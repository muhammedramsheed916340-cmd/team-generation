import { NextRequest } from 'next/server'
import { signAccessToken, signRefreshToken } from '@/lib/jwt'
import { apiHandler, ok } from '@/lib/api'

/**
 * POST /api/auth/auto-login
 * No credentials, no database. Creates a default JWT token for the session.
 */
export const POST = apiHandler(async () => {
  const userId = 'user-session'
  const accessToken = signAccessToken({ userId, email: 'user@teamgen.app', role: 'USER' })
  const refreshToken = signRefreshToken({ userId, email: 'user@teamgen.app' })

  // ============================================================
  // TEMP BYPASS — Dream11 & My11Circle are now free, so Team
  // Generation is also free temporarily. Revert this block when
  // fantasy platforms stop being free (estimated 2-3 months).
  // ORIGINAL: credits: 100 (no isPremium field)
  // ============================================================
  return ok({
    user: {
      id: userId,
      email: 'user@teamgen.app',
      name: 'User',
      role: 'USER',
      credits: 999999,
      isPremium: true,
      plan: 'MASTERY',
    },
    accessToken,
    refreshToken,
  })
})
