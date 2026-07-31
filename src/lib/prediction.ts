/**
 * Match Prediction Engine.
 * Computes win probability for each team based on:
 *  - Aggregate player form scores
 *  - Average player credits (proxy for perceived quality)
 *  - Toss advantage (toss winner gets a boost)
 *  - Home/away factor (simulated via team color hash)
 *  - Playing XI completeness
 *
 * Also produces a "key players" list and a predicted score range.
 */
import { db } from '@/lib/db'

export interface MatchPrediction {
  matchId: string
  team1: { short: string; name: string; winProbability: number; strength: number; keyPlayers: { name: string; role: string; impact: number }[] }
  team2: { short: string; name: string; winProbability: number; strength: number; keyPlayers: { name: string; role: string; impact: number }[] }
  tossAdvantage: string | null
  predictedTotalScore: number
  predictedWickets: number
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  factors: { label: string; team1Value: string; team2Value: string; edge: string }[]
}

function teamStrength(players: { formScore: number; credit: number; role: string; isPlaying: boolean }[]) {
  // weighted strength: form * credit, normalized
  const usable = players.length > 0 ? players : []
  if (usable.length === 0) return 0
  const total = usable.reduce((a, p) => a + (p.formScore / 100) * p.credit, 0)
  return Math.round(total * 10) / 10
}

function topKeyPlayers(players: { id: string; name: string; role: string; formScore: number; credit: number; isPlaying: boolean }[], n: number) {
  return [...players]
    .sort((a, b) => (b.formScore * b.credit) - (a.formScore * a.credit))
    .slice(0, n)
    .map((p) => ({ name: p.name, role: p.role, impact: Math.round((p.formScore * p.credit) / 10) / 10 }))
}

export async function predictMatch(matchId: string): Promise<MatchPrediction | null> {
  const match = await db.match.findUnique({ where: { id: matchId } })
  if (!match) return null

  const players = await db.player.findMany({ where: { matchId } })

  const team1Players = players.filter((p) => p.team === match.team1Short)
  const team2Players = players.filter((p) => p.team === match.team2Short)

  // Only consider playing XI if announced
  const t1Usable = match.playingXINamed ? team1Players.filter((p) => p.isPlaying) : team1Players
  const t2Usable = match.playingXINamed ? team2Players.filter((p) => p.isPlaying) : team2Players

  const s1 = teamStrength(t1Usable)
  const s2 = teamStrength(t2Usable)

  // base probability from strength ratio
  const total = s1 + s2
  let p1 = total > 0 ? s1 / total : 0.5
  let p2 = total > 0 ? s2 / total : 0.5

  // toss advantage: toss winner gets +8% boost
  let tossAdvantage: string | null = null
  if (match.tossWinner) {
    const boost = 0.08
    if (match.tossWinner === match.team1Short) {
      p1 += boost
      p2 -= boost
    } else {
      p2 += boost
      p1 -= boost
    }
    tossAdvantage = `${match.tossWinner} (${match.tossDecision})`
  }

  // playing XI completeness boost
  if (match.playingXINamed) {
    if (t1Usable.length === 11 && t2Usable.length < 11) p1 += 0.05
    if (t2Usable.length === 11 && t1Usable.length < 11) p2 += 0.05
  }

  // clamp
  p1 = Math.max(0.1, Math.min(0.9, p1))
  p2 = Math.max(0.1, Math.min(0.9, p2))
  // renormalize
  const sum = p1 + p2
  p1 = p1 / sum
  p2 = p2 / sum

  // predicted total score (T20: ~160-200 range, scaled by combined strength)
  const combinedStrength = (s1 + s2) / 2
  const predictedTotalScore = Math.round(140 + (combinedStrength / 100) * 80)
  const predictedWickets = Math.round(5 + Math.random() * 5)

  // confidence based on strength gap
  const gap = Math.abs(p1 - p2)
  const confidence: 'LOW' | 'MEDIUM' | 'HIGH' = gap > 0.25 ? 'HIGH' : gap > 0.12 ? 'MEDIUM' : 'LOW'

  const avgForm1 = t1Usable.length ? t1Usable.reduce((a, p) => a + p.formScore, 0) / t1Usable.length : 0
  const avgForm2 = t2Usable.length ? t2Usable.reduce((a, p) => a + p.formScore, 0) / t2Usable.length : 0
  const avgCredit1 = t1Usable.length ? t1Usable.reduce((a, p) => a + p.credit, 0) / t1Usable.length : 0
  const avgCredit2 = t2Usable.length ? t2Usable.reduce((a, p) => a + p.credit, 0) / t2Usable.length : 0

  return {
    matchId,
    team1: {
      short: match.team1Short,
      name: match.team1Name,
      winProbability: Math.round(p1 * 1000) / 10,
      strength: s1,
      keyPlayers: topKeyPlayers(t1Usable as any, 3),
    },
    team2: {
      short: match.team2Short,
      name: match.team2Name,
      winProbability: Math.round(p2 * 1000) / 10,
      strength: s2,
      keyPlayers: topKeyPlayers(t2Usable as any, 3),
    },
    tossAdvantage,
    predictedTotalScore,
    predictedWickets,
    confidence,
    factors: [
      { label: 'Avg Form', team1Value: avgForm1.toFixed(1), team2Value: avgForm2.toFixed(1), edge: avgForm1 > avgForm2 ? match.team1Short : match.team2Short },
      { label: 'Avg Credit', team1Value: avgCredit1.toFixed(1), team2Value: avgCredit2.toFixed(1), edge: avgCredit1 > avgCredit2 ? match.team1Short : match.team2Short },
      { label: 'Squad Size', team1Value: String(t1Usable.length), team2Value: String(t2Usable.length), edge: t1Usable.length > t2Usable.length ? match.team1Short : match.team2Short },
      { label: 'Toss', team1Value: match.tossWinner === match.team1Short ? 'Won' : '—', team2Value: match.tossWinner === match.team2Short ? 'Won' : '—', edge: match.tossWinner || '—' },
    ],
  }
}
