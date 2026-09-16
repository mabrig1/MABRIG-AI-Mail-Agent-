import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  authConfigured,
  createSessionToken,
  SESSION_COOKIE,
  sessionMaxAge,
  verifyAdminCredentials,
} from '@/lib/auth'

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json(
      { error: 'Admin authentication has not been configured.' },
      { status: 503 },
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const email = body.email?.trim() ?? ''
  const password = body.password ?? ''

  if (!email || !password || !verifyAdminCredentials(email, password)) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, createSessionToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: sessionMaxAge,
  })

  return NextResponse.json({ ok: true })
}
