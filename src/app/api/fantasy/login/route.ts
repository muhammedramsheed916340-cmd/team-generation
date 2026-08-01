import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

const REAL_BACKEND = 'https://tgsoftware-api.online'

/**
 * POST /api/fantasy/login
 * Body: { platform: 'DREAM11'|'MY11CIRCLE', mobile: string }
 * Proxies to the REAL teamgeneration.in send-otp API.
 * Returns the state/challenge to the frontend (needed for verify-otp).
 * NO caching — state is passed back from the frontend.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')

  const rl = rateLimitByIp(getClientIp(req), 'fantasy-otp', FANTASY_LIMITS.OTP_REQUEST.limit, FANTASY_LIMITS.OTP_REQUEST.windowMs)
  if (!rl.allowed) return fail('Too many OTP requests. Try again later.', 429, 'RATE_LIMIT')

  const { platform, mobile } = await parseBody<{ platform: string; mobile: string }>(req)
  if (!platform || !mobile) return fail('platform and mobile required', 400, 'VALIDATION_ERROR')
  if (!['DREAM11', 'MY11CIRCLE'].includes(platform)) return fail('Invalid platform', 400, 'VALIDATION_ERROR')
  if (!/^\d{10}$/.test(mobile)) return fail('Invalid mobile number (10 digits required)', 400, 'VALIDATION_ERROR')

  const fantasyApp = platform === 'DREAM11' ? 'dream11' : 'my11circle'

  try {
    const res = await fetch(`${REAL_BACKEND}/api/fantasy/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'TeamGen/1.0' },
      body: JSON.stringify({ fantasyApp, mobileNumber: mobile }),
      signal: AbortSignal.timeout(15000),
    })

    const json = await res.json()

    if (res.status !== 200 || json.status !== 'success') {
      return fail(json.message || 'OTP send failed', 502, 'OTP_SEND_FAILED')
    }

    // Return state/challenge to frontend — frontend will pass it back in verify-otp
    // This is necessary because Vercel serverless doesn't share in-memory state
    // between requests (each request may run on a different instance).
    const state = json.data?.state || json.data?.challenge || null
    const reasonCode = json.data?.reasonCode || null

    return ok({
      requestId: `otp-${platform}-${mobile}-${Date.now()}`,
      message: `OTP sent to +91 ${mobile} via SMS`,
      retriesLeft: json.data?.retries_left || 5,
      resendsLeft: json.data?.resends_left || 5,
      // State is passed to frontend and sent back with verify-otp
      state,
      reasonCode,
    })
  } catch (e: any) {
    return fail(`Failed to send OTP: ${e.message}`, 502, 'OTP_PROVIDER_ERROR')
  }
})
