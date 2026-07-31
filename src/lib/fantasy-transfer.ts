/**
 * Direct Fantasy Transfer Engine.
 *
 * Simulates transferring generated teams to Dream11 / My11Circle platforms.
 * In production, this would call the real platform APIs; here we use a
 * high-fidelity simulator that mimics OTP login, token refresh, team create,
 * team replace, verification, rate limits, and transient failures.
 *
 * Features:
 *  - OTP login flow (request OTP -> verify OTP -> encrypted session token)
 *  - Auto token refresh before expiry
 *  - Bulk transfer (1-500 teams) with configurable concurrency
 *  - Auto retry with exponential backoff
 *  - Transfer verification (team exists, players, C, VC)
 *  - Detailed per-team logs + queue progress
 *  - Error codes: INVALID_OTP | EXPIRED_SESSION | INVALID_TOKEN | NETWORK_FAILURE
 *    | RATE_LIMIT | PLATFORM_TIMEOUT | DUPLICATE_TRANSFER | QUEUE_FAILURE
 */
import { db } from '@/lib/db'
import { encryptJSON, decryptJSON } from '@/lib/crypto'
import { audit } from '@/lib/audit'
import { trackError } from '@/lib/errors'
import { enqueue } from '@/lib/queue'

export type Platform = 'DREAM11' | 'MY11CIRCLE'
export type TransferMode = 'CREATE' | 'REPLACE' | 'REPLACE_SPECIFIC' | 'AUTO_REPLACE'
export type TransferStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'VERIFIED' | 'RETRYING'
export type ErrorCode =
  | 'INVALID_OTP'
  | 'EXPIRED_SESSION'
  | 'INVALID_TOKEN'
  | 'NETWORK_FAILURE'
  | 'RATE_LIMIT'
  | 'PLATFORM_TIMEOUT'
  | 'DUPLICATE_TRANSFER'
  | 'QUEUE_FAILURE'

// ============================================================
// OTP LOGIN SIMULATION
// ============================================================

// In-memory OTP store: mobile -> { otp, expiresAt, attempts }
const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number; platform: string }>()

export function requestOtp(platform: Platform, mobile: string): { requestId: string } {
  // Generates an OTP and stores it for verification.
  // In production, this would call the real platform's OTP API (Dream11/My11Circle)
  // to send an actual SMS to the user's phone.
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const requestId = `otp-${platform}-${mobile}-${Date.now()}`
  otpStore.set(`${platform}:${mobile}`, { otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0, platform })
  return { requestId }
}

export interface VerifyOtpResult {
  success: boolean
  errorCode?: ErrorCode
  account?: { platformUserId: string; displayName: string; avatarUrl?: string }
  session?: { accessToken: string; refreshToken: string; expiresAt: Date; refreshExpiresAt: Date }
}

