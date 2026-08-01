import { NextRequest } from 'next/server'
import { apiHandler, ok, fail } from '@/lib/api'
import { cache } from '@/lib/cache'
import CryptoJS from 'crypto-js'

const REAL_BACKEND = 'https://tgsoftware-api.online'
const DECRYPT_KEY = 'coder_bobby_believer01_tg_software'
const ROLE_MAP: Record<number, string> = { 0: 'BOWL', 1: 'BAT', 2: 'AR', 3: 'WK', 4: 'BAT' }

function decrypt(enc: any): any {
  if (typeof enc !== 'string' || !enc.startsWith('U2FsdGVk')) return enc
  try {
    const bytes = CryptoJS.AES.decrypt(enc, DECRYPT_KEY)
    const d = bytes.toString(CryptoJS.enc.Utf8)
    try { return JSON.parse(d) } catch { return d }
  } catch { return enc }
}

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id

  // Fetch real match data
  const res = await fetch(`${REAL_BACKEND}/api/fantasy/match/${matchId}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return fail('Match not found', 404, 'NOT_FOUND')
  const json = await res.json()
  if (json.status !== 'success' || !json.data) return fail('Match not found', 404, 'NOT_FOUND')

  const m = json.data
  const team1 = decrypt(m.left_team_name)
  const team2 = decrypt(m.right_team_name)

  const parsePlayers = (arr: any[], teamName: string) => {
    return arr.map((enc) => {
      const p = decrypt(enc)
      if (!p || typeof p !== 'object') return null
      return { name: p.name, role: ROLE_MAP[p.role] || 'BAT', formScore: p.points || 50, playing: p.playing === 1 || p.playing === true }
    }).filter(Boolean) as any[]
  }

  const t1Players = parsePlayers(m.left_team_players || [], team1)
  const t2Players = parsePlayers(m.right_team_players || [], team2)
  const bat1 = t1Players.filter((p) => p.role === 'BAT' || p.role === 'WK' || p.role === 'AR')
  const bat2 = t2Players.filter((p) => p.role === 'BAT' || p.role === 'WK' || p.role === 'AR')
  const bowl1 = t1Players.filter((p) => p.role === 'BOWL' || p.role === 'AR')
  const bowl2 = t2Players.filter((p) => p.role === 'BOWL' || p.role === 'AR')

  // Simple simulation
  const simInnings = (bat: any[], bowl: any[], battingTeam: string, bowlingTeam: string, target?: number) => {
    let runs = 0, wickets = 0, balls = 0
    const timeline: any[] = []
    let striker = bat[0], nonStriker = bat[1], next = 2
    for (let over = 0; over < 20 && wickets < 10; over++) {
      const bowler = bowl[over % Math.max(bowl.length, 1)]
      if (!bowler) break
      for (let ballInOver = 1; ballInOver <= 6; ballInOver++) {
        if (wickets >= 10 || (target && runs >= target)) break
        balls++
        const wicketChance = 0.04 + ((bowler.formScore || 50) / 100) * 0.04
        if (Math.random() < wicketChance) {
          wickets++
          timeline.push({ over, ballInOver, batsman: striker?.name, bowler: bowler.name, runs: 0, isWicket: true, wicketType: 'CAUGHT', scoreAfter: `${runs}/${wickets}`, commentary: `WICKET! ${striker?.name} out. ${runs}/${wickets}` })
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
          timeline.push({ over, ballInOver, batsman: striker?.name, bowler: bowler.name, runs: runsThisBall, isWicket: false, scoreAfter: `${runs}/${wickets}`, commentary: `${runsThisBall === 4 ? 'FOUR!' : runsThisBall === 6 ? 'SIX!' : runsThisBall + ' runs'} — ${striker?.name}. ${runs}/${wickets}` })
          if (runsThisBall % 2 === 1) { [striker, nonStriker] = [nonStriker, striker] }
        }
      }
      ;[striker, nonStriker] = [nonStriker, striker]
    }
    return { battingTeam, bowlingTeam, totalRuns: runs, totalWickets: wickets, oversBowled: Math.floor(balls / 6) + (balls % 6) / 10, runRate: balls > 0 ? Math.round((runs / (balls / 6)) * 100) / 100 : 0, timeline, topScorers: [], topBowlers: [] }
  }

  const firstInnings = simInnings(bat1, bowl2, team1, team2)
  const target = firstInnings.totalRuns + 1
  const secondInnings = simInnings(bat2, bowl1, team2, team1, target)

  let result: string, winner: string | null, margin: string
  if (secondInnings.totalRuns >= target) {
    const wicketsLeft = 10 - secondInnings.totalWickets
    result = `${team2} won by ${wicketsLeft} wickets`; winner = team2; margin = `${wicketsLeft} wickets`
  } else if (secondInnings.totalRuns === firstInnings.totalRuns) {
    result = 'Match tied'; winner = null; margin = 'Tie'
  } else {
    const runMargin = target - 1 - secondInnings.totalRuns
    result = `${team1} won by ${runMargin} runs`; winner = team1; margin = `${runMargin} runs`
  }

  return ok({ matchId, matchName: `${team1} vs ${team2}`, firstInnings, secondInnings, result, winner, margin })
})
