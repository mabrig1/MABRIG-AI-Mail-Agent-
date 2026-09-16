import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { recordCampaignSpend, syncCampaignIntelligence } from '@/lib/campaign-intelligence'
import { mongoConfigured } from '@/lib/mongodb'

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ error: 'MongoDB persistence is not configured.' }, { status: 503 })
  }

  try {
    const body = await request.json() as {
      journeyId?: string
      amount?: number
      currency?: string
      note?: string
    }

    if (!body.journeyId) {
      return NextResponse.json({ error: 'journeyId is required.' }, { status: 400 })
    }

    const spend = await recordCampaignSpend({
      journeyId: body.journeyId,
      amount: Number(body.amount ?? 0),
      currency: body.currency || 'NGN',
      note: body.note,
    })

    let intelligence = null
    try {
      intelligence = await syncCampaignIntelligence(body.journeyId)
    } catch {
      // Spend can be recorded even when the mail bridge is temporarily unavailable.
    }

    return NextResponse.json({ spend, intelligence })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not record campaign spend.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
