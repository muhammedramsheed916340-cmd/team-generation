import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { executeTransfer } from '@/app/api/fantasy/_transfer-engine'

/**
 * POST /api/fantasy/edit-team
 * Replace a specific existing team on the fantasy platform.
 *
 * FIX (2026-08-03): Previously this route used a FAKE in-memory simulation
 * (Math.random < 0.95). Now it delegates to the real transfer engine.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-edit', FANTASY_LIMITS.TRANSFER.limit, FANTASY_LIMITS.TRANSFER.windowMs)
  if (!rl.allowed) return fail('Rate limited', 429, 'RATE_LIMIT')

  const { accountId, authToken, matchId, matchName, platform, platformTeamId, template } = await parseBody<{
    accountId: string; authToken?: string; matchId?: string; matchName: string;
    platform?: string; platformTeamId: string; template: any;
  }>(req)

  if (!accountId || !matchName || !platformTeamId || !template) {
    return fail('accountId, matchName, platformTeamId, template required', 400, 'VALIDATION_ERROR')
  }

  const result = await executeTransfer({
    accountId, authToken, matchId, matchName,
    platform: platform || 'DREAM11',
    mode: 'REPLACE_SPECIFIC',
    totalTeams: 1,
    template,
    platformTeamId,
  }, auth.user.id)

  if (!result.success) {
    return fail(result.error || 'Edit failed', result.status || 400, result.code || 'TRANSFER_ERROR')
  }

  return ok({
    queueId: result.queueId,
    status: result.status_text,
    message: result.successCount > 0 ? 'Team replaced successfully' : (result.errors?.[0] || 'Replace failed'),
    successCount: result.successCount,
    failedCount: result.failedCount,
    transferLinks: result.transferLinks,
    provider: result.provider,
    endpoint: result.endpoint,
  })
})
