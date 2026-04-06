// 버전은 sw.js 파일 자체의 수정 시각으로 자동 결정됨
// → 배포할 때마다 Vercel이 새 파일로 인식 → 브라우저가 자동 업데이트 감지

const CACHE_NAME = 'asa-cache-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// 네트워크 우선 전략 — 항상 서버에서 최신 파일 로드
// JS/CSS 등 앱 파일은 캐시 안 함 (Vite가 hash로 버전 관리)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // JS, CSS, JSX 번들 파일 → 캐시 완전 건너뜀 (Vite hash 파일명으로 자동 관리)
  if (url.pathname.startsWith('/assets/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 아이콘, manifest 등 정적 자산만 캐시
        if (STATIC_ASSETS.includes(url.pathname)) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting()
})
