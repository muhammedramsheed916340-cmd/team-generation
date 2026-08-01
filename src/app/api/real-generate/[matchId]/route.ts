/**
 * Real Team Generation API.
 * Uses REAL player data from teamgeneration.in (decrypted).
 *
 * Lineup logic:
 * - Before lineup (lineupOut=false): use full squad, but boost players with
 *   higher points/credits, avoid low-form players
 * - After lineup (lineupOut=true): ONLY use playing XI players (playing=true),
 *   completely exclude bench/offline players
 */
import { NextRequest } from 'next/server'
import { apiHandler, ok, fail } from '@/lib/api'
import { cache } from '@/lib/cache'
import CryptoJS from 'crypto-js'

const REAL_BACKEND = 'https://tgsoftware-api.online'
const DECRYPT_KEY = 'coder_bobby_believer01_tg_software'

const ROLE_MAP: Record<number, 'WK' | 'BAT' | 'AR' | 'BOWL'> = {
  0: 'BOWL', 1: 'BAT', 2: 'AR', 3: 'WK', 4: 'BAT',
}

interface RealPlayer {
  id: number
  name: string
  image: string
  team: string
  role: 'WK' | 'BAT' | 'AR' | 'BOWL'
  credits: number
  points: number
  selectedBy: number
  playing: boolean
  captainPct: number
  vcPct: number
  playerType: string
}

function decrypt(enc: any): any {
  if (typeof enc !== 'string' || !enc.startsWith('U2FsdGVk')) return enc
  try {
    const bytes = CryptoJS.AES.decrypt(enc, DECRYPT_KEY)
    const d = bytes.toString(CryptoJS.enc.Utf8)
    try { return JSON.parse(d) } catch { return d }
  } catch { return enc }
}

