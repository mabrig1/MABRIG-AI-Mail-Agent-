type BillionMailEnvelope<T = unknown> = {
  success?: boolean
  code?: number
  msg?: string
  data?: T
}

export type MailForwardRule = {
  address: string
  goto: string
  domain: string
  create_time: number
  update_time: number
  active: number
}

type ForwardListData = {
  total: number
  list: MailForwardRule[]
}

type LoginData = {
  token: string
  refreshToken?: string
  ttl?: number
}

let cachedToken: { token: string; expiresAt: number } | null = null

function baseUrl() {
  const value = process.env.BILLIONMAIL_BASE_URL
  if (!value) throw new Error('BILLIONMAIL_BASE_URL is not configured')
  return value.replace(/\/$/, '')
}

function apiPath(path: string) {
  if (!path.startsWith('/')) throw new Error('BillionMail API path must start with /')
  return path.startsWith('/api/') ? path : `/api${path}`
}

async function parseEnvelope<T>(response: Response): Promise<BillionMailEnvelope<T>> {
  let payload: BillionMailEnvelope<T>
  try {
    payload = await response.json() as BillionMailEnvelope<T>
  } catch {
    throw new Error(`MABRIG Mail bridge returned a non-JSON response (HTTP ${response.status})`)
  }

  if (!response.ok) {
    throw new Error(payload.msg || `MABRIG Mail bridge returned HTTP ${response.status}`)
  }

  if (payload.success === false || (typeof payload.code === 'number' && payload.code !== 0)) {
    throw new Error(payload.msg || 'MABRIG Mail reported an unsuccessful operation')
  }

  return payload
}

async function loginForToken() {
  const username = process.env.BILLIONMAIL_USERNAME
  const password = process.env.BILLIONMAIL_PASSWORD

  if (!username || !password) {
    throw new Error(
      'Configure BILLIONMAIL_API_TOKEN or BILLIONMAIL_USERNAME and BILLIONMAIL_PASSWORD',
    )
  }

  const response = await fetch(`${baseUrl()}/api/login`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
  })

  const payload = await parseEnvelope<LoginData>(response)
  const token = payload.data?.token
  if (!token) throw new Error('BillionMail login succeeded without returning a token')

  const ttl = Math.max(Number(payload.data?.ttl ?? 900), 120)
  cachedToken = {
    token,
    expiresAt: Date.now() + Math.max(ttl - 60, 60) * 1000,
  }
  return token
}

async function authorizationToken() {
  const staticToken = process.env.BILLIONMAIL_API_TOKEN
  if (staticToken) return staticToken.replace(/^Bearer\\s+/i, '').trim()

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  return loginForToken()
}

