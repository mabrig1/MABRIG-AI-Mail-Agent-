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
    campaignExecution: {
      enabled: process.env.CAMPAIGN_EXECUTION_ENABLED === 'true',
      senderConfigured: Boolean(process.env.CAMPAIGN_SENDER),
      maxRecipients: Math.max(Number(process.env.CAMPAIGN_MAX_RECIPIENTS ?? 1000), 1),
      dnsPassRequired: process.env.CAMPAIGN_REQUIRE_DNS_PASS !== 'false',
      startDelaySeconds: Math.max(Number(process.env.CAMPAIGN_START_DELAY_SECONDS ?? 300), 60),
    },
    growthAutopilot: {
      cooldownDays: Math.max(Number(process.env.GROWTH_AUTOPILOT_COOLDOWN_DAYS ?? 7), 1),
      schedulerSecretConfigured: Boolean(
        process.env.CRON_SECRET || process.env.AUTOPILOT_CRON_SECRET
      ),
      scheduledPath: '/api/growth/journeys/autoscan',
    },
    persistence,
    mail,
  })
}
