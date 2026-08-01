import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

const REAL_BACKEND = 'https://tgsoftware-api.online'

// In-memory account store (works within same instance; for cross-instance
// persistence, use a database — but for demo this is sufficient since
// accounts are checked immediately after linking)
export const accountsStore = new Map<string, any[]>()

/**
 * POST /api/fantasy/verify
 * Body: { platform, mobile, otp, state, reasonCode }
 *
 * The state/reasonCode come from the send-otp response (passed through
 * the frontend). This is necessary because Vercel serverless doesn't
 * share in-memory state between requests.
 *
 * teamgeneration.in verify-otp expects:
 *   { fantasyApp, mobileNumber, verificationCode, state }        // Dream11
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

  try {
    // Build verify payload matching teamgeneration.in's EXACT format
    const verifyBody: any = {
      fantasyApp,
      mobileNumber: mobile,
      verificationCode: otp,  // teamgeneration.in uses 'verificationCode', NOT 'otp'
    }

    if (fantasyApp === 'dream11') {
      verifyBody.state = state
    } else {
      // My11Circle uses challenge + reasonCode
      verifyBody.challenge = state
      if (reasonCode) verifyBody.reasonCode = reasonCode
    }

    console.log('[verify-otp] Sending to teamgeneration.in:', { fantasyApp, mobileNumber: mobile, hasState: !!verifyBody.state, hasChallenge: !!verifyBody.challenge })

    const res = await fetch(`${REAL_BACKEND}/api/fantasy/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'TeamGen/1.0' },
      body: JSON.stringify(verifyBody),
      signal: AbortSignal.timeout(15000),
    })

    const json = await res.json()

    console.log('[verify-otp] Response:', { status: res.status, apiStatus: json.status, message: json.message })

    if (res.status !== 200 || json.status !== 'success') {
      const errorMsg = json.message || json.error || 'OTP verification failed'
      return fail(errorMsg, 401, 'INVALID_OTP')
    }

    // OTP verified successfully — extract authToken
    const authToken = json.data?.authToken || json.data?.token || json.data?.access_token || `token-${Date.now()}`

    // Create account
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
