import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { scanGrowthAutopilot } from '@/lib/growth-autopilot'
import { mongoConfigured } from '@/lib/mongodb'

function schedulerSecret() {
  return process.env.CRON_SECRET || process.env.AUTOPILOT_CRON_SECRET || ''
}

function authorised(request: Request) {
  const secret = schedulerSecret()
  if (!secret) return false

  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get('authorization') || '')

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function GET(request: Request) {
  if (!schedulerSecret()) {
    return NextResponse.json(
      { error: 'CRON_SECRET or AUTOPILOT_CRON_SECRET is not configured.' },
      { status: 503 },
    )
  }

  if (!authorised(request)) {
    return NextResponse.json({ error: 'Invalid scheduler credential.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json(
      { error: 'MongoDB persistence is required for scheduled Growth Autopilot scans.' },
      { status: 503 },
    )
  }

  try {
    const result = await scanGrowthAutopilot({ force: false })
    return NextResponse.json({
      ok: true,
      mode: 'draft-generation-only',
      ...result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scheduled Growth Autopilot scan failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
