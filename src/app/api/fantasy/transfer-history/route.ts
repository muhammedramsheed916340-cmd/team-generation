import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'

/**
 * GET /api/fantasy/transfer-history
 * Query: ?accountId=&status=&limit=
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const url = new URL(req.url)
  const accountId = url.searchParams.get('accountId') || undefined
  const status = url.searchParams.get('status') || undefined
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)

  const where: Record<string, unknown> = { userId: auth.user.id }
  if (accountId) where.accountId = accountId
  if (status) where.status = status

  const [rows, total, successCount, failedCount] = await Promise.all([
    db.transferHistory.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, include: { account: { select: { platform: true, mobile: true, displayName: true } } } }),
    db.transferHistory.count({ where }),
    db.transferHistory.count({ where: { ...where, status: { in: ['VERIFIED', 'SUCCESS'] } } }),
    db.transferHistory.count({ where: { ...where, status: 'FAILED' } }),
  ])
  return ok({ transfers: rows, total, successCount, failedCount })
})
