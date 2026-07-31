import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache } from '@/lib/cache'
import { apiHandler, ok } from '@/lib/api'
import { isDatabaseAvailable } from '@/lib/fallback-data'

export const GET = apiHandler(async () => {
  const cacheStats = cache.stats_snapshot()
  let queue: Record<string, number> = {}
  let dbOk = false

  if (isDatabaseAvailable()) {
    try {
      const grouped = await db.syncJob.groupBy({ by: ['status'], _count: true })
      for (const g of grouped) queue[g.status] = g._count
      dbOk = true
    } catch { dbOk = false }
  }

  return ok({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cache: cacheStats,
    queue,
    db: { connected: dbOk },
    memory: process.memoryUsage(),
    serverless: !isDatabaseAvailable(),
  })
})
