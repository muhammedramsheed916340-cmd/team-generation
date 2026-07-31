/**
 * Error tracking service. Persists errors to DB for the monitoring dashboard.
 */
import { db } from '@/lib/db'

export interface ErrorInput {
  level?: 'ERROR' | 'WARN' | 'FATAL'
  source?: string
  message: string
  stack?: string
  context?: Record<string, unknown>
  path?: string
  method?: string
  statusCode?: number
  userId?: string
}

export async function trackError(input: ErrorInput) {
  try {
    await db.errorLog.create({
      data: {
        level: input.level || 'ERROR',
        source: input.source || 'api',
        message: input.message,
        stack: input.stack || null,
        context: JSON.stringify(input.context || {}),
        path: input.path || null,
        method: input.method || null,
        statusCode: input.statusCode || null,
        userId: input.userId || null,
      },
    })
  } catch (e) {
    console.error('[trackError] failed:', e)
  }
}

export async function resolveError(id: string) {
  await db.errorLog.update({ where: { id }, data: { resolved: true } })
}

export async function listErrors(opts: {
  level?: string
  resolved?: boolean
  limit?: number
  offset?: number
} = {}) {
  const { level, resolved, limit = 50, offset = 0 } = opts
  const where: Record<string, unknown> = {}
  if (level) where.level = level
  if (resolved !== undefined) where.resolved = resolved
  const [rows, total] = await Promise.all([
    db.errorLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    db.errorLog.count({ where }),
  ])
  return { rows, total }
}
