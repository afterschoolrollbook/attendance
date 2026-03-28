// supabase/functions/send-sms/index.ts
// 배포: supabase functions deploy send-sms

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Solapi HMAC-SHA256 서명 생성
function makeSignature(apiKey: string, apiSecret: string): { date: string, signature: string, salt: string } {
  const date  = new Date().toISOString()
  const salt  = Math.random().toString(36).slice(2, 12)
  const hmac  = createHmac('sha256', apiSecret)
  hmac.update(`${date}${salt}`)
  return { date, salt, signature: hmac.digest('hex') }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { to, text, type = 'SMS', kakaoChannelId, templateId } = await req.json()

    // settings 테이블에서 키 읽기 (관리자 페이지에서 등록)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SVC_ROLE_KEY')!,
    )
    const { data: solapiCfg } = await supabase.from('settings').select('value').eq('key', 'solapi').single()
    const cfg = solapiCfg?.value || {}
    const API_KEY    = cfg.apiKey    || Deno.env.get('SOLAPI_API_KEY')    || ''
    const API_SECRET = cfg.apiSecret || Deno.env.get('SOLAPI_API_SECRET') || ''
    const FROM_PHONE = cfg.senderPhone || Deno.env.get('SOLAPI_SENDER_PHONE') || ''
    const KAKAO_CHANNEL_ID = cfg.kakaoChannelId || ''

    if (!API_KEY || !API_SECRET || !FROM_PHONE) {
      // 개발 모드
      console.log(`[개발모드] SMS 발송 시뮬레이션`)
      console.log(`  수신: ${to}`)
      console.log(`  내용: ${text}`)
      return new Response(JSON.stringify({ success: true, dev: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { date, salt, signature } = makeSignature(API_KEY, API_SECRET)

    // 메시지 구성
    const message: Record<string, unknown> = {
      to:   to.replace(/[^0-9]/g, ''),
      from: FROM_PHONE.replace(/[^0-9]/g, ''),
      text,
      type,
    }

    // 카카오 알림톡
    if (type === 'ATA' && kakaoChannelId) {
      message.kakaoOptions = {
        pfId: kakaoChannelId,
        templateId,
        variables: {},
      }
    }

    const res = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `HMAC-SHA256 apiKey=${API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({ message }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.errorMessage || 'SMS 발송 실패')

    return new Response(JSON.stringify({ success: true, messageId: data.messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
