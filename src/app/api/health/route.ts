import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { cache } from '@/lib/cache'
import { queueStats } from '@/lib/queue'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async () => {
  const cacheStats = cache.stats_snapshot()
  const queue = await queueStats()
  const dbOk = await db.$queryRaw`SELECT 1 as ok`.catch(() => [{ ok: 0 }])
  const uptime = process.uptime()
  return ok({
    status: 'healthy',
    uptime,
    timestamp: new Date().toISOString(),
    cache: cacheStats,
    queue,
    db: { connected: Array.isArray(dbOk) && dbOk[0]?.ok === 1 },
    memory: process.memoryUsage(),
  })
})
