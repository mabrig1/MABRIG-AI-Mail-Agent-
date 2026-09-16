import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { createApprovalToken } from '@/lib/approval'
import { composeCampaignDraft } from '@/lib/campaign-draft'
import { getGrowthJourney, updateGrowthJourneyStatus } from '@/lib/growth-autopilot'
import { getSegmentRecipients } from '@/lib/growth-graph'
import { mongoConfigured } from '@/lib/mongodb'

function recipientHash(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

function fingerprint(hashes: string[]) {
  return createHash('sha256').update(hashes.slice().sort().join('\n')).digest('hex')
}

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

  const recipients = await getSegmentRecipients(String(journey.segmentKey || ''))
  const maxRecipients = Math.max(Number(process.env.CAMPAIGN_MAX_RECIPIENTS ?? 1000), 1)

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: 'No currently permissioned recipients qualify for this journey.' },
      { status: 409 },
    )
  }

  if (recipients.length > maxRecipients) {
    return NextResponse.json(
      {
        error:
          `Eligible audience (${recipients.length}) exceeds CAMPAIGN_MAX_RECIPIENTS (${maxRecipients}).`,
      },
      { status: 409 },
    )
  }

  const campaignDraft = await composeCampaignDraft({
    title: String(journey.title || 'Growth campaign'),
    objective: String(journey.objective || ''),
    segmentLabel: String(journey.segmentLabel || ''),
    segmentDefinition: String(journey.segmentDefinition || ''),
    plan: String(journey.plan || ''),
  })

  const recipientHashes = recipients.map(recipientHash).sort()
  const audienceFingerprint = fingerprint(recipientHashes)

  const summary = [
    String(journey.title || 'Growth campaign'),
    `Subject: ${campaignDraft.subject}`,
    `Audience: ${journey.segmentLabel} (${recipients.length} currently permissioned contacts)`,
    `Objective: ${journey.objective}`,
    '',
    campaignDraft.bodyText.slice(0, 500),
  ].join('\n')

  const proposal = createApprovalToken('create_campaign', summary, {
    journeyId: body.journeyId,
    segmentKey: String(journey.segmentKey || ''),
    audienceCount: String(recipients.length),
    audienceFingerprint,
    campaignDigest: campaignDraft.digest,
  })

  await updateGrowthJourneyStatus(body.journeyId, 'approval-staged', {
    approvalActionId: proposal.action.id,
    stagedAt: new Date(),
    stagedBy: session.email,
    campaignDraft,
    approvedRecipientHashes: recipientHashes,
    approvedAudienceFingerprint: audienceFingerprint,
    approvedAudienceCount: recipients.length,
  })

  return NextResponse.json({
    ...proposal,
    status: 'awaiting-human-approval',
    executable: process.env.CAMPAIGN_EXECUTION_ENABLED === 'true',
    journeyId: body.journeyId,
    campaignDraft: {
      subject: campaignDraft.subject,
      preheader: campaignDraft.preheader,
      bodyText: campaignDraft.bodyText,
      ctaText: campaignDraft.ctaText,
      digest: campaignDraft.digest,
    },
    audienceCount: recipients.length,
  })
}
