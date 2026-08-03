import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  // ============================================================
  // TEMP BYPASS — Dream11 & My11Circle are now free, so all Team
  // Generation plans are also free temporarily. Revert this block
  // (restore original prices) when fantasy platforms stop being free.
  // ORIGINAL: FREE ₹0 / PRO ₹499 / ELITE ₹999 / MASTERY ₹1999
  // ============================================================
  return ok({ plans: [
    { id: 'free', name: 'FREE', displayName: 'Free Plan', description: 'All features unlocked', priceInr: 0, durationDays: 365, creditsPerDay: 999999, maxTeamsPerMatch: 500, features: ['All features free', 'Unlimited teams', 'All strategies', 'Fantasy transfer'] },
    { id: 'pro', name: 'PRO', displayName: 'Pro Plan', description: 'All features unlocked', priceInr: 0, durationDays: 365, creditsPerDay: 999999, maxTeamsPerMatch: 500, features: ['All features free', 'Unlimited teams', 'All strategies', 'Toss regen'] },
    { id: 'elite', name: 'ELITE', displayName: 'Elite Plan', description: 'All features unlocked', priceInr: 0, durationDays: 365, creditsPerDay: 999999, maxTeamsPerMatch: 500, features: ['All features free', 'Unlimited teams', 'All strategies'] },
    { id: 'mastery', name: 'MASTERY', displayName: 'Mastery Plan', description: 'All features unlocked', priceInr: 0, durationDays: 365, creditsPerDay: 999999, maxTeamsPerMatch: 500, features: ['All features free', 'Unlimited teams', 'Fantasy transfer'] },
  ] })
})

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  // No-op in memory (subscription is implicit)
  // TEMP BYPASS — always returns MASTERY plan active for 1 year.
  return ok({ subscription: { userId: auth.user.id, status: 'ACTIVE', planId: 'mastery', expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) } })
})
