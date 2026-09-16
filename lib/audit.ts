import { getDatabase, mongoConfigured } from '@/lib/mongodb'

type AuditEvent = {
  actor: string
  actionId?: string
  actionType: string
  outcome: 'approved' | 'executed' | 'rejected' | 'failed' | 'not-executed'
  resource?: string
  detail?: string
}

export async function writeAuditEvent(event: AuditEvent) {
  const entry = {
    service: 'MABRIG AI Mail Agent',
    timestamp: new Date(),
    ...event,
  }

  // Intentionally exclude message bodies, passwords, tokens and other secrets.
  console.info('MABRIG_AUDIT', JSON.stringify({
    ...entry,
    timestamp: entry.timestamp.toISOString(),
  }))

  if (mongoConfigured()) {
    try {
      const db = await getDatabase()
      const collection = db.collection('audit_events')
      await collection.createIndex({ timestamp: -1 })
      await collection.createIndex({ actionId: 1 })
      await collection.insertOne(entry)
    } catch (error) {
      console.error(
        'MABRIG_AUDIT_PERSISTENCE_ERROR',
        error instanceof Error ? error.message : 'Unknown audit persistence error',
      )
    }
  }

  return entry
}
