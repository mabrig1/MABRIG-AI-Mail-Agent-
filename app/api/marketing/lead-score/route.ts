import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { LeadSignals, scoreLead } from '@/lib/lead-score'
import { runAgent } from '@/lib/agent'
import { ensureGrowthGraphIndexes, saveOpportunityAssessment } from '@/lib/growth-graph'
import { mongoConfigured } from '@/lib/mongodb'

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body = await request.json() as {
    leadLabel?: string
    contactEmail?: string
    context?: string
    signals?: LeadSignals
  }

  const signals = body.signals ?? {}
  const assessment = scoreLead(signals)

  const aiInput = [
    `Lead label: ${body.leadLabel?.trim() || 'unnamed lead'}`,
    `Contact email: ${body.contactEmail?.trim() || 'not supplied'}`,
    `Context: ${body.context?.trim() || 'not supplied'}`,
    `Deterministic score: ${assessment.score}/100`,
    `Band: ${assessment.band}`,
    `Reasons: ${assessment.reasons.join('; ') || 'No positive intent signals supplied'}`,
    `Baseline next action: ${assessment.nextBestAction}`,
    '',
    'Recommend a cautious next-best action and a short follow-up message. Do not infer demographic traits, wealth, or intent beyond the supplied signals.',
  ].join('\n')

  const recommendation = await runAgent('sales', aiInput)

  let persisted = false
  let persistenceWarning: string | undefined

  if (body.contactEmail?.trim() && mongoConfigured()) {
    try {
      await ensureGrowthGraphIndexes()
      await saveOpportunityAssessment({
        email: body.contactEmail,
        label: body.leadLabel,
        score: assessment.score,
        band: assessment.band,
        reasons: assessment.reasons,
        nextBestAction: assessment.nextBestAction,
        recommendation,
      })
      persisted = true
    } catch (error) {
      persistenceWarning = error instanceof Error ? error.message : 'Opportunity could not be persisted.'
    }
  }

  return NextResponse.json({
    assessment,
    recommendation,
    persisted,
    persistenceWarning,
  })
}
