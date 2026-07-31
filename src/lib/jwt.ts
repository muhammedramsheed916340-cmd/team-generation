/**
 * JWT-based session + API token management for the fantasy transfer system.
 * Issues short-lived access tokens and long-lived refresh tokens.
 */
import jwt from 'jsonwebtoken'

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'tg-access-secret-dev'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'tg-refresh-secret-dev'

export const ACCESS_TTL = 15 * 60 // 15 min
export const REFRESH_TTL = 7 * 24 * 60 * 60 // 7 days

export interface AccessPayload {
  userId: string
  email: string
  role: string
  type: 'access'
}

export interface RefreshPayload {
  userId: string
  email: string
  type: 'refresh'
}

export function signAccessToken(payload: Omit<AccessPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, ACCESS_SECRET, { expiresIn: ACCESS_TTL })
}

export function signRefreshToken(payload: Omit<RefreshPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_TTL })
}

export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as AccessPayload
    if (decoded.type !== 'access') return null
    return decoded
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): RefreshPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as RefreshPayload
    if (decoded.type !== 'refresh') return null
    return decoded
  } catch {
    return null
  }
}

/** Extract bearer token from Authorization header */
export function extractBearer(authHeader?: string | null): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}
