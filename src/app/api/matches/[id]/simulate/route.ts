import { NextRequest } from 'next/server'
import { apiHandler, ok, fail } from '@/lib/api'
import { simulateMatch } from '@/lib/match-simulator'
import { audit } from '@/lib/audit'
import { authenticate } from '@/lib/auth'

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const auth = await authenticate(req)
  const result = await simulateMatch(params.id)
  if (!result) return fail('Match not found', 404, 'NOT_FOUND')
  await audit({ userId: auth?.user.id, action: 'MATCH_SIMULATED', entity: 'Match', entityId: params.id, details: { result: result.result } })
  return ok(result)
})
