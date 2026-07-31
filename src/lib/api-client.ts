/**
 * Frontend API client. Handles auth token storage + typed fetch wrappers.
 * All requests go to relative /api paths (Caddy handles routing).
 */

const TOKEN_KEY = 'tg_access_token'
const REFRESH_KEY = 'tg_refresh_token'
const USER_KEY = 'tg_user'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string, refresh?: string, user?: unknown) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser(): { id: string; email: string; name: string; role: string; credits: number } | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export class ApiError extends Error {
  code?: string
  status: number
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, { ...opts, headers })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok || json.success === false) {
    throw new ApiError(json.error || `Request failed (${res.status})`, res.status, json.code)
  }
  return json.data as T
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
}

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post<{ user: any; accessToken: string; refreshToken: string }>('/api/auth/login', { email, password }),
  me: () => api.get('/api/auth/me'),
}

// Matches
export const matchesApi = {
  list: (status?: string) => api.get<{ matches: any[] }>(`/api/matches${status ? `?status=${status}` : ''}`),
  get: (id: string) => api.get<{ id: string; name: string; shortName: string; team1Short: string; team2Short: string; tossWinner: string | null; tossDecision: string | null; status: string; playingXINamed: boolean } & any>(`/api/matches/${id}`),
  players: (id: string) => api.get<{ players: any[] }>(`/api/matches/${id}/players`),
  playingXI: (id: string) => api.get<{ playingXI: any[] }>(`/api/matches/${id}/playing-xi`),
  announceXI: (id: string) => api.post(`/api/matches/${id}/playing-xi`),
  toss: (id: string) => api.post(`/api/matches/${id}/toss`),
  generate: (id: string, strategy: string, count: number, regenerateOnToss?: boolean) =>
    api.post<{ teams: any[] }>(`/api/matches/${id}/generate`, { strategy, count, regenerateOnToss }),
  getTeams: (id: string, strategy?: string) => api.get<{ teams: any[] }>(`/api/matches/${id}/generate${strategy ? `?strategy=${strategy}` : ''}`),
  predict: (id: string) => api.get<any>(`/api/matches/${id}/predict`),
  simulate: (id: string) => api.post<any>(`/api/matches/${id}/simulate`),
  sync: () => api.post('/api/sync/matches'),
}

// Subscriptions
export const subsApi = {
  plans: () => api.get<{ plans: any[] }>('/api/subscriptions/plans'),
  activate: (planId: string, durationDays?: number) => api.post('/api/subscriptions/activate', { planId, durationDays }),
}

// Admin
export const adminApi = {
  stats: () => api.get<any>('/api/admin/stats'),
  users: () => api.get<{ users: any[] }>('/api/admin/users'),
  jobs: () => api.get<{ jobs: any[] }>('/api/admin/jobs'),
  errors: () => api.get<{ errors: any[]; total: number }>('/api/admin/errors'),
  resolveError: (id: string) => api.post('/api/admin/errors', { id }),
}

// Audit
export const auditApi = {
  list: (action?: string, severity?: string) => api.get<{ logs: any[]; total: number }>(`/api/audit${action || severity ? `?${action ? `action=${action}&` : ''}${severity ? `severity=${severity}` : ''}` : ''}`),
}

// Notifications
export const notifApi = {
  list: () => api.get<{ notifications: any[] }>('/api/notifications'),
}

// Health & Metrics
export const healthApi = {
  health: () => api.get<any>('/api/health'),
  metrics: () => api.get<any>('/api/metrics'),
}

// Licenses
export const licenseApi = {
  list: () => api.get<{ licenses: any[] }>('/api/licenses'),
  activate: (key: string, machineId?: string) => api.post('/api/license/activate', { key, machineId }),
}

// Test runs
export const testApi = {
  list: (suite?: string) => api.get<{ tests: any[]; grouped: any[] }>(`/api/test-runs${suite ? `?suite=${suite}` : ''}`),
  run: (body: { suite: string; name: string; status: string; durationMs?: number; assertions?: number; error?: string }) =>
    api.post('/api/test-runs', body),
}

// Fantasy Transfer
export const fantasyApi = {
  login: (platform: string, mobile: string) => api.post<{ requestId: string; message: string }>('/api/fantasy/login', { platform, mobile }),
  verify: (platform: string, mobile: string, otp: string) => api.post<{ account: any; sessionId: string; expiresAt: string }>('/api/fantasy/verify', { platform, mobile, otp }),
  logout: (accountId: string) => api.post('/api/fantasy/logout', { accountId }),
  accounts: () => api.get<{ accounts: any[] }>('/api/fantasy/accounts'),
  createTeam: (accountId: string, matchName: string, template: any) => api.post<{ transfer: any; result: any }>('/api/fantasy/create-team', { accountId, matchName, template }),
  editTeam: (accountId: string, matchName: string, platformTeamId: string, template: any) => api.post<{ transfer: any; result: any }>('/api/fantasy/edit-team', { accountId, matchName, platformTeamId, template }),
  bulkTransfer: (body: any) => api.post<{ queueId: string; status: string; totalTeams: number }>('/api/fantasy/bulk-transfer', body),
  remainingTransfer: (accountId: string) => api.post<{ dailyLimit: number; usedToday: number; remaining: number; resetsAt: string }>('/api/fantasy/remaining-transfer', { accountId }),
  transferStatus: (id: string, process?: boolean) => api.get<any>(`/api/fantasy/transfer-status/${id}${process ? '?process=true' : ''}`),
  transferHistory: (accountId?: string, status?: string) => api.get<{ transfers: any[]; total: number; successCount: number; failedCount: number }>(`/api/fantasy/transfer-history${accountId || status ? `?${accountId ? `accountId=${accountId}&` : ''}${status ? `status=${status}` : ''}` : ''}`),
  queueList: () => api.get<{ queues: any[] }>('/api/fantasy/queue'),
  queueProcess: (queueId: string) => api.post('/api/fantasy/queue', { queueId }),
  queueRetry: (id: string) => api.post(`/api/fantasy/queue/${id}`),
}

// Seed
export const seedApi = {
  seed: () => api.post('/api/seed'),
}

// Real teamgeneration.in data (proxied + decrypted)
export const realApi = {
  matches: (sport?: string) => api.get<{ source: string; matches: any[]; total: number }>(`/api/real-matches?sport=${sport || 'cricket'}`),
  match: (id: string) => api.get<{ source: string; matchId: string; match: any }>(`/api/real-match/${id}`),
  generate: (matchId: string, strategy: string, count: number) => api.post<{ teams: any[]; match: any; lineupStatus: string }>(`/api/real-generate/${matchId}`, { strategy, count }),
}
