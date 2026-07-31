import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache } from '@/lib/cache'
import { queueStats } from '@/lib/queue'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async () => {
  const [
    totalUsers, totalMatches, totalTeams, totalTransfers,
    totalAccounts, totalJobs, totalErrors, totalTests,
  ] = await Promise.all([
    db.user.count(), db.match.count(), db.generatedTeam.count(),
    db.transferHistory.count(), db.fantasyAccount.count(),
    db.syncJob.count(), db.errorLog.count(), db.testRun.count(),
  ])
  const queue = await queueStats()
  const cacheStats = cache.stats_snapshot()
  const recentErrors = await db.errorLog.findMany({
    where: { resolved: false },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, level: true, message: true, source: true, createdAt: true },
  })
  const transferStats = await db.transferHistory.groupBy({ by: ['status'], _count: true })
  return ok({
    counts: { totalUsers, totalMatches, totalTeams, totalTransfers, totalAccounts, totalJobs, totalErrors, totalTests },
    queue,
    cache: cacheStats,
    transferStats: transferStats.reduce((a, b) => ({ ...a, [b.status]: b._count }), {} as Record<string, number>),
    recentErrors,
  })
})
