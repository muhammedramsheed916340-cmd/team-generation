import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  return ok({ tests: [], grouped: [] })
})

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  const body = await parseBody<{ suite: string; name: string; status: string; durationMs?: number; assertions?: number; error?: string }>(req)
  return ok({ test: { ...body, userId: auth?.user.id || null, createdAt: new Date() } }, 201)
})
