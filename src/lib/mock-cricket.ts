/**
 * Mock cricket data generator. Simulates an upstream "Live Match API"
 * returning matches, squads, playing XI, toss, and live score updates.
 * In production this would be replaced by a real cricket API client.
 */
import { db } from '@/lib/db'

const TEAM_POOL: { name: string; short: string; color: string }[] = [
  { name: 'Mumbai Indians', short: 'MI', color: '#1e3a8a' },
  { name: 'Chennai Super Kings', short: 'CSK', color: '#fbbf24' },
  { name: 'Royal Challengers Bengaluru', short: 'RCB', color: '#dc2626' },
  { name: 'Kolkata Knight Riders', short: 'KKR', color: '#7c3aed' },
  { name: 'Delhi Capitals', short: 'DC', color: '#2563eb' },
  { name: 'Punjab Kings', short: 'PBKS', color: '#dc2626' },
  { name: 'Rajasthan Royals', short: 'RR', color: '#ec4899' },
  { name: 'Sunrisers Hyderabad', short: 'SRH', color: '#f97316' },
  { name: 'Gujarat Titans', short: 'GT', color: '#1e293b' },
  { name: 'Lucknow Super Giants', short: 'LSG', color: '#0ea5e9' },
  { name: 'India', short: 'IND', color: '#2563eb' },
  { name: 'Australia', short: 'AUS', color: '#facc15' },
  { name: 'England', short: 'ENG', color: '#1d4ed8' },
  { name: 'Pakistan', short: 'PAK', color: '#15803d' },
]

const VENUES = [
  'Wankhede Stadium', 'M. Chinnaswamy Stadium', 'Eden Gardens', 'Narendra Modi Stadium',
  'Arun Jaitley Stadium', 'MA Chidambaram Stadium', 'Rajiv Gandhi Intl. Stadium',
]

const CITIES = ['Mumbai', 'Bengaluru', 'Kolkata', 'Ahmedabad', 'Delhi', 'Chennai', 'Hyderabad']

const FIRST_NAMES = ['Virat', 'Rohit', 'Jasprit', 'Hardik', 'Rishabh', 'KL', 'Shubman', 'Ravindra', 'Yuzvendra', 'Mohammed', 'Bhuvneshwar', 'Suryakumar', 'Ishan', 'Sanju', 'Yashasvi', 'Tilak', 'Axar', 'Washington', 'Shardul', 'Deepak', 'Arshdeep', 'Umran', 'Rinku', 'Nitish', 'Abhishek', 'Travis', 'David', 'Glenn', 'Mitchell', 'Jos']
const LAST_NAMES = ['Kohli', 'Sharma', 'Bumrah', 'Pandya', 'Pant', 'Rahul', 'Gill', 'Jadeja', 'Chahal', 'Shami', 'Kumar', 'Yadav', 'Kishan', 'Samson', 'Jaiswal', 'Varma', 'Patel', 'Sundar', 'Thakur', 'Chahar', 'Singh', 'Malik', 'Singh', 'Reddy', 'Sharma', 'Head', 'Warner', 'Maxwell', 'Starc', 'Buttler']

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

function randomName(): string {
  return `${pick(FIRST_NAMES, 1)[0]} ${pick(LAST_NAMES, 1)[0]}`
}

function roleCredit(role: string): number {
  // fantasy credit ranges by role
  switch (role) {
    case 'WK': return 8 + Math.random() * 3.5 // 8-11.5
    case 'BAT': return 7.5 + Math.random() * 4 // 7.5-11.5
    case 'AR': return 8 + Math.random() * 3 // 8-11
    case 'BOWL': return 7 + Math.random() * 4 // 7-11
    default: return 8
  }
}

export interface MockPlayer {
  externalId: string
  name: string
  shortName: string
  team: string
  role: 'WK' | 'BAT' | 'AR' | 'BOWL'
  battingStyle?: string
  bowlingStyle?: string
  credit: number
  selectedBy: number
  formScore: number
  isPlaying: boolean
}

/** Generate a 15-member squad for a team (mix of roles) */
export function generateSquad(teamShort: string): MockPlayer[] {
  const squad: MockPlayer[] = []
  const rolePlan: { role: MockPlayer['role']; count: number }[] = [
    { role: 'WK', count: 2 },
    { role: 'BAT', count: 5 },
    { role: 'AR', count: 3 },
    { role: 'BOWL', count: 5 },
  ]
  let idx = 0
  for (const { role, count } of rolePlan) {
    for (let i = 0; i < count; i++) {
      const name = randomName()
      const parts = name.split(' ')
      const shortName = `${parts[0]} ${parts[1][0]}.`
      squad.push({
        externalId: `${teamShort}-${role}-${idx++}`.toLowerCase(),
        name,
        shortName,
        team: teamShort,
        role,
        battingStyle: role === 'BOWL' ? undefined : pick(['Right Handed', 'Left Handed'], 1)[0],
        bowlingStyle: role === 'BAT' ? undefined : pick(['Right Arm Fast', 'Right Arm Medium', 'Left Arm Orthodox', 'Right Arm Leg Spin', 'Left Arm Fast'], 1)[0],
        credit: Math.round(roleCredit(role) * 10) / 10,
        selectedBy: Math.round(Math.random() * 9000) / 10, // 0-90%
        formScore: Math.round(30 + Math.random() * 70),
        isPlaying: true,
      })
    }
  }
  return squad
}

