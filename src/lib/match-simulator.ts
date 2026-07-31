/**
 * Live Match Score Simulation Engine.
 * Simulates a ball-by-ball cricket match using player form/role data.
 * Produces an innings timeline with runs, wickets, overs, and a result.
 */
import { db } from '@/lib/db'

export interface BallEvent {
  over: number          // 0-indexed over number
  ballInOver: number    // 1-6
  batsman: string
  bowler: string
  runs: number          // 0-6 (6 = six)
  isWicket: boolean
  wicketType?: string   // BOWLED | CAUGHT | LBW | RUN_OUT | STUMPED
  dismissedBatsman?: string
  scoreAfter: string    // "45/2"
  commentary: string
}

export interface InningsResult {
  battingTeam: string
  bowlingTeam: string
  totalRuns: number
  totalWickets: number
  oversBowled: number
  runRate: number
  timeline: BallEvent[]
  topScorers: { name: string; runs: number; balls: number }[]
  topBowlers: { name: string; wickets: number; runsConceded: number }[]
}

export interface MatchSimulationResult {
  matchId: string
  matchName: string
  firstInnings: InningsResult
  secondInnings: InningsResult
  result: string
  winner: string | null
  margin: string
}

const WICKET_TYPES = ['BOWLED', 'CAUGHT', 'LBW', 'RUN_OUT', 'STUMPED']

function pickBowler(bowlers: { name: string }[]): { name: string } {
  return bowlers[Math.floor(Math.random() * bowlers.length)]
}

function simulateInnings(
  battingPlayers: { name: string; role: string; formScore: number }[],
  bowlingPlayers: { name: string; role: string; formScore: number }[],
  battingTeam: string,
  bowlingTeam: string,
  target?: number
): InningsResult {
  const timeline: BallEvent[] = []
  const batsmen = [...battingPlayers]
  const bowlers = bowlingPlayers.filter((p) => p.role === 'BOWL' || p.role === 'AR')
  const usableBowlers = bowlers.length > 0 ? bowlers : bowlingPlayers

  let striker = batsmen[0]
  let nonStriker = batsmen[1]
  let nextBatsmanIdx = 2
  let totalRuns = 0
  let totalWickets = 0
  let ballsBowled = 0
  const maxOvers = 20 // T20
  const maxBalls = maxOvers * 6

  const batsmanStats: Record<string, { runs: number; balls: number }> = {}
  const bowlerStats: Record<string, { wickets: number; runsConceded: number; balls: number }> = {}

  batsmen.forEach((b) => { batsmanStats[b.name] = { runs: 0, balls: 0 } })
  usableBowlers.forEach((b) => { bowlerStats[b.name] = { wickets: 0, runsConceded: 0, balls: 0 } })

  for (let over = 0; over < maxOvers && totalWickets < 10; over++) {
    const bowler = pickBowler(usableBowlers)
    for (let ballInOver = 1; ballInOver <= 6; ballInOver++) {
      if (totalWickets >= 10) break
      if (target && totalRuns >= target) break

      ballsBowled++
      batsmanStats[striker.name].balls++
      bowlerStats[bowler.name].balls++

      // probability of wicket: base 4% + bowler form factor
      const wicketChance = 0.04 + (bowler.formScore / 100) * 0.04 - (striker.formScore / 100) * 0.02
      const isWicket = Math.random() < wicketChance

      if (isWicket) {
        totalWickets++
        const wicketType = WICKET_TYPES[Math.floor(Math.random() * WICKET_TYPES.length)]
        bowlerStats[bowler.name].wickets++
        timeline.push({
          over, ballInOver, batsman: striker.name, bowler: bowler.name,
          runs: 0, isWicket: true, wicketType,
          dismissedBatsman: striker.name,
          scoreAfter: `${totalRuns}/${totalWickets}`,
          commentary: `WICKET! ${striker.name} ${wicketType.toLowerCase()} by ${bowler.name}. ${totalRuns}/${totalWickets}`,
        })
        // next batsman
        if (nextBatsmanIdx < batsmen.length) {
          striker = batsmen[nextBatsmanIdx]
          nextBatsmanIdx++
        } else {
          break // all out
        }
      } else {
        // runs probability based on batsman form
        const formFactor = striker.formScore / 100
        const r = Math.random()
        let runs: number
        if (r < 0.38 - formFactor * 0.1) runs = 0       // dot ball
        else if (r < 0.60) runs = 1                      // single
        else if (r < 0.72) runs = 2                      // couple
        else if (r < 0.80) runs = 3                      // triple (rare)
        else if (r < 0.93) runs = 4                      // four
        else runs = 6                                     // six
        totalRuns += runs
        batsmanStats[striker.name].runs += runs
        bowlerStats[bowler.name].runsConceded += runs
        const shot = runs === 4 ? 'FOUR!' : runs === 6 ? 'SIX!' : runs === 0 ? 'dot ball' : `${runs} run${runs > 1 ? 's' : ''}`
        timeline.push({
          over, ballInOver, batsman: striker.name, bowler: bowler.name,
          runs, isWicket: false,
          scoreAfter: `${totalRuns}/${totalWickets}`,
          commentary: `${shot} — ${striker.name} off ${bowler.name}. ${totalRuns}/${totalWickets} (${over}.${ballInOver})`,
        })
        // strike rotation on odd runs
        if (runs % 2 === 1) { [striker, nonStriker] = [nonStriker, striker] }
      }
    }
    // strike rotation at end of over
    ;[striker, nonStriker] = [nonStriker, striker]
    if (target && totalRuns >= target) break
  }

  const oversBowled = Math.floor(ballsBowled / 6) + (ballsBowled % 6) / 10
  const runRate = ballsBowled > 0 ? Math.round((totalRuns / (ballsBowled / 6)) * 100) / 100 : 0

  const topScorers = Object.entries(batsmanStats)
    .map(([name, s]) => ({ name, runs: s.runs, balls: s.balls }))
    .filter((s) => s.balls > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 5)

  const topBowlers = Object.entries(bowlerStats)
    .map(([name, s]) => ({ name, wickets: s.wickets, runsConceded: s.runsConceded }))
    .filter((s) => s.balls > 0 || s.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)
    .slice(0, 5)

  return {
    battingTeam, bowlingTeam, totalRuns, totalWickets,
    oversBowled, runRate, timeline, topScorers, topBowlers,
  }
}

