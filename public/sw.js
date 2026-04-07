// ─── 방과후 출석부 Service Worker ───────────────────────────────────
// 위치: /public/sw.js  (빌드 시 루트로 복사됨)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

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
      // 이미 열린 탭 있으면 포커스
      for (const c of clients) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus()
      }
      // 없으면 새 탭
      return self.clients.openWindow(url)
    })
  )
})
