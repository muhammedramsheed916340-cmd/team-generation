import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  return ok({ notifications: [] })
})

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { type, title, body } = await req.json()
  return ok({ id: `n-${Date.now()}`, userId: auth.user.id, type: type || 'SYSTEM', title, body, isRead: false, createdAt: new Date() }, 201)
})

export const PATCH = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  return ok({ updated: true })
})
