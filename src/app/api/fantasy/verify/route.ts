import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

const REAL_BACKEND = 'https://tgsoftware-api.online'

export const accountsStore = new Map<string, any[]>()

/**
 * POST /api/fantasy/verify
 * Body: { platform, mobile, otp, state, reasonCode }
 *
 * Proxies to teamgeneration.in verify-otp API.
 * teamgeneration.in expects:
 *   { fantasyApp, mobileNumber, verificationCode, state }  // Dream11
 *   { fantasyApp, mobileNumber, verificationCode, challenge, reasonCode }  // My11Circle
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

  // Build EXACT payload matching teamgeneration.in's frontend
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
    console.log('[verify-otp] Request:', { url: `${REAL_BACKEND}/api/fantasy/verify-otp`, body: bodyStr })

    const res = await fetch(`${REAL_BACKEND}/api/fantasy/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: bodyStr,
      signal: AbortSignal.timeout(15000),
    })

    const text = await res.text()
    console.log('[verify-otp] Raw response:', { status: res.status, body: text.slice(0, 1000) })

    let json: any
    try { json = JSON.parse(text) } catch { return fail('Invalid response from provider', 502, 'PROVIDER_ERROR') }

    if (res.status !== 200 || json.status !== 'success') {
      // Return the ACTUAL error from teamgeneration.in (not hidden)
      const errorMsg = json.message || json.error || 'OTP verification failed'
      return fail(errorMsg, 401, 'INVALID_OTP')
    }

    // Success — extract authToken from response
    const authToken = json.data?.authToken || json.data?.token || json.data?.access_token || `token-${Date.now()}`
    const refreshToken = json.data?.refreshToken || json.data?.refresh_token || null

    const accountId = `acc-${fantasyApp}-${mobile.slice(-4)}-${Date.now().toString(36)}`
    const displayName = `${platform} User ${mobile.slice(-4)}`

    const account = {
      id: accountId,
      userId: auth.user.id,
      platform,
      mobile,
      displayName,
      status: 'ACTIVE',
      isActive: true,
      authToken,
      refreshToken,
      lastVerifiedAt: new Date(),
      createdAt: new Date(),
      _count: { transfers: 0, queueItems: 0 },
      sessionActive: true,
      sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }

    const userAccounts = accountsStore.get(auth.user.id) || []
    userAccounts.push(account)
    accountsStore.set(auth.user.id, userAccounts)

    return ok({
      account: { id: accountId, platform, mobile, displayName, status: 'ACTIVE' },
      sessionId: accountId,
      authToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
  } catch (e: any) {
    console.error('[verify-otp] Error:', e.message)
    return fail(`OTP verification failed: ${e.message}`, 502, 'OTP_VERIFY_ERROR')
  }
})
