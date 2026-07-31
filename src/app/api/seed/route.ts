import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { seedAll } from '@/lib/seed'
import { apiHandler, ok } from '@/lib/api'
import { cache } from '@/lib/cache'

export const POST = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url)
  const reset = url.searchParams.get('reset') === 'true'
  if (reset) {
    // Delete all matches (cascade deletes players, playing XI, generated teams)
    await db.generatedTeamPlayer.deleteMany()
    await db.generatedTeam.deleteMany()
    await db.playingXI.deleteMany()
    await db.player.deleteMany()
    await db.match.deleteMany()
    // Also clear transfer data for fresh start
    await db.transferHistory.deleteMany()
    await db.transferQueue.deleteMany()
    await db.sessionToken.deleteMany()
    await db.fantasyAccount.deleteMany()
    await db.notification.deleteMany()
    await db.syncJob.deleteMany()
    // Reset demo user credits (in case they were decremented by previous test runs)
    await db.user.updateMany({ where: { email: 'demo@teamgen.in' }, data: { credits: 200 } })
    await db.user.updateMany({ where: { email: 'admin@teamgen.in' }, data: { credits: 9999 } })
  }
  await seedAll()
  // CRITICAL: clear all caches so stale data doesn't interfere with new seed
  cache.clear()
  return ok({ seeded: true, reset })
})
