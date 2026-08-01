import { NextRequest } from 'next/server'
import { apiHandler, ok, fail, parseBody } from '@/lib/api'
import { realApi } from '@/lib/api-client'

// This route delegates to the real-generate route which uses real player data
// from teamgeneration.in. Kept for backward compatibility.

export const POST = apiHandler(async (req: NextRequest, { params }) => {
  const matchId = params.id
  const body = await parseBody<{ strategy: string; count: number }>(req)
  const strategy = body.strategy || 'GL'
  const count = Math.min(Math.max(1, body.count || 1), 50)

  // Fetch real match data and generate teams
  const matchRes = await fetch(`http://localhost:3000/api/real-generate/${matchId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy, count }),
  })
  const data = await matchRes.json()
  if (!data.success) return fail(data.error || 'Generation failed', 400)
  return ok(data.data)
})

export const GET = apiHandler(async (req: NextRequest, { params }) => {
  // Return empty — teams are generated on demand, not stored
  return ok({ teams: [] })
})
