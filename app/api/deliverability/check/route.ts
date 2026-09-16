import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth-server'
import { checkDeliverability } from '@/lib/deliverability'

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const domain = url.searchParams.get('domain') ?? ''

  try {
    const result = await checkDeliverability(domain)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DNS check failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
