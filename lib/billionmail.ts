function baseUrl() {
  const value = process.env.BILLIONMAIL_BASE_URL
  if (!value) throw new Error('BILLIONMAIL_BASE_URL is not configured')
  return value.replace(/\/$/, '')
}

export async function billionMailRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!path.startsWith('/')) throw new Error('BillionMail API path must start with /')

  const token = process.env.BILLIONMAIL_API_TOKEN
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  if (!response.ok) throw new Error(`MABRIG Mail bridge returned HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export async function checkMailServerReachability() {
  const url = process.env.BILLIONMAIL_BASE_URL
  if (!url) return { configured: false, reachable: false }

  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'manual' })
    return { configured: true, reachable: response.status < 500, status: response.status }
  } catch {
    return { configured: true, reachable: false }
  }
}
