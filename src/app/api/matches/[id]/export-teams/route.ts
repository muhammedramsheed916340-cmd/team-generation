import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler, fail } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const url = new URL(req.url)
  const strategy = url.searchParams.get('strategy')
  const teams = await db.generatedTeam.findMany({
    where: { matchId, ...(strategy ? { strategy } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { players: { include: { player: true }, orderBy: { sortOrder: 'asc' } } },
  })
  if (!teams.length) return fail('No teams found to export', 404, 'NOT_FOUND')

  const headers = [
    'Team #', 'Strategy', 'Captain', 'Vice Captain',
    'Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5',
    'Player 6', 'Player 7', 'Player 8', 'Player 9', 'Player 10', 'Player 11',
    'WK', 'BAT', 'AR', 'BOWL', 'Credits', 'Risk', 'Uniqueness %', 'Projected Score',
  ]
  const rows = teams.map((t, i) => {
    const players = t.players.map((tp) => tp.player.name)
    while (players.length < 11) players.push('')
    const cap = t.players.find((p) => p.isCaptain)?.player.name || ''
    const vc = t.players.find((p) => p.isViceCaptain)?.player.name || ''
    return [
      i + 1, t.strategy, cap, vc,
      ...players,
      t.wkCount, t.batCount, t.arCount, t.bowlCount,
      t.totalCredit, t.riskLevel, t.uniquenessScore, t.projectedScore,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
  })
  const csv = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n')
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="teams-${matchId}-${strategy || 'all'}.csv"`,
    },
  })
})
