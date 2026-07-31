import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache, cacheKeys, cacheTTL } from '@/lib/cache'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const players = await cache.getOrSet(
    cacheKeys.players(matchId),
    async () => {
      return db.player.findMany({
        where: { matchId },
        orderBy: [{ team: 'asc' }, { credit: 'desc' }],
      })
    },
    cacheTTL.players
  )
  return ok({ players })
})
