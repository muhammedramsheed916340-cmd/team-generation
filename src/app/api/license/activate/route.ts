import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { key } = await parseBody<{ key: string }>(req)
  if (!key) return fail('key required', 400, 'VALIDATION_ERROR')
  return ok({ license: { key, status: 'ACTIVE', userId: auth.user.id, activatedAt: new Date() } })
})
