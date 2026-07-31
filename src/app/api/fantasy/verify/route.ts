import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { verifyOtp, Platform } from '@/lib/fantasy-transfer'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')

  const rl = rateLimitByIp(getClientIp(req), 'fantasy-verify', FANTASY_LIMITS.OTP_VERIFY.limit, FANTASY_LIMITS.OTP_VERIFY.windowMs)
  if (!rl.allowed) return fail('Too many verify attempts', 429, 'RATE_LIMIT')

  const { platform, mobile, otp } = await parseBody<{ platform: Platform; mobile: string; otp: string }>(req)
  if (!platform || !mobile || !otp) return fail('platform, mobile, otp required', 400, 'VALIDATION_ERROR')

  const result = verifyOtp(platform, mobile, otp, auth.user.id)
  if (!result.success) return fail(`OTP verification failed: ${result.errorCode}`, 401, result.errorCode)

  return ok({
    account: { id: result.account!.id, platform, mobile, displayName: result.account!.displayName, status: 'ACTIVE' },
    sessionId: result.account!.id,
    expiresAt: result.session!.expiresAt,
  })
})
