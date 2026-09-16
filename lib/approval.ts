import { createHmac, randomUUID, timingSafeEqual } from 'crypto'

export type ProposedActionType =
  | 'send_email'
  | 'forward_email'
  | 'create_forward_rule'
  | 'create_campaign'
  | 'create_mailbox'
  | 'change_mail_setting'

export type ProposedAction = {
  id: string
  type: ProposedActionType
  summary: string
  details?: Record<string, string>
  createdAt: number
  expiresAt: number
}

function approvalSecret() {
  return process.env.APPROVAL_SECRET || process.env.AUTH_SECRET || ''
}

function sign(payload: string) {
  return createHmac('sha256', approvalSecret()).update(payload).digest('base64url')
}

function equal(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function createApprovalToken(
  type: ProposedActionType,
  summary: string,
  details?: Record<string, string>,
) {
  if (!approvalSecret()) throw new Error('APPROVAL_SECRET or AUTH_SECRET is required')
  const now = Math.floor(Date.now() / 1000)
  const action: ProposedAction = {
    id: randomUUID(),
    type,
    summary: summary.slice(0, 1000),
    details,
    createdAt: now,
    expiresAt: now + 15 * 60,
  }
  const payload = Buffer.from(JSON.stringify(action)).toString('base64url')
  return { action, token: `${payload}.${sign(payload)}` }
}

export function verifyApprovalToken(token: string): ProposedAction | null {
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !approvalSecret()) return null
  if (!equal(signature, sign(payload))) return null

  try {
    const action = JSON.parse(Buffer.from(payload, 'base64url').toString()) as ProposedAction
    if (!action.id || !action.type || action.expiresAt <= Math.floor(Date.now() / 1000)) return null
    return action
  } catch {
    return null
  }
}
