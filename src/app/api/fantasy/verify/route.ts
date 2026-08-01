import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

const REAL_BACKEND = 'https://tgsoftware-api.online'

/**
 * POST /api/fantasy/verify
 * Body: { platform, mobile, otp, state, reasonCode }
 *
 * Proxies to teamgeneration.in verify-otp API.
 * On success, returns account + authToken to frontend.
 * Frontend stores account in localStorage (NOT server memory — Vercel
 * serverless doesn't share memory between instances).
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')

  const rl = rateLimitByIp(getClientIp(req), 'fantasy-verify', FANTASY_LIMITS.OTP_VERIFY.limit, FANTASY_LIMITS.OTP_VERIFY.windowMs)
  if (!rl.allowed) return fail('Too many verify attempts', 429, 'RATE_LIMIT')

  const { platform, mobile, otp, state, reasonCode } = await parseBody<{
    platform: string; mobile: string; otp: string; state?: string; reasonCode?: number
  }>(req)

  if (!platform || !mobile || !otp) return fail('platform, mobile, otp required', 400, 'VALIDATION_ERROR')
  if (!state) return fail('OTP session expired. Please request a new OTP.', 400, 'SESSION_EXPIRED')

  const fantasyApp = platform === 'DREAM11' ? 'dream11' : 'my11circle'

  const verifyBody: any = {
    fantasyApp,
    mobileNumber: mobile,
    verificationCode: otp,
  }

  if (fantasyApp === 'dream11') {
    verifyBody.state = state
  } else {
    verifyBody.challenge = state
    if (reasonCode) verifyBody.reasonCode = reasonCode
  }

  try {
    const bodyStr = JSON.stringify(verifyBody)
    console.log('[verify-otp] Sending to teamgeneration.in:', bodyStr)

    const res = await fetch(`${REAL_BACKEND}/api/fantasy/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: bodyStr,
      signal: AbortSignal.timeout(15000),
    })

    const text = await res.text()
    console.log('[verify-otp] Response:', { status: res.status, body: text.slice(0, 500) })

    let json: any
    try { json = JSON.parse(text) } catch { return fail('Invalid provider response', 502, 'PROVIDER_ERROR') }

    if (res.status !== 200 || json.status !== 'success') {
      return fail(json.message || 'OTP verification failed', 401, 'INVALID_OTP')
    }

    // Success — return FULL account data to frontend for localStorage storage
    const authToken = json.data?.authToken || json.data?.token || json.data?.access_token || ''
    const refreshToken = json.data?.refreshToken || json.data?.refresh_token || ''
    const accountId = `acc-${fantasyApp}-${mobile.slice(-4)}-${Date.now().toString(36)}`
    const displayName = `${platform} User ${mobile.slice(-4)}`

    const account = {
      id: accountId,
      platform,
      mobile,
      displayName,
      status: 'ACTIVE',
      isActive: true,
      authToken,
      refreshToken,
      sessionActive: true,
      sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      _count: { transfers: 0, queueItems: 0 },
    }

    return ok({
      account,
      sessionId: accountId,
      authToken,
      expiresAt: account.sessionExpiresAt,
    })
  } catch (e: any) {
    console.error('[verify-otp] Error:', e.message)
    return fail(`OTP verification failed: ${e.message}`, 502, 'OTP_VERIFY_ERROR')
  }
})

// Keep accountsStore for backward compat (local dev only)
export const accountsStore = new Map<string, any[]>()
