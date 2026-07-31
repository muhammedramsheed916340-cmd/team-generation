/**
 * In-memory Fantasy Transfer Engine.
 * No database — all data stored in memory (works on Vercel).
 * OTP login, bulk transfer, verification, queue processing.
 */
import { encryptJSON, decryptJSON } from '@/lib/crypto'

export type Platform = 'DREAM11' | 'MY11CIRCLE'
export type TransferMode = 'CREATE' | 'REPLACE' | 'REPLACE_SPECIFIC' | 'AUTO_REPLACE'
export type TransferStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'VERIFIED' | 'RETRYING'
export type ErrorCode = 'INVALID_OTP' | 'EXPIRED_SESSION' | 'INVALID_TOKEN' | 'NETWORK_FAILURE' | 'RATE_LIMIT' | 'PLATFORM_TIMEOUT' | 'DUPLICATE_TRANSFER' | 'QUEUE_FAILURE'

// In-memory stores
const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>()
const accountsStore = new Map<string, any[]>() // userId -> accounts[]
const sessionsStore = new Map<string, any>() // accountId -> session
const queuesStore = new Map<string, any>() // queueId -> queue
const historyStore = new Map<string, any[]>() // userId -> history[]

export class TransferError extends Error {
  code: ErrorCode
  constructor(message: string, code: ErrorCode) {
    super(message); this.code = code; this.name = 'TransferError'
  }
}

// ============================================================
// OTP LOGIN
// ============================================================

export function requestOtp(platform: Platform, mobile: string): { requestId: string; otp: string } {
  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const requestId = `otp-${platform}-${mobile}-${Date.now()}`
  otpStore.set(`${platform}:${mobile}`, { otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 })
  return { requestId, otp }
}

export interface VerifyOtpResult {
  success: boolean
  errorCode?: ErrorCode
  account?: { id: string; platformUserId: string; displayName: string }
  session?: { accessToken: string; refreshToken: string; expiresAt: Date }
}

export function verifyOtp(platform: Platform, mobile: string, otp: string, userId: string): VerifyOtpResult {
  const entry = otpStore.get(`${platform}:${mobile}`)
  if (!entry) return { success: false, errorCode: 'INVALID_OTP' }
  if (Date.now() > entry.expiresAt) { otpStore.delete(`${platform}:${mobile}`); return { success: false, errorCode: 'INVALID_OTP' } }
  entry.attempts++
  if (entry.attempts > 5) { otpStore.delete(`${platform}:${mobile}`); return { success: false, errorCode: 'RATE_LIMIT' } }
  if (entry.otp !== otp) return { success: false, errorCode: 'INVALID_OTP' }
  otpStore.delete(`${platform}:${mobile}`)

  const platformUserId = `${platform.slice(0, 3)}-${mobile.slice(-4)}-${Math.random().toString(36).slice(2, 8)}`
  const accountId = `acc-${platformUserId}`
  const displayName = `${platform} User ${mobile.slice(-4)}`

  // Save account in memory
  const userAccounts = accountsStore.get(userId) || []
  userAccounts.push({
    id: accountId, userId, platform, mobile, displayName, platformUserId,
    status: 'ACTIVE', isActive: true, lastVerifiedAt: new Date(),
    createdAt: new Date(), _count: { transfers: 0, queueItems: 0 },
  })
  accountsStore.set(userId, userAccounts)

  // Save session
  const session = { accessToken: `acc-${platformUserId}-${Date.now()}`, refreshToken: `ref-${platformUserId}-${Date.now()}`, expiresAt: new Date(Date.now() + 30 * 60 * 1000) }
  sessionsStore.set(accountId, { session, expiresAt: session.expiresAt, isExpired: false })

  return { success: true, account: { id: accountId, platformUserId, displayName }, session }
}

// ============================================================
// ACCOUNTS
// ============================================================

export function getAccounts(userId: string) {
  const accounts = accountsStore.get(userId) || []
  return accounts.map((a) => {
    const session = sessionsStore.get(a.id)
    return { ...a, sessionActive: !!session && !session.isExpired && session.expiresAt > new Date(), sessionExpiresAt: session?.expiresAt || null }
  })
}

export function logoutAccount(userId: string, accountId: string) {
  sessionsStore.delete(accountId)
  const accounts = accountsStore.get(userId) || []
  const idx = accounts.findIndex((a) => a.id === accountId)
  if (idx >= 0) { accounts[idx].status = 'SESSION_EXPIRED'; accountsStore.set(userId, accounts) }
}

