import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { verifyApprovalToken } from '@/lib/approval'
import {
  claimApprovalExecution,
  markApprovalExecuted,
  markApprovalFailed,
} from '@/lib/execution-store'
import { writeAuditEvent } from '@/lib/audit'
import {
  executeForwardingAction,
  FORWARDING_RULE_ACTIONS,
} from '@/lib/forwarding-executor'

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body = await request.json() as { token?: string }
  const action = body.token ? verifyApprovalToken(body.token) : null

  if (!action) {
    await writeAuditEvent({
      actor: session.email,
      actionType: 'unknown',
      outcome: 'rejected',
      detail: 'Invalid or expired approval token',
    })
    return NextResponse.json({ error: 'Approval token is invalid or expired.' }, { status: 400 })
  }

  await writeAuditEvent({
    actor: session.email,
    actionId: action.id,
    actionType: action.type,
    outcome: 'approved',
    resource: action.details?.address || action.details?.recipient,
  })

  if (FORWARDING_RULE_ACTIONS.has(action.type)) {
    if (process.env.FORWARDING_EXECUTION_ENABLED !== 'true') {
      await writeAuditEvent({
        actor: session.email,
        actionId: action.id,
        actionType: action.type,
        outcome: 'not-executed',
        resource: action.details?.address,
        detail: 'FORWARDING_EXECUTION_ENABLED is not true',
      })

      return NextResponse.json({
        approved: true,
        executed: false,
        action,
        message:
          'Approval recorded. Forwarding execution is disabled until FORWARDING_EXECUTION_ENABLED=true.',
      })
    }

    let claimed = false
    try {
      claimed = await claimApprovalExecution(action, session.email)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not claim approval execution.'
      await writeAuditEvent({
        actor: session.email,
        actionId: action.id,
        actionType: action.type,
        outcome: 'failed',
        resource: action.details?.address,
        detail: message,
      })
      return NextResponse.json({ error: message }, { status: 503 })
    }

    if (!claimed) {
      await writeAuditEvent({
        actor: session.email,
        actionId: action.id,
        actionType: action.type,
        outcome: 'rejected',
        resource: action.details?.address,
        detail: 'Duplicate approval execution attempt',
      })
      return NextResponse.json(
        { error: 'This approval is already executing or has already been executed.' },
        { status: 409 },
      )
    }

    try {
      const result = await executeForwardingAction(action)
      await markApprovalExecuted(action)

      await writeAuditEvent({
        actor: session.email,
        actionId: action.id,
        actionType: action.type,
        outcome: 'executed',
        resource: result.resource,
        detail: result.operation,
      })

      return NextResponse.json({
        approved: true,
        executed: true,
        action,
        result,
        message: `Forwarding rule ${result.operation} successfully.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Forwarding action failed.'
      await markApprovalFailed(action, message)

      await writeAuditEvent({
        actor: session.email,
        actionId: action.id,
        actionType: action.type,
        outcome: 'failed',
        resource: action.details?.address,
        detail: message,
      })

      return NextResponse.json({ approved: true, executed: false, error: message }, { status: 502 })
    }
  }

  if (action.type === 'forward_email') {
    await writeAuditEvent({
      actor: session.email,
      actionId: action.id,
      actionType: action.type,
      outcome: 'not-executed',
      resource: action.details?.recipient,
      detail: 'One-time message forwarding executor is not connected',
    })

    return NextResponse.json({
      approved: true,
      executed: false,
      action,
      message:
        'Forward approved, but one-time message forwarding remains disabled until a verified message-send executor is connected.',
    })
  }

  await writeAuditEvent({
    actor: session.email,
    actionId: action.id,
    actionType: action.type,
    outcome: 'not-executed',
    detail: 'No executor registered for action type',
  })

  return NextResponse.json({
    approved: true,
    executed: false,
    action,
    message: 'Human approval recorded. No external executor is registered for this action yet.',
  })
}
