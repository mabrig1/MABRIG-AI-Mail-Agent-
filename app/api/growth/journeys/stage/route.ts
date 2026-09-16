import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { createApprovalToken } from '@/lib/approval'
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

  if (journey.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft journeys can be staged for approval.' },
      { status: 409 },
    )
  }

  const summary = [
    journey.title,
    `Audience: ${journey.segmentLabel} (${journey.audienceCount} eligible contacts)`,
    `Objective: ${journey.objective}`,
    '',
    String(journey.plan || '').slice(0, 700),
  ].join('\n')

  const proposal = createApprovalToken('create_campaign', summary, {
    journeyId: body.journeyId,
    segmentKey: String(journey.segmentKey || ''),
    audienceCount: String(journey.audienceCount || 0),
  })

  await updateGrowthJourneyStatus(body.journeyId, 'approval-staged', {
    approvalActionId: proposal.action.id,
    stagedAt: new Date(),
    stagedBy: session.email,
  })

  return NextResponse.json({
    ...proposal,
    status: 'awaiting-human-approval',
    executable: false,
    journeyId: body.journeyId,
  })
}
