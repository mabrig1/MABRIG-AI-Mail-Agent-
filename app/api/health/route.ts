import { NextResponse } from 'next/server'
import { checkMailServerReachability } from '@/lib/billionmail'

export async function GET() {
  const mail = await checkMailServerReachability()
  return NextResponse.json({
    ok: true,
    service: 'MABRIG AI Mail Agent',
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(process.env.AI_GATEWAY_URL && process.env.AI_GATEWAY_API_KEY && process.env.AI_MODEL),
    mail,
  })
}
