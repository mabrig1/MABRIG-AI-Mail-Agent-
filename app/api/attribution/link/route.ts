import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import {
  addAttributionToUrl,
  attributionConfigured,
  createAttributionToken,
} from '@/lib/attribution'
import { getGrowthJourney } from '@/lib/growth-autopilot'

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!attributionConfigured()) {
    return NextResponse.json(
      { error: 'ATTRIBUTION_SECRET is not configured.' },
      { status: 503 },
    )
  }

  try {
    const body = await request.json() as { journeyId?: string; url?: string }
    if (!body.journeyId || !body.url) {
      return NextResponse.json(
        { error: 'journeyId and url are required.' },
        { status: 400 },
      )
    }

    const journey = await getGrowthJourney(body.journeyId)
    if (!journey) {
      return NextResponse.json({ error: 'Growth journey was not found.' }, { status: 404 })
    }

    const token = createAttributionToken(body.journeyId)
    const attributedUrl = addAttributionToUrl(body.url, token)

    return NextResponse.json({
      journeyId: body.journeyId,
      attributedUrl,
      parameter: 'mabrig_attribution',
      expiresInDays: Math.min(
        Math.max(Number(process.env.ATTRIBUTION_TOKEN_TTL_DAYS ?? 30), 1),
        90,
      ),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create attributed link.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
