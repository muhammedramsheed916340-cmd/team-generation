import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'
import { processTransferQueue } from '@/lib/fantasy-transfer'

/**
 * POST /api/fantasy/queue/:id/retry
 * Retry all FAILED transfers in a queue.
 */
export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const id = params.id
  const queue = await db.transferQueue.findFirst({ where: { id, userId: auth.user.id } })
  if (!queue) return fail('Queue not found', 404, 'NOT_FOUND')

  // reset FAILED rows to RETRYING
  const reset = await db.transferHistory.updateMany({
    where: { queueId: id, status: 'FAILED' },
    data: { status: 'RETRYING', error: null, errorCode: null },
  })
  await db.transferQueue.update({ where: { id }, data: { status: 'QUEUED', failedCount: 0 } })

  if (queue.totalTeams <= 50) {
    await processTransferQueue(id)
  } else {
    processTransferQueue(id).catch((e) => console.error('queue retry error', e))
  }
  const updated = await db.transferQueue.findUnique({ where: { id } })
  return ok({ queue: updated, resetCount: reset.count })
})
