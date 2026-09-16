import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import {
  getConversionNetworkSummary,
  listRecentConversionEvents,
} from '@/lib/conversion-ingestion'
import { mongoConfigured } from '@/lib/mongodb'

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const configured = mongoConfigured()
  const integrations = {
    generic: Boolean(process.env.CONVERSION_INGEST_SECRET),
    paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
    flutterwave: Boolean(process.env.FLUTTERWAVE_SECRET_HASH),
  }

  if (!configured) {
    return NextResponse.json({
      configured: false,
      integrations,
      events: [],
    })
  }

  try {
    const [events, network] = await Promise.all([
      listRecentConversionEvents(40),
      getConversionNetworkSummary(),
    ])
    return NextResponse.json({
      configured: true,
      integrations,
      network: network.map(source => ({
        ...source,
        lastEventAt: source.lastEventAt?.toISOString() ?? null,
      })),
      endpoints: {
        generic: '/api/conversions/generic',
        paystack: '/api/conversions/paystack',
        flutterwave: '/api/conversions/flutterwave',
      },
      events: events.map(event => ({
        ...event,
        _id: event._id.toString(),
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load conversion gateway status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
