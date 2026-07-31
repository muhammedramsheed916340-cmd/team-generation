import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate, requireAdmin } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { audit } from '@/lib/audit'

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  const [
    totalUsers, totalMatches, totalGeneratedTeams, totalTransfers,
    totalAccounts, activeSubs, pendingJobs, unresolvedErrors,
  ] = await Promise.all([
    db.user.count(),
    db.match.count(),
    db.generatedTeam.count(),
    db.transferHistory.count(),
    db.fantasyAccount.count(),
    db.subscription.count({ where: { status: 'ACTIVE' } }),
    db.syncJob.count({ where: { status: { in: ['QUEUED', 'RETRYING'] } } }),
    db.errorLog.count({ where: { resolved: false } }),
  ])
  const transfersByStatus = await db.transferHistory.groupBy({ by: ['status'], _count: true })
  const teamsByStrategy = await db.generatedTeam.groupBy({ by: ['strategy'], _count: true })
  return ok({
    totalUsers, totalMatches, totalGeneratedTeams, totalTransfers,
    totalAccounts, activeSubs, pendingJobs, unresolvedErrors,
    transfersByStatus: transfersByStatus.reduce((a, b) => ({ ...a, [b.status]: b._count }), {} as Record<string, number>),
    teamsByStrategy: teamsByStrategy.reduce((a, b) => ({ ...a, [b.strategy]: b._count }), {} as Record<string, number>),
  })
})
