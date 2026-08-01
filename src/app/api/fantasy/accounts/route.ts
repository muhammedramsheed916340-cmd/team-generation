import { NextRequest } from 'next/server'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'

/**
 * GET /api/fantasy/accounts
 * Returns accounts passed from frontend localStorage (in body header).
 * On Vercel serverless, we can't store accounts in memory — the frontend
 * manages account storage in localStorage and sends them with each request.
 *
 * POST /api/fantasy/accounts
 * Frontend stores accounts in localStorage and sends them here for validation.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  // Frontend manages accounts in localStorage — return empty (frontend fills from localStorage)
  return ok({ accounts: [] })
})

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const { accounts } = await parseBody<{ accounts: any[] }>(req)
  return ok({ accounts: accounts || [] })
})
