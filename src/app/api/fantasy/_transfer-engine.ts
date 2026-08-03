import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

const REAL_BACKEND = 'https://tgsoftware-api.online'

/**
 * Shared transfer engine. Called by:
 *   - /api/fantasy/bulk-transfer (mode CREATE, multiple teams)
 *   - /api/fantasy/create-team   (mode CREATE, 1 team — delegates here)
 *   - /api/fantasy/edit-team     (mode REPLACE_SPECIFIC, 1 team — delegates here)
 *
 * FIX (2026-08-03): Previously this route called /api/classic/dream11/addteam
 * directly, which returned "Error while transfering the team!" (HTTP 404)
 * because the backend requires a session established via /api/fantasy/auth/verify
 * first. The real teamgeneration.in does this two-step flow:
 *
 *   1. POST /api/fantasy/auth/verify {fantasyApp, authToken, matchId}
 *      → backend validates the OTP-login token, establishes server session,
 *        may return a refreshed authToken (updateUiToken=true).
 *   2. POST /api/classic/<platform>/addteam {tgMatchId, playerData, captainData, vicecaptainData, generateLinkFlag}
 *      → backend uses the session from step 1 to authorize the transfer,
 *        returns {status: "success", data: "<encrypted_link_data>"}.
 *
 * This file now performs both steps. The encrypted link data is decrypted
 * with the same key the real site uses (coder_bobby_believer01_tg_software)
 * and the resulting URL is returned to the frontend.
 */
import CryptoJS from 'crypto-js'

const DECRYPT_KEY = 'coder_bobby_believer01_tg_software'

function decrypt(enc: any): any {
  if (typeof enc !== 'string' || !enc.startsWith('U2FsdGVk')) return enc
  try {
    const bytes = CryptoJS.AES.decrypt(enc, DECRYPT_KEY)
    const d = bytes.toString(CryptoJS.enc.Utf8)
    try { return JSON.parse(d) } catch { return d }
  } catch { return enc }
}

export interface TransferInput {
  accountId: string
  authToken?: string
  matchId?: string
  matchName: string
  platform?: string
  mode: string
  totalTeams: number
  template: any
  /** For REPLACE_SPECIFIC mode: the platform team ID to replace */
  platformTeamId?: string
}

