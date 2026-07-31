/**
 * In-memory fallback data store.
 * Used when the database is unavailable (e.g. Vercel serverless deployment
 * without a persistent filesystem). Provides match/player data so the app
 * always works, even without a database.
 */
import { generateMockMatch, generateSquad, simulateToss as mockToss } from './mock-cricket'

// Singleton in-memory store
let store: {
  matches: any[]
  players: any[]
  playingXI: any[]
  generatedTeams: any[]
  users: any[]
  initialized: boolean
} = {
  matches: [],
  players: [],
  playingXI: [],
  generatedTeams: [],
  users: [],
  initialized: false,
}

export function getFallbackStore() {
  if (!store.initialized) {
    initFallbackStore()
  }
  return store
}

function initFallbackStore() {
  // Create 4 matches with squads
  const match1 = { ...generateMockMatch({ daysFromNow: 0, live: true }), id: 'fb-match-1', playingXINamed: true, playingXIAnnouncedAt: new Date(), tossWinner: '', tossDecision: '', status: 'TOSS_DONE', lastSyncedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
  mockToss(match1)
  const match2 = { ...generateMockMatch({ daysFromNow: 0 }), id: 'fb-match-2', playingXINamed: false, playingXIAnnouncedAt: null, tossWinner: null, tossDecision: null, status: 'UPCOMING', lastSyncedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
  const match3 = { ...generateMockMatch({ daysFromNow: 1 }), id: 'fb-match-3', playingXINamed: false, playingXIAnnouncedAt: null, tossWinner: null, tossDecision: null, status: 'UPCOMING', lastSyncedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }
  const match4 = { ...generateMockMatch({ daysFromNow: 2 }), id: 'fb-match-4', playingXINamed: false, playingXIAnnouncedAt: null, tossWinner: null, tossDecision: null, status: 'UPCOMING', lastSyncedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }

  store.matches = [match1, match2, match3, match4]

  // Generate players for each match
  for (const match of store.matches) {
    for (const teamShort of [match.team1Short, match.team2Short]) {
      const squad = generateSquad(teamShort)
      for (const p of squad) {
        store.players.push({
          ...p,
          id: `${match.id}-${p.externalId}`,
          matchId: match.id,
          battingStyle: p.battingStyle || null,
          bowlingStyle: p.bowlingStyle || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
    }
    // If XI named, pick 11 from each team
    if (match.playingXINamed) {
      const matchPlayers = store.players.filter((p) => p.matchId === match.id)
      for (const teamShort of [match.team1Short, match.team2Short]) {
        const teamPlayers = matchPlayers.filter((p) => p.team === teamShort)
        // pick 1 WK, 4 BAT, 2 AR, 4 BOWL
        const xi = [
          ...teamPlayers.filter((p) => p.role === 'WK').slice(0, 1),
          ...teamPlayers.filter((p) => p.role === 'BAT').slice(0, 4),
          ...teamPlayers.filter((p) => p.role === 'AR').slice(0, 2),
          ...teamPlayers.filter((p) => p.role === 'BOWL').slice(0, 4),
        ]
        const xiIds = new Set(xi.map((p) => p.id))
        for (const p of teamPlayers) {
          p.isPlaying = xiIds.has(p.id)
        }
        for (const p of xi) {
          store.playingXI.push({
            id: `${match.id}-${p.id}-xi`,
            matchId: match.id,
            playerId: p.id,
            announcedAt: new Date(),
            source: 'auto',
          })
        }
      }
    }
  }

  // Create default user
  store.users = [{
    id: 'fb-user-1',
    email: 'user@teamgen.app',
    name: 'User',
    role: 'USER',
    credits: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  }]

  store.initialized = true
}

export function isDatabaseAvailable() {
  try {
    // Check if DATABASE_URL is set and points to a real file
    const url = process.env.DATABASE_URL
    if (!url) return false
    // In serverless (Vercel), file-based SQLite won't persist
    if (url.startsWith('file:')) {
      // Check if we're in a serverless environment
      if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}
