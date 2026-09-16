import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'

export type LifecycleStage =
  | 'prospect'
  | 'lead'
  | 'customer'
  | 'repeat-customer'
  | 'lapsed'
  | 'advocate'

export type InteractionType =
  | 'email_open'
  | 'email_click'
  | 'email_reply'
  | 'pricing_visit'
  | 'quote_request'
  | 'purchase'
  | 'referral'
  | 'unsubscribe'
  | 'consent_granted'
  | 'note'

export type ContactInput = {
  email: string
  name?: string
  company?: string
  phone?: string
  tags?: string[]
  lifecycleStage?: LifecycleStage
  marketingConsent?: boolean
  consentSource?: string
  market?: string
}

export type InteractionInput = {
  email: string
  type: InteractionType
  source?: string
  campaignId?: string
  value?: number
  currency?: string
  product?: string
  note?: string
  occurredAt?: string
}

const CONTACTS = 'growth_contacts'
const INTERACTIONS = 'growth_interactions'
const PURCHASES = 'growth_purchases'
const OPPORTUNITIES = 'growth_opportunities'

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid contact email is required.')
  }
  return email
}

function cleanTags(tags: string[] | undefined) {
  return Array.from(
    new Set(
      (tags ?? [])
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 30),
    ),
  )
}

export async function ensureGrowthGraphIndexes() {
  const db = await getDatabase()

  await Promise.all([
    db.collection(CONTACTS).createIndex({ email: 1 }, { unique: true }),
    db.collection(CONTACTS).createIndex({ marketingConsent: 1, lifecycleStage: 1 }),
    db.collection(INTERACTIONS).createIndex({ email: 1, occurredAt: -1 }),
    db.collection(INTERACTIONS).createIndex({ type: 1, occurredAt: -1 }),
    db.collection(PURCHASES).createIndex({ email: 1, occurredAt: -1 }),
    db.collection(OPPORTUNITIES).createIndex({ email: 1 }, { unique: true }),
    db.collection(OPPORTUNITIES).createIndex({ score: -1, updatedAt: -1 }),
  ])
}

export async function upsertGrowthContact(input: ContactInput) {
  const db = await getDatabase()
  const email = normalizeEmail(input.email)
  const now = new Date()
  const existing = await db.collection(CONTACTS).findOne({ email })

  const update: Record<string, unknown> = {
    email,
    updatedAt: now,
  }

  if (input.name !== undefined) update.name = input.name.trim().slice(0, 160)
  if (input.company !== undefined) update.company = input.company.trim().slice(0, 160)
  if (input.phone !== undefined) update.phone = input.phone.trim().slice(0, 80)
  if (input.market !== undefined) update.market = input.market.trim().slice(0, 160)
  if (input.tags !== undefined) update.tags = cleanTags(input.tags)
  if (input.lifecycleStage !== undefined) update.lifecycleStage = input.lifecycleStage

  if (input.marketingConsent !== undefined) {
    update.marketingConsent = input.marketingConsent
    update.consentUpdatedAt = now
    update.consentSource = (input.consentSource || 'admin').trim().slice(0, 120)
  }

  await db.collection(CONTACTS).updateOne(
    { email },
    {
      $set: update,
      $setOnInsert: {
        createdAt: now,
        lifecycleStage: input.lifecycleStage ?? 'prospect',
        marketingConsent: input.marketingConsent ?? false,
        tags: cleanTags(input.tags),
      },
    },
    { upsert: true },
  )

  const contact = await db.collection(CONTACTS).findOne({ email })
  return {
    created: !existing,
    contact,
  }
}

export async function recordGrowthInteraction(input: InteractionInput) {
  const db = await getDatabase()
  const email = normalizeEmail(input.email)
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()

  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error('Interaction date is invalid.')
  }

  const contact = await db.collection(CONTACTS).findOne({ email })
  if (!contact) throw new Error('Contact must exist before an interaction can be recorded.')

  const event = {
    _id: new ObjectId(),
    email,
    type: input.type,
    source: input.source?.trim().slice(0, 120) || 'manual',
    campaignId: input.campaignId?.trim().slice(0, 120) || undefined,
    value: typeof input.value === 'number' && Number.isFinite(input.value) ? input.value : undefined,
    currency: input.currency?.trim().toUpperCase().slice(0, 12) || undefined,
    product: input.product?.trim().slice(0, 200) || undefined,
    note: input.note?.trim().slice(0, 500) || undefined,
    occurredAt,
    createdAt: new Date(),
  }

  await db.collection(INTERACTIONS).insertOne(event)

  if (input.type === 'purchase') {
    await db.collection(PURCHASES).insertOne({
      email,
      value: event.value,
      currency: event.currency,
      product: event.product,
      source: event.source,
      occurredAt,
      createdAt: new Date(),
    })

    const purchaseCount = await db.collection(PURCHASES).countDocuments({ email })
    await db.collection(CONTACTS).updateOne(
      { email },
      {
        $set: {
          lifecycleStage: purchaseCount > 1 ? 'repeat-customer' : 'customer',
          updatedAt: new Date(),
        },
      },
    )
  }

  if (input.type === 'unsubscribe') {
    await db.collection(CONTACTS).updateOne(
      { email },
      {
        $set: {
          marketingConsent: false,
          consentUpdatedAt: occurredAt,
          consentSource: input.source?.trim().slice(0, 120) || 'unsubscribe',
          updatedAt: new Date(),
        },
      },
    )
  }

  if (input.type === 'consent_granted') {
    await db.collection(CONTACTS).updateOne(
      { email },
      {
        $set: {
          marketingConsent: true,
          consentUpdatedAt: occurredAt,
          consentSource: input.source?.trim().slice(0, 120) || 'consent_granted',
          updatedAt: new Date(),
        },
      },
    )
  }

  return event
}

