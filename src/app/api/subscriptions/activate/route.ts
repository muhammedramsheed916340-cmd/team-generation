import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { planId } = await parseBody<{ planId: string }>(req)
  if (!planId) return fail('planId required', 400, 'VALIDATION_ERROR')
  return ok({ subscription: { userId: auth.user.id, planId, status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } })
})
