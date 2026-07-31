import { NextRequest } from 'next/server'
import { apiHandler, ok } from '@/lib/api'
import { cache } from '@/lib/cache'
import CryptoJS from 'crypto-js'

const REAL_BACKEND = 'https://tgsoftware-api.online'
const DECRYPT_KEY = 'coder_bobby_believer01_tg_software'

/**
 * GET /api/matches
 * Now proxies directly to the real teamgeneration.in backend.
 * NO MORE MOCK DATA — only real matches from tgsoftware-api.online.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const sport = url.searchParams.get('sport') || 'cricket'

  const cacheKey = `matches:${sport}:${status || 'all'}`

  const matches = await cache.getOrSet(
    cacheKey,
    async () => {
      try {
        const res = await fetch(`${REAL_BACKEND}/api/fantasy/matches/${sport}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'TeamGen/1.0' },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) throw new Error(`Backend returned ${res.status}`)
        const json = await res.json()

        if (json.status !== 'success' || !Array.isArray(json.data)) {
          return []
        }

        // Decrypt each match
        const matches: any[] = []
        for (const encrypted of json.data) {
          try {
            const bytes = CryptoJS.AES.decrypt(encrypted, DECRYPT_KEY)
            const decrypted = bytes.toString(CryptoJS.enc.Utf8)
            if (decrypted) {
              const m = JSON.parse(decrypted)
              matches.push({
                id: m.id,
                _id: m._id,
                shortName: `${m.left_team_name} vs ${m.right_team_name}`,
                name: `${m.left_team_name} vs ${m.right_team_name}`,
                team1Short: m.left_team_name,
                team2Short: m.right_team_name,
                team1Name: m.left_team_name,
                team2Name: m.right_team_name,
                team1Color: '#563d7c',
                team2Color: '#1a73e8',
                team1Image: m.left_team_image,
                team2Image: m.right_team_image,
                series: m.series_name,
                format: 'T20',
                venue: '',
                city: '',
                startAt: m.match_time,
                status: m.lineup_out ? 'TOSS_DONE' : 'UPCOMING',
                playingXINamed: m.lineup_out === 1 || m.lineup_out === true,
                tossWinner: null,
                tossDecision: null,
                lineupOut: m.lineup_out === 1 || m.lineup_out === true,
                matchTime: m.match_time,
                isReal: true,
                _count: { players: 0, playingXI: 0, generatedTeams: 0 },
              })
            }
          } catch { /* skip */ }
        }

        // Filter by status if requested
        let result = matches
        if (status) result = matches.filter((m) => m.status === status)
        return result
      } catch (e) {
        console.error('matches fetch error:', e)
        return []
      }
    },
    60 * 1000
  )

  return ok({ matches, cached: cache.has(cacheKey) })
})
