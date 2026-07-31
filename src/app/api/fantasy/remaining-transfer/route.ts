import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { getRemainingTransfers } from '@/lib/fantasy-transfer'

/**
 * POST /api/fantasy/remaining-transfer
 * Body: { accountId }
 * Returns daily quota usage + remaining transfers.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { accountId } = await parseBody<{ accountId: string }>(req)
  const account = await db.fantasyAccount.findFirst({ where: { id: accountId, userId: auth.user.id } })
  if (!account) return fail('Account not found', 404, 'NOT_FOUND')
  const remaining = await getRemainingTransfers(accountId)
  return ok(remaining)
})
