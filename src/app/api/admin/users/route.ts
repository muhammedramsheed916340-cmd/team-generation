import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { subscription: { include: { plan: true } }, _count: { select: { generatedTeams: true, transfers: true, fantasyAccounts: true } } },
  })
  return ok({ users })
})
