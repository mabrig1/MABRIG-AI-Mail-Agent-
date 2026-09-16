import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import {
  syncCampaignIntelligence,
  syncCampaignIntelligenceBatch,
} from '@/lib/campaign-intelligence'
import { listGrowthJourneys } from '@/lib/growth-autopilot'
import { mongoConfigured } from '@/lib/mongodb'

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ configured: false, campaigns: [] })
  }

  const journeys = await listGrowthJourneys(50)
  const campaigns = journeys
    .filter(journey => {
      const billionMail = journey.billionMail as { taskId?: number } | undefined
      return Boolean(billionMail?.taskId)
    })
    .map(journey => ({
      _id: journey._id.toString(),
      title: journey.title,
      segmentLabel: journey.segmentLabel,
      status: journey.status,
      approvedAudienceCount: journey.approvedAudienceCount,
      campaignDraft: journey.campaignDraft,
      billionMail: journey.billionMail,
      economics: journey.economics,
      campaignIntelligence: journey.campaignIntelligence,
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt,
    }))

  return NextResponse.json({ configured: true, campaigns })
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ error: 'MongoDB persistence is not configured.' }, { status: 503 })
  }

  try {
    const body = await request.json().catch(() => ({})) as { journeyId?: string }
    if (body.journeyId) {
      const intelligence = await syncCampaignIntelligence(body.journeyId)
      return NextResponse.json({ synced: 1, intelligence })
    }

    const results = await syncCampaignIntelligenceBatch(30)
    return NextResponse.json({
      synced: results.filter(item => item.ok === true).length,
      failed: results.filter(item => item.ok !== true).length,
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Campaign intelligence sync failed.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
