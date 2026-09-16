import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { ingestConversionEvent } from '@/lib/conversion-ingestion'
import { mongoConfigured } from '@/lib/mongodb'

const allowedTypes = new Set([
  'purchase',
  'quote_request',
  'email_reply',
  'referral',
  'pricing_visit',
])

function secureEqualHex(expected: string, actual: string) {
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(actual, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const secret = process.env.CONVERSION_INGEST_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CONVERSION_INGEST_SECRET is not configured.' },
      { status: 503 },
    )
  }

  if (!mongoConfigured()) {
    return NextResponse.json(
      { error: 'MongoDB persistence is required for conversion ingestion.' },
      { status: 503 },
    )
  }

  const raw = await request.text()
  if (Buffer.byteLength(raw, 'utf8') > 32_768) {
    return NextResponse.json({ error: 'Conversion payload is too large.' }, { status: 413 })
  }

  const supplied = request.headers.get('x-mabrig-signature')?.trim().toLowerCase() || ''
  const expected = createHmac('sha256', secret).update(raw).digest('hex')

  if (!supplied || !secureEqualHex(expected, supplied)) {
    return NextResponse.json({ error: 'Invalid conversion signature.' }, { status: 401 })
  }

  try {
    const body = JSON.parse(raw) as {
      id?: string
      type?: string
      email?: string
      name?: string
      amount?: number
      currency?: string
      campaignId?: string
      product?: string
      reference?: string
      occurredAt?: string
      source?: string
    }

    if (!body.id || !body.email || !body.type || !allowedTypes.has(body.type)) {
      return NextResponse.json(
        { error: 'id, email and a supported conversion type are required.' },
        { status: 400 },
      )
    }

    if (body.type === 'purchase' && (!Number.isFinite(Number(body.amount)) || Number(body.amount) < 0)) {
      return NextResponse.json(
        { error: 'A valid non-negative amount is required for purchase events.' },
        { status: 400 },
      )
    }

    const result = await ingestConversionEvent({
      provider: 'generic',
      eventKey: body.id,
      type: body.type as 'purchase' | 'quote_request' | 'email_reply' | 'referral' | 'pricing_visit',
      email: body.email,
      name: body.name,
      amount: body.type === 'purchase' ? Number(body.amount) : undefined,
      currency: body.currency,
      campaignId: body.campaignId,
      product: body.product,
      reference: body.reference,
      occurredAt: body.occurredAt,
      providerVerified: true,
      source: body.source?.trim().slice(0, 120) || 'generic:conversion',
    })

    return NextResponse.json({ received: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversion ingestion failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
