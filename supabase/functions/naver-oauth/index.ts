// supabase/functions/naver-oauth/index.ts
// 네이버 로그인 — 서버사이드 토큰 교환
// 배포: supabase functions deploy naver-oauth

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { code, state } = await req.json()

    // settings 테이블에서 키 읽기
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: socialCfg } = await supabase.from('settings').select('value').eq('key', 'social').single()
    const cfg = socialCfg?.value || {}
    const CLIENT_ID     = cfg.naverClientId     || Deno.env.get('NAVER_CLIENT_ID')     || ''
    const CLIENT_SECRET = cfg.naverClientSecret || Deno.env.get('NAVER_CLIENT_SECRET') || ''

    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('네이버 클라이언트 ID/Secret이 설정되지 않았습니다.')
    }

    // 1. 액세스 토큰 교환
    const tokenRes = await fetch(
      `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&code=${code}&state=${state}`,
      { method: 'GET' }
    )
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error('토큰 교환 실패')

    // 2. 사용자 정보 조회
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profileData = await profileRes.json()
    const profile = profileData.response

    return new Response(JSON.stringify({
      success: true,
      profile: {
        provider:   'naver',
        email:      profile.email || '',
        name:       profile.name  || '',
        avatar:     profile.profile_image || '',
        providerId: profile.id,
        phone:      profile.mobile || '',
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
