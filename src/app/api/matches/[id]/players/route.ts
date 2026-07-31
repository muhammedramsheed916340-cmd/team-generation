import { NextRequest } from 'next/server'
import { apiHandler, ok } from '@/lib/api'
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

/**
 * GET /api/matches/[id]/players
 * Fetches real player data from teamgeneration.in for the match.
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const cacheKey = `players:${matchId}`

  const players = await cache.getOrSet(
    cacheKey,
    async () => {
      try {
        const res = await fetch(`${REAL_BACKEND}/api/fantasy/match/${matchId}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'TeamGen/1.0' },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return []
        const json = await res.json()
        if (json.status !== 'success' || !json.data) return []

        const m = json.data
        const team1 = decrypt(m.left_team_name)
        const team2 = decrypt(m.right_team_name)

        const parsePlayers = (arr: any[], teamName: string) => {
          return arr.map((enc, i) => {
            const p = decrypt(enc)
            if (!p || typeof p !== 'object') return null
            return {
              id: p.player_fixed_id || p.pl_id || i,
              externalId: String(p.player_fixed_id || p.pl_id || i),
              name: p.name,
              shortName: p.name?.split(' ').map((w: string) => w[0]).join('') || p.name,
              team: teamName,
              role: ROLE_MAP[p.role] || 'BAT',
              battingStyle: null,
              bowlingStyle: p.player_type || null,
              credit: p.credits,
              selectedBy: p.selected_by || 0,
              formScore: p.points || 0,
              isPlaying: p.playing === 1 || p.playing === true,
              image: p.image,
              points: p.points || 0,
              captainPercentage: p.captain_percentage || 0,
              viceCaptainPercentage: p.vice_captain_percentage || 0,
              playerType: p.player_type,
            }
          }).filter(Boolean)
        }

        return [
          ...parsePlayers(m.left_team_players || [], team1),
          ...parsePlayers(m.right_team_players || [], team2),
        ]
      } catch (e) {
        console.error('players fetch error:', e)
        return []
      }
    },
    60 * 1000
  )

  return ok({ players })
})
