import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { getGrowthJourney, updateGrowthJourneyStatus } from '@/lib/growth-autopilot'
import { mongoConfigured } from '@/lib/mongodb'

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ error: 'MongoDB persistence is not configured.' }, { status: 503 })
  }

  const body = await request.json() as { journeyId?: string }
  if (!body.journeyId) {
    return NextResponse.json({ error: 'journeyId is required.' }, { status: 400 })
  }

  const journey = await getGrowthJourney(body.journeyId)
  if (!journey) {
    return NextResponse.json({ error: 'Growth journey was not found.' }, { status: 404 })
  }

  if (journey.status === 'approved-awaiting-executor') {
    return NextResponse.json(
      { error: 'An approved journey cannot be dismissed from the draft workspace.' },
      { status: 409 },
    )
  }

  const updated = await updateGrowthJourneyStatus(body.journeyId, 'dismissed', {
    dismissedAt: new Date(),
    dismissedBy: session.email,
  })

  return NextResponse.json({
    dismissed: true,
    journey: updated ? { ...updated, _id: updated._id.toString() } : null,
  })
}
