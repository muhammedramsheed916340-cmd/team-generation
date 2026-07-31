import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const licenses = await db.license.findMany({
    where: { OR: [{ userId: auth.user.id }, { status: 'UNUSED' }] },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  })
  return ok({ licenses })
})
