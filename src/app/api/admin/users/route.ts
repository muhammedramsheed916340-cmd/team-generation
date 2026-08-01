import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  await requireAdmin(req)
  return ok({ users: [] })
})
