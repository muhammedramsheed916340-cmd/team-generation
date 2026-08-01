import { NextRequest } from 'next/server'
import { apiHandler, ok } from '@/lib/api'

export const GET = apiHandler(async () => {
  return ok({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db: { connected: false },
    memory: process.memoryUsage(),
  })
})
