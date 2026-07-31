/**
 * Auth helpers — simplified. No database, no login page.
 * Auto-login creates a JWT token directly.
 */
import { NextRequest } from 'next/server'
import { verifyAccessToken, extractBearer, AccessPayload } from '@/lib/jwt'

export interface AuthResult {
  user: { id: string; email: string; name: string; role: string; credits: number }
  payload: AccessPayload
}

export async function authenticate(req: NextRequest): Promise<AuthResult | null> {
  const token = extractBearer(req.headers.get('authorization'))
  if (!token) return null
  const payload = verifyAccessToken(token)
  if (!payload) return null
  return {
    user: { id: payload.userId, email: payload.email, name: 'User', role: payload.role, credits: 100 },
    payload,
  }
}

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const auth = await authenticate(req)
  if (!auth) throw new AuthError('Unauthorized', 401)
  return auth
}

export class AuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 401) {
    super(message)
    this.statusCode = statusCode
  }
}
