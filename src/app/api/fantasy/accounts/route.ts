import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'
import { getActiveSession } from '@/lib/fantasy-transfer'

/**
 * GET /api/fantasy/accounts
 * Lists all linked fantasy accounts for the user with session status.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const accounts = await db.fantasyAccount.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { transfers: true, queueItems: true } },
    },
  })
  const enriched = await Promise.all(
    accounts.map(async (a) => {
      const session = await getActiveSession(a.id)
      return {
        ...a,
        sessionActive: !!session && !session.isExpired,
        sessionExpiresAt: session?.expiresAt || null,
      }
    })
  )
  return ok({ accounts: enriched })
})
