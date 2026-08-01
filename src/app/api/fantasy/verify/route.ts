import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'
import { cache } from '@/lib/cache'

const REAL_BACKEND = 'https://tgsoftware-api.online'

// In-memory account store (for session management after OTP verify)
const accountsStore = new Map<string, any[]>()

/**
 * POST /api/fantasy/verify
 * Body: { platform, mobile, otp }
 * Proxies to the REAL teamgeneration.in verify-otp API.
 * Verifies the OTP that was sent via real SMS.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')

  const rl = rateLimitByIp(getClientIp(req), 'fantasy-verify', FANTASY_LIMITS.OTP_VERIFY.limit, FANTASY_LIMITS.OTP_VERIFY.windowMs)
  if (!rl.allowed) return fail('Too many verify attempts', 429, 'RATE_LIMIT')

  const { platform, mobile, otp } = await parseBody<{ platform: string; mobile: string; otp: string }>(req)
  if (!platform || !mobile || !otp) return fail('platform, mobile, otp required', 400, 'VALIDATION_ERROR')

  const fantasyApp = platform === 'DREAM11' ? 'dream11' : 'my11circle'

  // Get the state from the send-otp response
  const stateKey = `otp-state:${auth.user.id}:${platform}:${mobile}`
  const stateData = cache.get<any>(stateKey)
  if (!stateData) return fail('OTP session expired. Please request a new OTP.', 400, 'SESSION_EXPIRED')

  try {
    // Build verify payload matching teamgeneration.in's format
    const verifyBody: any = {
      fantasyApp,
      mobileNumber: mobile,
      otp,
    }
    // Dream11 uses state, My11Circle uses challenge
    if (fantasyApp === 'dream11') {
      verifyBody.state = stateData.state
    } else {
      verifyBody.challenge = stateData.state
    }

    const res = await fetch(`${REAL_BACKEND}/api/fantasy/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'TeamGen/1.0' },
      body: JSON.stringify(verifyBody),
      signal: AbortSignal.timeout(15000),
    })

    const json = await res.json()

    if (res.status !== 200 || json.status !== 'success') {
      return fail(json.message || 'OTP verification failed', 401, 'INVALID_OTP')
    }

    // OTP verified successfully — create account + session
    const accountId = `acc-${fantasyApp}-${mobile.slice(-4)}-${Date.now().toString(36)}`
    const displayName = `${platform} User ${mobile.slice(-4)}`
    const authToken = json.data?.authToken || json.data?.token || `token-${accountId}`

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

    // Store in memory
    const userAccounts = accountsStore.get(auth.user.id) || []
    userAccounts.push(account)
    accountsStore.set(auth.user.id, userAccounts)

    // Clear OTP state
    cache.delete(stateKey)

    return ok({
      account: { id: accountId, platform, mobile, displayName, status: 'ACTIVE' },
      sessionId: accountId,
      authToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
  } catch (e: any) {
    return fail(`OTP verification failed: ${e.message}`, 502, 'OTP_VERIFY_ERROR')
  }
})

export { accountsStore }
