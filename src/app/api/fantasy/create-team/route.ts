import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { executeTransfer } from '@/app/api/fantasy/_transfer-engine'

/**
 * POST /api/fantasy/create-team
 * Single team transfer = bulk-transfer with totalTeams=1.
 *
 * FIX (2026-08-03): Previously this route used a FAKE in-memory simulation
 * (Math.random < 0.95) instead of calling the real backend. Now it delegates
 * to the real transfer engine (auth/verify + addteam).
 *
 * Frontend must pass `authToken` from the linked fantasy account (stored in
 * localStorage after OTP verify-otp succeeds).
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-create', FANTASY_LIMITS.TRANSFER.limit, FANTASY_LIMITS.TRANSFER.windowMs)
  if (!rl.allowed) return fail('Rate limited', 429, 'RATE_LIMIT')

  const { accountId, authToken, matchId, matchName, platform, template } = await parseBody<{
    accountId: string; authToken?: string; matchId?: string; matchName: string;
    platform?: string; template: any;
  }>(req)

  if (!accountId || !matchName || !template) {
    return fail('accountId, matchName, template required', 400, 'VALIDATION_ERROR')
  }

  const result = await executeTransfer({
    accountId, authToken, matchId, matchName,
    platform: platform || 'DREAM11',
    mode: 'CREATE',
    totalTeams: 1,
    template,
  }, auth.user.id)

  if (!result.success) {
    return fail(result.error || 'Transfer failed', result.status || 400, result.code || 'TRANSFER_ERROR')
  }

  return ok({
    queueId: result.queueId,
    status: result.status_text,
    message: result.successCount > 0 ? 'Team transferred successfully' : (result.errors?.[0] || 'Transfer failed'),
    successCount: result.successCount,
    failedCount: result.failedCount,
    transferLinks: result.transferLinks,
    provider: result.provider,
    endpoint: result.endpoint,
  })
})
