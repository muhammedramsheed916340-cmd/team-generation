import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { enqueueBulkTransfer, TeamTemplate, Platform, TransferMode, getRemainingTransfers, TransferError } from '@/lib/fantasy-transfer'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

/**
 * POST /api/fantasy/bulk-transfer
 * Body: {
 *   accountId, matchName, matchId?, mode, totalTeams,
 *   concurrency?, maxRetries?, replaceTeamIds?, template
 * }
 * Enqueues a bulk transfer (1-500 teams). Returns queueId.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-bulk', FANTASY_LIMITS.BULK_TRANSFER.limit, FANTASY_LIMITS.BULK_TRANSFER.windowMs)
  if (!rl.allowed) return fail('Too many bulk transfer requests', 429, 'RATE_LIMIT')

  const body = await parseBody<{
    accountId: string
    matchName: string
    matchId?: string
    platform?: Platform
    mode: TransferMode
    totalTeams: number
    concurrency?: number
    maxRetries?: number
    replaceTeamIds?: string[]
    template: TeamTemplate
  }>(req)

  if (!body.accountId || !body.matchName || !body.mode || !body.template) {
    return fail('accountId, matchName, mode, template required', 400, 'VALIDATION_ERROR')
  }
  if (body.totalTeams < 1 || body.totalTeams > 500) {
    return fail('totalTeams must be between 1 and 500', 400, 'VALIDATION_ERROR')
  }

  const account = await db.fantasyAccount.findFirst({ where: { id: body.accountId, userId: auth.user.id } })
  if (!account) return fail('Account not found', 404, 'NOT_FOUND')

  // check remaining daily quota
  const remaining = await getRemainingTransfers(account.id)
  if (body.totalTeams > remaining.remaining) {
    return fail(`Exceeds daily limit. Remaining: ${remaining.remaining}`, 429, 'RATE_LIMIT')
  }

  try {
    const queueId = await enqueueBulkTransfer({
      userId: auth.user.id,
      accountId: account.id,
      matchId: body.matchId,
      matchName: body.matchName,
      platform: account.platform as Platform,
      mode: body.mode,
      totalTeams: body.totalTeams,
      concurrency: body.concurrency ?? 5,
      maxRetries: body.maxRetries ?? 3,
      replaceTeamIds: body.replaceTeamIds,
      template: body.template,
    })
    return ok({ queueId, status: 'QUEUED', totalTeams: body.totalTeams }, 202)
  } catch (e) {
    if (e instanceof TransferError) return fail(e.message, 400, e.code)
    throw e
  }
})
