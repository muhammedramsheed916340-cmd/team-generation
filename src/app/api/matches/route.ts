import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache, cacheKeys, cacheTTL } from '@/lib/cache'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const cacheKey = cacheKeys.matchList(status || 'all')

  const matches = await cache.getOrSet(
    cacheKey,
    async () => {
      const where = status ? { status } : {}
      const rows = await db.match.findMany({
        where,
        orderBy: { startAt: 'asc' },
        include: {
          _count: { select: { players: true, playingXI: true, generatedTeams: true } },
        },
      })
      return rows
    },
    cacheTTL.match
  )

  return ok({ matches, cached: cache.has(cacheKey) })
})
