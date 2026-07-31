/**
 * Advanced AI Team Generator Engine.
 *
 * Strategies:
 *  - GL  (Grand League)      : high uniqueness, contrarian picks, risk spread
 *  - SL  (Small League)      : safe, high-selection core, low risk
 *  - H2H (Head-to-Head)      : optimal 11, maximize projected points
 *
 * Constraints (Dream11 rules):
 *  - Exactly 11 players
 *  - WK: 1-8, BAT: 1-8, AR: 1-8, BOWL: 1-8 (practical: WK 1-2, BAT 3-5, AR 1-3, BOWL 3-5)
 *  - Team split: max 10 from one team (practical: 4-7)
 *  - Total credits <= 100
 *  - Exactly 1 Captain (2x points) + 1 Vice-Captain (1.5x points)
 *
 * Toss-based regeneration: when toss is decided, boost players of the
 * batting-first / bowling-first team according to pitch conditions.
 */
import { db } from '@/lib/db'
import { cache, cacheKeys, cacheTTL } from '@/lib/cache'

export type Strategy = 'GL' | 'SL' | 'H2H'

export interface PlayerLite {
  id: string
  externalId: string
  name: string
  shortName: string
  team: string
  role: 'WK' | 'BAT' | 'AR' | 'BOWL'
  credit: number
  selectedBy: number
  formScore: number
  isPlaying: boolean
}

export interface GeneratedTeamResult {
  captainId: string
  viceCaptainId: string
  players: PlayerLite[]
  totalCredit: number
  team1Count: number
  team2Count: number
  wkCount: number
  batCount: number
  arCount: number
  bowlCount: number
  projectedScore: number
  uniquenessScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  combinationKey: string
  meta: Record<string, unknown>
}

const MAX_CREDIT = 100

// valid role combination templates (WK, BAT, AR, BOWL) summing to 11
const ROLE_COMBOS: { wk: number; bat: number; ar: number; bowl: number }[] = [
  { wk: 1, bat: 4, ar: 2, bowl: 4 },
  { wk: 1, bat: 3, ar: 3, bowl: 4 },
  { wk: 1, bat: 4, ar: 3, bowl: 3 },
  { wk: 1, bat: 5, ar: 2, bowl: 3 },
  { wk: 1, bat: 3, ar: 2, bowl: 5 },
  { wk: 1, bat: 5, ar: 1, bowl: 4 },
  { wk: 1, bat: 4, ar: 1, bowl: 5 },
  { wk: 2, bat: 3, ar: 2, bowl: 4 },
  { wk: 2, bat: 4, ar: 2, bowl: 3 },
  { wk: 2, bat: 3, ar: 3, bowl: 3 },
  { wk: 2, bat: 4, ar: 3, bowl: 2 },
]

