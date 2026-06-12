// supabase/functions/send-push/index.ts
// 웹 푸시 발송 Edge Function
// 배포: supabase functions deploy send-push

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as webpush from 'https://esm.sh/web-push@3.6.6'

// CORS: 환경변수 ALLOWED_ORIGIN 으로 배포 도메인을 제한하세요.
// 예) supabase secrets set ALLOWED_ORIGIN=https://your-domain.vercel.app
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGIN') || '')
  .split(',').map(s => s.trim()).filter(Boolean)

// 요청 Origin을 ALLOWED_ORIGIN과 대조하여 CORS 헤더 반환
// ALLOWED_ORIGIN 미설정 시 개발 편의를 위해 요청 Origin 반영 (배포 전 반드시 설정)
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.length
    ? (ALLOWED_ORIGINS.includes(origin) ? origin : '')
    : (origin || '*')
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const {
      subscription,   // JSON 문자열 (endpoint + keys)
      title,
      body,
      url = '/parent-invite',
      tag = 'attendance',
    } = await req.json()

    if (!subscription) throw new Error('subscription 없음')

    // VAPID 키 — Supabase Secrets에 등록
    // supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_EMAIL=mailto:...
    const vapidPublicKey  = Deno.env.get('VAPID_PUBLIC_KEY')  || ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || ''
    const vapidEmail      = Deno.env.get('VAPID_EMAIL')       || 'mailto:admin@example.com'

    if (!vapidPublicKey || !vapidPrivateKey) throw new Error('VAPID 키가 설정되지 않았습니다')

    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)

    const sub = JSON.parse(subscription)
    const payload = JSON.stringify({ title, body, url, tag, icon: '/icon-192.png' })

    await webpush.sendNotification(sub, payload)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[send-push]', e.message)
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 200, // 클라이언트에서 throw 방지
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
