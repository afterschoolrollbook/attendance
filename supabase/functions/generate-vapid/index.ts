// supabase/functions/generate-vapid/index.ts
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
    const vapidKeys = webpush.generateVAPIDKeys()
    return new Response(
      JSON.stringify({ success: true, publicKey: vapidKeys.publicKey, privateKey: vapidKeys.privateKey }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
