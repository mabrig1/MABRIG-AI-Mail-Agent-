import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import {
  ContactInput,
  ensureGrowthGraphIndexes,
  listGrowthContacts,
  upsertGrowthContact,
} from '@/lib/growth-graph'
import { mongoConfigured } from '@/lib/mongodb'

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ error: 'MongoDB persistence is not configured.' }, { status: 503 })
  }

  const url = new URL(request.url)
  const consentOnly = url.searchParams.get('consent') === 'true'
  const lifecycleStage = url.searchParams.get('stage') || undefined
  const limit = Number(url.searchParams.get('limit') || 100)

  try {
    await ensureGrowthGraphIndexes()
    const contacts = await listGrowthContacts({ consentOnly, lifecycleStage, limit })
    return NextResponse.json({ contacts })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load growth contacts.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ error: 'MongoDB persistence is not configured.' }, { status: 503 })
  }

  try {
    const body = await request.json() as ContactInput
    await ensureGrowthGraphIndexes()
    const result = await upsertGrowthContact(body)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save growth contact.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
