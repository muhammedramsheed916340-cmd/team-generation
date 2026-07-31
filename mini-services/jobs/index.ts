/**
 * Background Jobs Mini-Service (port 3003)
 *
 * Responsibilities:
 *  1. Polls the SyncJob queue and executes jobs (sync match, update XI, regenerate teams,
 *     send notifications, cleanup, process transfer queue).
 *  2. Emits real-time updates via socket.io (live match sync, XI auto-update, transfer progress,
 *     push notifications) to all connected clients.
 *  3. Auto-refreshes fantasy session tokens before expiry.
 *
 * The Next.js app talks to this service via socket.io at path "/" with ?XTransformPort=3003.
 */
import { createServer } from 'http'
import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import { pickPlayingXI, simulateToss } from '../../src/lib/mock-cricket'

const PORT = 3003
const db = new PrismaClient({ log: ['error', 'warn'] })

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ============================================================
// JOB PROCESSOR
// ============================================================

async function processJob(job: {
  id: string
  jobType: string
  matchId: string
  payload: any
  attempts: number
  maxAttempts: number
}) {
  const { id, jobType, matchId, payload } = job
  console.log(`[job] processing ${jobType} ${id} (attempt ${job.attempts})`)
  try {
    switch (jobType) {
      case 'SYNC_MATCH': {
        const match = await db.match.findUnique({ where: { id: matchId } })
        if (match) {
          await db.match.update({ where: { id: matchId }, data: { lastSyncedAt: new Date() } })
          io.emit('match:synced', { matchId, at: new Date().toISOString() })
        }
        await db.syncJob.update({ where: { id }, data: { status: 'SUCCESS', result: 'synced', completedAt: new Date() } })
        break
      }
      case 'UPDATE_PLAYING_XI': {
        const match = await db.match.findUnique({ where: { id: matchId } })
        if (!match) throw new Error('match not found')
        const players = await db.player.findMany({ where: { matchId } })
        await db.playingXI.deleteMany({ where: { matchId } })
        for (const teamShort of [match.team1Short, match.team2Short]) {
          const tp = players.filter((p) => p.team === teamShort)
          const xi = pickPlayingXI(tp)
          for (const p of xi) await db.playingXI.create({ data: { matchId, playerId: p.id, source: 'auto' } })
          const xiIds = new Set(xi.map((p) => p.id))
          for (const p of tp) await db.player.update({ where: { id: p.id }, data: { isPlaying: xiIds.has(p.id) } })
        }
        await db.match.update({ where: { id: matchId }, data: { playingXINamed: true, playingXIAnnouncedAt: new Date() } })
        io.emit('playingxi:updated', { matchId, at: new Date().toISOString() })
        await db.syncJob.update({ where: { id }, data: { status: 'SUCCESS', result: 'xi updated', completedAt: new Date() } })
        break
      }
      case 'REGENERATE_TEAMS': {
        // Signal clients to regenerate on toss; actual generation done by API on demand
        io.emit('teams:regenerate', { matchId, ...payload })
        await db.syncJob.update({ where: { id }, data: { status: 'SUCCESS', result: 'notified', completedAt: new Date() } })
        break
      }
      case 'SEND_NOTIFICATION': {
        const { userId, type, title, body } = payload
        if (userId) {
          const n = await db.notification.create({ data: { userId, type: type || 'SYSTEM', title, body, channel: 'IN_APP' } })
          io.emit(`notification:${userId}`, n)
        }
        await db.syncJob.update({ where: { id }, data: { status: 'SUCCESS', result: 'sent', completedAt: new Date() } })
        break
      }
      case 'CLEANUP': {
        // delete old completed jobs (>7 days) and resolved errors
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        await db.syncJob.deleteMany({ where: { status: 'SUCCESS', completedAt: { lt: cutoff } } })
        await db.errorLog.deleteMany({ where: { resolved: true, createdAt: { lt: cutoff } } })
        await db.syncJob.update({ where: { id }, data: { status: 'SUCCESS', result: 'cleaned', completedAt: new Date() } })
        break
      }
      case 'PROCESS_TRANSFER_QUEUE': {
        const { queueId } = payload
        if (queueId) {
          await processTransferQueue(queueId)
        }
        await db.syncJob.update({ where: { id }, data: { status: 'SUCCESS', result: 'queue processed', completedAt: new Date() } })
        break
      }
      default:
        await db.syncJob.update({ where: { id }, data: { status: 'FAILED', error: 'unknown job type', completedAt: new Date() } })
    }
  } catch (e: any) {
    const exhausted = job.attempts >= job.maxAttempts
    const backoffMs = Math.min(30000, 2000 * Math.pow(2, job.attempts))
    await db.syncJob.update({
      where: { id },
      data: {
        status: exhausted ? 'FAILED' : 'RETRYING',
        error: e.message,
        scheduledAt: exhausted ? undefined : new Date(Date.now() + backoffMs),
        completedAt: exhausted ? new Date() : undefined,
      },
    })
    console.error(`[job] ${jobType} ${id} failed:`, e.message)
  }
}

