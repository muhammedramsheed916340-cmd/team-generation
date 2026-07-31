import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  const matches = await db.match.findMany({ orderBy: { startAt: 'desc' }, include: { _count: true } })
  return ok({ matches })
})