// ============================================================
// BULK TRANSFER
// ============================================================

export interface TeamTemplate {
  players: { externalId: string; name: string; role: string }[]
  captainExternalId: string
  viceCaptainExternalId: string
  captainName: string
  viceCaptainName: string
}

export interface BulkTransferInput {
  userId: string
  accountId: string
  matchName: string
  platform: Platform
  mode: TransferMode
  totalTeams: number
  concurrency?: number
  maxRetries?: number
  template: TeamTemplate
}

export function enqueueBulkTransfer(input: BulkTransferInput): string {
  if (input.totalTeams < 1 || input.totalTeams > 500) throw new TransferError('totalTeams must be 1-500', 'QUEUE_FAILURE')
  const queueId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const queue = {
    id: queueId, ...input, status: 'QUEUED', completedCount: 0, successCount: 0, failedCount: 0,
    createdAt: new Date(), startedAt: null, completedAt: null,
  }
  queuesStore.set(queueId, queue)

  // Create history entries
  const history = historyStore.get(input.userId) || []
  for (let i = 0; i < input.totalTeams; i++) {
    history.unshift({
      id: `t-${queueId}-${i}`, userId: input.userId, accountId: input.accountId, queueId,
      matchName: input.matchName, platform: input.platform, mode: input.mode,
      status: 'PENDING', teamIndex: i, captainName: input.template.captainName,
      viceCaptainName: input.template.viceCaptainName, playerCount: input.template.players.length,
      attempts: 0, maxAttempts: input.maxRetries || 3, createdAt: new Date(),
    })
  }
  historyStore.set(input.userId, history)

  return queueId
}

export function processTransferQueue(queueId: string) {
  const queue = queuesStore.get(queueId)
  if (!queue || queue.status === 'COMPLETED') return
  queue.status = 'PROCESSING'
  queue.startedAt = new Date()

  // Process in memory (synchronous for demo)
  const history = historyStore.get(queue.userId) || []
  const queueItems = history.filter((h) => h.queueId === queueId)

  for (const item of queueItems) {
    item.status = 'PROCESSING'
    item.startedAt = new Date()
    item.attempts = 1

    // Simulate transfer (95% success)
    const success = Math.random() < 0.95
    if (success) {
      item.status = 'VERIFIED'
      item.platformTeamId = `tpl-${queue.accountId.slice(-6)}-${item.teamIndex}-${Date.now()}`
      item.verificationStatus = 'VERIFIED'
      item.verificationDetails = JSON.stringify({ platformTeamId: item.platformTeamId, playerCount: item.playerCount, captain: item.captainName })
      item.completedAt = new Date()
      item.verifiedAt = new Date()
      queue.successCount++
    } else {
      item.status = 'FAILED'
      item.error = 'Transfer failed'
      item.errorCode = 'NETWORK_FAILURE'
      item.completedAt = new Date()
      queue.failedCount++
    }
    queue.completedCount++
  }

  queue.status = 'COMPLETED'
  queue.completedAt = new Date()
  historyStore.set(queue.userId, history)
}

export function getQueueStatus(userId: string, queueId: string) {
  const queue = queuesStore.get(queueId)
  if (!queue) return null
  const history = historyStore.get(userId) || []
  const items = history.filter((h) => h.queueId === queueId).slice(0, 50)
  return { queue, recent: items, progress: queue.totalTeams > 0 ? Math.round((queue.completedCount / queue.totalTeams) * 100) : 0 }
}

export function getUserQueues(userId: string) {
  const all = []
  for (const [id, q] of queuesStore) {
    if (q.userId === userId) all.push({ ...q, account: { platform: q.platform, mobile: '', displayName: q.matchName } })
  }
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export function getTransferHistory(userId: string) {
  const history = historyStore.get(userId) || []
  const successCount = history.filter((h) => h.status === 'VERIFIED' || h.status === 'SUCCESS').length
  const failedCount = history.filter((h) => h.status === 'FAILED').length
  return { transfers: history.slice(0, 100), total: history.length, successCount, failedCount }
}

export function getRemainingTransfers(accountId: string) {
  return { platform: 'DREAM11', dailyLimit: 500, usedToday: 0, remaining: 500, resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
}
