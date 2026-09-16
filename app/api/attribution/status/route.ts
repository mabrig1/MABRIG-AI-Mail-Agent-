import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { attributionConfigured } from '@/lib/attribution'

export async function GET() {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  return NextResponse.json({
    configured: attributionConfigured(),
    sdkPath: '/mabrig-attribution.js',
    queryParameter: 'mabrig_attribution',
    ttlDays: Math.min(
      Math.max(Number(process.env.ATTRIBUTION_TOKEN_TTL_DAYS ?? 30), 1),
      90,
    ),
    defaultCampaignUrlConfigured: Boolean(process.env.CAMPAIGN_DEFAULT_CTA_URL),
    unsignedProviderAttributionAllowed:
      process.env.ALLOW_UNSIGNED_PROVIDER_ATTRIBUTION === 'true',
  })
}
