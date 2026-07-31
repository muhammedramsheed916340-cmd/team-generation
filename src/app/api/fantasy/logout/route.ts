import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { audit } from '@/lib/audit'

/**
 * POST /api/fantasy/logout
 * Body: { accountId }
 * Revokes active session tokens for the account.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { accountId } = await parseBody<{ accountId: string }>(req)
  const account = await db.fantasyAccount.findFirst({ where: { id: accountId, userId: auth.user.id } })
  if (!account) return fail('Account not found', 404, 'NOT_FOUND')

  await db.sessionToken.updateMany({ where: { accountId, status: 'ACTIVE' }, data: { status: 'REVOKED' } })
  await db.fantasyAccount.update({ where: { id: accountId }, data: { status: 'SESSION_EXPIRED' } })

  await audit({ userId: auth.user.id, action: 'FANTASY_LOGOUT', entity: 'FantasyAccount', entityId: accountId })
  return ok({ loggedOut: true })
})
