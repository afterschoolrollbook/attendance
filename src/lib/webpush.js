// lib/webpush.js
// 웹 푸시 구독 등록 + 구독 정보 저장 헬퍼

// VAPID 공개키 — Supabase send-push Edge Function과 동일해야 함
// 관리자 설정에서 입력받아 Settings에 저장하는 방식으로 확장 가능
// 현재는 Settings에서 로드
import { Settings } from './db.js'

function getVapidKey() {
  const s = Settings.get()
  return s?.push?.vapidPublicKey || ''
}

// base64url → Uint8Array (VAPID 키 변환용)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Service Worker 등록 (앱 시작 시 1회)
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    return reg
  } catch (e) {
    console.warn('[SW] 등록 실패:', e)
    return null
  }
}

// 푸시 구독 요청 + 구독 객체 반환
// 학부모가 가입 완료할 때 호출
export async function subscribePush() {
  const vapidKey = getVapidKey()
  if (!vapidKey) {
    console.warn('[Push] VAPID 공개키가 설정되지 않았습니다. 관리자 → 서비스설정 → 푸시알림에서 등록하세요.')
    return null
  }

  if (!('Notification' in window)) return null
  if (!('serviceWorker' in navigator)) return null

  // 권한 요청
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }
  return JSON.stringify(sub)  // endpoint + keys 포함된 JSON 문자열
}

// 현재 구독 정보 반환 (이미 구독 중인지 확인용)
export async function getExistingSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? JSON.stringify(sub) : null
}
