import { NextRequest } from 'next/server'
import { apiHandler, ok, fail } from '@/lib/api'
import { predictMatch } from '@/lib/prediction'

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  const prediction = await predictMatch(params.id)
  if (!prediction) return fail('Match not found', 404, 'NOT_FOUND')
  return ok(prediction)
})
