import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { ensureGrowthGraphIndexes, listTopOpportunities } from '@/lib/growth-graph'
import { mongoConfigured } from '@/lib/mongodb'

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({ configured: false, opportunities: [] })
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get('limit') || 12)

  try {
    await ensureGrowthGraphIndexes()
    const opportunities = await listTopOpportunities(limit)
    return NextResponse.json({ configured: true, opportunities })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load opportunities.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
