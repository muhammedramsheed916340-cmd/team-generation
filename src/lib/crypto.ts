/**
 * AES-256-GCM encryption for sensitive tokens (fantasy platform sessions).
 * Uses Node crypto. Key derived from FANTASY_ENCRYPTION_KEY env (or fallback dev key).
 */
import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 16

function getKey(): Buffer {
  const raw = process.env.FANTASY_ENCRYPTION_KEY || 'tg-dev-encryption-key-please-change-in-prod-32b'
  // derive a stable 32-byte key via sha256
  return crypto.createHash('sha256').update(raw).digest()
}

export interface EncryptedBlob {
  encrypted: string // base64 ciphertext
  iv: string // base64 iv
  tag: string // base64 auth tag
}

export function encrypt(plain: string): EncryptedBlob {
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    encrypted: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decrypt(blob: EncryptedBlob): string {
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(blob.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(blob.tag, 'base64'))
  const dec = Buffer.concat([decipher.update(Buffer.from(blob.encrypted, 'base64')), decipher.final()])
  return dec.toString('utf8')
}

/** Convenience: encrypt a JSON-serialisable object and return DB-friendly columns */
export function encryptJSON(obj: unknown): { encryptedToken: string; tokenIv: string } {
  const blob = encrypt(JSON.stringify(obj))
  // pack tag into the encrypted string separated by ":" for single-column storage
  return {
    encryptedToken: `${blob.encrypted}:${blob.tag}`,
    tokenIv: blob.iv,
  }
}

export function decryptJSON(encryptedToken: string, tokenIv: string): unknown {
  const [encrypted, tag] = encryptedToken.split(':')
  return JSON.parse(decrypt({ encrypted, iv: tokenIv, tag }))
}
