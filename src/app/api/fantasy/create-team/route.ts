import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { enqueueBulkTransfer, processTransferQueue, TeamTemplate } from '@/lib/fantasy-transfer'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-create', FANTASY_LIMITS.TRANSFER.limit, FANTASY_LIMITS.TRANSFER.windowMs)
  if (!rl.allowed) return fail('Rate limited', 429, 'RATE_LIMIT')

  const { accountId, matchName, template } = await parseBody<{ accountId: string; matchName: string; template: TeamTemplate }>(req)
  if (!accountId || !matchName || !template) return fail('accountId, matchName, template required', 400, 'VALIDATION_ERROR')

  // Single team transfer = bulk with 1 team
  const queueId = enqueueBulkTransfer({
    userId: auth.user.id, accountId, matchName, platform: 'DREAM11', mode: 'CREATE',
    totalTeams: 1, concurrency: 1, template,
  })
  processTransferQueue(queueId)
  return ok({ queueId, status: 'COMPLETED', message: 'Team transferred successfully' })
})