async function fetchRealMatch(matchId: string) {
  const res = await fetch(`${REAL_BACKEND}/api/fantasy/match/${matchId}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'TeamGen/1.0' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`Backend returned ${res.status}`)
  const json = await res.json()
  if (json.status !== 'success' || !json.data) return null

  const m = json.data
  const team1 = decrypt(m.left_team_name)
  const team2 = decrypt(m.right_team_name)
  const team1Image = decrypt(m.left_team_image)
  const team2Image = decrypt(m.right_team_image)
  const lineupOut = m.lineup_status === 1 || m.lineup_status === true

  const parsePlayers = (arr: any[], teamName: string): RealPlayer[] => {
    return arr.map((enc, i) => {
      const p = decrypt(enc)
      if (!p || typeof p !== 'object') return null
      return {
        id: p.player_fixed_id || p.pl_id || i,
        name: p.name,
        image: p.image,
        team: teamName,
        role: ROLE_MAP[p.role] || 'BAT',
        credits: p.credits,
        points: p.points || 0,
        selectedBy: p.selected_by || 0,
        playing: p.playing === 1 || p.playing === true,
        captainPct: p.captain_percentage || 0,
        vcPct: p.vice_captain_percentage || 0,
        playerType: p.player_type || 'unknown',
      }
    }).filter(Boolean) as RealPlayer[]
  }

  const team1Players = parsePlayers(m.left_team_players || [], team1)
  const team2Players = parsePlayers(m.right_team_players || [], team2)

  return {
    matchId,
    team1, team2, team1Image, team2Image,
    lineupOut,
    toss: decrypt(m.toss),
    matchTime: m.match_time,
    players: { team1: team1Players, team2: team2Players },
  }
}

// Role combinations (WK, BAT, AR, BOWL) summing to 11
const ROLE_COMBOS = [
  { wk: 1, bat: 4, ar: 2, bowl: 4 },
  { wk: 1, bat: 3, ar: 3, bowl: 4 },
  { wk: 1, bat: 4, ar: 3, bowl: 3 },
  { wk: 1, bat: 5, ar: 2, bowl: 3 },
  { wk: 1, bat: 3, ar: 2, bowl: 5 },
  { wk: 2, bat: 3, ar: 2, bowl: 4 },
  { wk: 2, bat: 4, ar: 2, bowl: 3 },
  { wk: 2, bat: 3, ar: 3, bowl: 3 },
]

const MAX_CREDIT = 100

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

function playerWeight(p: RealPlayer, strategy: string, lineupOut: boolean): number {
  // Base weight from points and credits
  const pointsNorm = Math.min(p.points / 200, 1) // normalize points 0-200 to 0-1
  const creditNorm = p.credits / 12 // normalize credits
  let w = pointsNorm * 2 + creditNorm * 1.5

  // Before lineup: boost players with high points (likely starters)
  // After lineup: only playing players are in pool, so weight by form
  if (!lineupOut) {
    // Before lineup: penalize players with very low points (likely bench)
    if (p.points < 20) w *= 0.3
    if (p.points < 50) w *= 0.6
    // Boost high selected_by (indicates likely starter)
    w *= (1 + p.selectedBy / 200)
  }

  // Strategy adjustments
  switch (strategy) {
    case 'GL':
      // Grand League: contrarian, prefer lower selection %
      w *= Math.max(0.2, 1 - p.selectedBy / 150)
      w += Math.random() * 0.5
      break
    case 'SL':
      // Small League: safe, prefer high selection %
      w *= (1 + p.selectedBy / 100)
      break
    case 'H2H':
      // H2H: optimal, prefer high points
      w *= (1 + pointsNorm)
      break
  }

  return Math.max(0.01, w)
}

function weightedPickIndex(weights: number[]): number {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0)
  if (total <= 0) return Math.floor(Math.random() * weights.length)
  let r = Math.random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i])
    if (r <= 0) return i
  }
  return weights.length - 1
}

interface GeneratedTeam {
  captainId: number
  viceCaptainId: number
  players: RealPlayer[]
  totalCredit: number
  team1Count: number
  team2Count: number
  wkCount: number
  batCount: number
  arCount: number
  bowlCount: number
  combinationKey: string
  riskLevel: string
}

function generateTeam(players: RealPlayer[], strategy: string, team1: string, team2: string, lineupOut: boolean): GeneratedTeam | null {
  // Filter players based on lineup status
  let usablePlayers: RealPlayer[]
  if (lineupOut) {
    // AFTER LINEUP: ONLY use playing XI players (exclude bench)
    usablePlayers = players.filter((p) => p.playing)
  } else {
    // BEFORE LINEUP: use all players (will weight by likely starter status)
    usablePlayers = players
  }

  if (usablePlayers.length < 11) return null

  const byRole: Record<string, RealPlayer[]> = { WK: [], BAT: [], AR: [], BOWL: [] }
  for (const p of usablePlayers) byRole[p.role]?.push(p)

  // Check each team has enough players
  const team1Count = usablePlayers.filter((p) => p.team === team1).length
  const team2Count = usablePlayers.filter((p) => p.team === team2).length
  if (team1Count < 4 || team2Count < 4) return null

  const combos = shuffle(ROLE_COMBOS)
  for (const combo of combos) {
    const picks: RealPlayer[] = []
    let ok = true

    for (const [roleKey, count] of Object.entries(combo) as [string, number][]) {
      const role = roleKey.toUpperCase() as 'WK' | 'BAT' | 'AR' | 'BOWL'
      const rolePool = byRole[role]
      if (!rolePool || rolePool.length < count) { ok = false; break }

      const weights = rolePool.map((p) => playerWeight(p, strategy, lineupOut))
      const chosen: RealPlayer[] = []
      const poolCopy = [...rolePool]
      const wCopy = [...weights]

      for (let i = 0; i < count; i++) {
        const idx = weightedPickIndex(wCopy)
        if (idx === -1) break
        chosen.push(poolCopy.splice(idx, 1)[0])
        wCopy.splice(idx, 1)
      }

      if (chosen.length !== count) { ok = false; break }
      picks.push(...chosen)
    }

    if (!ok || picks.length !== 11) continue

    // Check credits
    const totalCredit = Math.round(picks.reduce((a, p) => a + p.credits, 0) * 10) / 10
    if (totalCredit > MAX_CREDIT) continue

    // Check team split (max 10 from one team)
    const t1Count = picks.filter((p) => p.team === team1).length
    const t2Count = 11 - t1Count
    if (t1Count > 10 || t2Count > 10) continue
    if (t1Count < 1 || t2Count < 1) continue

    // Pick captain and vice-captain
    const ranked = [...picks].sort((a, b) => (b.points * b.credits) - (a.points * a.credits))
    let captain = ranked[0]
    let vc = ranked[1]
    if (strategy === 'GL' && Math.random() < 0.4) {
      const diff = picks.filter((p) => p.selectedBy < 30).sort((a, b) => b.points - a.points)
      if (diff.length) {
        captain = diff[0]
        vc = ranked.find((p) => p.id !== captain.id) || ranked[1]
      }
    }

    const wkCount = picks.filter((p) => p.role === 'WK').length
    const batCount = picks.filter((p) => p.role === 'BAT').length
    const arCount = picks.filter((p) => p.role === 'AR').length
    const bowlCount = picks.filter((p) => p.role === 'BOWL').length

    const imbalance = Math.abs(t1Count - t2Count)
    const riskLevel = imbalance <= 1 ? 'LOW' : imbalance <= 3 ? 'MEDIUM' : 'HIGH'

    return {
      captainId: captain.id,
      viceCaptainId: vc.id,
      players: picks,
      totalCredit,
      team1Count: t1Count,
      team2Count: t2Count,
      wkCount, batCount, arCount, bowlCount,
      combinationKey: `${wkCount} WK, ${batCount} BAT, ${arCount} AR, ${bowlCount} BOWL`,
      riskLevel,
    }
  }

  // Fallback: pick cheapest valid team
  for (const combo of ROLE_COMBOS) {
    const picks: RealPlayer[] = []
    let ok = true
    for (const [roleKey, count] of Object.entries(combo) as [string, number][]) {
      const role = roleKey.toUpperCase() as 'WK' | 'BAT' | 'AR' | 'BOWL'
      const rolePool = byRole[role]
      if (!rolePool || rolePool.length < count) { ok = false; break }
      const sorted = [...rolePool].sort((a, b) => a.credits - b.credits || b.points - a.points)
      picks.push(...sorted.slice(0, count))
    }
    if (!ok || picks.length !== 11) continue
    const totalCredit = Math.round(picks.reduce((a, p) => a + p.credits, 0) * 10) / 10
    if (totalCredit > MAX_CREDIT) continue
    const t1Count = picks.filter((p) => p.team === team1).length
    const t2Count = 11 - t1Count
    if (t1Count > 10 || t2Count > 10) continue

    const ranked = [...picks].sort((a, b) => (b.points * b.credits) - (a.points * a.credits))
    const wkCount = picks.filter((p) => p.role === 'WK').length
    const batCount = picks.filter((p) => p.role === 'BAT').length
    const arCount = picks.filter((p) => p.role === 'AR').length
    const bowlCount = picks.filter((p) => p.role === 'BOWL').length
    return {
      captainId: ranked[0].id, viceCaptainId: ranked[1].id,
      players: picks, totalCredit, team1Count: t1Count, team2Count: t2Count,
      wkCount, batCount, arCount, bowlCount,
      combinationKey: `${wkCount} WK, ${batCount} BAT, ${arCount} AR, ${bowlCount} BOWL`,
      riskLevel: 'LOW',
    }
  }
  return null
}

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.matchId
  const body = await req.json().catch(() => ({}))
  const strategy = body.strategy || 'GL'
  const count = Math.min(Math.max(1, body.count || 5), 20)

  // Fetch real match data (cached)
  const cacheKey = `real-match:${matchId}`
  const matchData = await cache.getOrSet(cacheKey, async () => {
    return await fetchRealMatch(matchId)
  }, 60 * 1000)

  if (!matchData) return fail('Match not found on teamgeneration.in', 404, 'NOT_FOUND')

  const allPlayers = [...matchData.players.team1, ...matchData.players.team2]

  // Generate unique teams
  const teams: GeneratedTeam[] = []
  const seen = new Set<string>()
  const maxAttempts = count * 25
  let attempts = 0

  while (teams.length < count && attempts < maxAttempts) {
    attempts++
    const team = generateTeam(allPlayers, strategy, matchData.team1, matchData.team2, matchData.lineupOut)
    if (!team) continue
    const key = team.players.map((p) => p.id).sort().join(',') + `|${team.captainId}|${team.viceCaptainId}`
    if (seen.has(key)) continue
    seen.add(key)
    teams.push(team)
  }

  return ok({
    source: 'tgsoftware-api.online',
    matchId,
    match: {
      team1: matchData.team1,
      team2: matchData.team2,
      team1Image: matchData.team1Image,
      team2Image: matchData.team2Image,
      lineupOut: matchData.lineupOut,
      toss: matchData.toss,
    },
    strategy,
    lineupStatus: matchData.lineupOut ? 'LINEUP_OUT' : 'LINEUP_PENDING',
    totalPlayers: allPlayers.length,
    playingPlayers: allPlayers.filter((p) => p.playing).length,
    teams: teams.map((t) => ({
      captainId: t.captainId,
      viceCaptainId: t.viceCaptainId,
      captainName: t.players.find((p) => p.id === t.captainId)?.name,
      viceCaptainName: t.players.find((p) => p.id === t.viceCaptainId)?.name,
      players: t.players.map((p) => ({
        id: p.id, name: p.name, image: p.image, team: p.team, role: p.role,
        credits: p.credits, points: p.points, selectedBy: p.selectedBy,
        playing: p.playing, isCaptain: p.id === t.captainId, isViceCaptain: p.id === t.viceCaptainId,
      })),
      totalCredit: t.totalCredit,
      team1Count: t.team1Count,
      team2Count: t.team2Count,
      combinationKey: t.combinationKey,
      riskLevel: t.riskLevel,
    })),
  })
})