export async function listGrowthContacts(options: {
  consentOnly?: boolean
  lifecycleStage?: string
  limit?: number
} = {}) {
  const db = await getDatabase()
  const filter: Record<string, unknown> = {}

  if (options.consentOnly) filter.marketingConsent = true
  if (options.lifecycleStage) filter.lifecycleStage = options.lifecycleStage

  return db.collection(CONTACTS)
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(Math.min(Math.max(options.limit ?? 100, 1), 500))
    .project({ email: 1, name: 1, company: 1, market: 1, tags: 1, lifecycleStage: 1, marketingConsent: 1, updatedAt: 1 })
    .toArray()
}

async function emailsWithRecentInteraction(types: InteractionType[], since: Date) {
  const db = await getDatabase()
  return db.collection(INTERACTIONS).distinct('email', {
    type: { $in: types },
    occurredAt: { $gte: since },
  }) as Promise<string[]>
}

async function purchaseStats() {
  const db = await getDatabase()
  return db.collection(PURCHASES).aggregate<{
    _id: string
    purchases: number
    lastPurchaseAt: Date
    totalValue: number
  }>([
    {
      $group: {
        _id: '$email',
        purchases: { $sum: 1 },
        lastPurchaseAt: { $max: '$occurredAt' },
        totalValue: { $sum: { $ifNull: ['$value', 0] } },
      },
    },
  ]).toArray()
}

export async function getGrowthSegments() {
  const db = await getDatabase()
  const now = Date.now()
  const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000)
  const last90Days = new Date(now - 90 * 24 * 60 * 60 * 1000)

  const [
    total,
    marketable,
    engagedEmails,
    intentEmails,
    purchases,
  ] = await Promise.all([
    db.collection(CONTACTS).countDocuments(),
    db.collection(CONTACTS).countDocuments({ marketingConsent: true }),
    emailsWithRecentInteraction(['email_open', 'email_click', 'email_reply'], last30Days),
    emailsWithRecentInteraction(['email_reply', 'pricing_visit', 'quote_request'], last30Days),
    purchaseStats(),
  ])

  const consentedEmails = new Set<string>(
    await db.collection(CONTACTS).distinct('email', { marketingConsent: true }) as string[],
  )

  const reactivation = purchases.filter(
    item => item.lastPurchaseAt < last90Days && consentedEmails.has(item._id),
  )

  const referralCandidates = purchases.filter(
    item => item.purchases >= 2 && consentedEmails.has(item._id),
  )

  return {
    generatedAt: new Date().toISOString(),
    segments: [
      {
        key: 'all',
        label: 'All contacts',
        count: total,
        description: 'Every contact stored in the Customer Growth Graph.',
      },
      {
        key: 'marketable',
        label: 'Permissioned audience',
        count: marketable,
        description: 'Contacts with an explicit current marketing-consent flag.',
      },
      {
        key: 'engaged_30d',
        label: 'Engaged in 30 days',
        count: engagedEmails.filter(email => consentedEmails.has(email)).length,
        description: 'Permissioned contacts with a recent open, click or reply.',
      },
      {
        key: 'high_intent_30d',
        label: 'High-intent signals',
        count: intentEmails.filter(email => consentedEmails.has(email)).length,
        description: 'Permissioned contacts with a recent reply, pricing visit or quote request.',
      },
      {
        key: 'reactivation',
        label: 'Reactivation candidates',
        count: reactivation.length,
        description: 'Permissioned customers whose latest recorded purchase is older than 90 days.',
      },
      {
        key: 'referral_candidates',
        label: 'Referral candidates',
        count: referralCandidates.length,
        description: 'Permissioned contacts with at least two recorded purchases.',
      },
    ],
  }
}
