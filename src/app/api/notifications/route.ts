import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const notifications = await db.notification.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return ok({ notifications })
})

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { type, title, body } = await req.json()
  const n = await db.notification.create({
    data: { userId: auth.user.id, type: type || 'SYSTEM', title, body, channel: 'IN_APP' },
  })
  return ok(n, 201)
})

export const PATCH = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { id } = await req.json()
  const n = await db.notification.update({ where: { id }, data: { isRead: true, readAt: new Date() } })
  return ok(n)
})