/** Weighted random pick influenced by strategy + form + selection + toss */
function weightedPick<T>(items: T[], weights: number[]): T | null {
  if (!items.length) return null
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return items[Math.floor(Math.random() * items.length)]
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

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

/** Compute a player's base weight given strategy */
function playerWeight(p: PlayerLite, strategy: Strategy): number {
  const formNorm = p.formScore / 100 // 0-1
  const selNorm = p.selectedBy / 100 // 0-1
  switch (strategy) {
    case 'GL':
      // contrarian: prefer lower selection % but decent form
      return Math.max(0.05, (1 - selNorm) * 2 + formNorm * 1.2 + Math.random() * 0.5)
    case 'SL':
      // safe: prefer high selection + form
      return Math.max(0.05, selNorm * 2.5 + formNorm * 1.5 + Math.random() * 0.2)
    case 'H2H':
      // optimal: form heavy
      return Math.max(0.05, formNorm * 3 + selNorm * 0.8 + Math.random() * 0.3)
  }
}

/** Apply toss bias: boost batting-first batters & bowling-first bowlers */
function applyTossBias(
  p: PlayerLite,
  tossWinner: string,
  tossDecision: string,
  team1Short: string,
  team2Short: string
): number {
  if (!tossWinner || !tossDecision) return 1
  const battingTeam = tossDecision === 'BAT' ? tossWinner : tossWinner === team1Short ? team2Short : team1Short
  const bowlingTeam = battingTeam === team1Short ? team2Short : team1Short
  if (p.team === battingTeam && (p.role === 'BAT' || p.role === 'WK')) return 1.25
  if (p.team === bowlingTeam && (p.role === 'BOWL' || p.role === 'AR')) return 1.2
  return 1
}

function riskForCombo(combo: { wk: number; bat: number; ar: number; bowl: number }, team1Count: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  const imbalance = Math.abs(team1Count - (11 - team1Count))
  if (imbalance <= 1) return 'LOW'
  if (imbalance <= 3) return 'MEDIUM'
  return 'HIGH'
}

function projectedScore(team: PlayerLite[], captainId: string, vcId: string): number {
  // crude projection: form * credit factor, C x2, VC x1.5
  let score = 0
  for (const p of team) {
    let pts = p.formScore * (0.8 + p.credit / 20)
    if (p.id === captainId) pts *= 2
    else if (p.id === vcId) pts *= 1.5
    score += pts
  }
  return Math.round(score * 10) / 10
}

function uniquenessScore(team: PlayerLite[], strategy: Strategy): number {
  // lower avg selection % => higher uniqueness
  const avgSel = team.reduce((a, p) => a + p.selectedBy, 0) / team.length
  const base = 100 - avgSel
  const bonus = strategy === 'GL' ? 15 : strategy === 'H2H' ? -10 : 0
  return Math.max(0, Math.min(100, Math.round(base + bonus)))
}

function pickCaptainAndVC(team: PlayerLite[], strategy: Strategy): { captainId: string; viceCaptainId: string } {
  // rank by a captaincy score: form * credit, with strategy bias
  const ranked = [...team].sort((a, b) => {
    const sa = a.formScore * a.credit + (strategy === 'SL' ? a.selectedBy * 0.5 : 0)
    const sb = b.formScore * b.credit + (strategy === 'SL' ? b.selectedBy * 0.5 : 0)
    return sb - sa
  })
  // GL: sometimes pick a differential captain (lower selection)
  let captain = ranked[0]
  let vc = ranked[1]
  if (strategy === 'GL' && Math.random() < 0.4) {
    const diff = team.filter((p) => p.selectedBy < 30).sort((a, b) => b.formScore - a.formScore)
    if (diff.length) {
      captain = diff[0]
      vc = ranked.find((p) => p.id !== captain.id) || ranked[1]
    }
  }
  return { captainId: captain.id, viceCaptainId: vc.id }
}

/**
 * Generate a single valid fantasy team for a match.
 */
export function generateTeam(
  players: PlayerLite[],
  strategy: Strategy,
  match: { team1Short: string; team2Short: string; tossWinner: string | null; tossDecision: string | null },
  seed?: number
): GeneratedTeamResult | null {
  // only consider players marked as playing (or all if XI not announced)
  const pool = players.filter((p) => p.isPlaying)
  const usable = pool.length >= 11 ? pool : players
  if (usable.length < 11) return null

  const byRole: Record<string, PlayerLite[]> = { WK: [], BAT: [], AR: [], BOWL: [] }
  for (const p of usable) byRole[p.role]?.push(p)

  // try combos until we find one that fits credit + team-split constraints
  const combos = shuffle(ROLE_COMBOS)
  for (const combo of combos) {
    // pick players per role with weighting
    const picks: PlayerLite[] = []
    let ok = true
    for (const [role, count] of Object.entries(combo) as [string, number][]) {
      const rolePool = byRole[role]
      if (!rolePool || rolePool.length < count) {
        ok = false
        break
      }
      const weights = rolePool.map((p) => {
        let w = playerWeight(p, strategy)
        w *= applyTossBias(p, match.tossWinner || '', match.tossDecision || '', match.team1Short, match.team2Short)
        return w
      })
      // weighted sampling without replacement
      const chosen: PlayerLite[] = []
      const poolCopy = [...rolePool]
      const wCopy = [...weights]
      for (let i = 0; i < count; i++) {
        const idx = weightedPickIndex(poolCopy, wCopy)
        if (idx === -1) break
        chosen.push(poolCopy.splice(idx, 1)[0])
        wCopy.splice(idx, 1)
      }
      if (chosen.length !== count) {
        ok = false
        break
      }
      picks.push(...chosen)
    }
    if (!ok || picks.length !== 11) continue

    // check credits
    const totalCredit = Math.round(picks.reduce((a, p) => a + p.credit, 0) * 10) / 10
    if (totalCredit > MAX_CREDIT) continue

    // check team split (max 10, practical 4-7)
    const team1Count = picks.filter((p) => p.team === match.team1Short).length
    const team2Count = 11 - team1Count
    if (team1Count > 10 || team2Count > 10) continue
    if (team1Count < 3 || team2Count < 3) continue

    const { captainId, viceCaptainId } = pickCaptainAndVC(picks, strategy)
    const wkCount = picks.filter((p) => p.role === 'WK').length
    const batCount = picks.filter((p) => p.role === 'BAT').length
    const arCount = picks.filter((p) => p.role === 'AR').length
    const bowlCount = picks.filter((p) => p.role === 'BOWL').length

    return {
      captainId,
      viceCaptainId,
      players: picks,
      totalCredit,
      team1Count,
      team2Count,
      wkCount,
      batCount,
      arCount,
      bowlCount,
      projectedScore: projectedScore(picks, captainId, viceCaptainId),
      uniquenessScore: uniquenessScore(picks, strategy),
      riskLevel: riskForCombo(combo, team1Count),
      combinationKey: `${wkCount} WK, ${batCount} BAT, ${arCount} AR, ${bowlCount} BOWL`,
      meta: {
        strategy,
        combo,
        seed,
      },
    }
  }
  return null
}

function weightedPickIndex<T>(items: T[], weights: number[]): number {
  if (!items.length) return -1
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0)
  if (total <= 0) return Math.floor(Math.random() * items.length)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i])
    if (r <= 0) return i
  }
  return items.length - 1
}

