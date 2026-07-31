import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache, cacheKeys, cacheTTL } from '@/lib/cache'
import { apiHandler, ok, fail } from '@/lib/api'
import { getFallbackStore, isDatabaseAvailable } from '@/lib/fallback-data'

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const id = params.id

  if (!isDatabaseAvailable()) {
    const store = getFallbackStore()
    const match = store.matches.find((m) => m.id === id)
    if (!match) return fail('Match not found', 404, 'NOT_FOUND')
    return ok({ ...match, _count: { players: store.players.filter((p) => p.matchId === id).length, playingXI: store.playingXI.filter((x) => x.matchId === id).length, generatedTeams: 0 } })
  }

  try {
    const cacheKey = cacheKeys.match(id)
    const match = await cache.getOrSet(
      cacheKey,
      async () => {
        const m = await db.match.findUnique({ where: { id }, include: { _count: true } })
        return m
      },
      cacheTTL.match
    )
    if (!match) return fail('Match not found', 404, 'NOT_FOUND')
    return ok(match)
  } catch {
    const store = getFallbackStore()
    const match = store.matches.find((m) => m.id === id)
    if (!match) return fail('Match not found', 404, 'NOT_FOUND')
    return ok({ ...match, _count: { players: store.players.filter((p) => p.matchId === id).length, playingXI: store.playingXI.filter((x) => x.matchId === id).length, generatedTeams: 0 } })
  }
})
