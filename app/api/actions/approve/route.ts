import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { verifyApprovalToken } from '@/lib/approval'

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body = await request.json() as { token?: string }
  const action = body.token ? verifyApprovalToken(body.token) : null

  if (!action) {
    return NextResponse.json({ error: 'Approval token is invalid or expired.' }, { status: 400 })
  }

  // Deliberately no external side-effect yet. Real executors will be added per action type.
  return NextResponse.json({
    approved: true,
    executed: false,
    action,
    message: 'Human approval recorded. No external mail action is wired to this endpoint yet.',
  })
}
