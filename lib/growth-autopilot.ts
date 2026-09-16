import { ObjectId } from 'mongodb'
import { runAgent } from '@/lib/agent'
import { getGrowthSegments } from '@/lib/growth-graph'
import { getDatabase } from '@/lib/mongodb'

export type GrowthJourneyStatus =
  | 'draft'
  | 'approval-staged'
  | 'approved-awaiting-executor'
  | 'scheduled'
  | 'execution-failed'
  | 'dismissed'

const COLLECTION = 'growth_journeys'

const JOURNEY_TEMPLATES = [
  {
    segmentKey: 'high_intent_30d',
    title: 'High-Intent Conversion Journey',
    objective: 'Turn recent high-intent engagement into a qualified conversation or purchase without adding sales pressure.',
  },
  {
    segmentKey: 'opportunity_radar',
    title: 'Opportunity Radar Follow-Up',
    objective: 'Prioritise permissioned, transparently scored opportunities with a relevant next-best-action journey.',
  },
  {
    segmentKey: 'reactivation',
    title: 'Customer Reactivation Journey',
    objective: 'Re-engage dormant customers with useful value, a relevant reason to return, and a clear opt-out path.',
  },
  {
    segmentKey: 'referral_candidates',
    title: 'Referral & Advocacy Journey',
    objective: 'Invite proven repeat customers to refer or advocate only when the relationship and consent signals support it.',
  },
] as const

async function ensureJourneyIndexes() {
  const db = await getDatabase()
  await Promise.all([
    db.collection(COLLECTION).createIndex({ status: 1, createdAt: -1 }),
    db.collection(COLLECTION).createIndex({ segmentKey: 1, createdAt: -1 }),
  ])
}

export async function scanGrowthAutopilot(options: { force?: boolean } = {}) {
  await ensureJourneyIndexes()
  const db = await getDatabase()
  const snapshot = await getGrowthSegments()
  const segmentMap = new Map(snapshot.segments.map(segment => [segment.key, segment]))
  const cooldownDays = Math.max(Number(process.env.GROWTH_AUTOPILOT_COOLDOWN_DAYS ?? 7), 1)
  const cooldownSince = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000)

  const generated: Array<Record<string, unknown>> = []
  const skipped: Array<Record<string, unknown>> = []

  for (const template of JOURNEY_TEMPLATES) {
    const segment = segmentMap.get(template.segmentKey)
    if (!segment || segment.count <= 0) {
      skipped.push({
        segmentKey: template.segmentKey,
        reason: 'no-eligible-audience',
      })
      continue
    }

    if (!options.force) {
      const existing = await db.collection(COLLECTION).findOne({
        segmentKey: template.segmentKey,
        status: { $in: ['draft', 'approval-staged', 'approved-awaiting-executor'] },
        createdAt: { $gte: cooldownSince },
      })

      if (existing) {
        skipped.push({
          segmentKey: template.segmentKey,
          reason: 'cooldown-or-existing-proposal',
          journeyId: existing._id.toString(),
        })
        continue
      }
    }

    const prompt = [
      `Segment key: ${segment.key}`,
      `Segment label: ${segment.label}`,
      `Eligible audience count: ${segment.count}`,
      `Segment definition: ${segment.description}`,
      `Business objective: ${template.objective}`,
      '',
      'Constraints:',
      '- The audience is determined by deterministic server-side rules; do not alter or expand it.',
      '- Only permissioned contacts may receive marketing journeys.',
      '- Do not include personal identities or infer private traits.',
      '- Prefer value-first, low-pressure messaging and explicit exit/suppression conditions.',
      '- Nothing is sent automatically. The plan will require administrator approval.',
    ].join('\n')

    const plan = await runAgent('autopilot', prompt)
    const now = new Date()
    const document = {
      title: template.title,
      segmentKey: segment.key,
      segmentLabel: segment.label,
      segmentDefinition: segment.description,
      audienceCount: segment.count,
      objective: template.objective,
      plan,
      status: 'draft' as GrowthJourneyStatus,
      generatedFromSnapshotAt: new Date(snapshot.generatedAt),
      createdAt: now,
      updatedAt: now,
    }

    const result = await db.collection(COLLECTION).insertOne(document)
    generated.push({
      id: result.insertedId.toString(),
      ...document,
    })
  }

  return {
    generated,
    skipped,
    snapshotGeneratedAt: snapshot.generatedAt,
    cooldownDays,
  }
}

export async function listGrowthJourneys(limit = 20) {
  await ensureJourneyIndexes()
  const db = await getDatabase()

  return db.collection(COLLECTION)
    .find({})
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .toArray()
}

export async function getGrowthJourney(id: string) {
  if (!ObjectId.isValid(id)) return null
  const db = await getDatabase()
  return db.collection(COLLECTION).findOne({ _id: new ObjectId(id) })
}

export async function updateGrowthJourneyStatus(
  id: string,
  status: GrowthJourneyStatus,
  details: Record<string, unknown> = {},
) {
  if (!ObjectId.isValid(id)) throw new Error('Invalid growth journey id.')
  const db = await getDatabase()
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        status,
        ...details,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' },
  )
  return result
}
