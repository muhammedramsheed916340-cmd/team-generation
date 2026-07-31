import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'
import { getUserQueues } from '@/lib/fantasy-transfer'

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  return ok({ queues: getUserQueues(auth.user.id) })
})
