import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { authenticate } from '@/lib/auth'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'

export const GET = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  if (!auth) return fail('Unauthorized', 401, 'AUTH_ERROR')
  const url = new URL(req.url)
  const suite = url.searchParams.get('suite') || undefined
  const where = suite ? { suite } : {}
  const tests = await db.testRun.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 })
  const grouped = await db.testRun.groupBy({ by: ['suite', 'status'], _count: true })
  return ok({ tests, grouped })
})

export const POST = apiHandler(async (req: NextRequest) => {
  const auth = await authenticate(req)
  const body = await parseBody<{ suite: string; name: string; status: string; durationMs?: number; assertions?: number; error?: string }>(req)
  const test = await db.testRun.create({
    data: {
      userId: auth?.user.id || null,
      suite: body.suite,
      name: body.name,
      status: body.status,
      durationMs: body.durationMs || 0,
      assertions: body.assertions || 0,
      error: body.error || null,
    },
  })
  return ok(test, 201)
})
