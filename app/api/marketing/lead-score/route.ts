import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { LeadSignals, scoreLead } from '@/lib/lead-score'
import { runAgent } from '@/lib/agent'

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body = await request.json() as {
    leadLabel?: string
    context?: string
    signals?: LeadSignals
  }

  const signals = body.signals ?? {}
  const assessment = scoreLead(signals)

  const aiInput = [
    `Lead label: ${body.leadLabel?.trim() || 'unnamed lead'}`,
    `Context: ${body.context?.trim() || 'not supplied'}`,
    `Deterministic score: ${assessment.score}/100`,
    `Band: ${assessment.band}`,
    `Reasons: ${assessment.reasons.join('; ') || 'No positive intent signals supplied'}`,
    `Baseline next action: ${assessment.nextBestAction}`,
    '',
    'Recommend a cautious next-best action and a short follow-up message. Do not infer demographic traits, wealth, or intent beyond the supplied signals.',
  ].join('\n')

  const recommendation = await runAgent('sales', aiInput)

  return NextResponse.json({
    assessment,
    recommendation,
  })
}
