import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { transferOneTeam, TeamTemplate, Platform, TransferMode } from '@/lib/fantasy-transfer'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/api'
import { audit } from '@/lib/audit'

/**
 * POST /api/fantasy/create-team
 * Body: { accountId, matchName, template }
 * Creates a SINGLE team on the platform (not bulk).
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-create', FANTASY_LIMITS.TRANSFER.limit, FANTASY_LIMITS.TRANSFER.windowMs)
  if (!rl.allowed) return fail('Rate limited', 429, 'RATE_LIMIT')

  const { accountId, matchName, template } = await parseBody<{ accountId: string; matchName: string; template: TeamTemplate }>(req)
  if (!accountId || !matchName || !template) return fail('accountId, matchName, template required', 400, 'VALIDATION_ERROR')

  const account = await db.fantasyAccount.findFirst({ where: { id: accountId, userId: auth.user.id } })
  if (!account) return fail('Account not found', 404, 'NOT_FOUND')

  const result = await transferOneTeam({
    accountId,
    platform: account.platform as Platform,
    mode: 'CREATE',
    template,
    teamIndex: 0,
  })

  const history = await db.transferHistory.create({
    data: {
      userId: auth.user.id,
      accountId,
      matchName,
      platform: account.platform,
      mode: 'CREATE',
      status: result.status,
      teamIndex: 0,
      platformTeamId: result.platformTeamId || null,
      captainName: template.captainName,
      viceCaptainName: template.viceCaptainName,
      playerCount: template.players.length,
      verificationStatus: result.verificationStatus || null,
      verificationDetails: JSON.stringify(result.verificationDetails || {}),
      error: result.error || null,
      errorCode: result.errorCode || null,
      attempts: 1,
      startedAt: new Date(),
      completedAt: new Date(),
      verifiedAt: result.verificationStatus === 'VERIFIED' ? new Date() : null,
    },
  })

  await audit({ userId: auth.user.id, action: 'FANTASY_CREATE_TEAM', entity: 'TransferHistory', entityId: history.id, details: { accountId, matchName, status: result.status } })
  return ok({ transfer: history, result })
})
