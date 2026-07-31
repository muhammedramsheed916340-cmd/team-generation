import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache, cacheKeys, cacheTTL } from '@/lib/cache'
import { apiHandler, ok } from '@/lib/api'
import { getFallbackStore, isDatabaseAvailable } from '@/lib/fallback-data'

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined

  // If database is not available (Vercel serverless), use fallback in-memory data
  if (!isDatabaseAvailable()) {
    const store = getFallbackStore()
    let matches = store.matches
    if (status) matches = matches.filter((m) => m.status === status)
    return ok({ matches, cached: false, source: 'memory' })
  }

  // Try database, fall back to memory if it fails
  try {
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
  } catch (e) {
    // Database error — use fallback
    const store = getFallbackStore()
    let matches = store.matches
    if (status) matches = matches.filter((m) => m.status === status)
    return ok({ matches, cached: false, source: 'fallback' })
  }
})
