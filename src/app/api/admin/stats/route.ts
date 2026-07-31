import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  // In-memory: return empty data (no DB)
  return ok({
    totalUsers: 1, totalMatches: 4, totalGeneratedTeams: 0, totalTransfers: 0,
    totalAccounts: 0, activeSubs: 0, pendingJobs: 0, unresolvedErrors: 0,
    transfersByStatus: {}, teamsByStrategy: {},
  })
})
