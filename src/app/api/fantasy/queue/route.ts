import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'
import { processTransferQueue } from '@/lib/fantasy-transfer'

/**
 * GET /api/fantasy/queue - list user's transfer queues
 * POST /api/fantasy/queue - trigger processing of a queue { queueId }
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const queues = await db.transferQueue.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { account: { select: { platform: true, mobile: true, displayName: true } } },
  })
  return ok({ queues })
})

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { queueId } = await req.json()
  const queue = await db.transferQueue.findFirst({ where: { id: queueId, userId: auth.user.id } })
  if (!queue) return fail('Queue not found', 404, 'NOT_FOUND')
  if (queue.totalTeams <= 50) {
    await processTransferQueue(queueId)
  } else {
    processTransferQueue(queueId).catch((e) => console.error('queue process error', e))
  }
  const updated = await db.transferQueue.findUnique({ where: { id: queueId } })
  return ok({ queue: updated })
})
