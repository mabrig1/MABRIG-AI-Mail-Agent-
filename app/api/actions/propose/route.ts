import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { createApprovalToken, ProposedActionType } from '@/lib/approval'

const TYPES = new Set<ProposedActionType>([
  'send_email',
  'create_campaign',
  'create_mailbox',
  'change_mail_setting',
])

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body = await request.json() as { type?: ProposedActionType; summary?: string }
  if (!body.type || !TYPES.has(body.type) || !body.summary?.trim()) {
    return NextResponse.json({ error: 'Valid action type and summary are required.' }, { status: 400 })
  }

  const proposal = createApprovalToken(body.type, body.summary.trim())
  return NextResponse.json({
    ...proposal,
    status: 'awaiting-human-approval',
    executable: false,
  })
}
