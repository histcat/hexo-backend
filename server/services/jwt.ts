/**
 * JWT 签发/验证，以及 GitHub Token 的 AES-GCM 加解密。
 *
 * JWT_SECRET 同时用于：
 *   1. HS256 JWT 签名（直接作为对称密钥）
 *   2. HKDF 派生 AES-GCM 密钥（加密 GitHub PAT）
 *
 * 存储于 JWT payload 中的 encryptedToken 格式：
 *   base64url(iv (12 bytes) + ciphertext + auth-tag (16 bytes))
 */

import { SignJWT, jwtVerify } from 'jose'
import type { RepoConfig } from '../types.ts'
import { getJwtSecret } from './env.ts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// ── Helpers ──────────────────────────────────────────────────────

function requireSecret(): string {
  const secret = getJwtSecret()
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

function getSigningKey(): Uint8Array {
  return encoder.encode(requireSecret())
}

let _encryptionKey: CryptoKey | null = null

/**
 * Derive a dedicated AES-256-GCM key from JWT_SECRET via HKDF.
 * Cached after first derivation (lasts the lifetime of the isolate).
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (_encryptionKey) return _encryptionKey

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(requireSecret()),
    'HKDF',
    false,
    ['deriveKey'],
  )

  _encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('hexo-backend:v1'),
      info: encoder.encode('github-token-encryption'),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )

  return _encryptionKey
}

// ── Token Encryption (AES-256-GCM) ───────────────────────────────

/**
 * Encrypt a GitHub PAT so it can be safely stored in the JWT payload.
 * Returns base64url(iv || ciphertext).
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = encoder.encode(plaintext)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  )

  // Concatenate iv + ciphertext
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.byteLength)

  // Base64URL encode
  return btoa(String.fromCharCode(...combined))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Decrypt a GitHub PAT from the JWT payload.
 */
export async function decryptToken(encrypted: string): Promise<string> {
  const key = await getEncryptionKey()

  // Base64URL decode
  let base64 = encrypted.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

  const iv = raw.slice(0, 12)
  const ciphertext = raw.slice(12)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )

  return decoder.decode(plaintext)
}

// ── JWT ──────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: number
  login: string
  name: string
  avatarUrl: string
  encryptedToken: string
  iat?: number
  exp?: number
  /** Set after user selects a repo */
  selectedRepo?: {
    owner: string
    name: string
    defaultBranch: string
  }
  /** Repo config parsed from .astro-editor.yml */
  repoConfig?: RepoConfig
}

const JWT_EXPIRY_SECONDS = 24 * 60 * 60 // 24 hours

/**
 * Sign a JWT with the session payload.
 */
export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // SignJWT expects sub as string; we set it separately via setSubject
  const { sub, ...rest } = payload
  return new SignJWT({ ...rest, sub: String(sub) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(payload.sub))
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_EXPIRY_SECONDS)
    .sign(getSigningKey())
}

/**
 * Verify and decode a JWT. Returns the payload or null if invalid/expired.
 */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ['HS256'],
    })
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}
