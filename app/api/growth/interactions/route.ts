import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import {
  ensureGrowthGraphIndexes,
  InteractionInput,
  recordGrowthInteraction,
} from '@/lib/growth-graph'
import { mongoConfigured } from '@/lib/mongodb'

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ error: 'MongoDB persistence is not configured.' }, { status: 503 })
  }

  try {
    const body = await request.json() as InteractionInput
    await ensureGrowthGraphIndexes()
    const event = await recordGrowthInteraction(body)
    return NextResponse.json({ event })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not record interaction.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
