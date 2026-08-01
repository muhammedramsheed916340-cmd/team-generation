import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'

// Import the shared accounts store from verify route
import { accountsStore } from '@/app/api/fantasy/verify/route'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const accounts = accountsStore.get(auth.user.id) || []
  return ok({ accounts })
})