/**
 * Generate N unique teams for a match with a given strategy.
 */
export function generateMultipleTeams(
  players: PlayerLite[],
  strategy: Strategy,
  match: { team1Short: string; team2Short: string; tossWinner: string | null; tossDecision: string | null },
  count: number
): GeneratedTeamResult[] {
  const results: GeneratedTeamResult[] = []
  const seen = new Set<string>()
  const maxAttempts = count * 25
  let attempts = 0
  while (results.length < count && attempts < maxAttempts) {
    attempts++
    const team = generateTeam(players, strategy, match, attempts)
    if (!team) continue
    const key = teamSignature(team)
    if (seen.has(key)) continue
    seen.add(key)
    results.push(team)
  }
  return results
}

function teamSignature(t: GeneratedTeamResult): string {
  const ids = t.players.map((p) => p.externalId).sort().join(',')
  return `${ids}|${t.captainId}|${t.viceCaptainId}`
}

/**
 * Persist a generated team to DB inside a transaction.
 */
export async function persistTeam(
  userId: string,
  matchId: string,
  strategy: Strategy,
  result: GeneratedTeamResult
): Promise<string> {
  return await db.$transaction(async (tx) => {
    const captain = result.players.find((p) => p.id === result.captainId)!
    const vc = result.players.find((p) => p.id === result.viceCaptainId)!
    const team = await tx.generatedTeam.create({
      data: {
        userId,
        matchId,
        strategy,
        teamName: `${strategy} Team ${Math.floor(Math.random() * 9000 + 1000)}`,
        captainId: result.captainId,
        viceCaptainId: result.viceCaptainId,
        totalCredit: result.totalCredit,
        team1Count: result.team1Count,
        team2Count: result.team2Count,
        wkCount: result.wkCount,
        batCount: result.batCount,
        arCount: result.arCount,
        bowlCount: result.bowlCount,
        projectedScore: result.projectedScore,
        uniquenessScore: result.uniquenessScore,
        riskLevel: result.riskLevel,
        combinationKey: result.combinationKey,
        meta: JSON.stringify(result.meta),
      },
    })
    for (let i = 0; i < result.players.length; i++) {
      const p = result.players[i]
      await tx.generatedTeamPlayer.create({
        data: {
          teamId: team.id,
          playerId: p.id,
          isCaptain: p.id === result.captainId,
          isViceCaptain: p.id === result.viceCaptainId,
          sortOrder: i,
        },
      })
    }
    // decrement user credits
    await tx.user.update({ where: { id: userId }, data: { credits: { decrement: 1 } } })
    return team.id
  })
}

/** Fetch match + players and run generation, with caching */
export async function generateAndPersist(
  userId: string,
  matchId: string,
  strategy: Strategy,
  count: number
): Promise<{ teams: { id: string; result: GeneratedTeamResult }[]; cached: boolean }> {
  const match = await db.match.findUnique({ where: { id: matchId } })
  if (!match) throw new Error('Match not found')

  const players = await cache.getOrSet(
    cacheKeys.players(matchId),
    async () => {
      const rows = await db.player.findMany({ where: { matchId } })
      return rows.map((p) => ({
        id: p.id,
        externalId: p.externalId,
        name: p.name,
        shortName: p.shortName,
        team: p.team,
        role: p.role as PlayerLite['role'],
        credit: p.credit,
        selectedBy: p.selectedBy,
        formScore: p.formScore,
        isPlaying: p.isPlaying,
      }))
    },
    cacheTTL.players
  )

  const results = generateMultipleTeams(players, strategy, {
    team1Short: match.team1Short,
    team2Short: match.team2Short,
    tossWinner: match.tossWinner,
    tossDecision: match.tossDecision,
  }, count)

  const persisted: { id: string; result: GeneratedTeamResult }[] = []
  for (const r of results.slice(0, count)) {
    const id = await persistTeam(userId, matchId, strategy, r)
    persisted.push({ id, result: r })
  }

  // invalidate teams cache
  cache.delete(cacheKeys.generatedTeams(matchId, strategy))

  return { teams: persisted, cached: false }
}
