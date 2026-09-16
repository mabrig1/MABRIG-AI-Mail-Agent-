import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import {
  extractProduct,
  resolveProviderCampaignId,
  ingestConversionEvent,
} from '@/lib/conversion-ingestion'
import { mongoConfigured } from '@/lib/mongodb'

function secureEqual(expected: string, actual: string) {
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(actual, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

function metadataCandidates(payload: Record<string, unknown>, data: Record<string, unknown>) {
  return [
    data.meta,
    data.meta_data,
    payload.meta,
    payload.meta_data,
  ]
}

export async function POST(request: Request) {
  const secret = process.env.FLUTTERWAVE_SECRET_HASH
  if (!secret) {
    return NextResponse.json(
      { error: 'FLUTTERWAVE_SECRET_HASH is not configured.' },
      { status: 503 },
    )
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ error: 'MongoDB persistence is required.' }, { status: 503 })
  }

  const supplied = request.headers.get('verif-hash') || ''
  if (!supplied || !secureEqual(secret, supplied)) {
    return NextResponse.json({ error: 'Invalid Flutterwave webhook hash.' }, { status: 401 })
  }

  try {
    const payload = await request.json() as Record<string, unknown>
    const eventType = String(payload.event || payload.type || '')
    const data = (
      payload.data && typeof payload.data === 'object'
        ? payload.data
        : {}
    ) as Record<string, unknown>

    if (eventType !== 'charge.completed' || String(data.status || '') !== 'successful') {
      return NextResponse.json({ received: true, ignored: true })
    }

    const customer = (
      data.customer && typeof data.customer === 'object'
        ? data.customer
        : {}
    ) as Record<string, unknown>

    const email = String(customer.email || '').trim()
    if (!email) {
      return NextResponse.json({ received: true, ignored: true, reason: 'missing-customer-email' })
    }

    const reference = String(data.tx_ref || data.flw_ref || data.id || '').trim()
    if (!reference) {
      return NextResponse.json({ received: true, ignored: true, reason: 'missing-reference' })
    }

    const amount = Number(data.amount ?? 0)
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ received: true, ignored: true, reason: 'invalid-amount' })
    }

    const candidates = metadataCandidates(payload, data)
    const campaignId = candidates
      .map(resolveProviderCampaignId)
      .find(Boolean)
    const product = candidates
      .map(extractProduct)
      .find(Boolean)

    const nameValue = customer.name
    const name = typeof nameValue === 'string'
      ? nameValue.trim()
      : nameValue && typeof nameValue === 'object'
        ? [
            String((nameValue as Record<string, unknown>).first || '').trim(),
            String((nameValue as Record<string, unknown>).middle || '').trim(),
            String((nameValue as Record<string, unknown>).last || '').trim(),
          ].filter(Boolean).join(' ')
        : ''

    const result = await ingestConversionEvent({
      provider: 'flutterwave',
      eventKey: String(payload.webhook_id || data.id || reference),
      type: 'purchase',
      email,
      name: name || undefined,
      amount: Number(amount.toFixed(2)),
      currency: String(data.currency || ''),
      campaignId,
      product,
      reference,
      occurredAt: String(data.created_at || '') || undefined,
      providerVerified: true,
      source: 'flutterwave:charge.completed',
    })

    return NextResponse.json({ received: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Flutterwave conversion ingestion failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
