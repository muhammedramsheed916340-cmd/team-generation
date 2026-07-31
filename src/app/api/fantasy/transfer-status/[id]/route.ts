import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'
import { getQueueStatus } from '@/lib/fantasy-transfer'

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const result = getQueueStatus(auth.user.id, params.id)
  if (!result) return fail('Queue not found', 404, 'NOT_FOUND')
  return ok(result)
})
