/**
 * crypto.js — 비밀번호 해싱 유틸 (Web Crypto API, PBKDF2)
 *
 * ▸ hashPassword(plain)  → Promise<string>  "pbkdf2:salt:hash" 형식
 * ▸ verifyPassword(plain, stored) → Promise<boolean>
 *
 * SHA-256 단방향 해시에서 PBKDF2(솔트 포함)로 업그레이드.
 * 레거시 SHA-256 해시(64자 hex)도 검증 가능 (마이그레이션용).
 * 평문 fallback은 완전 제거됨.
 */

const SHA256_RE  = /^[0-9a-f]{64}$/i
const PBKDF2_RE  = /^pbkdf2:[0-9a-f]{32}:[0-9a-f]{64}$/i

/** PBKDF2 해시 생성 (솔트 포함) */
export async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(plain), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${saltHex}:${hashHex}`
}

/** 비밀번호 검증 */
export async function verifyPassword(plain, stored) {
  if (!plain || !stored) return false

  // PBKDF2 형식
  if (PBKDF2_RE.test(stored)) {
    const [, saltHex, hashHex] = stored.split(':')
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)))
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(plain), 'PBKDF2', false, ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    )
    const newHash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
    return newHash === hashHex
  }

  // 레거시 SHA-256 (솔트 없음) — 마이그레이션용, 검증 후 재해시 필요
  if (SHA256_RE.test(stored)) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain))
    const hashed = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    return hashed === stored
  }

  // 평문 fallback 완전 제거 — 일치 불가로 처리
  return false
}

/** 해시된 값인지 확인 */
export function isHashed(value) {
  return PBKDF2_RE.test(value) || SHA256_RE.test(value)
}
