import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { signAccessToken, signRefreshToken } from '@/lib/jwt'
import { apiHandler, ok } from '@/lib/api'
import { cache } from '@/lib/cache'

/**
 * POST /api/auth/auto-login
 * No credentials required. Creates or returns the default app user.
 * The app is directly accessible — no login page needed.
 */
export const POST = apiHandler(async () => {
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
    // Give them a free subscription
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
