import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { listAllMailForwards } from '@/lib/billionmail'

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const domain = url.searchParams.get('domain')?.trim() || process.env.MAIL_DOMAIN || undefined

  try {
    const rules = await listAllMailForwards(domain)
    return NextResponse.json({ rules, domain: domain ?? null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load forwarding rules.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
