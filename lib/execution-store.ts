import { MongoServerError } from 'mongodb'
import type { ProposedAction } from '@/lib/approval'
import {
  beginApprovalExecution as beginInMemory,
  completeApprovalExecution as completeInMemory,
  failApprovalExecution as failInMemory,
} from '@/lib/approval-replay'
import { getDatabase, mongoConfigured } from '@/lib/mongodb'

const COLLECTION = 'approval_executions'
let indexesReady: Promise<void> | null = null

async function ensureIndexesOnce() {
  if (!mongoConfigured()) return
  if (!indexesReady) indexesReady = ensureApprovalIndexes()
  await indexesReady
}

export async function claimApprovalExecution(action: ProposedAction, actor: string) {
  if (!mongoConfigured()) return beginInMemory(action.id)

  await ensureIndexesOnce()
  const db = await getDatabase()

  try {
    await db.collection(COLLECTION).insertOne({
      actionId: action.id,
      actionType: action.type,
      actor,
      status: 'executing',
      createdAt: new Date(),
      expiresAt: new Date(action.expiresAt * 1000),
    })
    return true
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) return false
    throw error
  }
}

export async function markApprovalExecuted(action: ProposedAction) {
  if (!mongoConfigured()) {
    completeInMemory(action.id, action.expiresAt)
    return
  }

  const db = await getDatabase()
  await db.collection(COLLECTION).updateOne(
    { actionId: action.id },
    {
      $set: {
        status: 'executed',
        completedAt: new Date(),
      },
    },
  )
}

export async function markApprovalFailed(action: ProposedAction, message: string) {
  if (!mongoConfigured()) {
    failInMemory(action.id)
    return
  }

  const db = await getDatabase()
  await db.collection(COLLECTION).updateOne(
    { actionId: action.id },
    {
      $set: {
        status: 'failed',
        failedAt: new Date(),
        error: message.slice(0, 500),
      },
    },
  )
}

export async function ensureApprovalIndexes() {
  if (!mongoConfigured()) return
  const db = await getDatabase()
  await db.collection(COLLECTION).createIndex({ actionId: 1 }, { unique: true })
  await db.collection(COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 86400 })
}
