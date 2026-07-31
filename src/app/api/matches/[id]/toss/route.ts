import { NextRequest } from 'next/server'
import { apiHandler, ok, fail } from '@/lib/api'

/**
 * Toss is managed by teamgeneration.in backend.
 * We can't simulate it — it comes from the real API.
 */
export const POST = apiHandler(async (req: NextRequest, { params }) => {
  return fail('Toss is managed by teamgeneration.in. It updates automatically when announced.', 400, 'AUTO_MANAGED')
})
