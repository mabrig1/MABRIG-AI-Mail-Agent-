import { Db, MongoClient } from 'mongodb'

declare global {
  var __mabrigMongoClientPromise: Promise<MongoClient> | undefined
}

export function mongoConfigured() {
  return Boolean(process.env.MONGODB_URI)
}

function databaseName() {
  return process.env.MONGODB_DB_NAME?.trim() || 'mabrig_ai_mail'
}

async function client() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not configured')

  if (!global.__mabrigMongoClientPromise) {
    const instance = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    })
    global.__mabrigMongoClientPromise = instance.connect()
  }

  return global.__mabrigMongoClientPromise
}

export async function getDatabase(): Promise<Db> {
  return (await client()).db(databaseName())
}

export async function checkMongoReachability() {
  if (!mongoConfigured()) return { configured: false, reachable: false }

  try {
    const db = await getDatabase()
    await db.command({ ping: 1 })
    return { configured: true, reachable: true }
  } catch {
    return { configured: true, reachable: false }
  }
}
