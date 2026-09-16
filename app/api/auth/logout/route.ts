import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

export async function POST(request: Request) {
  const store = await cookies()
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return NextResponse.redirect(new URL('/login', request.url), 303)
}
