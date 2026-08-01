import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { accountsStore } from '@/app/api/fantasy/verify/route'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { accountId } = await parseBody<{ accountId: string }>(req)
  const accounts = accountsStore.get(auth.user.id) || []
  const idx = accounts.findIndex((a) => a.id === accountId)
  if (idx >= 0) {
    accounts[idx].status = 'SESSION_EXPIRED'
    accounts[idx].sessionActive = false
    accountsStore.set(auth.user.id, accounts)
  }
  return ok({ loggedOut: true })
})
