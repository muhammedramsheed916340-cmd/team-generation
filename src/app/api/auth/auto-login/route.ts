import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { signAccessToken, signRefreshToken } from '@/lib/jwt'
import { apiHandler, ok } from '@/lib/api'
import { cache } from '@/lib/cache'
import { seedMatch, simulateToss } from '@/lib/mock-cricket'

/**
 * POST /api/auth/auto-login
 * No credentials required. Creates or returns the default app user.
 * Also ensures there is match data available (auto-seeds if empty).
 */
export const POST = apiHandler(async () => {
  // Ensure plans exist
  const planCount = await db.plan.count()
  if (planCount === 0) {
    const plans = [
      { name: 'FREE', displayName: 'Free Plan', description: 'Basic team generation', priceInr: 0, durationDays: 365, creditsPerDay: 5, maxTeamsPerMatch: 5, features: JSON.stringify(['5 teams/match', 'GL strategy']) },
      { name: 'PRO', displayName: 'Pro Plan', description: 'Advanced AI', priceInr: 499, durationDays: 30, creditsPerDay: 25, maxTeamsPerMatch: 20, features: JSON.stringify(['20 teams/match', 'GL+SL', 'Toss regen']) },
      { name: 'ELITE', displayName: 'Elite Plan', description: 'Full access', priceInr: 999, durationDays: 30, creditsPerDay: 50, maxTeamsPerMatch: 50, features: JSON.stringify(['50 teams/match', 'All strategies']) },
      { name: 'MASTERY', displayName: 'Mastery Plan', description: 'Unlimited', priceInr: 1999, durationDays: 90, creditsPerDay: 200, maxTeamsPerMatch: 500, features: JSON.stringify(['500 teams/match', 'Fantasy transfer']) },
    ]
    for (const p of plans) {
      await db.plan.upsert({ where: { name: p.name }, update: {}, create: p })
    }
  }

  // Get or create the default user
  let user = await db.user.findUnique({ where: { email: 'user@teamgen.app' } })
  if (!user) {
    user = await db.user.create({
      data: {
        email: 'user@teamgen.app',
        name: 'User',
        role: 'USER',
        credits: 100,
      },
    })
    const freePlan = await db.plan.findUnique({ where: { name: 'FREE' } })
    if (freePlan) {
      await db.subscription.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      })
    }
  }

  // Ensure there is match data — auto-seed if empty
  const matchCount = await db.match.count()
  if (matchCount === 0) {
    try {
      const liveId = await seedMatch({ daysFromNow: 0, live: true, announceXI: true })
      await simulateToss(liveId)
      await seedMatch({ daysFromNow: 0, announceXI: false })
      await seedMatch({ daysFromNow: 1, announceXI: false })
      await seedMatch({ daysFromNow: 2, announceXI: false })
      cache.clear()
    } catch (e) {
      // seed might fail if data partially exists — ignore
      console.error('auto-seed error:', e)
    }
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email, role: user.role })
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email })

  cache.set(`auth:user:${user.id}`, {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    credits: user.credits,
  }, 60 * 1000)

  return ok({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, credits: user.credits },
    accessToken,
    refreshToken,
  })
})