export function verifyOtp(platform: Platform, mobile: string, otp: string): VerifyOtpResult {
  const entry = otpStore.get(`${platform}:${mobile}`)
  if (!entry) {
    return { success: false, errorCode: 'INVALID_OTP' }
  }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(`${platform}:${mobile}`)
    return { success: false, errorCode: 'INVALID_OTP' }
  }
  entry.attempts++
  if (entry.attempts > 5) {
    otpStore.delete(`${platform}:${mobile}`)
    return { success: false, errorCode: 'RATE_LIMIT' }
  }
  if (entry.otp !== otp) {
    return { success: false, errorCode: 'INVALID_OTP' }
  }
  otpStore.delete(`${platform}:${mobile}`)
  // success — mint a mock platform session
  const platformUserId = `${platform.slice(0, 3)}-${mobile.slice(-4)}-${Math.random().toString(36).slice(2, 8)}`
  const displayName = `${platform} User ${mobile.slice(-4)}`
  return {
    success: true,
    account: { platformUserId, displayName },
    session: {
      accessToken: `acc-${platformUserId}-${Date.now()}`,
      refreshToken: `ref-${platformUserId}-${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  }
}

// ============================================================
// SESSION TOKEN MANAGEMENT (encrypted persistence)
// ============================================================

export async function saveSession(opts: {
  userId: string
  accountId: string
  platform: Platform
  session: { accessToken: string; refreshToken: string; expiresAt: Date; refreshExpiresAt: Date }
}): Promise<string> {
  const { encryptedToken, tokenIv } = encryptJSON(opts.session)
  // revoke previous active tokens for this account
  await db.sessionToken.updateMany({
    where: { accountId: opts.accountId, status: 'ACTIVE' },
    data: { status: 'REVOKED' },
  })
  const token = await db.sessionToken.create({
    data: {
      userId: opts.userId,
      accountId: opts.accountId,
      platform: opts.platform,
      encryptedToken,
      tokenIv,
      expiresAt: opts.session.expiresAt,
      refreshExpiresAt: opts.session.refreshExpiresAt,
      status: 'ACTIVE',
      lastRefreshedAt: new Date(),
    },
  })
  return token.id
}

export async function getActiveSession(accountId: string) {
  const token = await db.sessionToken.findFirst({
    where: { accountId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })
  if (!token) return null
  const session = decryptJSON(token.encryptedToken, token.tokenIv) as {
    accessToken: string
    refreshToken: string
    expiresAt: string
    refreshExpiresAt: string
  }
  return {
    tokenId: token.id,
    session,
    expiresAt: token.expiresAt,
    refreshExpiresAt: token.refreshExpiresAt,
    isExpired: token.expiresAt < new Date(),
  }
}

/** Auto-refresh token if expired (simulated) */
export async function ensureFreshSession(accountId: string) {
  const active = await getActiveSession(accountId)
  if (!active) {
    throw new TransferError('No active session', 'EXPIRED_SESSION')
  }
  if (active.refreshExpiresAt < new Date()) {
    await db.sessionToken.update({ where: { id: active.tokenId }, data: { status: 'EXPIRED' } })
    await db.fantasyAccount.update({ where: { id: accountId }, data: { status: 'SESSION_EXPIRED' } })
    throw new TransferError('Refresh token expired; re-login required', 'EXPIRED_SESSION')
  }
  if (active.isExpired) {
    // simulate refresh
    const refreshed = {
      accessToken: `acc-refreshed-${Date.now()}`,
      refreshToken: active.session.refreshToken,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      refreshExpiresAt: active.refreshExpiresAt.toISOString(),
    }
    const { encryptedToken, tokenIv } = encryptJSON(refreshed)
    await db.sessionToken.update({
      where: { id: active.tokenId },
      data: {
        encryptedToken,
        tokenIv,
        expiresAt: new Date(refreshed.expiresAt),
        lastRefreshedAt: new Date(),
      },
    })
    return { ...refreshed, tokenId: active.tokenId }
  }
  return active.session
}

export class TransferError extends Error {
  code: ErrorCode
  constructor(message: string, code: ErrorCode) {
    super(message)
    this.code = code
    this.name = 'TransferError'
  }
}

// ============================================================
// SINGLE TEAM TRANSFER (create / replace)
// ============================================================

export interface TeamTemplate {
  players: { externalId: string; name: string; role: string }[]
  captainExternalId: string
  viceCaptainExternalId: string
  captainName: string
  viceCaptainName: string
}

export interface TransferOneResult {
  success: boolean
  status: TransferStatus
  platformTeamId?: string
  error?: string
  errorCode?: ErrorCode
  verificationStatus?: 'VERIFIED' | 'FAILED'
  verificationDetails?: Record<string, unknown>
}

/**
 * Transfer a single team to the platform (simulated with realistic failure modes).
 */
export async function transferOneTeam(opts: {
  accountId: string
  platform: Platform
  mode: TransferMode
  template: TeamTemplate
  replaceTeamId?: string
  teamIndex: number
}): Promise<TransferOneResult> {
  // 1. ensure session fresh
  let session
  try {
    session = await ensureFreshSession(opts.accountId)
  } catch (e) {
    const err = e as TransferError
    return { success: false, status: 'FAILED', error: err.message, errorCode: err.code }
  }

  // 2. simulate transient platform failures (~8% chance)
  const roll = Math.random()
  if (roll < 0.03) {
    return { success: false, status: 'FAILED', error: 'Platform timeout', errorCode: 'PLATFORM_TIMEOUT' }
  }
  if (roll < 0.06) {
    return { success: false, status: 'FAILED', error: 'Rate limited by platform', errorCode: 'RATE_LIMIT' }
  }
  if (roll < 0.08) {
    return { success: false, status: 'FAILED', error: 'Network failure', errorCode: 'NETWORK_FAILURE' }
  }

  // 3. simulate the platform creating / replacing the team
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 150)) // latency

  const platformTeamId = opts.mode === 'REPLACE' || opts.mode === 'REPLACE_SPECIFIC'
    ? opts.replaceTeamId || `tpl-${opts.accountId.slice(-6)}-${Date.now()}`
    : `tpl-${opts.accountId.slice(-6)}-${opts.teamIndex}-${Date.now()}`

  // 4. verify the team landed correctly
  const verification = await verifyTeamOnPlatform(opts.accountId, platformTeamId, opts.template)

  return {
    success: verification.verified,
    status: verification.verified ? 'VERIFIED' : 'FAILED',
    platformTeamId,
    verificationStatus: verification.verified ? 'VERIFIED' : 'FAILED',
    verificationDetails: verification.details,
    error: verification.verified ? undefined : 'Verification failed',
    errorCode: verification.verified ? undefined : 'NETWORK_FAILURE',
  }
}

/**
 * Verify a transferred team exists on the platform with correct players + C + VC.
 */
export async function verifyTeamOnPlatform(
  accountId: string,
  platformTeamId: string,
  template: TeamTemplate
): Promise<{ verified: boolean; details: Record<string, unknown> }> {
  // simulate a verification API call
  await new Promise((r) => setTimeout(r, 30 + Math.random() * 80))

  // 95% verification success (simulates occasional platform lag)
  const verified = Math.random() < 0.95
  return {
    verified,
    details: {
      platformTeamId,
      playerCount: template.players.length,
      captain: template.captainName,
      viceCaptain: template.viceCaptainName,
      checkedAt: new Date().toISOString(),
      accountId,
    },
  }
}

// ============================================================
// BULK TRANSFER PROCESSOR (queue + concurrency + retry + backoff)
// ============================================================

export interface BulkTransferInput {
  userId: string
  accountId: string
  matchId?: string
  matchName: string
  platform: Platform
  mode: TransferMode
  totalTeams: number
  concurrency?: number
  maxRetries?: number
  replaceTeamIds?: string[]
  template: TeamTemplate
}

/**
 * Enqueue a bulk transfer job. Returns the queue id.
 * The actual processing happens in `processQueue` (called by the API
 * synchronously for small batches, or by the background worker for large ones).
 */
export async function enqueueBulkTransfer(input: BulkTransferInput): Promise<string> {
  if (input.totalTeams < 1 || input.totalTeams > 500) {
    throw new TransferError('totalTeams must be between 1 and 500', 'QUEUE_FAILURE')
  }
  const queue = await db.transferQueue.create({
    data: {
      userId: input.userId,
      accountId: input.accountId,
      matchId: input.matchId || null,
      matchName: input.matchName,
      platform: input.platform,
      mode: input.mode,
      totalTeams: input.totalTeams,
      concurrency: input.concurrency ?? 5,
      maxRetries: input.maxRetries ?? 3,
      replaceTeamIds: JSON.stringify(input.replaceTeamIds || []),
      teamTemplate: JSON.stringify(input.template),
      status: 'QUEUED',
      priority: 5,
    },
  })

  // create placeholder transfer history rows (PENDING)
  const historyRows = []
  for (let i = 0; i < input.totalTeams; i++) {
    historyRows.push({
      userId: input.userId,
      accountId: input.accountId,
      queueId: queue.id,
      matchId: input.matchId || null,
      matchName: input.matchName,
      platform: input.platform,
      mode: input.mode,
      status: 'PENDING' as TransferStatus,
      teamIndex: i,
      captainName: input.template.captainName,
      viceCaptainName: input.template.viceCaptainName,
      playerCount: input.template.players.length,
      maxAttempts: input.maxRetries ?? 3,
    })
  }
  // bulk insert in chunks to avoid SQLite param limits
  const CHUNK = 100
  for (let i = 0; i < historyRows.length; i += CHUNK) {
    await db.transferHistory.createMany({ data: historyRows.slice(i, i + CHUNK) })
  }

  // enqueue background job
  await enqueue({
    jobType: 'PROCESS_TRANSFER_QUEUE',
    priority: 3,
    payload: { queueId: queue.id },
    maxAttempts: 1,
  })

  await audit({
    userId: input.userId,
    action: 'FANTASY_BULK_TRANSFER_QUEUED',
    entity: 'TransferQueue',
    entityId: queue.id,
    details: { platform: input.platform, mode: input.mode, totalTeams: input.totalTeams, matchName: input.matchName },
  })

  return queue.id
}

/**
 * Process a transfer queue: run teams in parallel batches with retry + backoff.
 * Designed to be called both from the API (for live progress) and the background worker.
 */
export async function processTransferQueue(queueId: string): Promise<void> {
  const queue = await db.transferQueue.findUnique({ where: { id: queueId } })
  if (!queue) return
  if (queue.status === 'COMPLETED' || queue.status === 'PROCESSING') return

  await db.transferQueue.update({ where: { id: queueId }, data: { status: 'PROCESSING', startedAt: new Date() } })

  const template = JSON.parse(queue.teamTemplate) as TeamTemplate
  const replaceIds = JSON.parse(queue.replaceTeamIds) as string[]
  const concurrency = queue.concurrency

  // fetch pending / failed-retryable history rows
  const pending = await db.transferHistory.findMany({
    where: { queueId, status: { in: ['PENDING', 'RETRYING'] } },
    orderBy: { teamIndex: 'asc' },
  })

  // process in batches of `concurrency`
  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency)
    await Promise.all(batch.map((row) => processOneHistoryRow(row, queue, template, replaceIds)))
  }

  // finalize queue
  const finalStats = await db.transferHistory.groupBy({
    by: ['status'],
    where: { queueId },
    _count: true,
  })
  const stats: Record<string, number> = {}
  for (const s of finalStats) stats[s.status] = s._count
  const allDone = (stats.PENDING || 0) === 0 && (stats.RETRYING || 0) === 0
  const successCount = stats.VERIFIED || stats.SUCCESS || 0
  const failedCount = stats.FAILED || 0
  const completedCount = successCount + failedCount

  await db.transferQueue.update({
    where: { id: queueId },
    data: {
      status: allDone ? 'COMPLETED' : 'PROCESSING',
      completedCount,
      successCount,
      failedCount,
      completedAt: allDone ? new Date() : null,
    },
  })
}

async function processOneHistoryRow(
  row: { id: string; teamIndex: number; attempts: number; maxAttempts: number },
  queue: { id: string; accountId: string; platform: string; mode: string },
  template: TeamTemplate,
  replaceIds: string[]
) {
  await db.transferHistory.update({ where: { id: row.id }, data: { status: 'PROCESSING', startedAt: new Date() } })

  const mode = queue.mode as TransferMode
  const replaceTeamId =
    mode === 'REPLACE_SPECIFIC' ? replaceIds[row.teamIndex % replaceIds.length] : mode === 'REPLACE' ? replaceIds[0] : undefined

  const result = await transferOneTeamWithRetry({
    accountId: queue.accountId,
    platform: queue.platform as Platform,
    mode,
    template,
    replaceTeamId,
    teamIndex: row.teamIndex,
    maxAttempts: row.maxAttempts,
  })

  await db.transferHistory.update({
    where: { id: row.id },
    data: {
      status: result.status,
      platformTeamId: result.platformTeamId || null,
      verificationStatus: result.verificationStatus || null,
      verificationDetails: JSON.stringify(result.verificationDetails || {}),
      error: result.error || null,
      errorCode: result.errorCode || null,
      attempts: result.attempts,
      completedAt: new Date(),
      verifiedAt: result.verificationStatus === 'VERIFIED' ? new Date() : null,
    },
  })
}

async function transferOneTeamWithRetry(opts: {
  accountId: string
  platform: Platform
  mode: TransferMode
  template: TeamTemplate
  replaceTeamId?: string
  teamIndex: number
  maxAttempts: number
}): Promise<TransferOneResult & { attempts: number }> {
  let attempts = 0
  let lastResult: TransferOneResult | null = null
  while (attempts < opts.maxAttempts) {
    attempts++
    const result = await transferOneTeam({
      accountId: opts.accountId,
      platform: opts.platform,
      mode: opts.mode,
      template: opts.template,
      replaceTeamId: opts.replaceTeamId,
      teamIndex: opts.teamIndex,
    })
    lastResult = result
    if (result.success) {
      return { ...result, attempts }
    }
    // exponential backoff before retry
    const backoffMs = Math.min(10000, 500 * Math.pow(2, attempts))
    await new Promise((r) => setTimeout(r, backoffMs))
  }
  return { ...(lastResult as TransferOneResult), attempts }
}

// ============================================================
// REMAINING TRANSFERS (per-day quota per platform account)
// ============================================================

const PLATFORM_DAILY_LIMIT: Record<Platform, number> = {
  DREAM11: 500,
  MY11CIRCLE: 500,
}

export async function getRemainingTransfers(accountId: string): Promise<{
  platform: string
  dailyLimit: number
  usedToday: number
  remaining: number
  resetsAt: Date
}> {
  const account = await db.fantasyAccount.findUnique({ where: { id: accountId } })
  if (!account) throw new TransferError('Account not found', 'INVALID_TOKEN')

  const platform = account.platform as Platform
  const limit = PLATFORM_DAILY_LIMIT[platform] || 500
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const usedToday = await db.transferHistory.count({
    where: {
      accountId,
      createdAt: { gte: startOfDay },
      status: { in: ['VERIFIED', 'SUCCESS'] },
    },
  })
  const remaining = Math.max(0, limit - usedToday)
  const resetsAt = new Date()
  resetsAt.setDate(resetsAt.getDate() + 1)
  resetsAt.setHours(0, 0, 0, 0)
  return { platform, dailyLimit: limit, usedToday, remaining, resetsAt }
}