export async function simulateMatch(matchId: string): Promise<MatchSimulationResult | null> {
  const match = await db.match.findUnique({ where: { id: matchId } })
  if (!match) return null
  const players = await db.player.findMany({ where: { matchId } })

  const team1Batsmen = players.filter((p) => p.team === match.team1Short && (p.role === 'BAT' || p.role === 'WK' || p.role === 'AR')).map((p) => ({ name: p.name, role: p.role, formScore: p.formScore }))
  const team2Batsmen = players.filter((p) => p.team === match.team2Short && (p.role === 'BAT' || p.role === 'WK' || p.role === 'AR')).map((p) => ({ name: p.name, role: p.role, formScore: p.formScore }))
  const team1Bowlers = players.filter((p) => p.team === match.team1Short && (p.role === 'BOWL' || p.role === 'AR')).map((p) => ({ name: p.name, role: p.role, formScore: p.formScore }))
  const team2Bowlers = players.filter((p) => p.team === match.team2Short && (p.role === 'BOWL' || p.role === 'AR')).map((p) => ({ name: p.name, role: p.role, formScore: p.formScore }))

  // toss winner bats first
  const tossWinnerBatsFirst = match.tossWinner ? match.tossDecision === 'BAT' : Math.random() > 0.5
  const firstBattingTeam = tossWinnerBatsFirst ? match.team1Short : match.team2Short
  const firstBattingBatsmen = firstBattingTeam === match.team1Short ? team1Batsmen : team2Batsmen
  const firstBowlingBowlers = firstBattingTeam === match.team1Short ? team2Bowlers : team1Bowlers
  const secondBattingBatsmen = firstBattingTeam === match.team1Short ? team2Batsmen : team1Batsmen
  const secondBowlingBowlers = firstBattingTeam === match.team1Short ? team1Bowlers : team2Bowlers
  const secondBattingTeam = firstBattingTeam === match.team1Short ? match.team2Short : match.team1Short

  const firstInnings = simulateInnings(firstBattingBatsmen, firstBowlingBowlers, firstBattingTeam, secondBattingTeam)
  const target = firstInnings.totalRuns + 1
  const secondInnings = simulateInnings(secondBattingBatsmen, secondBowlingBowlers, secondBattingTeam, firstBattingTeam, target)

  let result: string
  let winner: string | null
  let margin: string
  if (secondInnings.totalRuns >= target) {
    const wicketsLeft = 10 - secondInnings.totalWickets
    result = `${secondBattingTeam} won by ${wicketsLeft} wickets`
    winner = secondBattingTeam
    margin = `${wicketsLeft} wickets`
  } else if (secondInnings.totalRuns === firstInnings.totalRuns) {
    result = 'Match tied'
    winner = null
    margin = 'Tie'
  } else {
    const runMargin = target - 1 - secondInnings.totalRuns
    result = `${firstBattingTeam} won by ${runMargin} runs`
    winner = firstBattingTeam
    margin = `${runMargin} runs`
  }

  return {
    matchId,
    matchName: match.shortName,
    firstInnings,
    secondInnings,
    result,
    winner,
    margin,
  }
}
