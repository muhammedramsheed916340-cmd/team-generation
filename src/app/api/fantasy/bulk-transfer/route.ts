import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

const REAL_BACKEND = 'https://tgsoftware-api.online'

/**
 * POST /api/fantasy/bulk-transfer
 *
 * Proxies to teamgeneration.in's transfer API:
 *   POST /api/classic/dream11/addteam
 *   POST /api/classic/my11circle/addteam
 *
 * EXACT payload (from teamgeneration.in JS analysis):
 *   {
 *     tgMatchId: "<match_id>",              // string
 *     playerData: ["<pl_id>", "<pl_id>", ...],  // array of player ID strings
 *     captainData: "<pl_id>",               // captain player ID string
 *     vicecaptainData: "<pl_id>",           // VC player ID string
 *     generateLinkFlag: "general"
 *   }
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const rl = rateLimitByIp(getClientIp(req), 'fantasy-bulk', FANTASY_LIMITS.BULK_TRANSFER.limit, FANTASY_LIMITS.BULK_TRANSFER.windowMs)
  if (!rl.allowed) return fail('Too many bulk transfer requests', 429, 'RATE_LIMIT')

  const body = await parseBody<{
    accountId: string; authToken?: string; matchId?: string; matchName: string;
    platform?: string; mode: string; totalTeams: number; template: any;
  }>(req)

  if (!body.accountId || !body.matchName || !body.mode || !body.template) {
    return fail('accountId, matchName, mode, template required', 400, 'VALIDATION_ERROR')
  }
  if (body.totalTeams < 1 || body.totalTeams > 500) {
    return fail('totalTeams must be 1-500', 400, 'VALIDATION_ERROR')
  }

  const t = body.template
  const matchId = body.matchId || body.matchName

  // Build playerData: array of pl_id strings (player IDs as strings)
  const playerData = t.players.map((p: any) => String(p.externalId))

  // captainData and vicecaptainData are pl_id strings
  const captainData = String(t.captainExternalId)
  const vicecaptainData = String(t.viceCaptainExternalId)

  // Build EXACT payload matching teamgeneration.in's format
  const transferPayload = {
    tgMatchId: String(matchId),
    playerData,
    captainData,
    vicecaptainData,
    generateLinkFlag: 'general',
  }

  const platform = (body.platform || 'DREAM11').toLowerCase()
  const endpoint = `/api/classic/${platform}/addteam`

  console.log('[bulk-transfer] Sending to teamgeneration.in:', { endpoint, payload: JSON.stringify(transferPayload) })

  let successCount = 0
  let failedCount = 0
  const errors: string[] = []

  for (let i = 0; i < body.totalTeams; i++) {
    try {
      const res = await fetch(`${REAL_BACKEND}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(transferPayload),
        signal: AbortSignal.timeout(15000),
      })

      const text = await res.text()
      console.log(`[bulk-transfer] Team ${i + 1} response:`, { status: res.status, body: text.slice(0, 300) })

      let json: any
      try { json = JSON.parse(text) } catch { json = { status: 'fail', message: 'Invalid response' } }

      if (res.status === 200 && (json.status === 'success' || json.success === true)) {
        successCount++
      } else {
        failedCount++
        errors.push(json.message || `Team ${i + 1} failed (HTTP ${res.status})`)
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
    errors: errors.slice(0, 5),
    provider: 'teamgeneration.in',
    endpoint,
  }, 202)
})
