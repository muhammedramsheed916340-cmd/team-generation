import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { loginWithPassword } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody, getClientIp } from '@/lib/api'
import { audit } from '@/lib/audit'
import { rateLimitByIp, FANTASY_LIMITS } from '@/lib/rate-limit'

export const POST = apiHandler(async (req: NextRequest) => {
  const rl = rateLimitByIp(getClientIp(req), 'login', 10, 60 * 1000)
  if (!rl.allowed) return fail('Too many login attempts', 429, 'RATE_LIMIT')

  const { email, password } = await parseBody<{ email: string; password: string }>(req)
  if (!email || !password) return fail('Email and password required', 400, 'VALIDATION_ERROR')

  const result = await loginWithPassword(email, password)
  if (!result) {
    await audit({ action: 'LOGIN_FAILED', details: { email }, ipAddress: getClientIp(req), severity: 'WARN' })
    return fail('Invalid credentials', 401, 'AUTH_ERROR')
  }
  await audit({ userId: result.user.id, action: 'LOGIN', ipAddress: getClientIp(req), details: { email } })
  return ok(result)
})