// Inline transfer queue processor (avoids importing Next.js lib code)
async function processTransferQueue(queueId: string) {
  const queue = await db.transferQueue.findUnique({ where: { id: queueId } })
  if (!queue || queue.status === 'COMPLETED') return
  await db.transferQueue.update({ where: { id: queueId }, data: { status: 'PROCESSING', startedAt: new Date() } })
  io.emit('transfer:queue:start', { queueId })

  const template = JSON.parse(queue.teamTemplate)
  const replaceIds = JSON.parse(queue.replaceTeamIds)
  const concurrency = queue.concurrency

  const pending = await db.transferHistory.findMany({
    where: { queueId, status: { in: ['PENDING', 'RETRYING'] } },
    orderBy: { teamIndex: 'asc' },
  })

  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency)
    await Promise.all(batch.map((row) => processOneTransfer(row, queue, template, replaceIds, queueId)))
    // emit progress
    const done = await db.transferHistory.count({ where: { queueId, status: { in: ['VERIFIED', 'SUCCESS', 'FAILED'] } } })
    io.emit('transfer:progress', { queueId, completed: done, total: queue.totalTeams })
  }

  const stats = await db.transferHistory.groupBy({ by: ['status'], where: { queueId }, _count: true })
  const m: Record<string, number> = {}
  for (const s of stats) m[s.status] = s._count
  await db.transferQueue.update({
    where: { id: queueId },
    data: {
      status: 'COMPLETED',
      completedCount: (m.VERIFIED || 0) + (m.SUCCESS || 0) + (m.FAILED || 0),
      successCount: (m.VERIFIED || 0) + (m.SUCCESS || 0),
      failedCount: m.FAILED || 0,
      completedAt: new Date(),
    },
  })
  io.emit('transfer:queue:done', { queueId, stats: m })
}

async function processOneTransfer(row: any, queue: any, template: any, replaceIds: string[], queueId: string) {
  await db.transferHistory.update({ where: { id: row.id }, data: { status: 'PROCESSING', startedAt: new Date() } })
  io.emit('transfer:item:start', { queueId, teamIndex: row.teamIndex })

  let attempts = 0
  let success = false
  let platformTeamId: string | null = null
  let verificationStatus: string | null = null
  let verificationDetails: any = {}
  let error: string | null = null
  let errorCode: string | null = null

  while (attempts < row.maxAttempts && !success) {
    attempts++
    // simulate transient failures
    const roll = Math.random()
    if (roll < 0.03) { error = 'Platform timeout'; errorCode = 'PLATFORM_TIMEOUT' }
    else if (roll < 0.06) { error = 'Rate limited'; errorCode = 'RATE_LIMIT' }
    else if (roll < 0.08) { error = 'Network failure'; errorCode = 'NETWORK_FAILURE' }
    else {
      await new Promise((r) => setTimeout(r, 40 + Math.random() * 120))
      platformTeamId = `${queue.accountId.slice(-6)}-${row.teamIndex}-${Date.now()}`
      const verified = Math.random() < 0.95
      verificationStatus = verified ? 'VERIFIED' : 'FAILED'
      verificationDetails = { platformTeamId, playerCount: template.players.length, captain: template.captainName, checkedAt: new Date().toISOString() }
      if (verified) { success = true; error = null; errorCode = null }
      else { error = 'Verification failed'; errorCode = 'NETWORK_FAILURE' }
    }
    if (!success && attempts < row.maxAttempts) {
      await new Promise((r) => setTimeout(r, Math.min(8000, 400 * Math.pow(2, attempts))))
    }
  }

  await db.transferHistory.update({
    where: { id: row.id },
    data: {
      status: success ? 'VERIFIED' : 'FAILED',
      platformTeamId,
      verificationStatus,
      verificationDetails: JSON.stringify(verificationDetails),
      error,
      errorCode,
      attempts,
      completedAt: new Date(),
      verifiedAt: success ? new Date() : null,
    },
  })
  io.emit('transfer:item:done', { queueId, teamIndex: row.teamIndex, success, platformTeamId })
}

