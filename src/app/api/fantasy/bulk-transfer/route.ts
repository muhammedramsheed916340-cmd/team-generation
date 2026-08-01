import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

const REAL_BACKEND = 'https://tgsoftware-api.online'

/**
 * POST /api/fantasy/bulk-transfer
 * Body: { accountId, authToken, matchName, platform, mode, totalTeams, template }
 *
 * Proxies to teamgeneration.in's transfer API:
 *   Dream11: POST /api/dream11/addteam
 *   My11Circle: POST /api/my11circle/add-match
 *
 * teamgeneration.in expects:
 *   { matchId, captain, vice_captain, players, fantasyApp, authToken, sportIndex, type }
 *
 * - captain: player ID (string)
 * - vice_captain: player ID (string)
 * - players: array of player IDs (strings)
 * - fantasyApp: "dream11" | "my11circle"
 * - authToken: from OTP verify response
 * - sportIndex: 0 (cricket)
 * - type: "new" for create, "edit" for replace
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-bulk', FANTASY_LIMITS.BULK_TRANSFER.limit, FANTASY_LIMITS.BULK_TRANSFER.windowMs)
  if (!rl.allowed) return fail('Too many bulk transfer requests', 429, 'RATE_LIMIT')

  const body = await parseBody<{
    accountId: string; authToken?: string; matchName: string; platform?: string;
    mode: string; totalTeams: number; template: any;
  }>(req)

  if (!body.accountId || !body.matchName || !body.mode || !body.template) {
    return fail('accountId, matchName, mode, template required', 400, 'VALIDATION_ERROR')
  }
  if (body.totalTeams < 1 || body.totalTeams > 500) {
    return fail('totalTeams must be 1-500', 400, 'VALIDATION_ERROR')
  }

  const t = body.template
  const fantasyApp = (body.platform || 'DREAM11').toLowerCase()

  // If we have a real authToken from OTP verify, use real teamgeneration.in transfer
  if (body.authToken) {
    // Build the EXACT payload teamgeneration.in expects
    const transferPayload = {
      matchId: body.matchName, // match identifier
      captain: String(t.captainExternalId), // player ID
      vice_captain: String(t.viceCaptainExternalId), // player ID
      players: t.players.map((p: any) => String(p.externalId)), // array of player IDs
      fantasyApp,
      authToken: body.authToken,
      sportIndex: 0, // cricket
      type: body.mode === 'REPLACE' || body.mode === 'REPLACE_SPECIFIC' ? 'edit' : 'new',
    }

    const endpoint = fantasyApp === 'dream11' ? '/api/dream11/addteam' : '/api/my11circle/add-match'
    console.log('[bulk-transfer] Sending to teamgeneration.in:', { endpoint, payload: JSON.stringify(transferPayload).slice(0, 300) })

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    // Transfer each team (same template for all in bulk)
    for (let i = 0; i < body.totalTeams; i++) {
      try {
        const res = await fetch(`${REAL_BACKEND}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(transferPayload),
          signal: AbortSignal.timeout(15000),
        })

        const text = await res.text()
        console.log(`[bulk-transfer] Team ${i + 1} response:`, { status: res.status, body: text.slice(0, 200) })

        let json: any
        try { json = JSON.parse(text) } catch { json = { status: 'fail', message: 'Invalid response' } }

        if (res.status === 200 && (json.status === 'success' || json.success === true)) {
          successCount++
        } else {
          failedCount++
          errors.push(json.message || `Team ${i + 1} failed`)
        }
      } catch (e: any) {
        console.error(`[bulk-transfer] Team ${i + 1} error:`, e.message)
        failedCount++
        errors.push(e.message)
      }
    }

    return ok({
      queueId: `q-${Date.now()}`,
      status: 'COMPLETED',
      totalTeams: body.totalTeams,
      successCount,
      failedCount,
      errors: errors.slice(0, 5), // Return first 5 errors
      provider: 'teamgeneration.in',
      endpoint,
    }, 202)
  }

  // No authToken — can't transfer without linked account
  return fail('No authToken. Link your fantasy account first via OTP.', 401, 'NO_AUTH_TOKEN')
})
