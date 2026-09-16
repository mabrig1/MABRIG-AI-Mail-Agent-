import type { MailForwardRule } from '@/lib/billionmail'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function csvEnv(name: string) {
  return (process.env[name] ?? '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
}

function emailDomain(address: string) {
  return address.split('@')[1]?.toLowerCase() ?? ''
}

export function parseForwardTargets(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]+/)
        .map(item => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

export function validateForwardingRule(addressInput: string, gotoInput: string) {
  const address = addressInput.trim().toLowerCase()
  const targets = parseForwardTargets(gotoInput)

  if (!EMAIL_RE.test(address)) {
    throw new Error('Forwarding source must be a valid email address.')
  }

  if (!targets.length) {
    throw new Error('At least one forwarding destination is required.')
  }

  const invalidTarget = targets.find(target => !EMAIL_RE.test(target))
  if (invalidTarget) {
    throw new Error(`Invalid forwarding destination: ${invalidTarget}`)
  }

  const maxTargets = Math.max(Number(process.env.FORWARDING_MAX_TARGETS ?? 5), 1)
  if (targets.length > maxTargets) {
    throw new Error(`A forwarding rule can have at most ${maxTargets} destinations.`)
  }

  if (targets.includes(address)) {
    throw new Error('A forwarding rule cannot target its own source address.')
  }

  const sourceDomain = emailDomain(address)
  const configuredSources = csvEnv('FORWARDING_ALLOWED_SOURCE_DOMAINS')
  const fallbackDomain = (process.env.MAIL_DOMAIN ?? '').trim().toLowerCase()
  const allowedSources = configuredSources.length
    ? configuredSources
    : fallbackDomain
      ? [fallbackDomain]
      : []

  if (allowedSources.length && !allowedSources.includes(sourceDomain)) {
    throw new Error(`Source domain ${sourceDomain} is not allowed for forwarding rules.`)
  }

  const allowExternal = process.env.FORWARDING_ALLOW_EXTERNAL === 'true'
  const destinationAllowlist = new Set([
    ...allowedSources,
    ...csvEnv('FORWARDING_ALLOWED_DESTINATION_DOMAINS'),
  ])
  const blockedDomains = new Set(csvEnv('FORWARDING_BLOCKED_DESTINATION_DOMAINS'))

  for (const target of targets) {
    const domain = emailDomain(target)
    if (blockedDomains.has(domain)) {
      throw new Error(`Destination domain ${domain} is blocked.`)
    }
    if (!allowExternal && destinationAllowlist.size && !destinationAllowlist.has(domain)) {
      throw new Error(
        `External forwarding to ${domain} is disabled. Add it to the destination allowlist or explicitly enable external forwarding.`,
      )
    }
  }

  return {
    address,
    targets,
    goto: targets.join('\n'),
    sourceDomain,
  }
}

export function assertNoForwardingLoop(
  source: string,
  newTargets: string[],
  existingRules: MailForwardRule[],
) {
  const graph = new Map<string, string[]>()

  for (const rule of existingRules) {
    if (!rule.active) continue
    graph.set(rule.address.toLowerCase(), parseForwardTargets(rule.goto))
  }

  graph.set(source.toLowerCase(), newTargets.map(target => target.toLowerCase()))

  function reachesSource(node: string, visited: Set<string>): boolean {
    const normalized = node.toLowerCase()
    if (normalized === source.toLowerCase()) return true
    if (visited.has(normalized)) return false
    visited.add(normalized)

    for (const next of graph.get(normalized) ?? []) {
      if (reachesSource(next, visited)) return true
    }
    return false
  }

  for (const target of newTargets) {
    if (reachesSource(target, new Set())) {
      throw new Error('The proposed forwarding rule would create a forwarding loop.')
    }
  }
}
