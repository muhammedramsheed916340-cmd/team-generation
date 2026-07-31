import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  const jobs = await db.syncJob.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { match: { select: { shortName: true } } } })
  return ok({ jobs })
})
