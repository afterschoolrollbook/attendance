// supabase/functions/send-email/index.ts
// 배포: supabase functions deploy send-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    // Authorization 헤더 확인 (anon key 이상 필요)
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: '인증이 필요합니다.' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { to, subject, html, purpose, code } = await req.json()

    // 수신자 이메일 기본 검증
    if (!to || !String(to).includes('@')) {
      return new Response(JSON.stringify({ success: false, error: '유효하지 않은 수신자입니다.' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // settings 테이블에서 키 읽기 (관리자 페이지에서 등록)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SVC_ROLE_KEY')!,
    )
    const { data: emailCfg } = await supabase.from('settings').select('value').eq('key', 'email').single()
    const cfg = emailCfg?.value || {}
    const RESEND_API_KEY = cfg.resendApiKey || Deno.env.get('RESEND_API_KEY') || ''
    const FROM_EMAIL     = cfg.fromEmail || 'noreply@afterschool.app'

    if (!RESEND_API_KEY) {
      // 개발 모드: 콘솔에만 출력
      console.log(`[개발모드] 이메일 발송 시뮬레이션`)
      console.log(`  수신: ${to}`)
      console.log(`  제목: ${subject}`)
      console.log(`  인증코드: ${code}`)
      return new Response(JSON.stringify({ success: true, dev: true, code }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Resend API로 실제 이메일 발송
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `방과후 출석부 <${FROM_EMAIL}>`,
        to: [to],
        subject: subject || '[방과후 출석부] 이메일 인증번호',
        html: html || `
          <div style="font-family:'Noto Sans KR',sans-serif;max-width:500px;margin:0 auto;padding:40px 20px;">
            <h1 style="color:#f97316;font-size:24px;margin-bottom:8px">방과후 출석부</h1>
            <p style="color:#374151;font-size:16px;margin-bottom:32px">이메일 인증번호입니다.</p>
            <div style="background:#fff7ed;border:2px solid #fed7aa;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <div style="font-size:40px;font-weight:700;letter-spacing:10px;color:#f97316">${code}</div>
              <div style="color:#9ca3af;font-size:13px;margin-top:8px">10분 이내 입력해주세요</div>
            </div>
            <p style="color:#6b7280;font-size:13px;line-height:1.6">본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.</p>
          </div>
        `,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || '이메일 발송 실패')

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
