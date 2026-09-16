import {
  getMarketingTaskInfo,
  getMarketingTaskStats,
} from '@/lib/billionmail'
import {
  getGrowthJourney,
  listGrowthJourneys,
  patchGrowthJourney,
  updateGrowthJourneyStatus,
} from '@/lib/growth-autopilot'
import { getCampaignAttributionSummary } from '@/lib/growth-graph'

function taskStatus(processValue: number, paused: number) {
  if (paused === 1 || processValue === 3) return 'paused'
  if (processValue === 2) return 'completed'
  if (processValue === 1) return 'running'
  return 'queued'
}

function directRoas(
  spend: { amount?: number; currency?: string } | undefined,
  revenueByCurrency: Record<string, number>,
) {
  const amount = Number(spend?.amount ?? 0)
  const currency = String(spend?.currency || '').trim().toUpperCase()
  if (!Number.isFinite(amount) || amount <= 0 || !currency) return null

  const revenue = Number(revenueByCurrency[currency] ?? 0)
  return {
    currency,
    spend: Number(amount.toFixed(2)),
    directlyAttributedRevenue: Number(revenue.toFixed(2)),
    roas: Number((revenue / amount).toFixed(3)),
    revenueMinusCampaignSpend: Number((revenue - amount).toFixed(2)),
    note:
      'ROAS uses explicitly attributed revenue divided by recorded campaign spend. It is not profit ROI and does not include cost of goods, labour, tax, or overhead.',
  }
}

export async function syncCampaignIntelligence(journeyId: string) {
  const journey = await getGrowthJourney(journeyId)
  if (!journey) throw new Error('Growth journey was not found.')

  const billionMail = journey.billionMail as {
    taskId?: number
    scheduledStartTime?: number
    recipientCount?: number
    sender?: string
  } | undefined

  const taskId = Number(billionMail?.taskId ?? 0)
  if (!Number.isInteger(taskId) || taskId <= 0) {
    throw new Error('This journey does not have a BillionMail campaign task.')
  }

  const [info, stats] = await Promise.all([
    getMarketingTaskInfo(taskId),
    getMarketingTaskStats(
      taskId,
      Number(billionMail?.scheduledStartTime ?? 0),
      Math.floor(Date.now() / 1000),
    ),
  ])

  const startSeconds = Number(
    billionMail?.scheduledStartTime ??
    info.start_time ??
    Math.floor(Date.now() / 1000),
  )
  const startedAt = new Date(Math.max(startSeconds, 0) * 1000)
  const approvedRecipientHashes = Array.isArray(journey.approvedRecipientHashes)
    ? journey.approvedRecipientHashes.map(value => String(value))
    : []

  const attribution = await getCampaignAttributionSummary({
    journeyId,
    taskId,
    approvedRecipientHashes,
    startedAt,
    windowDays: Number(process.env.CAMPAIGN_ATTRIBUTION_WINDOW_DAYS ?? 14),
  })

  const economics = journey.economics as {
    spend?: { amount?: number; currency?: string; note?: string }
  } | undefined

  const campaignDraft = journey.campaignDraft as { subject?: string } | undefined
  const status = taskStatus(Number(info.task_process ?? 0), Number(info.pause ?? 0))
  const intelligence = {
    taskId,
    taskStatus: status,
    taskProcess: Number(info.task_process ?? 0),
    recipientCount: Number(info.recipient_count ?? billionMail?.recipientCount ?? 0),
    subject: String(info.subject || campaignDraft?.subject || ''),
    sender: String(info.addresser || billionMail?.sender || ''),
    syncedAt: new Date(),
    metrics: stats,
    attribution,
    economics: {
      spend: economics?.spend ?? null,
      directRoas: directRoas(economics?.spend, attribution.direct.revenueByCurrency),
    },
  }

  await patchGrowthJourney(journeyId, { campaignIntelligence: intelligence })

  if (status === 'completed' && journey.status === 'scheduled') {
    await updateGrowthJourneyStatus(journeyId, 'completed', {
      completedAt: new Date(),
      campaignIntelligence: intelligence,
    })
  }

  return intelligence
}

export async function syncCampaignIntelligenceBatch(limit = 20) {
  const journeys = await listGrowthJourneys(Math.min(Math.max(limit, 1), 100))
  const candidates = journeys.filter(journey => {
    const billionMail = journey.billionMail as { taskId?: number } | undefined
    return Boolean(billionMail?.taskId) && ['scheduled', 'completed'].includes(String(journey.status))
  })

  const results: Array<Record<string, unknown>> = []
  for (const journey of candidates) {
    const id = journey._id.toString()
    try {
      const intelligence = await syncCampaignIntelligence(id)
      results.push({ journeyId: id, ok: true, intelligence })
    } catch (error) {
      results.push({
        journeyId: id,
        ok: false,
        error: error instanceof Error ? error.message : 'Campaign intelligence sync failed.',
      })
    }
  }

  return results
}

export async function recordCampaignSpend(input: {
  journeyId: string
  amount: number
  currency: string
  note?: string
}) {
  const journey = await getGrowthJourney(input.journeyId)
  if (!journey) throw new Error('Growth journey was not found.')

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Campaign spend must be a valid non-negative number.')

  const currency = input.currency.trim().toUpperCase()
  if (!/^[A-Z]{3,12}$/.test(currency)) throw new Error('Enter a valid campaign-spend currency code.')

  const spend = {
    amount: Number(amount.toFixed(2)),
    currency,
    note: input.note?.trim().slice(0, 300) || undefined,
    updatedAt: new Date(),
  }

  const currentEconomics = (
    typeof journey.economics === 'object' && journey.economics
      ? journey.economics
      : {}
  ) as Record<string, unknown>

  await patchGrowthJourney(input.journeyId, {
    economics: {
      ...currentEconomics,
      spend,
    },
  })

  return spend
}
