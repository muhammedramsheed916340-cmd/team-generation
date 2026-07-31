import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { enqueueBulkTransfer, processTransferQueue, TeamTemplate } from '@/lib/fantasy-transfer'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-edit', FANTASY_LIMITS.TRANSFER.limit, FANTASY_LIMITS.TRANSFER.windowMs)
  if (!rl.allowed) return fail('Rate limited', 429, 'RATE_LIMIT')

  const { accountId, matchName, platformTeamId, template } = await parseBody<{ accountId: string; matchName: string; platformTeamId: string; template: TeamTemplate }>(req)
  if (!accountId || !matchName || !platformTeamId || !template) return fail('accountId, matchName, platformTeamId, template required', 400, 'VALIDATION_ERROR')

  const queueId = enqueueBulkTransfer({
    userId: auth.user.id, accountId, matchName, platform: 'DREAM11', mode: 'REPLACE_SPECIFIC',
    totalTeams: 1, concurrency: 1, template,
  })
  processTransferQueue(queueId)
  return ok({ queueId, status: 'COMPLETED', message: 'Team replaced successfully' })
})
