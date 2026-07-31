import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiHandler, ok, fail } from '@/lib/api'
import { predictMatch } from '@/lib/prediction'
import { getFallbackStore, isDatabaseAvailable } from '@/lib/fallback-data'

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  if (!isDatabaseAvailable()) {
    // Use fallback data for prediction
    const store = getFallbackStore()
    const match = store.matches.find((m) => m.id === params.id)
    if (!match) return fail('Match not found', 404, 'NOT_FOUND')
    const players = store.players.filter((p) => p.matchId === params.id)
    const prediction = computePrediction(match, players)
    return ok(prediction)
  }

  try {
    const prediction = await predictMatch(params.id)
    if (!prediction) return fail('Match not found', 404, 'NOT_FOUND')
    return ok(prediction)
  } catch {
    const store = getFallbackStore()
    const match = store.matches.find((m) => m.id === params.id)
    if (!match) return fail('Match not found', 404, 'NOT_FOUND')
    const players = store.players.filter((p) => p.matchId === params.id)
    const prediction = computePrediction(match, players)
    return ok(prediction)
  }
})

function computePrediction(match: any, players: any[]) {
  const team1Players = players.filter((p) => p.team === match.team1Short)
  const team2Players = players.filter((p) => p.team === match.team2Short)
  const s1 = team1Players.reduce((a, p) => a + (p.formScore / 100) * p.credit, 0)
  const s2 = team2Players.reduce((a, p) => a + (p.formScore / 100) * p.credit, 0)
  const total = s1 + s2
  let p1 = total > 0 ? s1 / total : 0.5
  let p2 = total > 0 ? s2 / total : 0.5
  if (match.tossWinner) {
    const boost = 0.08
    if (match.tossWinner === match.team1Short) { p1 += boost; p2 -= boost } else { p2 += boost; p1 -= boost }
  }
  p1 = Math.max(0.1, Math.min(0.9, p1)); p2 = Math.max(0.1, Math.min(0.9, p2))
  const sum = p1 + p2; p1 = p1 / sum; p2 = p2 / sum
  const gap = Math.abs(p1 - p2)
  const confidence = gap > 0.25 ? 'HIGH' : gap > 0.12 ? 'MEDIUM' : 'LOW'
  return {
    matchId: match.id,
    team1: { short: match.team1Short, name: match.team1Name, winProbability: Math.round(p1 * 1000) / 10, strength: Math.round(s1 * 10) / 10, keyPlayers: team1Players.sort((a, b) => (b.formScore * b.credit) - (a.formScore * a.credit)).slice(0, 3).map((p) => ({ name: p.name, role: p.role, impact: Math.round((p.formScore * p.credit) / 10) / 10 })) },
    team2: { short: match.team2Short, name: match.team2Name, winProbability: Math.round(p2 * 1000) / 10, strength: Math.round(s2 * 10) / 10, keyPlayers: team2Players.sort((a, b) => (b.formScore * b.credit) - (a.formScore * a.credit)).slice(0, 3).map((p) => ({ name: p.name, role: p.role, impact: Math.round((p.formScore * p.credit) / 10) / 10 })) },
    tossAdvantage: match.tossWinner ? `${match.tossWinner} (${match.tossDecision})` : null,
    predictedTotalScore: Math.round(140 + ((s1 + s2) / 2 / 100) * 80),
    predictedWickets: 6,
    confidence,
    factors: [
      { label: 'Avg Form', team1Value: (team1Players.reduce((a, p) => a + p.formScore, 0) / Math.max(team1Players.length, 1)).toFixed(1), team2Value: (team2Players.reduce((a, p) => a + p.formScore, 0) / Math.max(team2Players.length, 1)).toFixed(1), edge: team1Players.reduce((a, p) => a + p.formScore, 0) / Math.max(team1Players.length, 1) > team2Players.reduce((a, p) => a + p.formScore, 0) / Math.max(team2Players.length, 1) ? match.team1Short : match.team2Short },
      { label: 'Squad Size', team1Value: String(team1Players.length), team2Value: String(team2Players.length), edge: team1Players.length > team2Players.length ? match.team1Short : match.team2Short },
    ],
  }
}
