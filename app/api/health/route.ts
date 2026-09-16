import { NextResponse } from 'next/server'
import { checkMailServerReachability } from '@/lib/billionmail'
import { getAdminSession } from '@/lib/auth-server'
import { checkMongoReachability } from '@/lib/mongodb'

export async function GET() {
  const session = await getAdminSession()

  if (!session) {
    return NextResponse.json({
      ok: true,
      service: 'MABRIG AI Mail Agent',
      timestamp: new Date().toISOString(),
    })
  }

  const [mail, persistence] = await Promise.all([
    checkMailServerReachability(),
    checkMongoReachability(),
  ])
  return NextResponse.json({
    ok: true,
    service: 'MABRIG AI Mail Agent',
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(
      process.env.AI_GATEWAY_URL &&
      process.env.AI_GATEWAY_API_KEY &&
      process.env.AI_MODEL
    ),
    authConfigured: Boolean(
      process.env.AUTH_SECRET &&
      process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD_SHA256
    ),
    mailBridgeAuthConfigured: Boolean(
      process.env.BILLIONMAIL_API_TOKEN ||
      (process.env.BILLIONMAIL_USERNAME && process.env.BILLIONMAIL_PASSWORD)
    ),
    forwardingExecutionEnabled: process.env.FORWARDING_EXECUTION_ENABLED === 'true',
    persistence,
    mail,
  })
}
