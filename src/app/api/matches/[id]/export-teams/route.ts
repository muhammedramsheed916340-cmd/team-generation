import { NextRequest } from 'next/server'
import { apiHandler, fail } from '@/lib/api'
import CryptoJS from 'crypto-js'

const REAL_BACKEND = 'https://tgsoftware-api.online'
const DECRYPT_KEY = 'coder_bobby_believer01_tg_software'

function decrypt(enc: any): any {
  if (typeof enc !== 'string' || !enc.startsWith('U2FsdGVk')) return enc
  try {
    const bytes = CryptoJS.AES.decrypt(enc, DECRYPT_KEY)
    const d = bytes.toString(CryptoJS.enc.Utf8)
    try { return JSON.parse(d) } catch { return d }
  } catch { return enc }
}

/**
 * GET /api/matches/[id]/export-teams
 * Exports generated teams as CSV. Since teams are generated on-demand
 * (not stored), this returns a CSV with the match's real player data.
 */
export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id

  // Fetch real match data for player names
  const res = await fetch(`${REAL_BACKEND}/api/fantasy/match/${matchId}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) return fail('Match not found', 404, 'NOT_FOUND')
  const json = await res.json()
  if (json.status !== 'success' || !json.data) return fail('Match not found', 404, 'NOT_FOUND')

  const m = json.data
  const team1 = decrypt(m.left_team_name)
  const team2 = decrypt(m.right_team_name)

  const headers = ['Player', 'Team', 'Role', 'Credits', 'Points', 'Selected By %', 'Playing']
  const rows: string[] = []

  const addPlayers = (arr: any[], teamName: string) => {
    const ROLE_MAP: Record<number, string> = { 0: 'BOWL', 1: 'BAT', 2: 'AR', 3: 'WK', 4: 'BAT' }
    for (const enc of arr) {
      const p = decrypt(enc)
      if (!p || typeof p !== 'object') continue
      rows.push([p.name, teamName, ROLE_MAP[p.role] || 'BAT', p.credits, p.points || 0, p.selected_by || 0, p.playing === 1 ? 'Yes' : 'No'].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    }
  }

  addPlayers(m.left_team_players || [], team1)
  addPlayers(m.right_team_players || [], team2)

  const csv = [headers.map((h) => `"${h}"`).join(','), ...rows].join('\n')
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="match-${matchId}-players.csv"`,
    },
  })
})
