/**
 * Audit logging service. Writes structured audit entries to DB and emits metrics.
 */
import { db } from '@/lib/db'

export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

export interface AuditInput {
  userId?: string
  action: string
  entity?: string
  entityId?: string
  ipAddress?: string
  userAgent?: string
  details?: Record<string, unknown>
  severity?: AuditSeverity
}

export async function audit(input: AuditInput) {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        entity: input.entity || null,
        entityId: input.entityId || null,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        details: JSON.stringify(input.details || {}),
        severity: input.severity || 'INFO',
      },
    })
  } catch (e) {
    // audit must never break the request
    console.error('[audit] failed to write log:', e)
  }
}

export async function listAudit(opts: {
  action?: string
  severity?: string
  limit?: number
  offset?: number
} = {}) {
  const { action, severity, limit = 50, offset = 0 } = opts
  const where: Record<string, unknown> = {}
  if (action) where.action = action
  if (severity) where.severity = severity
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { user: { select: { name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ])
  return { rows, total }
}
