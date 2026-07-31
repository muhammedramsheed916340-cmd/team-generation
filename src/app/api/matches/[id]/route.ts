import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache, cacheKeys, cacheTTL } from '@/lib/cache'
import { apiHandler, ok, fail } from '@/lib/api'
import { seedMatch } from '@/lib/mock-cricket'

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const id = params.id
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
})

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  // create a new mock match (admin/dev convenience)
  const matchId = await seedMatch({ daysFromNow: Math.floor(Math.random() * 3), announceXI: Math.random() > 0.5 })
  const match = await db.match.findUnique({ where: { id: matchId } })
  return ok(match, 201)
})
