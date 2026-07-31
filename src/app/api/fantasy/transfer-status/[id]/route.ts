import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'
import { processTransferQueue } from '@/lib/fantasy-transfer'

/**
 * GET /api/fantasy/transfer-status/:id
 * Returns the status of a transfer queue (progress, counts) + recent history rows.
 * If ?process=true, also kicks the queue processor (useful for small batches).
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const id = params.id
  const url = new URL(req.url)
  const shouldProcess = url.searchParams.get('process') === 'true'

  const queue = await db.transferQueue.findFirst({ where: { id, userId: auth.user.id } })
  if (!queue) return fail('Queue not found', 404, 'NOT_FOUND')

  if (shouldProcess && (queue.status === 'QUEUED' || queue.status === 'PROCESSING')) {
    // process synchronously (best for small batches / live demo)
    // run without awaiting so the response returns immediately for large jobs
    if (queue.totalTeams <= 20) {
      await processTransferQueue(id)
    } else {
      processTransferQueue(id).catch((e) => console.error('queue process error', e))
    }
  }

  const [updated, recent, byStatus] = await Promise.all([
    db.transferQueue.findUnique({ where: { id } }),
    db.transferHistory.findMany({ where: { queueId: id }, orderBy: { teamIndex: 'asc' }, take: 50 }),
    db.transferHistory.groupBy({ by: ['status'], where: { queueId: id }, _count: true }),
  ])
  const progress = updated!.totalTeams > 0 ? Math.round((updated!.completedCount / updated!.totalTeams) * 100) : 0
  return ok({
    queue: updated,
    progress,
    recent,
    byStatus: byStatus.reduce((a, b) => ({ ...a, [b.status]: b._count }), {} as Record<string, number>),
  })
})
