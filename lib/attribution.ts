import { createHmac, timingSafeEqual } from 'crypto'

export type AttributionClaims = {
  campaignId: string
  issuedAt: number
  expiresAt: number
}

function secret() {
  return process.env.ATTRIBUTION_SECRET?.trim() || ''
}

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string, key: string) {
  return createHmac('sha256', key).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function cleanCampaignId(value: string) {
  const result = value.trim().slice(0, 120)
  if (!result || !/^[A-Za-z0-9:_-]+$/.test(result)) {
    throw new Error('Invalid campaign attribution identifier.')
  }
  return result
}

export function attributionConfigured() {
  return Boolean(secret())
}

export function createAttributionToken(
  campaignId: string,
  ttlDays = Number(process.env.ATTRIBUTION_TOKEN_TTL_DAYS ?? 30),
) {
  const key = secret()
  if (!key) throw new Error('ATTRIBUTION_SECRET is not configured.')

  const now = Math.floor(Date.now() / 1000)
  const days = Math.min(Math.max(Number(ttlDays) || 30, 1), 90)
  const claims: AttributionClaims = {
    campaignId: cleanCampaignId(campaignId),
    issuedAt: now,
    expiresAt: now + days * 24 * 60 * 60,
  }
  const payload = b64url(JSON.stringify(claims))
  return `${payload}.${sign(payload, key)}`
}

export function verifyAttributionToken(token: string): AttributionClaims | null {
  const key = secret()
  if (!key) return null

  const [payload, signature, ...extra] = token.trim().split('.')
  if (!payload || !signature || extra.length) return null

  const expected = sign(payload, key)
  if (!safeEqual(expected, signature)) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AttributionClaims
    if (
      !claims ||
      typeof claims.campaignId !== 'string' ||
      !Number.isFinite(claims.issuedAt) ||
      !Number.isFinite(claims.expiresAt) ||
      claims.expiresAt < Math.floor(Date.now() / 1000)
    ) {
      return null
    }

    return {
      campaignId: cleanCampaignId(claims.campaignId),
      issuedAt: claims.issuedAt,
      expiresAt: claims.expiresAt,
    }
  } catch {
    return null
  }
}

export function addAttributionToUrl(url: string, token: string) {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Attributed links must use http or https.')
  }
  parsed.searchParams.set('mabrig_attribution', token)
  return parsed.toString()
}
