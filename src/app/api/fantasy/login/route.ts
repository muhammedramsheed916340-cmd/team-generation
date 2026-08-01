import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

const REAL_BACKEND = 'https://tgsoftware-api.online'

/**
 * POST /api/fantasy/login
 * Proxies to teamgeneration.in send-otp API.
 * Returns state/challenge in response (frontend passes it back for verify).
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
    const body = JSON.stringify({ fantasyApp, mobileNumber: mobile })
    console.log('[send-otp] Request:', { url: `${REAL_BACKEND}/api/fantasy/send-otp`, body })

    const res = await fetch(`${REAL_BACKEND}/api/fantasy/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(15000),
    })

    const text = await res.text()
    console.log('[send-otp] Raw response:', { status: res.status, body: text.slice(0, 500) })

    let json: any
    try { json = JSON.parse(text) } catch { return fail('Invalid response from provider', 502, 'PROVIDER_ERROR') }

    if (res.status !== 200 || json.status !== 'success') {
      return fail(json.message || 'OTP send failed', 502, 'OTP_SEND_FAILED')
    }

    // Return ALL data from provider response
    return ok({
      requestId: `otp-${platform}-${mobile}-${Date.now()}`,
      message: `OTP sent to +91 ${mobile} via SMS`,
      retriesLeft: json.data?.retries_left || 5,
      resendsLeft: json.data?.resends_left || 5,
      state: json.data?.state || json.data?.challenge || null,
      reasonCode: json.data?.reasonCode || null,
      // Return raw provider data for debugging
      rawData: json.data,
    })
  } catch (e: any) {
    console.error('[send-otp] Error:', e.message)
    return fail(`Failed to send OTP: ${e.message}`, 502, 'OTP_PROVIDER_ERROR')
  }
})
