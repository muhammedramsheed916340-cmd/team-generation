import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { enqueueBulkTransfer, Platform, TransferMode, TeamTemplate, TransferError, processTransferQueue } from '@/lib/fantasy-transfer'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-bulk', FANTASY_LIMITS.BULK_TRANSFER.limit, FANTASY_LIMITS.BULK_TRANSFER.windowMs)
  if (!rl.allowed) return fail('Too many bulk transfer requests', 429, 'RATE_LIMIT')

  const body = await parseBody<{
    accountId: string; matchName: string; platform?: Platform; mode: TransferMode;
    totalTeams: number; concurrency?: number; maxRetries?: number; template: TeamTemplate;
  }>(req)

  if (!body.accountId || !body.matchName || !body.mode || !body.template) return fail('accountId, matchName, mode, template required', 400, 'VALIDATION_ERROR')
  if (body.totalTeams < 1 || body.totalTeams > 500) return fail('totalTeams must be 1-500', 400, 'VALIDATION_ERROR')

  try {
    const queueId = enqueueBulkTransfer({
      userId: auth.user.id, accountId: body.accountId, matchName: body.matchName,
      platform: body.platform || 'DREAM11', mode: body.mode, totalTeams: body.totalTeams,
      concurrency: body.concurrency ?? 5, maxRetries: body.maxRetries ?? 3, template: body.template,
    })
    // Process immediately (in-memory)
    processTransferQueue(queueId)
    return ok({ queueId, status: 'COMPLETED', totalTeams: body.totalTeams }, 202)
  } catch (e) {
    if (e instanceof TransferError) return fail(e.message, 400, e.code)
    throw e
  }
})
