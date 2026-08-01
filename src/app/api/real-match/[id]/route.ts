/**
 * Proxy to real teamgeneration.in match detail API.
 * Fetches from https://tgsoftware-api.online/api/fantasy/match/:id
 * Decrypts AES-encrypted team names, images, and player data.
 */
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
    // Try to parse as JSON, otherwise return string
    try { return JSON.parse(d) } catch { return d }
  } catch { return enc }
}

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const cacheKey = `real-match:${matchId}`

  const result = await cache.getOrSet(
    cacheKey,
    async () => {
      try {
        const res = await fetch(`${REAL_BACKEND}/api/fantasy/match/${matchId}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'TeamGen/1.0' },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error(`Backend returned ${res.status}`)
        const json = await res.json()
        if (json.status !== 'success' || !json.data) {
          return { source: 'tgsoftware-api.online', matchId, match: null }
        }
        const m = json.data

        const leftTeamName = decrypt(m.left_team_name)
        const rightTeamName = decrypt(m.right_team_name)
        const leftTeamImage = decrypt(m.left_team_image)
        const rightTeamImage = decrypt(m.right_team_image)

        const leftPlayers = (m.left_team_players || []).map((enc: string, i: number) => {
          const p = decrypt(enc)
          return normalizePlayer(p, leftTeamName, i)
        }).filter(Boolean)

        const rightPlayers = (m.right_team_players || []).map((enc: string, i: number) => {
          const p = decrypt(enc)
          return normalizePlayer(p, rightTeamName, i)
        }).filter(Boolean)

        return {
          source: 'tgsoftware-api.online',
          matchId,
          match: {
            id: m.id,
            _id: m._id,
            team1: leftTeamName,
            team2: rightTeamName,
            team1Image: leftTeamImage,
            team2Image: rightTeamImage,
            matchTime: m.match_time,
            matchType: m.match_type,
            sportIndex: m.sport_index,
            lineupStatus: m.lineup_status,
            toss: decrypt(m.toss),
            players: {
              team1: leftPlayers,
              team2: rightPlayers,
            },
          },
        }
      } catch (e: any) {
        throw new Error(`Failed to fetch match: ${e.message}`)
      }
    },
    60 * 1000
  )

  return ok(result)
})

function normalizePlayer(p: any, team: string, index: number) {
  if (!p || typeof p !== 'object') return null
  return {
    id: p.player_fixed_id || p.pl_id || `p-${index}`,
    name: p.name,
    image: p.image,
    team,
    role: ROLE_MAP[p.role] || 'BAT',
    credits: p.credits,
    points: p.points,
    selectedBy: p.selected_by,
    captainPercentage: p.captain_percentage,
    viceCaptainPercentage: p.vice_captain_percentage,
    playing: p.playing === 1 || p.playing === true,
    playerType: p.player_type,
    lastPlay: p.last_play,
    fantasyIdList: p.fantasy_id_list || [],
  }
}
