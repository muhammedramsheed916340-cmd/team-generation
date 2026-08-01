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
  const cacheKey = `predict:${matchId}`

  const prediction = await cache.getOrSet(cacheKey, async () => {
    const res = await fetch(`${REAL_BACKEND}/api/fantasy/match/${matchId}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json.status !== 'success' || !json.data) return null

    const m = json.data
    const team1 = decrypt(m.left_team_name)
    const team2 = decrypt(m.right_team_name)
    const lineupOut = m.lineup_status === 1 || m.lineup_status === true

    const parsePlayers = (arr: any[], teamName: string) => {
      return arr.map((enc) => {
        const p = decrypt(enc)
        if (!p || typeof p !== 'object') return null
        return { name: p.name, role: ROLE_MAP[p.role] || 'BAT', credit: p.credits, points: p.points || 0, selectedBy: p.selected_by || 0, playing: p.playing === 1 || p.playing === true }
      }).filter(Boolean)
    }

    const t1Players = parsePlayers(m.left_team_players || [], team1)
    const t2Players = parsePlayers(m.right_team_players || [], team2)
    const usable1 = lineupOut ? t1Players.filter((p) => p.playing) : t1Players
    const usable2 = lineupOut ? t2Players.filter((p) => p.playing) : t2Players

    const s1 = usable1.reduce((a, p) => a + (p.points / 100) * p.credit, 0)
    const s2 = usable2.reduce((a, p) => a + (p.points / 100) * p.credit, 0)
    const total = s1 + s2
    let p1 = total > 0 ? s1 / total : 0.5
    let p2 = total > 0 ? s2 / total : 0.5
    p1 = Math.max(0.1, Math.min(0.9, p1)); p2 = Math.max(0.1, Math.min(0.9, p2))
    const sum = p1 + p2; p1 = p1 / sum; p2 = p2 / sum
    const gap = Math.abs(p1 - p2)
    const confidence = gap > 0.25 ? 'HIGH' : gap > 0.12 ? 'MEDIUM' : 'LOW'

    const topPlayers = (players: any[]) => [...players].sort((a, b) => (b.points * b.credit) - (a.points * a.credit)).slice(0, 3).map((p) => ({ name: p.name, role: p.role, impact: Math.round((p.points * p.credit) / 10) / 10 }))

    return {
      matchId,
      team1: { short: team1, name: team1, winProbability: Math.round(p1 * 1000) / 10, strength: Math.round(s1 * 10) / 10, keyPlayers: topPlayers(usable1) },
      team2: { short: team2, name: team2, winProbability: Math.round(p2 * 1000) / 10, strength: Math.round(s2 * 10) / 10, keyPlayers: topPlayers(usable2) },
      tossAdvantage: null,
      predictedTotalScore: Math.round(140 + ((s1 + s2) / 2 / 100) * 80),
      predictedWickets: 6,
      confidence,
      factors: [
        { label: 'Avg Points', team1Value: (usable1.reduce((a, p) => a + p.points, 0) / Math.max(usable1.length, 1)).toFixed(1), team2Value: (usable2.reduce((a, p) => a + p.points, 0) / Math.max(usable2.length, 1)).toFixed(1), edge: usable1.reduce((a, p) => a + p.points, 0) / Math.max(usable1.length, 1) > usable2.reduce((a, p) => a + p.points, 0) / Math.max(usable2.length, 1) ? team1 : team2 },
        { label: 'Squad Size', team1Value: String(usable1.length), team2Value: String(usable2.length), edge: usable1.length > usable2.length ? team1 : team2 },
      ],
    }
  }, 60 * 1000)

  if (!prediction) return fail('Match not found', 404, 'NOT_FOUND')
  return ok(prediction)
})
