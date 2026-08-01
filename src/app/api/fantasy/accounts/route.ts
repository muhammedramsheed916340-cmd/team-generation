import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'
import { getAccounts } from '@/lib/fantasy-transfer'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  return ok({ accounts: getAccounts(auth.user.id) })
})
