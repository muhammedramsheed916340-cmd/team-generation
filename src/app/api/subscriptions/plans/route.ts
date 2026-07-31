import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  // In-memory: return default plans
  return ok({ plans: [
    { id: 'free', name: 'FREE', displayName: 'Free Plan', description: 'Basic team generation', priceInr: 0, durationDays: 365, creditsPerDay: 5, maxTeamsPerMatch: 5, features: ['5 teams/match', 'GL strategy'] },
    { id: 'pro', name: 'PRO', displayName: 'Pro Plan', description: 'Advanced AI', priceInr: 499, durationDays: 30, creditsPerDay: 25, maxTeamsPerMatch: 20, features: ['20 teams/match', 'GL+SL', 'Toss regen'] },
    { id: 'elite', name: 'ELITE', displayName: 'Elite Plan', description: 'Full access', priceInr: 999, durationDays: 30, creditsPerDay: 50, maxTeamsPerMatch: 50, features: ['50 teams/match', 'All strategies'] },
    { id: 'mastery', name: 'MASTERY', displayName: 'Mastery Plan', description: 'Unlimited', priceInr: 1999, durationDays: 90, creditsPerDay: 200, maxTeamsPerMatch: 500, features: ['500 teams/match', 'Fantasy transfer'] },
  ] })
})

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  // No-op in memory (subscription is implicit)
  return ok({ subscription: { userId: auth.user.id, status: 'ACTIVE', planId: 'free', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) } })
})