export async function executeTransfer(input: TransferInput, userId: string) {
  const {
    accountId, authToken, matchId, matchName, platform = 'DREAM11',
    mode = 'CREATE', totalTeams, template, platformTeamId,
  } = input

  if (!accountId || !matchName || !template) {
    return { success: false, status: 400, error: 'accountId, matchName, template required', code: 'VALIDATION_ERROR' }
  }
  if (totalTeams < 1 || totalTeams > 500) {
    return { success: false, status: 400, error: 'totalTeams must be 1-500', code: 'VALIDATION_ERROR' }
  }
  if (mode === 'REPLACE_SPECIFIC' && !platformTeamId) {
    return { success: false, status: 400, error: 'platformTeamId required for REPLACE_SPECIFIC mode', code: 'VALIDATION_ERROR' }
  }

  const t = template
  const realMatchId = String(matchId || matchName)
  const fantasyApp = platform.toLowerCase() // 'dream11' | 'my11circle'

  // Build playerData: array of pl_id strings (matches teamgeneration.in format)
  const playerData = t.players.map((p: any) => String(p.externalId))
  const captainData = String(t.captainExternalId)
  const vicecaptainData = String(t.viceCaptainExternalId)

  // ============================================================
  // STEP 1: /api/fantasy/auth/verify — establish server session
  // ============================================================
  // The authToken comes from OTP verify-otp response (stored in localStorage
  // as account.authToken). Without this step, addteam returns 404.
  if (authToken) {
    const verifyPayload: any = {
      fantasyApp,
      authToken,
      matchId: realMatchId,
    }
    // My11Circle needs extra fields
    if (platform === 'MY11CIRCLE') {
      verifyPayload.my11circleChallenge = (t as any).my11circleChallenge || null
      verifyPayload.my11circleUserId = (t as any).my11circleUserId || null
      verifyPayload.my11circleMobile = (t as any).mobileNumber || null
    }

    try {
      console.log('[transfer] Step 1: auth/verify', { fantasyApp, matchId: realMatchId, hasToken: !!authToken })
      const verifyRes = await fetch(`${REAL_BACKEND}/api/fantasy/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://teamgeneration.in',
          'Referer': 'https://teamgeneration.in/',
        },
        body: JSON.stringify(verifyPayload),
        signal: AbortSignal.timeout(15000),
      })
      const verifyText = await verifyRes.text()
      console.log('[transfer] auth/verify response:', { status: verifyRes.status, body: verifyText.slice(0, 300) })

      let verifyJson: any
      try { verifyJson = JSON.parse(verifyText) } catch { verifyJson = {} }

      if (verifyRes.status !== 200 || !verifyJson.validToken) {
        const msg = verifyJson.message || 'Token verification failed. Please re-link your fantasy account.'
        return {
          success: false, status: 401, error: msg, code: 'INVALID_TOKEN',
          queueId: `q-${Date.now()}`, totalTeams, successCount: 0, failedCount: totalTeams,
        }
      }
      // If backend returned a refreshed token, we could update localStorage —
      // but since this is server-side, we just proceed. The session is now established.
    } catch (e: any) {
      console.error('[transfer] auth/verify error:', e.message)
      // Continue anyway — some flows may not require verify (e.g. if session already exists)
    }
  }

  // ============================================================
  // STEP 2: /api/classic/<platform>/addteam — actual transfer
  // ============================================================
  const endpoint = `/api/classic/${fantasyApp}/addteam`
  const transferPayload = {
    tgMatchId: realMatchId,
    playerData,
    captainData,
    vicecaptainData,
    generateLinkFlag: 'general',
  }

  console.log('[transfer] Step 2: addteam', { endpoint, payload: JSON.stringify(transferPayload).slice(0, 300) })

  let successCount = 0
  let failedCount = 0
  const errors: string[] = []
  const transferLinks: string[] = []

  for (let i = 0; i < totalTeams; i++) {
    try {
      const res = await fetch(`${REAL_BACKEND}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://teamgeneration.in',
          'Referer': 'https://teamgeneration.in/',
        },
        body: JSON.stringify(transferPayload),
        signal: AbortSignal.timeout(15000),
      })

      const text = await res.text()
      console.log(`[transfer] Team ${i + 1} response:`, { status: res.status, body: text.slice(0, 500) })

      let json: any
      try { json = JSON.parse(text) } catch { json = { status: 'fail', message: 'Invalid response' } }

      if (res.status === 200 && (json.status === 'success' || json.success === true)) {
        successCount++
        // Decrypt the link data (teamgeneration.in returns encrypted link)
        if (json.data) {
          const decrypted = decrypt(json.data)
          if (typeof decrypted === 'string') {
            transferLinks.push(decrypted)
          } else if (decrypted?.link) {
            transferLinks.push(decrypted.link)
          } else if (decrypted?.url) {
            transferLinks.push(decrypted.url)
          } else if (typeof json.data === 'string') {
            transferLinks.push(json.data)
          }
        }
      } else {
        failedCount++
        errors.push(json.message || `Team ${i + 1} failed (HTTP ${res.status})`)
      }
    } catch (e: any) {
      console.error(`[transfer] Team ${i + 1} error:`, e.message)
      failedCount++
      errors.push(e.message)
    }
  }

  return {
    success: true,
    status: 202,
    queueId: `q-${Date.now()}`,
    status_text: 'COMPLETED',
    totalTeams,
    successCount,
    failedCount,
    errors: errors.slice(0, 5),
    transferLinks,
    provider: 'teamgeneration.in',
    endpoint,
  }
}
