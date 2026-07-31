import { NextRequest } from 'next/server'
import { listErrors, resolveError } from '@/lib/errors'
import { requireAdmin } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  const url = new URL(req.url)
  const level = url.searchParams.get('level') || undefined
  const resolved = url.searchParams.get('resolved')
  const { rows, total } = await listErrors({
    level: level || undefined,
    resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
    limit: 100,
  })
  return ok({ errors: rows, total })
})

export const POST = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  const { id } = await req.json().catch(() => ({}))
  if (!id) return fail('id required', 400, 'VALIDATION_ERROR')
  await resolveError(id)
  return ok({ resolved: true })
})
