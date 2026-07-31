import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { requestOtp, Platform } from '@/lib/fantasy-transfer'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

/**
 * POST /api/fantasy/login
 * Body: { platform: 'DREAM11'|'MY11CIRCLE', mobile: string }
 * Returns: { otp (demo only), requestId }
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')

  const rl = rateLimitByIp(getClientIp(req), 'fantasy-otp', FANTASY_LIMITS.OTP_REQUEST.limit, FANTASY_LIMITS.OTP_REQUEST.windowMs)
  if (!rl.allowed) return fail('Too many OTP requests. Try again later.', 429, 'RATE_LIMIT')

  const { platform, mobile } = await parseBody<{ platform: Platform; mobile: string }>(req)
  if (!platform || !mobile) return fail('platform and mobile required', 400, 'VALIDATION_ERROR')
  if (!['DREAM11', 'MY11CIRCLE'].includes(platform)) return fail('Invalid platform', 400, 'VALIDATION_ERROR')
  if (!/^\d{10}$/.test(mobile)) return fail('Invalid mobile number (10 digits required)', 400, 'VALIDATION_ERROR')

  const { otp, requestId } = requestOtp(platform, mobile)
  await audit({ userId: auth.user.id, action: 'FANTASY_OTP_REQUESTED', details: { platform, mobile }, severity: 'INFO' })
  return ok({ requestId, message: 'OTP sent to your registered mobile number' })
})