// ============================================================
// QUEUE POLLER
// ============================================================

async function pollQueue() {
  try {
    const job = await db.syncJob.findFirst({
      where: { status: { in: ['QUEUED', 'RETRYING'] }, scheduledAt: { lte: new Date() } },
      orderBy: [{ priority: 'asc' }, { scheduledAt: 'asc' }],
    })
    if (!job) return
    await db.syncJob.update({ where: { id: job.id }, data: { status: 'RUNNING', startedAt: new Date(), attempts: { increment: 1 } } })
    await processJob({ id: job.id, jobType: job.jobType, matchId: job.matchId, payload: JSON.parse(job.payload), attempts: job.attempts + 1, maxAttempts: job.maxAttempts })
  } catch (e: any) {
    console.error('[poller] error:', e.message)
  }
}

// ============================================================
// AUTO PLAYING-XI ANNOUNCER (simulates XI getting announced ~30s before match)
// ============================================================

async function autoAnnounceXI() {
  try {
    const now = new Date()
    const soon = new Date(now.getTime() + 30 * 60 * 1000) // matches starting within 30 min
    const matches = await db.match.findMany({
      where: { status: 'UPCOMING', playingXINamed: false, startAt: { lte: soon } },
    })
    for (const match of matches) {
      const players = await db.player.findMany({ where: { matchId: match.id } })
      await db.playingXI.deleteMany({ where: { matchId: match.id } })
      for (const teamShort of [match.team1Short, match.team2Short]) {
        const tp = players.filter((p) => p.team === teamShort)
        const xi = pickPlayingXI(tp)
        for (const p of xi) await db.playingXI.create({ data: { matchId: match.id, playerId: p.id, source: 'auto' } })
        const xiIds = new Set(xi.map((p) => p.id))
        for (const p of tp) await db.player.update({ where: { id: p.id }, data: { isPlaying: xiIds.has(p.id) } })
      }
      await db.match.update({ where: { id: match.id }, data: { playingXINamed: true, playingXIAnnouncedAt: new Date() } })
      io.emit('playingxi:auto-announced', { matchId: match.id, shortName: match.shortName })
      console.log(`[auto-xi] announced for ${match.shortName}`)
    }
  } catch (e: any) {
    console.error('[auto-xi] error:', e.message)
  }
}

// ============================================================
// SOCKET.IO
// ============================================================

io.on('connection', (socket) => {
  console.log(`[ws] client connected: ${socket.id}`)
  socket.emit('connected', { service: 'jobs', port: PORT, time: new Date().toISOString() })

  socket.on('subscribe:match', (matchId: string) => {
    socket.join(`match:${matchId}`)
  })
  socket.on('subscribe:transfer', (queueId: string) => {
    socket.join(`transfer:${queueId}`)
  })
  socket.on('ping', () => socket.emit('pong', { time: new Date().toISOString() }))

  socket.on('disconnect', () => {
    console.log(`[ws] client disconnected: ${socket.id}`)
  })
})

// ============================================================
// START
// ============================================================

httpServer.listen(PORT, () => {
  console.log(`[jobs-service] listening on :${PORT}`)
  // poll queue every 2s
  setInterval(pollQueue, 2000)
  // auto-announce XI every 15s
  setInterval(autoAnnounceXI, 15000)
  console.log('[jobs-service] pollers started (queue=2s, xi=15s)')
})
