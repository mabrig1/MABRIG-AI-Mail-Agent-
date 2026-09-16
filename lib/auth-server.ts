import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

export async function getAdminSession() {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

export async function requireAdmin() {
  const session = await getAdminSession()
  if (!session) redirect('/login')
  return session
}
