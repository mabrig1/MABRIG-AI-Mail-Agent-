import { createHash } from 'crypto'
import { MongoServerError } from 'mongodb'
import {
  ensureGrowthGraphIndexes,
  InteractionType,
  recordGrowthInteraction,
  upsertGrowthContact,
} from '@/lib/growth-graph'
import { getDatabase } from '@/lib/mongodb'

const COLLECTION = 'conversion_ingestion_events'

export type ConversionProvider = 'generic' | 'paystack' | 'flutterwave'

export type ConversionEventInput = {
  provider: ConversionProvider
  eventKey: string
  type: Extract<
    InteractionType,
    'purchase' | 'quote_request' | 'email_reply' | 'referral' | 'pricing_visit'
  >
  email: string
  name?: string
  amount?: number
  currency?: string
  campaignId?: string
  product?: string
  reference?: string
  occurredAt?: string
  providerVerified?: boolean
  source?: string
}

async function ensureConversionIndexes() {
  const db = await getDatabase()
  await Promise.all([
    db.collection(COLLECTION).createIndex(
      { provider: 1, eventKey: 1 },
      { unique: true },
    ),
    db.collection(COLLECTION).createIndex({ receivedAt: -1 }),
    db.collection(COLLECTION).createIndex({ campaignId: 1, receivedAt: -1 }),
  ])
}

function cleanEventKey(value: string) {
  const result = value.trim().slice(0, 240)
  if (!result) throw new Error('Conversion event key is required.')
  return result
}

async function claimConversion(input: ConversionEventInput) {
  const db = await getDatabase()
  const eventKey = cleanEventKey(input.eventKey)
  const now = new Date()
  const document = {
    provider: input.provider,
    eventKey,
    type: input.type,
    reference: input.reference?.trim().slice(0, 240) || undefined,
    campaignId: input.campaignId?.trim().slice(0, 120) || undefined,
    providerVerified: input.providerVerified === true,
    payloadFingerprint: createHash('sha256')
      .update(JSON.stringify({
        provider: input.provider,
        eventKey,
        type: input.type,
        email: input.email.trim().toLowerCase(),
        amount: input.amount,
        currency: input.currency,
        campaignId: input.campaignId,
        reference: input.reference,
      }))
      .digest('hex'),
    status: 'processing',
    attempts: 1,
    receivedAt: now,
    updatedAt: now,
  }

  try {
    await db.collection(COLLECTION).insertOne(document)
    return { claimed: true, duplicate: false }
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error

    const existing = await db.collection(COLLECTION).findOne({
      provider: input.provider,
      eventKey,
    })

    if (existing?.status !== 'failed') {
      return { claimed: false, duplicate: true }
    }

    const retry = await db.collection(COLLECTION).updateOne(
      {
        provider: input.provider,
        eventKey,
        status: 'failed',
      },
      {
        $set: {
          status: 'processing',
          updatedAt: now,
          lastError: null,
        },
        $inc: { attempts: 1 },
      },
    )

    return {
      claimed: retry.modifiedCount === 1,
      duplicate: retry.modifiedCount !== 1,
    }
  }
}

async function completeConversion(
  provider: ConversionProvider,
  eventKey: string,
  interactionId: string,
) {
  const db = await getDatabase()
  await db.collection(COLLECTION).updateOne(
    { provider, eventKey },
    {
      $set: {
        status: 'processed',
        interactionId,
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  )
}

async function failConversion(
  provider: ConversionProvider,
  eventKey: string,
  error: unknown,
) {
  const db = await getDatabase()
  const message = error instanceof Error ? error.message : 'Conversion ingestion failed.'
  await db.collection(COLLECTION).updateOne(
    { provider, eventKey },
    {
      $set: {
        status: 'failed',
        lastError: message.slice(0, 500),
        updatedAt: new Date(),
      },
    },
  )
}

export async function ingestConversionEvent(input: ConversionEventInput) {
  await Promise.all([
    ensureGrowthGraphIndexes(),
    ensureConversionIndexes(),
  ])

  const claim = await claimConversion(input)
  if (!claim.claimed) {
    return {
      duplicate: true,
      processed: false,
      eventKey: cleanEventKey(input.eventKey),
    }
  }

  try {
    await upsertGrowthContact({
      email: input.email,
      name: input.name,
      // Deliberately do not grant marketing consent from a payment/business event.
    })

    const event = await recordGrowthInteraction({
      email: input.email,
      type: input.type,
      source: input.source || `${input.provider}:webhook`,
      campaignId: input.campaignId,
      value: input.amount,
      currency: input.currency,
      product: input.product,
      note: input.reference
        ? `${input.provider} reference ${input.reference}`.slice(0, 500)
        : undefined,
      occurredAt: input.occurredAt,
    })

    await completeConversion(input.provider, cleanEventKey(input.eventKey), event._id.toString())

    return {
      duplicate: false,
      processed: true,
      eventKey: cleanEventKey(input.eventKey),
      interactionId: event._id.toString(),
      campaignId: input.campaignId || null,
    }
  } catch (error) {
    await failConversion(input.provider, cleanEventKey(input.eventKey), error)
    throw error
  }
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function extractCampaignId(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return undefined
  const record = metadata as Record<string, unknown>

  const directKeys = [
    'campaignId',
    'campaign_id',
    'mabrig_campaign_id',
    'growth_journey_id',
    'journey_id',
  ]

  for (const key of directKeys) {
    const value = textValue(record[key])
    if (value) return value.slice(0, 120)
  }

  const customFields = Array.isArray(record.custom_fields)
    ? record.custom_fields
    : []

  for (const field of customFields) {
    if (!field || typeof field !== 'object') continue
    const item = field as Record<string, unknown>
    const variableName = textValue(item.variable_name)
    if (!directKeys.includes(variableName)) continue
    const value = textValue(item.value)
    if (value) return value.slice(0, 120)
  }

  return undefined
}

export function extractProduct(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object') return undefined
  const record = metadata as Record<string, unknown>
  const value =
    textValue(record.product) ||
    textValue(record.product_name) ||
    textValue(record.item) ||
    textValue(record.service)
  return value ? value.slice(0, 200) : undefined
}

export async function listRecentConversionEvents(limit = 30) {
  const db = await getDatabase()
  await ensureConversionIndexes()
  return db.collection(COLLECTION)
    .find({})
    .sort({ receivedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 100))
    .project({
      provider: 1,
      eventKey: 1,
      type: 1,
      reference: 1,
      campaignId: 1,
      providerVerified: 1,
      status: 1,
      attempts: 1,
      receivedAt: 1,
      processedAt: 1,
      lastError: 1,
    })
    .toArray()
}
