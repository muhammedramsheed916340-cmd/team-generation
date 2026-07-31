/**
 * Proxy to the real teamgeneration.in backend API.
 * Fetches from https://tgsoftware-api.online, decrypts the AES-encrypted
 * match data, and returns it in a clean format.
 */
import { NextRequest } from 'next/server'
import { apiHandler, ok, fail } from '@/lib/api'
import { cache } from '@/lib/cache'
import CryptoJS from 'crypto-js'

const REAL_BACKEND = 'https://tgsoftware-api.online'
const DECRYPT_KEY = 'coder_bobby_believer01_tg_software'

export interface RealMatch {
  id: string
  team1: string
  team2: string
  team1Image: string
  team2Image: string
  series: string
  matchTime: string
  sportIndex: number
  lineupOut: boolean
  matchType: string
  fantasyApps: string[]
  _id: string
}

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url)
  const sport = url.searchParams.get('sport') || 'cricket'
  const sportMap: Record<string, string> = {
    cricket: 'cricket', football: 'football', basketball: 'basketball', kabaddi: 'kabaddi',
  }
  const sportPath = sportMap[sport] || 'cricket'

  const cacheKey = `real-matches:${sportPath}`

  const result = await cache.getOrSet(
    cacheKey,
    async () => {
      try {
        const res = await fetch(`${REAL_BACKEND}/api/fantasy/matches/${sportPath}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'TeamGen/1.0' },
          signal: AbortSignal.timeout(10000),
        })

        if (!res.ok) throw new Error(`Backend returned ${res.status}`)

        const json = await res.json()

        if (json.status !== 'success' || !Array.isArray(json.data)) {
          return { source: 'tgsoftware-api.online', sport: sportPath, matches: [], error: 'Unexpected response format' }
        }

        // Each element in the array is an AES-encrypted string
        const matches: RealMatch[] = []
        for (const encrypted of json.data) {
          try {
            const bytes = CryptoJS.AES.decrypt(encrypted, DECRYPT_KEY)
            const decrypted = bytes.toString(CryptoJS.enc.Utf8)
            if (decrypted) {
              const m = JSON.parse(decrypted)
              matches.push({
                id: m.id,
                _id: m._id,
                team1: m.left_team_name,
                team2: m.right_team_name,
                team1Image: m.left_team_image,
                team2Image: m.right_team_image,
                series: m.series_name,
                matchTime: m.match_time,
                sportIndex: m.sport_index,
                lineupOut: m.lineup_out === 1 || m.lineup_out === true,
                matchType: m.match_type,
                fantasyApps: m.fantasy_list || [],
              })
            }
          } catch {
            // skip unparseable entries
          }
        }

        return { source: 'tgsoftware-api.online', sport: sportPath, matches, total: matches.length }
      } catch (e: any) {
        throw new Error(`Failed to fetch from real backend: ${e.message}`)
      }
    },
    60 * 1000 // 1 minute cache
  )

  return ok(result)
})
