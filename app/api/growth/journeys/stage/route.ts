import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { createApprovalToken } from '@/lib/approval'
import {
  addAttributionToUrl,
  attributionConfigured,
  createAttributionToken,
} from '@/lib/attribution'
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

type StoredCampaignDraft = {
  subject: string
  preheader: string
  bodyText: string
  ctaText: string
  ctaUrl?: string
  html: string
  digest: string
}

function buildProposal(input: {
  journeyId: string
  title: string
  segmentKey: string
  segmentLabel: string
  objective: string
  campaignDraft: StoredCampaignDraft
  audienceCount: number
  audienceFingerprint: string
}) {
  const summary = [
    input.title,
    `Subject: ${input.campaignDraft.subject}`,
    `Audience: ${input.segmentLabel} (${input.audienceCount} currently permissioned approved contacts)`,
    `Objective: ${input.objective}`,
    '',
    input.campaignDraft.bodyText.slice(0, 500),
  ].join('\n')

  return createApprovalToken('create_campaign', summary, {
    journeyId: input.journeyId,
    segmentKey: input.segmentKey,
    audienceCount: String(input.audienceCount),
    audienceFingerprint: input.audienceFingerprint,
    campaignDigest: input.campaignDraft.digest,
  })
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

  const maxRecipients = Math.max(Number(process.env.CAMPAIGN_MAX_RECIPIENTS ?? 1000), 1)

  if (journey.status === 'approved-awaiting-executor') {
    const campaignDraft = journey.campaignDraft as StoredCampaignDraft | undefined
    const approvedHashes = new Set(
      Array.isArray(journey.approvedRecipientHashes)
        ? journey.approvedRecipientHashes.map(value => String(value))
        : [],
    )
    const audienceFingerprint = String(journey.approvedAudienceFingerprint || '')

    if (!campaignDraft?.digest || !approvedHashes.size || !audienceFingerprint) {
      return NextResponse.json(
        { error: 'Approved campaign snapshot is incomplete and cannot be re-staged safely.' },
        { status: 409 },
      )
    }

    const currentlyEligible = await getSegmentRecipients(String(journey.segmentKey || ''))
    const currentApprovedCount = currentlyEligible
      .map(recipientHash)
      .filter(hash => approvedHashes.has(hash)).length

    if (currentApprovedCount <= 0) {
      return NextResponse.json(
        { error: 'No recipients from the approved snapshot remain permissioned and eligible.' },
        { status: 409 },
      )
    }

    const proposal = buildProposal({
      journeyId: body.journeyId,
      title: String(journey.title || 'Growth campaign'),
      segmentKey: String(journey.segmentKey || ''),
      segmentLabel: String(journey.segmentLabel || ''),
      objective: String(journey.objective || ''),
      campaignDraft,
      audienceCount: currentApprovedCount,
      audienceFingerprint,
    })

    await updateGrowthJourneyStatus(body.journeyId, 'approval-staged', {
      approvalActionId: proposal.action.id,
      restagedAt: new Date(),
      stagedBy: session.email,
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
        ctaUrl: campaignDraft.ctaUrl,
        digest: campaignDraft.digest,
      },
      audienceCount: currentApprovedCount,
      restaged: true,
    })
  }

  if (journey.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only draft or approved-awaiting-executor journeys can be staged.' },
      { status: 409 },
    )
  }

  const recipients = await getSegmentRecipients(String(journey.segmentKey || ''))

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

  const defaultCtaUrl = process.env.CAMPAIGN_DEFAULT_CTA_URL?.trim() || ''
  const attributedCtaUrl =
    defaultCtaUrl && attributionConfigured()
      ? addAttributionToUrl(
          defaultCtaUrl,
          createAttributionToken(body.journeyId),
        )
      : undefined

  const campaignDraft = await composeCampaignDraft({
    title: String(journey.title || 'Growth campaign'),
    objective: String(journey.objective || ''),
    segmentLabel: String(journey.segmentLabel || ''),
    segmentDefinition: String(journey.segmentDefinition || ''),
    plan: String(journey.plan || ''),
    ctaUrl: attributedCtaUrl,
  })

  const recipientHashes = recipients.map(recipientHash).sort()
  const audienceFingerprint = fingerprint(recipientHashes)

  const proposal = buildProposal({
    journeyId: body.journeyId,
    title: String(journey.title || 'Growth campaign'),
    segmentKey: String(journey.segmentKey || ''),
    segmentLabel: String(journey.segmentLabel || ''),
    objective: String(journey.objective || ''),
    campaignDraft,
    audienceCount: recipients.length,
    audienceFingerprint,
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
