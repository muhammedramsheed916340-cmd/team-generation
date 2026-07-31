import { NextRequest } from 'next/server'
import { apiHandler, ok, fail } from '@/lib/api'
import { simulateMatch } from '@/lib/match-simulator'
import { authenticate } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { getFallbackStore, isDatabaseAvailable } from '@/lib/fallback-data'

function simulateWithFallback(matchId: string) {
  const store = getFallbackStore()
  const match = store.matches.find((m) => m.id === matchId)
  if (!match) return null
  const players = store.players.filter((p) => p.matchId === matchId)
  // Inline simulation using fallback data
  const team1Batsmen = players.filter((p) => p.team === match.team1Short && (p.role === 'BAT' || p.role === 'WK' || p.role === 'AR'))
  const team2Batsmen = players.filter((p) => p.team === match.team2Short && (p.role === 'BAT' || p.role === 'WK' || p.role === 'AR'))
  const team1Bowlers = players.filter((p) => p.team === match.team1Short && (p.role === 'BOWL' || p.role === 'AR'))
  const team2Bowlers = players.filter((p) => p.team === match.team2Short && (p.role === 'BOWL' || p.role === 'AR'))

  const bat1 = team1Batsmen.map((p) => ({ name: p.name, role: p.role, formScore: p.formScore }))
  const bat2 = team2Batsmen.map((p) => ({ name: p.name, role: p.role, formScore: p.formScore }))
  const bowl1 = team1Bowlers.map((p) => ({ name: p.name, role: p.role, formScore: p.formScore }))
  const bowl2 = team2Bowlers.map((p) => ({ name: p.name, role: p.role, formScore: p.formScore }))

  // Simple inline simulation
  const simInnings = (bat: any[], bowl: any[], battingTeam: string, bowlingTeam: string, target?: number) => {
    let runs = 0, wickets = 0, balls = 0
    const timeline: any[] = []
    let striker = bat[0], nonStriker = bat[1], next = 2
    for (let over = 0; over < 20 && wickets < 10; over++) {
      const bowler = bowl[over % bowl.length]
      for (let ballInOver = 1; ballInOver <= 6; ballInOver++) {
        if (wickets >= 10 || (target && runs >= target)) break
        balls++
        const wicketChance = 0.04 + (bowler.formScore / 100) * 0.04
        if (Math.random() < wicketChance) {
          wickets++
          timeline.push({ over, ballInOver, batsman: striker.name, bowler: bowler.name, runs: 0, isWicket: true, wicketType: 'CAUGHT', scoreAfter: `${runs}/${wickets}`, commentary: `WICKET! ${striker.name} caught by ${bowler.name}. ${runs}/${wickets}` })
          if (next < bat.length) { striker = bat[next]; next++ } else break
        } else {
          const r = Math.random()
          let runsThisBall = 0
          if (r < 0.4) runsThisBall = 0
          else if (r < 0.62) runsThisBall = 1
          else if (r < 0.74) runsThisBall = 2
          else if (r < 0.82) runsThisBall = 3
          else if (r < 0.94) runsThisBall = 4
          else runsThisBall = 6
          runs += runsThisBall
          timeline.push({ over, ballInOver, batsman: striker.name, bowler: bowler.name, runs: runsThisBall, isWicket: false, scoreAfter: `${runs}/${wickets}`, commentary: `${runsThisBall === 4 ? 'FOUR!' : runsThisBall === 6 ? 'SIX!' : runsThisBall === 0 ? 'dot ball' : runsThisBall + ' runs'} — ${striker.name}. ${runs}/${wickets}` })
          if (runsThisBall % 2 === 1) { [striker, nonStriker] = [nonStriker, striker] }
        }
      }
      ;[striker, nonStriker] = [nonStriker, striker]
    }
    return { battingTeam, bowlingTeam, totalRuns: runs, totalWickets: wickets, oversBowled: Math.floor(balls / 6) + (balls % 6) / 10, runRate: balls > 0 ? Math.round((runs / (balls / 6)) * 100) / 100 : 0, timeline, topScorers: [], topBowlers: [] }
  }

  const firstInnings = simInnings(bat1, bowl2, match.team1Short, match.team2Short)
  const target = firstInnings.totalRuns + 1
  const secondInnings = simInnings(bat2, bowl1, match.team2Short, match.team1Short, target)

  let result: string, winner: string | null, margin: string
  if (secondInnings.totalRuns >= target) {
    const wicketsLeft = 10 - secondInnings.totalWickets
    result = `${match.team2Short} won by ${wicketsLeft} wickets`; winner = match.team2Short; margin = `${wicketsLeft} wickets`
  } else if (secondInnings.totalRuns === firstInnings.totalRuns) {
    result = 'Match tied'; winner = null; margin = 'Tie'
  } else {
    const runMargin = target - 1 - secondInnings.totalRuns
    result = `${match.team1Short} won by ${runMargin} runs`; winner = match.team1Short; margin = `${runMargin} runs`
  }

  return { matchId, matchName: match.shortName, firstInnings, secondInnings, result, winner, margin }
}

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const auth = await authenticate(req)

  if (!isDatabaseAvailable()) {
    const result = simulateWithFallback(params.id)
    if (!result) return fail('Match not found', 404, 'NOT_FOUND')
    return ok(result)
  }

  try {
    const result = await simulateMatch(params.id)
    if (!result) return fail('Match not found', 404, 'NOT_FOUND')
    await audit({ userId: auth?.user.id, action: 'MATCH_SIMULATED', entity: 'Match', entityId: params.id, details: { result: result.result } })
    return ok(result)
  } catch {
    const result = simulateWithFallback(params.id)
    if (!result) return fail('Match not found', 404, 'NOT_FOUND')
    return ok(result)
  }
})
