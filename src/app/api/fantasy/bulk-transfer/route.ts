import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

const REAL_BACKEND = 'https://tgsoftware-api.online'

/**
 * POST /api/fantasy/bulk-transfer
 * Body: { accountId, authToken, matchId, matchName, platform, mode, totalTeams, template }
 *
 * Proxies to teamgeneration.in's transfer API:
 *   POST /api/classic/dream11/addteam (Dream11)
 *   POST /api/classic/my11circle/addteam (My11Circle) — if exists
 *
 * teamgeneration.in expects EXACTLY:
 *   {
 *     tgMatchId: "<match_id>",
 *     playerData: [<player_object>, ...],   // array of player objects
 *     captainData: <player_object>,          // captain player object
 *     vicecaptainData: <player_object>,      // VC player object
 *     generateLinkFlag: "general"
 *   }
 *
 * player_object = { name, player_id, ... } from teamgeneration.in
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

  // Build player objects for the classic transfer API
  // teamgeneration.in expects player objects, not just IDs
  const playerData = t.players.map((p: any) => ({
    player_id: p.externalId,
    name: p.name,
    role: p.role,
  }))

  const captainPlayer = t.players.find((p: any) => p.externalId === t.captainExternalId) || t.players[0]
  const vcPlayer = t.players.find((p: any) => p.externalId === t.viceCaptainExternalId) || t.players[1]

  const captainData = {
    player_id: captainPlayer.externalId,
    name: captainPlayer.name,
    role: captainPlayer.role,
  }

  const vicecaptainData = {
    player_id: vcPlayer.externalId,
    name: vcPlayer.name,
    role: vcPlayer.role,
  }

  // Build EXACT payload matching teamgeneration.in's classic/dream11/addteam
  const transferPayload = {
    tgMatchId: String(matchId),
    playerData,
    captainData,
    vicecaptainData,
    generateLinkFlag: 'general',
  }

  const platform = (body.platform || 'DREAM11').toLowerCase()
  const endpoint = `/api/classic/${platform}/addteam`

  console.log('[bulk-transfer] Sending to teamgeneration.in:', { endpoint, payload: JSON.stringify(transferPayload).slice(0, 500) })

  let successCount = 0
  let failedCount = 0
  const errors: string[] = []

  // Transfer each team
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