export function generateMockMatch(opts?: { daysFromNow?: number; live?: boolean }) {
  const [t1, t2] = pick(TEAM_POOL, 2)
  const venue = pick(VENUES, 1)[0]
  const city = pick(CITIES, 1)[0]
  const daysFromNow = opts?.daysFromNow ?? 0
  const startAt = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)
  return {
    externalId: `mock-${t1.short}-vs-${t2.short}-${startAt.getTime()}`,
    name: `${t1.name} vs ${t2.name}`,
    shortName: `${t1.short} vs ${t2.short}`,
    series: 'Indian T20 League 2025',
    format: 'T20',
    team1Name: t1.name,
    team1Short: t1.short,
    team1Color: t1.color,
    team2Name: t2.name,
    team2Short: t2.short,
    team2Color: t2.color,
    venue,
    city,
    startAt,
    status: opts?.live ? 'LIVE' : daysFromNow <= 0 ? 'UPCOMING' : 'UPCOMING',
  }
}

/**
 * Seed a fresh match + squads + (optionally) playing XI into the DB.
 * Returns the match id.
 */
export async function seedMatch(opts?: { daysFromNow?: number; live?: boolean; announceXI?: boolean }): Promise<string> {
  const data = generateMockMatch(opts)
  const existing = await db.match.findUnique({ where: { externalId: data.externalId } })
  if (existing) return existing.id

  const match = await db.match.create({ data: { ...data, lastSyncedAt: new Date() } })

  for (const teamShort of [data.team1Short, data.team2Short]) {
    const squad = generateSquad(teamShort)
    for (const p of squad) {
      await db.player.create({
        data: {
          matchId: match.id,
          externalId: p.externalId,
          name: p.name,
          shortName: p.shortName,
          team: p.team,
          role: p.role,
          battingStyle: p.battingStyle || null,
          bowlingStyle: p.bowlingStyle || null,
          credit: p.credit,
          selectedBy: p.selectedBy,
          formScore: p.formScore,
          isPlaying: p.isPlaying,
        },
      })
    }
  }

  if (opts?.announceXI) {
    // pick 11 from each squad (2 WK, 3-5 BAT, 1-3 AR, 3-5 BOWL) — mark as playing XI
    const players = await db.player.findMany({ where: { matchId: match.id } })
    for (const teamShort of [data.team1Short, data.team2Short]) {
      const teamPlayers = players.filter((p) => p.team === teamShort)
      const xi = pickPlayingXI(teamPlayers)
      for (const p of xi) {
        await db.playingXI.create({
          data: { matchId: match.id, playerId: p.id, source: 'auto' },
        })
      }
      // mark non-XI as not playing
      const xiIds = new Set(xi.map((p) => p.id))
      for (const p of teamPlayers) {
        if (!xiIds.has(p.id)) {
          await db.player.update({ where: { id: p.id }, data: { isPlaying: false } })
        }
      }
    }
    await db.match.update({
      where: { id: match.id },
      data: { playingXINamed: true, playingXIAnnouncedAt: new Date() },
    })
  }

  return match.id
}

export function pickPlayingXI(players: { id: string; role: string }[]) {
  const byRole: Record<string, typeof players> = { WK: [], BAT: [], AR: [], BOWL: [] }
  for (const p of players) byRole[p.role]?.push(p)
  // 11 = 1 WK + 4 BAT + 2 AR + 4 BOWL (one of many valid combos)
  const xi = [
    ...pick(byRole.WK, 1),
    ...pick(byRole.BAT, 4),
    ...pick(byRole.AR, 2),
    ...pick(byRole.BOWL, 4),
  ]
  return xi
}

/** Simulate a toss update for a match */
export async function simulateToss(matchId: string) {
  const match = await db.match.findUnique({ where: { id: matchId } })
  if (!match) return null
  const winner = Math.random() > 0.5 ? match.team1Short : match.team2Short
  const decision = Math.random() > 0.5 ? 'BAT' : 'BOWL'
  await db.match.update({
    where: { id: matchId },
    data: { tossWinner: winner, tossDecision: decision, status: 'TOSS_DONE', lastSyncedAt: new Date() },
  })
  return { winner, decision }
}
