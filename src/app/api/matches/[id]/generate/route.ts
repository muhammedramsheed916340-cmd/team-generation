import { NextRequest } from 'next/server'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { authenticate } from '@/lib/auth'
import { generateAndPersist } from '@/lib/team-generator'
import { generateMultipleTeams, PlayerLite, Strategy } from '@/lib/team-generator'
import { audit } from '@/lib/audit'
import { enqueue } from '@/lib/queue'
import { db } from '@/lib/db'
import { getFallbackStore, isDatabaseAvailable } from '@/lib/fallback-data'

let fallbackTeamCounter = 0

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')

  const matchId = params.id
  const body = await parseBody<{ strategy: Strategy; count: number; regenerateOnToss?: boolean }>(req)
  const strategy = body.strategy || 'GL'
  const count = Math.min(Math.max(1, body.count || 1), 50)

  // Fallback mode (Vercel without DB)
  if (!isDatabaseAvailable()) {
    const store = getFallbackStore()
    const match = store.matches.find((m) => m.id === matchId)
    if (!match) return fail('Match not found', 404, 'NOT_FOUND')
    const players: PlayerLite[] = store.players.filter((p) => p.matchId === matchId).map((p) => ({
      id: p.id, externalId: p.externalId, name: p.name, shortName: p.shortName, team: p.team,
      role: p.role, credit: p.credit, selectedBy: p.selectedBy, formScore: p.formScore, isPlaying: p.isPlaying,
    }))
    const results = generateMultipleTeams(players, strategy, {
      team1Short: match.team1Short, team2Short: match.team2Short,
      tossWinner: match.tossWinner, tossDecision: match.tossDecision,
    }, count)

    const teams = results.map((r) => {
      fallbackTeamCounter++
      const captain = r.players.find((p) => p.id === r.captainId)!
      const vc = r.players.find((p) => p.id === r.viceCaptainId)!
      return {
        id: `fb-team-${fallbackTeamCounter}`,
        captainId: r.captainId,
        viceCaptainId: r.viceCaptainId,
        players: r.players.map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, team: p.team, role: p.role, credit: p.credit, isCaptain: p.id === r.captainId, isViceCaptain: p.id === r.viceCaptainId })),
        totalCredit: r.totalCredit,
        team1Count: r.team1Count,
        team2Count: r.team2Count,
        projectedScore: r.projectedScore,
        uniquenessScore: r.uniquenessScore,
        riskLevel: r.riskLevel,
        combinationKey: r.combinationKey,
        strategy,
      }
    })
    store.generatedTeams.push(...teams.map((t) => ({ ...t, matchId, userId: auth.user.id, createdAt: new Date() })))
    return ok({ strategy, count: teams.length, teams })
  }

  // Database mode
  const sub = await db.subscription.findUnique({ where: { userId: auth.user.id }, include: { plan: true } })
  const maxTeams = sub?.plan?.maxTeamsPerMatch || 5
  if (count > maxTeams) return fail(`Your plan allows max ${maxTeams} teams per match`, 403, 'PLAN_LIMIT')
  if (auth.user.credits < count) return fail(`Insufficient credits. You have ${auth.user.credits}, need ${count}`, 403, 'NO_CREDITS')

  const result = await generateAndPersist(auth.user.id, matchId, strategy, count)

  if (body.regenerateOnToss) {
    await enqueue({ jobType: 'REGENERATE_TEAMS', matchId, payload: { userId: auth.user.id, strategy, count } })
  }

  await audit({ userId: auth.user.id, action: 'TEAM_GENERATED', entity: 'Match', entityId: matchId, details: { strategy, count, generated: result.teams.length } })

  return ok({
    strategy, count: result.teams.length,
    teams: result.teams.map((t) => ({
      id: t.id, captainId: t.result.captainId, viceCaptainId: t.result.viceCaptainId,
      players: t.result.players.map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, team: p.team, role: p.role, credit: p.credit, isCaptain: p.id === t.result.captainId, isViceCaptain: p.id === t.result.viceCaptainId })),
      totalCredit: t.result.totalCredit, team1Count: t.result.team1Count, team2Count: t.result.team2Count,
      projectedScore: t.result.projectedScore, uniquenessScore: t.result.uniquenessScore,
      riskLevel: t.result.riskLevel, combinationKey: t.result.combinationKey,
    })),
  })
})

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const url = new URL(req.url)
  const strategy = url.searchParams.get('strategy') as Strategy | null

  if (!isDatabaseAvailable()) {
    const store = getFallbackStore()
    let teams = store.generatedTeams.filter((t) => t.matchId === matchId)
    if (strategy) teams = teams.filter((t) => t.strategy === strategy)
    return ok({ teams })
  }

  try {
    const teams = await db.generatedTeam.findMany({
      where: { matchId, ...(strategy ? { strategy } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { players: { include: { player: true }, orderBy: { sortOrder: 'asc' } } },
    })
    return ok({ teams })
  } catch {
    return ok({ teams: [] })
  }
})
