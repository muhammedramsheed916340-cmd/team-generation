import { NextRequest } from 'next/server'
import { listAudit } from '@/lib/audit'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || undefined
  const severity = url.searchParams.get('severity') || undefined
  const { rows, total } = await listAudit({ action, severity, limit: 100 })
  return ok({ logs: rows, total })
})
