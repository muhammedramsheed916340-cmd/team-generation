/**
 * Auth helpers — JWT-based sessions. No database, no login page.
 * Auto-login creates a JWT token directly.
 *
 * Exports:
 * - authenticate(req)     → AuthResult | null (soft check)
 * - requireAuth(req)      → AuthResult (throws AuthError 401 if no token)
 * - requireAdmin(req)     → AuthResult (throws AuthError 401/403 if not admin)
 * - AuthError             → Error class with statusCode
 */
import { NextRequest } from 'next/server'
import { verifyAccessToken, extractBearer, AccessPayload } from '@/lib/jwt'

export interface AuthResult {
  user: { id: string; email: string; name: string; role: string; credits: number }
  payload: AccessPayload
}

/**
 * Soft authentication — returns null if no valid token (does not throw).
 * Use for routes that work for both authenticated and anonymous users.
 */
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

/**
 * Require authentication — throws AuthError(401) if no valid token.
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const auth = await authenticate(req)
  if (!auth) throw new AuthError('Unauthorized', 401)
  return auth
}

/**
 * Require admin role — throws AuthError(401) if not authenticated,
 * or AuthError(403) if authenticated but not an admin.
 *
 * Authorization logic: user.role must be 'ADMIN' or 'SUPER_ADMIN'.
 * This preserves admin-only security for all admin routes.
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(req)
  if (auth.user.role !== 'ADMIN' && auth.user.role !== 'SUPER_ADMIN') {
    throw new AuthError('Forbidden: admin access required', 403)
  }
  return auth
}

export class AuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 401) {
    super(message)
    this.statusCode = statusCode
  }
}
