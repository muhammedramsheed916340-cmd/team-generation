import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { cache } from '@/lib/cache'

const REAL_BACKEND = 'https://tgsoftware-api.online'

/**
 * POST /api/fantasy/login
 * Body: { platform: 'DREAM11'|'MY11CIRCLE', mobile: string }
 * Proxies to the REAL teamgeneration.in send-otp API.
 * The OTP is sent via real SMS to the user's phone.
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

  // Map platform to teamgeneration.in fantasyApp slug
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

    // Store the state/challenge for verification
    const state = json.data?.state || json.data?.challenge || null
    const reasonCode = json.data?.reasonCode || null
    const cacheKey = `otp-state:${auth.user.id}:${platform}:${mobile}`
    cache.set(cacheKey, {
      state, reasonCode,
      retriesLeft: json.data?.retries_left || 5,
      resendsLeft: json.data?.resends_left || 5,
      sentAt: Date.now()
    }, 5 * 60 * 1000)

    return ok({
      requestId: cacheKey,
      message: `OTP sent to +91 ${mobile} via SMS`,
      retriesLeft: json.data?.retries_left || 5,
      resendsLeft: json.data?.resends_left || 5,
    })
  } catch (e: any) {
    return fail(`Failed to send OTP: ${e.message}`, 502, 'OTP_PROVIDER_ERROR')
  }
})
