import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { transferOneTeam, TeamTemplate, Platform } from '@/lib/fantasy-transfer'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

/**
 * POST /api/fantasy/edit-team
 * Body: { accountId, matchName, platformTeamId, template }
 * Replaces an existing team on the platform.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-edit', FANTASY_LIMITS.TRANSFER.limit, FANTASY_LIMITS.TRANSFER.windowMs)
  if (!rl.allowed) return fail('Rate limited', 429, 'RATE_LIMIT')

  const { accountId, matchName, platformTeamId, template } = await parseBody<{ accountId: string; matchName: string; platformTeamId: string; template: TeamTemplate }>(req)
  if (!accountId || !matchName || !platformTeamId || !template) return fail('accountId, matchName, platformTeamId, template required', 400, 'VALIDATION_ERROR')

  const account = await db.fantasyAccount.findFirst({ where: { id: accountId, userId: auth.user.id } })
  if (!account) return fail('Account not found', 404, 'NOT_FOUND')

  const result = await transferOneTeam({
    accountId,
    platform: account.platform as Platform,
    mode: 'REPLACE_SPECIFIC',
    template,
    replaceTeamId: platformTeamId,
    teamIndex: 0,
  })

  const history = await db.transferHistory.create({
    data: {
      userId: auth.user.id,
      accountId,
      matchName,
      platform: account.platform,
      mode: 'REPLACE_SPECIFIC',
      status: result.status,
      teamIndex: 0,
      platformTeamId: result.platformTeamId || platformTeamId,
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

  await audit({ userId: auth.user.id, action: 'FANTASY_EDIT_TEAM', entity: 'TransferHistory', entityId: history.id, details: { accountId, matchName, platformTeamId, status: result.status } })
  return ok({ transfer: history, result })
})
