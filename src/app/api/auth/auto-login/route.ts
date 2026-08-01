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

  return ok({
    user: { id: userId, email: 'user@teamgen.app', name: 'User', role: 'USER', credits: 100 },
    accessToken,
    refreshToken,
  })
})
