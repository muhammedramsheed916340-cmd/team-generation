import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache, cacheKeys, cacheTTL } from '@/lib/cache'
import { apiHandler, ok, fail } from '@/lib/api'
import { pickPlayingXI } from '@/lib/mock-cricket'
import { audit } from '@/lib/audit'

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const xi = await cache.getOrSet(
    cacheKeys.playingXI(matchId),
    async () => {
      const rows = await db.playingXI.findMany({
        where: { matchId },
        include: { player: true },
        orderBy: { player: { role: 'asc' } },
      })
      return rows
    },
    cacheTTL.xi
  )
  return ok({ playingXI: xi })
})

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  // Auto-update playing XI: pick 11 from each squad using mock algorithm
  const matchId = params.id
  const match = await db.match.findUnique({ where: { id: matchId } })
  if (!match) return fail('Match not found', 404, 'NOT_FOUND')

  const players = await db.player.findMany({ where: { matchId } })
  // clear old XI
  await db.playingXI.deleteMany({ where: { matchId } })

  for (const teamShort of [match.team1Short, match.team2Short]) {
    const teamPlayers = players.filter((p) => p.team === teamShort)
    const xi = pickPlayingXI(teamPlayers)
    for (const p of xi) {
      await db.playingXI.create({ data: { matchId, playerId: p.id, source: 'auto' } })
    }
    const xiIds = new Set(xi.map((p) => p.id))
    for (const p of teamPlayers) {
      await db.player.update({
        where: { id: p.id },
        data: { isPlaying: xiIds.has(p.id) },
      })
    }
  }
  await db.match.update({
    where: { id: matchId },
    data: { playingXINamed: true, playingXIAnnouncedAt: new Date(), lastSyncedAt: new Date() },
  })
  cache.delete(cacheKeys.playingXI(matchId))
  cache.delete(cacheKeys.players(matchId))

  await audit({ action: 'PLAYING_XI_UPDATED', entity: 'Match', entityId: matchId, details: { auto: true } })
  return ok({ announced: true })
})
