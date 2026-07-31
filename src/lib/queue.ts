/**
 * In-process job queue with priority, retries, and exponential backoff.
 * Backed by the SyncJob table for persistence + an in-memory runner.
 * The background-jobs mini-service also polls the same table.
 */
import { db } from '@/lib/db'

export type JobType =
  | 'SYNC_MATCH'
  | 'UPDATE_PLAYING_XI'
  | 'REGENERATE_TEAMS'
  | 'SEND_NOTIFICATION'
  | 'CLEANUP'
  | 'PROCESS_TRANSFER_QUEUE'

export interface EnqueueOpts {
  matchId?: string
  jobType: JobType
  priority?: number
  payload?: Record<string, unknown>
  maxAttempts?: number
  runAt?: Date
}

export async function enqueue(opts: EnqueueOpts): Promise<string> {
  const job = await db.syncJob.create({
    data: {
      matchId: opts.matchId || 'SYSTEM',
      jobType: opts.jobType,
      priority: opts.priority ?? 5,
      payload: JSON.stringify(opts.payload || {}),
      maxAttempts: opts.maxAttempts ?? 3,
      scheduledAt: opts.runAt ?? new Date(),
      status: 'QUEUED',
    },
  })
  return job.id
}

export async function claimNextJob(): Promise<{
  id: string
  jobType: string
  matchId: string
  payload: Record<string, unknown>
  attempts: number
  maxAttempts: number
} | null> {
  // Atomic-ish claim: find oldest QUEUED, mark RUNNING
  const job = await db.syncJob.findFirst({
    where: { status: { in: ['QUEUED', 'RETRYING'] }, scheduledAt: { lte: new Date() } },
    orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
  })
  if (!job) return null
  await db.syncJob.update({
    where: { id: job.id },
    data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } },
  })
  return {
    id: job.id,
    jobType: job.jobType,
    matchId: job.matchId,
    payload: JSON.parse(job.payload),
    attempts: job.attempts + 1,
    maxAttempts: job.maxAttempts,
  }
}

export async function completeJob(id: string, result?: string) {
  await db.syncJob.update({
    where: { id },
    data: { status: 'SUCCESS', result: result || 'ok', completedAt: new Date() },
  })
}

export async function failJob(id: string, error: string, retryable = true) {
  const job = await db.syncJob.findUnique({ where: { id } })
  if (!job) return
  const exhausted = job.attempts >= job.maxAttempts
  const backoffMs = Math.min(30000, 2000 * Math.pow(2, job.attempts))
  await db.syncJob.update({
    where: { id },
    data: {
      status: retryable && !exhausted ? 'RETRYING' : 'FAILED',
      error,
      scheduledAt: retryable && !exhausted ? new Date(Date.now() + backoffMs) : job.scheduledAt,
      completedAt: exhausted ? new Date() : null,
    },
  })
}

export async function queueStats() {
  const grouped = await db.syncJob.groupBy({ by: ['status'], _count: true })
  const map: Record<string, number> = {}
  for (const g of grouped) map[g.status] = g._count
  return map
}
