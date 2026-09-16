import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { ensureGrowthGraphIndexes, getGrowthSegments } from '@/lib/growth-graph'
import { mongoConfigured } from '@/lib/mongodb'

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  if (!mongoConfigured()) {
    return NextResponse.json({
      configured: false,
      segments: [],
      message: 'MongoDB persistence is not configured.',
    })
  }

  try {
    await ensureGrowthGraphIndexes()
    const data = await getGrowthSegments()
    return NextResponse.json({ configured: true, ...data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not compute growth segments.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