export async function billionMailRequest<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await authorizationToken()
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  headers.set('authorization', `Bearer ${token}`)

  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(`${baseUrl()}${apiPath(path)}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  const payload = await parseEnvelope<T>(response)
  return payload.data as T
}

export async function listMailForwards(options: {
  domain?: string
  page?: number
  pageSize?: number
  searchKey?: string
} = {}) {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    page_size: String(options.pageSize ?? 100),
  })

  if (options.domain) params.set('domain', options.domain)
  if (options.searchKey) params.set('search_key', options.searchKey)

  return billionMailRequest<ForwardListData>(`/mail_forward/list?${params.toString()}`)
}

export async function listAllMailForwards(domain?: string) {
  const pageSize = 200
  const first = await listMailForwards({ domain, page: 1, pageSize })
  const rules = [...(first.list ?? [])]
  const total = Number(first.total ?? rules.length)

  for (let page = 2; rules.length < total; page += 1) {
    const next = await listMailForwards({ domain, page, pageSize })
    const batch = next.list ?? []
    if (!batch.length) break
    rules.push(...batch)
  }

  return rules
}

export async function addMailForward(input: {
  address: string
  goto: string
  active?: number
}) {
  return billionMailRequest('/mail_forward/add', {
    method: 'POST',
    body: JSON.stringify({
      address: input.address,
      goto: input.goto,
      active: input.active ?? 1,
    }),
  })
}

export async function editMailForward(input: {
  address: string
  goto?: string
  active: number
}) {
  return billionMailRequest('/mail_forward/edit', {
    method: 'POST',
    body: JSON.stringify({
      address: input.address,
      goto: input.goto ?? '',
      active: input.active,
    }),
  })
}

export async function deleteMailForward(address: string) {
  return billionMailRequest('/mail_forward/delete', {
    method: 'POST',
    body: JSON.stringify({ address }),
  })
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


type CreateGroupData = { group_id: number }
type ImportContactsData = { imported_count: number }
type CreateTemplateData = { id: number }
type CreateTaskData = { id: number }

export async function createContactGroup(input: {
  name: string
  description: string
}) {
  return billionMailRequest<CreateGroupData>('/contact/group/create', {
    method: 'POST',
    body: JSON.stringify({
      create_type: 1,
      name: input.name,
      description: input.description,
      double_optin: 0,
    }),
  })
}

export async function importContactsToGroup(groupId: number, recipients: string[]) {
  return billionMailRequest<ImportContactsData>('/contact/group/import', {
    method: 'POST',
    body: JSON.stringify({
      group_ids: [groupId],
      contacts: recipients.join('\n'),
      import_type: 2,
      default_active: 1,
      status: 1,
      overwrite: 0,
    }),
  })
}

export async function deleteContactGroup(groupId: number) {
  return billionMailRequest('/contact/group/delete', {
    method: 'POST',
    body: JSON.stringify({ group_ids: [groupId] }),
  })
}

export async function createEmailTemplate(input: {
  name: string
  html: string
}) {
  return billionMailRequest<CreateTemplateData>('/email_template/create', {
    method: 'POST',
    body: JSON.stringify({
      temp_name: input.name,
      add_type: 0,
      html_content: input.html,
      drag_data: '',
    }),
  })
}

export async function deleteEmailTemplate(templateId: number) {
  return billionMailRequest('/email_template/delete', {
    method: 'POST',
    body: JSON.stringify({ id: templateId }),
  })
}

export async function createMarketingTask(input: {
  addresser: string
  fullName?: string
  subject: string
  groupId: number
  templateId: number
  startTime: number
  threads?: number
  warmup?: number
  trackOpen?: number
  trackClick?: number
  remark?: string
}) {
  return billionMailRequest<CreateTaskData>('/batch_mail/task/create', {
    method: 'POST',
    body: JSON.stringify({
      addresser: input.addresser,
      full_name: input.fullName ?? '',
      subject: input.subject,
      group_id: input.groupId,
      template_id: input.templateId,
      is_record: 1,
      unsubscribe: 1,
      threads: input.threads ?? 2,
      track_open: input.trackOpen ?? 1,
      track_click: input.trackClick ?? 1,
      start_time: input.startTime,
      warmup: input.warmup ?? 1,
      remark: input.remark ?? '',
      tag_ids: [],
      tag_logic: 'AND',
    }),
  })
}


export type MarketingTaskInfo = {
  id: number
  task_name?: string
  addresser?: string
  subject?: string
  full_name?: string
  recipient_count?: number
  task_process?: number
  pause?: number
  template_id?: number
  track_open?: number
  track_click?: number
  start_time?: number
  create_time?: number
  update_time?: number
  group_id?: number
}

export type MarketingTaskDashboard = {
  sends: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  delayed_queue?: number
  delivery_rate: number
  bounce_rate: number
  open_rate: number
  click_rate: number
}

type MarketingTaskStatChart = {
  dashboard?: Partial<MarketingTaskDashboard>
  mail_providers?: unknown
  send_mail_chart?: unknown
  bounce_rate_chart?: unknown
  open_rate_chart?: unknown
  click_rate_chart?: unknown
}

function numberValue(value: unknown) {
  const result = Number(value ?? 0)
  return Number.isFinite(result) ? result : 0
}

export async function getMarketingTaskInfo(taskId: number) {
  if (!Number.isInteger(taskId) || taskId <= 0) throw new Error('A valid BillionMail task id is required.')
  return billionMailRequest<MarketingTaskInfo>(`/batch_mail/task/find?id=${taskId}`)
}

export async function getMarketingTaskStats(
  taskId: number,
  startTime: number,
  endTime = Math.floor(Date.now() / 1000),
) {
  if (!Number.isInteger(taskId) || taskId <= 0) throw new Error('A valid BillionMail task id is required.')

  const start = Math.max(Math.floor(startTime || 0), 0)
  const end = Math.max(Math.floor(endTime || 0), start)

  const params = new URLSearchParams({
    task_id: String(taskId),
    start_time: String(start),
    end_time: String(end),
  })

  const result = await billionMailRequest<MarketingTaskStatChart>(
    `/batch_mail/task/stat_chart?${params.toString()}`,
  )
  const dashboard = result?.dashboard ?? {}

  return {
    sends: numberValue(dashboard.sends),
    delivered: numberValue(dashboard.delivered),
    opened: numberValue(dashboard.opened),
    clicked: numberValue(dashboard.clicked),
    bounced: numberValue(dashboard.bounced),
    delayed_queue: numberValue(dashboard.delayed_queue),
    delivery_rate: numberValue(dashboard.delivery_rate),
    bounce_rate: numberValue(dashboard.bounce_rate),
    open_rate: numberValue(dashboard.open_rate),
    click_rate: numberValue(dashboard.click_rate),
  } satisfies MarketingTaskDashboard
}
