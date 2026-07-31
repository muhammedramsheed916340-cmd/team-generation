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

/**
 * GET /api/matches/[id]
 * Fetches real match detail from teamgeneration.in, decrypts player data.
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const id = params.id
  const cacheKey = `match:${id}`

  const match = await cache.getOrSet(
    cacheKey,
    async () => {
      try {
        const res = await fetch(`${REAL_BACKEND}/api/fantasy/match/${id}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'TeamGen/1.0' },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return null
        const json = await res.json()
        if (json.status !== 'success' || !json.data) return null

        const m = json.data
        const team1 = decrypt(m.left_team_name)
        const team2 = decrypt(m.right_team_name)
        const team1Image = decrypt(m.left_team_image)
        const team2Image = decrypt(m.right_team_image)
        const lineupOut = m.lineup_status === 1 || m.lineup_status === true

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

        const team1Players = parsePlayers(m.left_team_players || [], team1)
        const team2Players = parsePlayers(m.right_team_players || [], team2)

        return {
          id: m.id,
          _id: m._id,
          shortName: `${team1} vs ${team2}`,
          name: `${team1} vs ${team2}`,
          team1Name: team1, team2Name: team2,
          team1Short: team1, team2Short: team2,
          team1Color: '#563d7c', team2Color: '#1a73e8',
          team1Image, team2Image,
          series: '', format: 'T20', venue: '', city: '',
          startAt: m.match_time,
          status: lineupOut ? 'TOSS_DONE' : 'UPCOMING',
          playingXINamed: lineupOut,
          tossWinner: null, tossDecision: null,
          lineupOut,
          toss: decrypt(m.toss),
          matchTime: m.match_time,
          players: { team1: team1Players, team2: team2Players },
          _count: { players: team1Players.length + team2Players.length, playingXI: 0, generatedTeams: 0 },
        }
      } catch (e) {
        console.error('match detail error:', e)
        return null
      }
    },
    60 * 1000
  )

  if (!match) return fail('Match not found', 404, 'NOT_FOUND')
  return ok(match)
})
