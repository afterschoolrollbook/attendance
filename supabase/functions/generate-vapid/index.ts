// supabase/functions/generate-vapid/index.ts
// VAPID 키 자동 생성 + Supabase Secrets에 저장
// 배포: supabase functions deploy generate-vapid

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as webpush from 'https://esm.sh/web-push@3.6.6'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // VAPID 키 쌍 생성
    const vapidKeys = webpush.generateVAPIDKeys()
    const { publicKey, privateKey } = vapidKeys

    // Supabase Management API로 Secrets 등록
    // SUPABASE_PROJECT_REF, SUPABASE_SERVICE_ROLE_KEY 는 자동 주입됨
    const projectRef = Deno.env.get('SUPABASE_PROJECT_REF') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!projectRef || !serviceKey) {
      throw new Error('프로젝트 환경변수가 없습니다. Supabase Edge Function 환경에서 실행하세요.')
    }

    // Supabase Management API로 Secrets 업데이트
    const secretsRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          { name: 'VAPID_PUBLIC_KEY',  value: publicKey },
          { name: 'VAPID_PRIVATE_KEY', value: privateKey },
          { name: 'VAPID_EMAIL',       value: `mailto:admin@afterschool.app` },
        ]),
      }
    )

    if (!secretsRes.ok) {
      const errText = await secretsRes.text()
      throw new Error(`Secrets 저장 실패: ${errText}`)
    }

    // 공개키만 프론트로 반환 (비밀키는 서버에만 보관)
    return new Response(JSON.stringify({ success: true, publicKey }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('[generate-vapid]', e.message)
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
