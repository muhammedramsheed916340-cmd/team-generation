/**
 * Direct client-side API to tgsoftware-api.online.
 *
 * WHY: The real teamgeneration.in calls the backend DIRECTLY from the browser
 * (client-side axios). The Next.js API routes were calling it server-side,
 * which caused "Error while transfering the team!" (HTTP 404) on addteam.
 *
 * By calling the backend from the browser (same as teamgeneration.in),
 * transfers work correctly. The backend has permissive CORS
 * (Access-Control-Allow-Origin: *) so browser calls work from any origin.
 *
 * All methods return the raw JSON response from the backend.
 */

const BACKEND = 'https://tgsoftware-api.online'

async function post<T = any>(path: string, body: any): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    credentials: 'include',  // send + receive cookies (session from auth/verify)
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = { status: 'fail', message: 'Invalid response', raw: text } }
  if (res.status !== 200 || json.status !== 'success') {
    throw new Error(json.message || `Request failed (${res.status})`)
  }
  return json as T
}

async function get<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'GET',
    credentials: 'include',  // send + receive cookies
    headers: { 'Accept': 'application/json, text/plain, */*' },
  })
  const text = await res.text()
  let json: any
  try { json = JSON.parse(text) } catch { json = { status: 'fail', message: 'Invalid response', raw: text } }
  if (res.status !== 200) {
    throw new Error(json.message || `Request failed (${res.status})`)
  }
  return json as T
}

// ============================================================
// OTP LOGIN (direct to backend, same as teamgeneration.in)
// ============================================================

export interface SendOtpResult {
  status: string
  data: {
    state: string
    retries_left: number
    resends_left: number
    resend_after: number
  }
  message: string
}

export async function sendOtp(platform: string, mobile: string): Promise<SendOtpResult> {
  const fantasyApp = platform === 'DREAM11' ? 'dream11' : 'my11circle'
  return post<SendOtpResult>('/api/fantasy/send-otp', { fantasyApp, mobileNumber: mobile })
}

export interface VerifyOtpResult {
  status: string
  data: {
    token: string           // authToken — stored in localStorage, used for transfers
    my11circleChallenge?: string
    my11circleUserId?: string
  }
  message?: string
}

export async function verifyOtp(
  platform: string,
  mobile: string,
  otp: string,
  state: string,
  reasonCode?: number | null
): Promise<VerifyOtpResult> {
  const fantasyApp = platform === 'DREAM11' ? 'dream11' : 'my11circle'
  const body: any = { fantasyApp, mobileNumber: mobile, verificationCode: otp }
  if (fantasyApp === 'dream11') {
    body.state = state
  } else {
    body.challenge = state
    if (reasonCode) body.reasonCode = reasonCode
  }
  return post<VerifyOtpResult>('/api/fantasy/verify-otp', body)
}

// ============================================================
// AUTH VERIFY (validate token before transfer)
// ============================================================

export interface AuthVerifyResult {
  status: string
  validToken: boolean
  updateUiToken?: boolean
  authToken?: string          // refreshed token (if updateUiToken is true)
  my11circleChallenge?: string
  my11circleUserId?: string
  retryable?: boolean
  message?: string
}

export async function authVerify(
  platform: string,
  authToken: string,
  matchId: string,
  extras?: { my11circleChallenge?: string; my11circleUserId?: string; mobileNumber?: string }
): Promise<AuthVerifyResult> {
  const fantasyApp = platform === 'DREAM11' ? 'dream11' : 'my11circle'
  const body: any = { fantasyApp, authToken, matchId }
  if (platform === 'MY11CIRCLE') {
    body.my11circleChallenge = extras?.my11circleChallenge || null
    body.my11circleUserId = extras?.my11circleUserId || null
    body.my11circleMobile = extras?.mobileNumber || null
  }
  return post<AuthVerifyResult>('/api/fantasy/auth/verify', body)
}

// ============================================================
// TRANSFER (the actual team transfer to Dream11/My11Circle)
// ============================================================

export interface AddTeamResult {
  status: string
  data: string  // encrypted link data (will be decrypted client-side)
}

export async function addTeam(
  platform: string,
  tgMatchId: string,
  playerData: string[],      // array of player pl_id strings
  captainData: string,       // captain pl_id
  vicecaptainData: string     // VC pl_id
): Promise<AddTeamResult> {
  const fantasyApp = platform.toLowerCase()
  const payload = {
    tgMatchId: String(tgMatchId),
    playerData,
    captainData: String(captainData),
    vicecaptainData: String(vicecaptainData),
    generateLinkFlag: 'general',
  }
  return post<AddTeamResult>(`/api/classic/${fantasyApp}/addteam`, payload)
}

// ============================================================
// DECRYPT (same AES key as teamgeneration.in)
// ============================================================

import CryptoJS from 'crypto-js'

const DECRYPT_KEY = 'coder_bobby_believer01_tg_software'

export function decryptLink(enc: any): string {
  if (typeof enc !== 'string' || !enc.startsWith('U2FsdGVk')) return enc
  try {
    const bytes = CryptoJS.AES.decrypt(enc, DECRYPT_KEY)
    const d = bytes.toString(CryptoJS.enc.Utf8)
    try {
      const parsed = JSON.parse(d)
      return parsed.link || parsed.url || d
    } catch {
      return d
    }
  } catch {
    return enc
  }
}

// ============================================================
// FULL TRANSFER FLOW (auth/verify + addteam + decrypt)
// ============================================================

export interface TransferResult {
  success: boolean
  transferLink?: string
  error?: string
  refreshedAuthToken?: string  // if backend returned a new token
}

export async function executeTransferDirect(params: {
  platform: string
  authToken: string
  matchId: string
  playerIds: string[]
  captainId: string
  viceCaptainId: string
  extras?: { my11circleChallenge?: string; my11circleUserId?: string; mobileNumber?: string }
}): Promise<TransferResult> {
  const { platform, authToken, matchId, playerIds, captainId, viceCaptainId, extras } = params

  // Step 1: auth/verify (validates token, establishes session)
  try {
    const verify = await authVerify(platform, authToken, matchId, extras)
    if (!verify.validToken) {
      return { success: false, error: verify.message || 'Token expired. Please re-link your account.' }
    }
    // If backend returned a refreshed token, return it so frontend can update localStorage
    if (verify.updateUiToken && verify.authToken) {
      // Continue with the refreshed token
      const refreshedToken = verify.authToken
      // Step 2: addteam with the refreshed token's session
      const result = await addTeam(platform, matchId, playerIds, captainId, viceCaptainId)
      const link = decryptLink(result.data)
      return { success: true, transferLink: link, refreshedAuthToken: refreshedToken }
    }
  } catch (e: any) {
    // If auth/verify fails, try addteam anyway (some flows may not require it)
    console.warn('[transfer] auth/verify failed, trying addteam directly:', e.message)
  }

  // Step 2: addteam (actual transfer)
  try {
    const result = await addTeam(platform, matchId, playerIds, captainId, viceCaptainId)
    const link = decryptLink(result.data)
    return { success: true, transferLink: link }
  } catch (e: any) {
    return { success: false, error: e.message || 'Transfer failed' }
  }
}
