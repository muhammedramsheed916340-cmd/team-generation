import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler, ok, fail } from '@/lib/api'
import { audit } from '@/lib/audit'
import { simulateToss } from '@/lib/mock-cricket'
import { cache, cacheKeys } from '@/lib/cache'

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const match = await db.match.findUnique({ where: { id: matchId } })
  if (!match) return fail('Match not found', 404, 'NOT_FOUND')

  const result = await simulateToss(matchId)
  cache.delete(cacheKeys.match(matchId))
  cache.delete(cacheKeys.matchList())

  await audit({
    action: 'TOSS_UPDATED',
    entity: 'Match',
    entityId: matchId,
    details: result || {},
  })
  return ok(result)
})
