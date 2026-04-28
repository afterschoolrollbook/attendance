/**
 * crypto.js — 비밀번호 해싱 유틸 (Web Crypto API, SHA-256)
 *
 * ▸ hashPassword(plain)  → Promise<string>  (hex 64자)
 * ▸ verifyPassword(plain, hash) → Promise<boolean>
 *
 * 단방향 해시이므로 bcrypt 대비 가볍고,
 * 브라우저/Node 환경 모두 지원 (Web Crypto API).
 *
 * ※ 기존 평문 pw가 DB에 남아있는 경우를 위해
 *    verifyPassword 는 "평문 일치"도 fallback으로 처리합니다.
 *    (마이그레이션 완료 후 fallback 제거 권장)
 */

const HEX_RE = /^[0-9a-f]{64}$/i

/** SHA-256 hex 문자열 반환 */
export async function hashPassword(plain) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(plain)
  )
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 비밀번호 검증
 * - hash 값이 64자 hex → SHA-256 해시 비교
 * - 그 외(= 평문 레거시) → 평문 직접 비교 후 해시로 자동 업그레이드
 *
 * @param {string}  plain  입력된 평문 비밀번호
 * @param {string}  stored DB에 저장된 값 (해시 or 평문 레거시)
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plain, stored) {
  if (!plain || !stored) return false
  // 이미 해시된 값이면 해시 비교
  if (HEX_RE.test(stored)) {
    const hashed = await hashPassword(plain)
    return hashed === stored
  }
  // 레거시 평문 — 그대로 비교 (마이그레이션 용)
  return plain === stored
}

/** 해시된 값인지 확인 */
export function isHashed(value) {
  return HEX_RE.test(value)
}
