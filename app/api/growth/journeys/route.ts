import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { listGrowthJourneys, scanGrowthAutopilot } from '@/lib/growth-autopilot'
import { mongoConfigured } from '@/lib/mongodb'

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ configured: false, journeys: [] })
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get('limit') || 20)

  try {
    const journeys = await listGrowthJourneys(limit)
    return NextResponse.json({
      configured: true,
      journeys: journeys.map(journey => ({
        ...journey,
        _id: journey._id.toString(),
      })),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load growth journeys.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json(
      { error: 'MongoDB persistence is required for Growth Autopilot.' },
      { status: 503 },
    )
  }

  try {
    const body = await request.json().catch(() => ({})) as { force?: boolean }
    const result = await scanGrowthAutopilot({ force: body.force === true })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Growth Autopilot scan failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
