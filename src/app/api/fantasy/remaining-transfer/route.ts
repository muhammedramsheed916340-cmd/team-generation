import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { getRemainingTransfers } from '@/lib/fantasy-transfer'

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { accountId } = await parseBody<{ accountId: string }>(req)
  return ok(getRemainingTransfers(accountId))
})
