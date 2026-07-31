/**
 * Simple in-memory rate limiter (sliding window).
 * Used to throttle fantasy login OTP requests and transfer endpoints.
 */
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || now > existing.resetAt) {
    const bucket: Bucket = { count: 1, resetAt: now + windowMs }
    buckets.set(key, bucket)
    return { allowed: true, remaining: limit - 1, resetAt: bucket.resetAt, limit }
  }
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt, limit }
  }
  existing.count++
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt, limit }
}

/** Convenience: rate limit by IP for a given route namespace */
export function rateLimitByIp(ip: string | null, namespace: string, limit: number, windowMs: number): RateLimitResult {
  return rateLimit(`${namespace}:${ip || 'unknown'}`, limit, windowMs)
}

// Fantasy-specific limits
export const FANTASY_LIMITS = {
  OTP_REQUEST: { limit: 3, windowMs: 5 * 60 * 1000 }, // 3 OTP / 5min per ip
  OTP_VERIFY: { limit: 5, windowMs: 5 * 60 * 1000 }, // 5 verify attempts / 5min
  TRANSFER: { limit: 20, windowMs: 60 * 1000 }, // 20 transfer calls / min
  BULK_TRANSFER: { limit: 2, windowMs: 60 * 1000 }, // 2 bulk jobs / min
}
