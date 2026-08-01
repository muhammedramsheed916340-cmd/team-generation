import { NextRequest } from 'next/server'
import { apiHandler, ok } from '@/lib/api'
import { cache } from '@/lib/cache'

/** Re-fetch matches from teamgeneration.in (clears cache) */
export const POST = apiHandler(async () => {
  cache.clear()
  return ok({ synced: true, message: 'Cache cleared — matches will re-fetch from teamgeneration.in' })
})
