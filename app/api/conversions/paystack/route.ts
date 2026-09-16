import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import {
  extractProduct,
  resolveProviderCampaignId,
  ingestConversionEvent,
} from '@/lib/conversion-ingestion'
import { mongoConfigured } from '@/lib/mongodb'

function validSignature(raw: string, supplied: string, secret: string) {
  const expected = createHmac('sha512', secret).update(raw).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(supplied.trim().toLowerCase(), 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return NextResponse.json({ error: 'PAYSTACK_SECRET_KEY is not configured.' }, { status: 503 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ error: 'MongoDB persistence is required.' }, { status: 503 })
  }

  const raw = await request.text()
  const signature = request.headers.get('x-paystack-signature') || ''

  if (!signature || !validSignature(raw, signature, secret)) {
    return NextResponse.json({ error: 'Invalid Paystack signature.' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(raw) as {
      event?: string
      data?: {
        id?: number | string
        status?: string
        reference?: string
        amount?: number | string
        currency?: string
        paid_at?: string
        created_at?: string
        metadata?: unknown
        customer?: {
          email?: string
          first_name?: string
          last_name?: string
        }
      }
    }

    const data = payload.data
    if (payload.event !== 'charge.success' || data?.status !== 'success') {
      return NextResponse.json({ received: true, ignored: true })
    }

    const email = data.customer?.email?.trim() || ''
    if (!email) {
      return NextResponse.json({ received: true, ignored: true, reason: 'missing-customer-email' })
    }

    const reference = String(data.reference || data.id || '').trim()
    if (!reference) {
      return NextResponse.json({ received: true, ignored: true, reason: 'missing-reference' })
    }

    const divisor = Math.max(Number(process.env.PAYSTACK_AMOUNT_DIVISOR ?? 100), 1)
    const rawAmount = Number(data.amount ?? 0)
    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      return NextResponse.json({ received: true, ignored: true, reason: 'invalid-amount' })
    }

    const name = [data.customer?.first_name, data.customer?.last_name]
      .map(value => value?.trim())
      .filter(Boolean)
      .join(' ')

    const result = await ingestConversionEvent({
      provider: 'paystack',
      eventKey: reference,
      type: 'purchase',
      email,
      name: name || undefined,
      amount: Number((rawAmount / divisor).toFixed(2)),
      currency: data.currency,
      campaignId: resolveProviderCampaignId(data.metadata),
      product: extractProduct(data.metadata),
      reference,
      occurredAt: data.paid_at || data.created_at,
      providerVerified: true,
      source: 'paystack:charge.success',
    })

    return NextResponse.json({ received: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Paystack conversion ingestion failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
