/**
 * Shared transfer engine.
 *
 * Direct transfer flow:
 *   1. POST /api/fantasy/auth/verify — validates OTP authToken
 *   2. POST /api/dream11/addteam — ACTUALLY transfers the team (NOT classic/link)
 *
 * The /api/dream11/addteam endpoint creates the team directly on Dream11
 * using the authToken. It does NOT return a link — it performs the transfer.
 *
 * Payload for step 2:
 *   { matchId, captain, vice_captain, players, fantasyApp, authToken, sportIndex, type }
 */
import CryptoJS from 'crypto-js'

const REAL_BACKEND = 'https://tgsoftware-api.online'
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

  const t = template
  const realMatchId = String(matchId || matchName)
  const fantasyApp = platform.toLowerCase()

  // authToken is REQUIRED for direct transfer
  if (!authToken) {
    return {
      success: false, status: 401, error: 'No authToken. Link your fantasy account first via OTP.',
      code: 'NO_AUTH_TOKEN', queueId: `q-${Date.now()}`, totalTeams, successCount: 0, failedCount: totalTeams,
    }
  }

  // ============================================================
  // STEP 1: /api/fantasy/auth/verify — validate token
  // ============================================================
  try {
    const verifyPayload: any = { fantasyApp, authToken, matchId: realMatchId }
    if (platform === 'MY11CIRCLE') {
      verifyPayload.my11circleChallenge = (t as any).my11circleChallenge || null
      verifyPayload.my11circleUserId = (t as any).my11circleUserId || null
      verifyPayload.my11circleMobile = (t as any).mobileNumber || null
    }

    console.log('[transfer] Step 1: auth/verify', { fantasyApp, matchId: realMatchId })
    const verifyRes = await fetch(`${REAL_BACKEND}/api/fantasy/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(verifyPayload),
      signal: AbortSignal.timeout(15000),
    })
    const verifyText = await verifyRes.text()
    console.log('[transfer] auth/verify response:', { status: verifyRes.status, body: verifyText.slice(0, 300) })

    let verifyJson: any
    try { verifyJson = JSON.parse(verifyText) } catch { verifyJson = {} }

    if (verifyRes.status !== 200 || !verifyJson.validToken) {
      // Continue anyway — verify may not be required for all flows
      console.log('[transfer] auth/verify failed, continuing with addteam anyway')
    }
  } catch (e: any) {
    console.error('[transfer] auth/verify error:', e.message)
    // Continue — try addteam anyway
  }

  // ============================================================
  // STEP 2: /api/dream11/addteam — DIRECT transfer (not classic/link)
  // ============================================================
  // Build player arrays
  const playerIds = t.players.map((p: any) => String(p.externalId))
  const captainId = String(t.captainExternalId)
  const vcId = String(t.viceCaptainExternalId)

  // Direct transfer payload (NOT classic — this actually transfers)
  const transferPayload = {
    matchId: realMatchId,
    captain: captainId,
    vice_captain: vcId,
    players: playerIds,
    fantasyApp,
    authToken,
    sportIndex: 0,
    type: mode === 'REPLACE' || mode === 'REPLACE_SPECIFIC' ? 'edit' : 'new',
  }

  const endpoint = `/api/${fantasyApp}/addteam`
  console.log('[transfer] Step 2: direct transfer', {
    endpoint, matchId: realMatchId, captain: captainId, vc: vcId,
    playerCount: playerIds.length, type: transferPayload.type,
  })

  let successCount = 0
  let failedCount = 0
  const errors: string[] = []

  for (let i = 0; i < totalTeams; i++) {
    try {
      const res = await fetch(`${REAL_BACKEND}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(transferPayload),
        signal: AbortSignal.timeout(20000),
      })

      const text = await res.text()
      console.log(`[transfer] Team ${i + 1}/${totalTeams} response:`, { status: res.status, body: text.slice(0, 500) })

      let json: any
      try { json = JSON.parse(text) } catch { json = { status: 'fail', message: 'Invalid response from provider' } }

      if (res.status === 200 && (json.status === 'success' || json.success === true)) {
        successCount++
        console.log(`[transfer] Team ${i + 1} transferred successfully`)
      } else {
        failedCount++
        errors.push(json.message || `Team ${i + 1} failed (HTTP ${res.status})`)
        console.error(`[transfer] Team ${i + 1} FAILED:`, json.message)
      }
    } catch (e: any) {
      console.error(`[transfer] Team ${i + 1} error:`, e.message)
      failedCount++
      errors.push(`Team ${i + 1}: ${e.message}`)
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
    transferLinks: [], // NO links — direct transfer only
    provider: 'teamgeneration.in',
    endpoint,
    directTransfer: true,
  }
}
