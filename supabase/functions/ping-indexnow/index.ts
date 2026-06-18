// supabase/functions/ping-indexnow/index.ts
// 배포: supabase functions deploy ping-indexnow
//
// 브라우저에서 api.indexnow.org 직접 호출 시 CSP 오류 발생 →
// 이 Edge Function이 서버 측에서 IndexNow API를 호출해 줍니다.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGIN') || '')
  .split(',').map(s => s.trim()).filter(Boolean)

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

const INDEXNOW_KEY = '9dcc9754863220877605a3ee2763022a'
const INDEXNOW_HOST = 'https://api.indexnow.org/indexnow'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'url 파라미터가 필요합니다.' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const indexNowUrl = `${INDEXNOW_HOST}?url=${encodeURIComponent(url)}&key=${INDEXNOW_KEY}`
    const res = await fetch(indexNowUrl, { method: 'GET' })
    const status = res.status

    console.log('[IndexNow] 핑 전송:', url, '→', status)

    // IndexNow 성공 코드: 200, 202
    const success = status === 200 || status === 202

    return new Response(JSON.stringify({ success, status }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[IndexNow] 오류:', e)
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
