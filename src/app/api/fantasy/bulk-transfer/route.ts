import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { executeTransfer } from '@/app/api/fantasy/_transfer-engine'

/**
 * POST /api/fantasy/bulk-transfer
 * Performs the full transfer flow:
 *   1. /api/fantasy/auth/verify (establishes server session with OTP authToken)
 *   2. /api/classic/<platform>/addteam (actual transfer, returns encrypted link)
 *
 * FIX (2026-08-03): Previously called addteam directly without the verify step,
 * causing "Error while transfering the team!" (HTTP 404) on every transfer.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-bulk', FANTASY_LIMITS.BULK_TRANSFER.limit, FANTASY_LIMITS.BULK_TRANSFER.windowMs)
  if (!rl.allowed) return fail('Too many bulk transfer requests', 429, 'RATE_LIMIT')

  const body = await parseBody<{
    accountId: string; authToken?: string; matchId?: string; matchName: string;
    platform?: string; mode: string; totalTeams: number; template: any;
  }>(req)

  const result = await executeTransfer(body, auth.user.id)

  if (!result.success) {
    return fail(result.error || 'Transfer failed', result.status || 400, result.code || 'TRANSFER_ERROR')
  }

  return ok({
    queueId: result.queueId,
    status: result.status_text,
    totalTeams: result.totalTeams,
    successCount: result.successCount,
    failedCount: result.failedCount,
    errors: result.errors,
    transferLinks: result.transferLinks,
    provider: result.provider,
    endpoint: result.endpoint,
  }, 202)
})
