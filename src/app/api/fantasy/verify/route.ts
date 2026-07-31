import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { verifyOtp, saveSession, Platform, TransferError } from '@/lib/fantasy-transfer'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

/**
 * POST /api/fantasy/verify
 * Body: { platform, mobile, otp }
 * Creates a FantasyAccount + encrypted SessionToken.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')

  const rl = rateLimitByIp(getClientIp(req), 'fantasy-verify', FANTASY_LIMITS.OTP_VERIFY.limit, FANTASY_LIMITS.OTP_VERIFY.windowMs)
  if (!rl.allowed) return fail('Too many verify attempts', 429, 'RATE_LIMIT')

  const { platform, mobile, otp } = await parseBody<{ platform: Platform; mobile: string; otp: string }>(req)
  if (!platform || !mobile || !otp) return fail('platform, mobile, otp required', 400, 'VALIDATION_ERROR')

  const result = verifyOtp(platform, mobile, otp)
  if (!result.success) {
    await audit({ userId: auth.user.id, action: 'FANTASY_OTP_VERIFY_FAILED', details: { platform, mobile, code: result.errorCode }, severity: 'WARN' })
    return fail(`OTP verification failed: ${result.errorCode}`, 401, result.errorCode)
  }

  // upsert fantasy account
  const account = await db.fantasyAccount.upsert({
    where: { userId_platform_mobile: { userId: auth.user.id, platform, mobile } },
    update: {
      status: 'ACTIVE',
      isActive: true,
      displayName: result.account!.displayName,
      platformUserId: result.account!.platformUserId,
      lastVerifiedAt: new Date(),
    },
    create: {
      userId: auth.user.id,
      platform,
      mobile,
      displayName: result.account!.displayName,
      platformUserId: result.account!.platformUserId,
      status: 'ACTIVE',
      isActive: true,
      lastVerifiedAt: new Date(),
    },
  })

  const tokenId = await saveSession({
    userId: auth.user.id,
    accountId: account.id,
    platform,
    session: result.session!,
  })

  await audit({ userId: auth.user.id, action: 'FANTASY_LOGIN_SUCCESS', entity: 'FantasyAccount', entityId: account.id, details: { platform, mobile } })
  return ok({
    account: { id: account.id, platform: account.platform, mobile: account.mobile, displayName: account.displayName, status: account.status },
    sessionId: tokenId,
    expiresAt: result.session!.expiresAt,
  })
})
