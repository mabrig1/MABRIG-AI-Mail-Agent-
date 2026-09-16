type AuditEvent = {
  actor: string
  actionId?: string
  actionType: string
  outcome: 'approved' | 'executed' | 'rejected' | 'failed' | 'not-executed'
  resource?: string
  detail?: string
}

export function writeAuditEvent(event: AuditEvent) {
  const entry = {
    service: 'MABRIG AI Mail Agent',
    timestamp: new Date().toISOString(),
    ...event,
  }

  // Intentionally exclude message bodies, passwords, tokens and other secrets.
  console.info('MABRIG_AUDIT', JSON.stringify(entry))
  return entry
}
