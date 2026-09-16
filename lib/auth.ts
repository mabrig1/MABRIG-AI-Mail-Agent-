import { createHash, createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE = 'mabrig_admin_session'
const SESSION_TTL_SECONDS = 60 * 60 * 8

type SessionPayload = {
  email: string
  exp: number
}

function secret() {
  return process.env.AUTH_SECRET ?? ''
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function signature(encodedPayload: string) {
  return createHmac('sha256', secret()).update(encodedPayload).digest('base64url')
}

export function authConfigured() {
  return Boolean(secret() && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_SHA256)
}

export function verifyAdminCredentials(email: string, password: string) {
  if (!authConfigured()) return false
  const expectedEmail = process.env.ADMIN_EMAIL!.trim().toLowerCase()
  const submittedEmail = email.trim().toLowerCase()
  const submittedHash = createHash('sha256').update(password).digest('hex')

  return (
    safeEqual(submittedEmail, expectedEmail) &&
    safeEqual(submittedHash, process.env.ADMIN_PASSWORD_SHA256!.trim().toLowerCase())
  )
}

export function createSessionToken(email: string) {
  if (!secret()) throw new Error('AUTH_SECRET is not configured')
  const payload: SessionPayload = {
    email: email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${signature(encoded)}`
}

export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token || !secret()) return null
  const [encoded, suppliedSignature] = token.split('.')
  if (!encoded || !suppliedSignature) return null

  const expected = signature(encoded)
  if (!safeEqual(suppliedSignature, expected)) return null

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload
    if (!payload.email || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export const sessionMaxAge = SESSION_TTL_SECONDS
