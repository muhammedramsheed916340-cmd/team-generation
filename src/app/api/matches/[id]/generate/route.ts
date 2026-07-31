import { NextRequest } from 'next/server'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { authenticate } from '@/lib/auth'
import { generateAndPersist } from '@/lib/team-generator'
import { Strategy } from '@/lib/team-generator'
import { audit } from '@/lib/audit'
import { enqueue } from '@/lib/queue'
import { db } from '@/lib/db'

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')

  const matchId = params.id
  const body = await parseBody<{ strategy: Strategy; count: number; regenerateOnToss?: boolean }>(req)
  const strategy = body.strategy || 'GL'
  const count = Math.min(Math.max(1, body.count || 1), 50)

  // check subscription limits
  const sub = await db.subscription.findUnique({ where: { userId: auth.user.id }, include: { plan: true } })
  const maxTeams = sub?.plan?.maxTeamsPerMatch || 5
  if (count > maxTeams) {
    return fail(`Your plan allows max ${maxTeams} teams per match`, 403, 'PLAN_LIMIT')
  }
  if (auth.user.credits < count) {
    return fail(`Insufficient credits. You have ${auth.user.credits}, need ${count}`, 403, 'NO_CREDITS')
  }

  const result = await generateAndPersist(auth.user.id, matchId, strategy, count)

  // if toss done and regenerateOnToss, enqueue regeneration job
  if (body.regenerateOnToss) {
    await enqueue({
      jobType: 'REGENERATE_TEAMS',
      matchId,
      payload: { userId: auth.user.id, strategy, count },
    })
  }

  await audit({
    userId: auth.user.id,
    action: 'TEAM_GENERATED',
    entity: 'Match',
    entityId: matchId,
    details: { strategy, count, generated: result.teams.length },
  })

  return ok({
    strategy,
    count: result.teams.length,
    teams: result.teams.map((t) => ({
      id: t.id,
      captainId: t.result.captainId,
      viceCaptainId: t.result.viceCaptainId,
      players: t.result.players.map((p) => ({ id: p.id, name: p.name, shortName: p.shortName, team: p.team, role: p.role, credit: p.credit, isCaptain: p.id === t.result.captainId, isViceCaptain: p.id === t.result.viceCaptainId })),
      totalCredit: t.result.totalCredit,
      team1Count: t.result.team1Count,
      team2Count: t.result.team2Count,
      projectedScore: t.result.projectedScore,
      uniquenessScore: t.result.uniquenessScore,
      riskLevel: t.result.riskLevel,
      combinationKey: t.result.combinationKey,
    })),
  })
})

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const url = new URL(req.url)
  const strategy = url.searchParams.get('strategy') as Strategy | null
  const teams = await db.generatedTeam.findMany({
    where: { matchId, ...(strategy ? { strategy } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      players: {
        include: { player: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
  return ok({ teams })
})
