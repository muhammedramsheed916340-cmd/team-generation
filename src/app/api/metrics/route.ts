import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache } from '@/lib/cache'
import { apiHandler, ok } from '@/lib/api'
import { getFallbackStore, isDatabaseAvailable } from '@/lib/fallback-data'

export const GET = apiHandler(async () => {
  if (!isDatabaseAvailable()) {
    const store = getFallbackStore()
    return ok({
      counts: {
        totalUsers: store.users.length,
        totalMatches: store.matches.length,
        totalTeams: store.generatedTeams.length,
        totalTransfers: 0,
        totalAccounts: 0,
        totalJobs: 0,
        totalErrors: 0,
        totalTests: 0,
      },
      queue: {},
      cache: cache.stats_snapshot(),
      transferStats: {},
      recentErrors: [],
    })
  }

  try {
    const [
      totalUsers, totalMatches, totalTeams, totalTransfers,
      totalAccounts, totalJobs, totalErrors, totalTests,
    ] = await Promise.all([
      db.user.count(), db.match.count(), db.generatedTeam.count(),
      db.transferHistory.count(), db.fantasyAccount.count(),
      db.syncJob.count(), db.errorLog.count(), db.testRun.count(),
    ])
    const grouped = await db.syncJob.groupBy({ by: ['status'], _count: true })
    const queue: Record<string, number> = {}
    for (const g of grouped) queue[g.status] = g._count
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
  } catch {
    const store = getFallbackStore()
    return ok({
      counts: {
        totalUsers: store.users.length,
        totalMatches: store.matches.length,
        totalTeams: store.generatedTeams.length,
        totalTransfers: 0,
        totalAccounts: 0,
        totalJobs: 0,
        totalErrors: 0,
        totalTests: 0,
      },
      queue: {},
      cache: cache.stats_snapshot(),
      transferStats: {},
      recentErrors: [],
    })
  }
})
