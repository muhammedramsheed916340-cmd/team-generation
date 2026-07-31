import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  return ok({ errors: [], total: 0 })
})

export const POST = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  const { id } = await req.json().catch(() => ({}))
  if (!id) return fail('id required', 400, 'VALIDATION_ERROR')
  return ok({ resolved: true })
})
