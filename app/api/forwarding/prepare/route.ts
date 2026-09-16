import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { runAgent } from '@/lib/agent'
import { createApprovalToken } from '@/lib/approval'

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body = await request.json() as {
    recipient?: string
    message?: string
    purpose?: string
  }

  const recipient = body.recipient?.trim() ?? ''
  const message = body.message?.trim() ?? ''
  const purpose = body.purpose?.trim() ?? ''

  if (!validEmail(recipient)) {
    return NextResponse.json({ error: 'Enter a valid forwarding recipient.' }, { status: 400 })
  }

  if (!message) {
    return NextResponse.json({ error: 'Paste the email to be reviewed for forwarding.' }, { status: 400 })
  }

  const input = [
    `Forwarding destination: ${recipient}`,
    purpose ? `Purpose: ${purpose}` : 'Purpose: not specified',
    '',
    'Original email:',
    message,
  ].join('\n')

  const analysis = await runAgent('forward', input)
  const proposal = createApprovalToken(
    'forward_email',
    analysis,
    {
      recipient,
      purpose: purpose || 'not specified',
    },
  )

  return NextResponse.json({
    analysis,
    proposal,
    status: 'awaiting-human-approval',
    executed: false,
  })
}
