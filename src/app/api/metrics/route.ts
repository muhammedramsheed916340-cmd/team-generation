import { NextRequest } from 'next/server'
import { apiHandler, ok } from '@/lib/api'
import { cache } from '@/lib/cache'

export const GET = apiHandler(async () => {
  return ok({
    counts: { totalUsers: 1, totalMatches: 4, totalTeams: 0, totalTransfers: 0, totalAccounts: 0, totalJobs: 0, totalErrors: 0, totalTests: 0 },
    queue: {},
    cache: cache.stats_snapshot(),
    transferStats: {},
    recentErrors: [],
  })
})
