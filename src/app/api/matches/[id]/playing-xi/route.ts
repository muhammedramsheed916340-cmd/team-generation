import { NextRequest } from 'next/server'
import { apiHandler, ok, fail } from '@/lib/api'
import { cache } from '@/lib/cache'
import CryptoJS from 'crypto-js'

const REAL_BACKEND = 'https://tgsoftware-api.online'
const DECRYPT_KEY = 'coder_bobby_believer01_tg_software'
const ROLE_MAP: Record<number, string> = { 0: 'BOWL', 1: 'BAT', 2: 'AR', 3: 'WK', 4: 'BAT' }

function decrypt(enc: any): any {
  if (typeof enc !== 'string' || !enc.startsWith('U2FsdGVk')) return enc
  try {
    const bytes = CryptoJS.AES.decrypt(enc, DECRYPT_KEY)
    const d = bytes.toString(CryptoJS.enc.Utf8)
    try { return JSON.parse(d) } catch { return d }
  } catch { return enc }
}

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const cacheKey = `xi:${matchId}`

  const xi = await cache.getOrSet(cacheKey, async () => {
    const res = await fetch(`${REAL_BACKEND}/api/fantasy/match/${matchId}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const json = await res.json()
    if (json.status !== 'success' || !json.data) return []

    const m = json.data
    const team1 = decrypt(m.left_team_name)
    const team2 = decrypt(m.right_team_name)

    const parsePlayers = (arr: any[], teamName: string) => {
      return arr.map((enc) => {
        const p = decrypt(enc)
        if (!p || typeof p !== 'object') return null
        return { id: p.player_fixed_id, name: p.name, team: teamName, role: ROLE_MAP[p.role] || 'BAT', playing: p.playing === 1 || p.playing === true }
      }).filter(Boolean) as any[]
    }

    const all = [...parsePlayers(m.left_team_players || [], team1), ...parsePlayers(m.right_team_players || [], team2)]
    return all.filter((p) => p.playing).map((p) => ({ ...p, player: p }))
  }, 60 * 1000)

  return ok({ playingXI: xi })
})

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  // Lineup is controlled by teamgeneration.in — we can't manually announce it
  return fail('Lineup is managed by teamgeneration.in backend. It updates automatically.', 400, 'AUTO_MANAGED')
})
