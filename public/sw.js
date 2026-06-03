// ─── 방과후 출석부 Service Worker ───────────────────────────────────
// 위치: /public/sw.js  (빌드 시 루트로 복사됨)

self.addEventListener('install', () => {
  // skipWaiting 하지 않음 — index.html에서 사용자 확인 후 교체
})

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// ─── index.html에서 'skipWaiting' 메시지 받으면 교체
self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting()
})

// ─── 푸시 수신
self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()

  const options = {
    body:    data.body    || '',
    icon:    data.icon    || '/icon-192.png',
    badge:   data.badge   || '/icon-192.png',
    tag:     data.tag     || 'attendance',
    data:    { url: data.url || '/parent-invite' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  }

  e.waitUntil(self.registration.showNotification(data.title || '방과후 출석부', options))
})

// ─── 알림 클릭 → 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/parent-invite'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
