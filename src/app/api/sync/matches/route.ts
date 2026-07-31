import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler, ok } from '@/lib/api'
import { audit } from '@/lib/audit'
import { cache, cacheKeys } from '@/lib/cache'
import { seedMatch, simulateToss } from '@/lib/mock-cricket'

/** Simulate syncing matches from upstream cricket API */
export const POST = apiHandler(async (req: NextRequest) => {
  // sync existing matches (update lastSyncedAt) + optionally create new ones
  const matches = await db.match.findMany()
  let updated = 0
  for (const m of matches) {
    await db.match.update({ where: { id: m.id }, data: { lastSyncedAt: new Date() } })
    updated++
    cache.delete(cacheKeys.match(m.id))
  }
  // maybe create a new upcoming match if few exist
  if (matches.length < 6) {
    const newId = await seedMatch({ daysFromNow: Math.floor(Math.random() * 4) + 1 })
    updated++
  }
  cache.delete(cacheKeys.matchList())

  await audit({ action: 'SYNC_MATCHES', details: { updated } })
  return ok({ synced: updated, lastSyncAt: new Date() })
})
