import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { runAgent } from '@/lib/agent'

type GrowthPlanRequest = {
  businessName?: string
  product?: string
  audience?: string
  objective?: string
  offer?: string
  market?: string
  constraints?: string
}

function field(value: string | undefined, fallback = 'not supplied') {
  return value?.trim() || fallback
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body = await request.json() as GrowthPlanRequest

  if (!body.businessName?.trim() || !body.product?.trim() || !body.objective?.trim()) {
    return NextResponse.json(
      { error: 'Business name, product/service, and objective are required.' },
      { status: 400 },
    )
  }

  const context = [
    `Business: ${field(body.businessName)}`,
    `Product/service: ${field(body.product)}`,
    `Audience: ${field(body.audience)}`,
    `Business objective: ${field(body.objective)}`,
    `Current offer: ${field(body.offer)}`,
    `Market/location: ${field(body.market)}`,
    `Constraints: ${field(body.constraints)}`,
    '',
    'Use only supplied facts. Mark assumptions clearly. Prefer permission-based promotion, measurable actions, and practical low-cost experiments.',
  ].join('\n')

  const [promotion, growth, lifecycle, sales] = await Promise.all([
    runAgent('promotion', context),
    runAgent('growth', context),
    runAgent('lifecycle', context),
    runAgent('sales', context),
  ])

  return NextResponse.json({
    business: body.businessName.trim(),
    promotion,
    growth,
    lifecycle,
    sales,
    actionMode: 'approval-controlled',
  })
}
