import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'
import { getUserQueues } from '@/lib/fantasy-transfer'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  return ok({ queues: getUserQueues(auth.user.id) })
})

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  return fail('Queue already processed automatically', 400, 'AUTO_PROCESSED')
})
