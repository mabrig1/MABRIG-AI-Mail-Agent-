import { resolveMx, resolveTxt } from 'node:dns/promises'

export type DeliverabilityCheck = {
  domain: string
  mx: Array<{ exchange: string; priority: number }>
  spf: string[]
  dmarc: string[]
  warnings: string[]
}

function normaliseTxt(records: string[][]) {
  return records.map(parts => parts.join(''))
}

async function safeMx(domain: string) {
  try {
    return await resolveMx(domain)
  } catch {
    return []
  }
}

async function safeTxt(domain: string) {
  try {
    return normaliseTxt(await resolveTxt(domain))
  } catch {
    return []
  }
}

export async function checkDeliverability(domainInput: string): Promise<DeliverabilityCheck> {
  const domain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) {
    throw new Error('Enter a valid domain name.')
  }

  const [mx, rootTxt, dmarcTxt] = await Promise.all([
    safeMx(domain),
    safeTxt(domain),
    safeTxt(`_dmarc.${domain}`),
  ])

  const spf = rootTxt.filter(record => record.toLowerCase().startsWith('v=spf1'))
  const dmarc = dmarcTxt.filter(record => record.toLowerCase().startsWith('v=dmarc1'))
  const warnings: string[] = []

  if (!mx.length) warnings.push('No MX record was found.')
  if (!spf.length) warnings.push('No SPF record was found.')
  if (spf.length > 1) warnings.push('Multiple SPF records were found; SPF should normally be published as one record.')
  if (!dmarc.length) warnings.push('No DMARC record was found.')

  return {
    domain,
    mx: [...mx].sort((a, b) => a.priority - b.priority),
    spf,
    dmarc,
    warnings,
  }
}
