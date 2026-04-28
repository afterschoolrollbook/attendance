// supabase/functions/naver-oauth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || ''
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { code, state } = await req.json()

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SVC_ROLE_KEY')!,
    )

    // settings 테이블에서 키 읽기
    const { data: socialCfg } = await adminClient.from('settings').select('value').eq('key', 'social').single()
    const cfg = socialCfg?.value || {}
    const CLIENT_ID     = cfg.naverClientId     || Deno.env.get('NAVER_CLIENT_ID')     || ''
    const CLIENT_SECRET = cfg.naverClientSecret || Deno.env.get('NAVER_CLIENT_SECRET') || ''

    if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('네이버 클라이언트 ID/Secret이 설정되지 않았습니다.')

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
    const email = profile.email || `naver_${profile.id}@naver.local`
    const providerId = String(profile.id)

    // 3. Supabase Auth에 계정 생성 또는 세션 발급
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.users?.find(u =>
      u.email === email || u.user_metadata?.provider_id === providerId
    )

    let session = null
    const tempPw = `naver_${providerId}_${Deno.env.get('SUPABASE_JWT_SECRET')?.slice(0, 8) || 'secret'}`

    if (existingAuthUser) {
      await adminClient.auth.admin.updateUserById(existingAuthUser.id, { password: tempPw })
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
      )
      const { data: signInData } = await anonClient.auth.signInWithPassword({
        email: existingAuthUser.email!,
        password: tempPw,
      })
      session = signInData?.session
    } else {
      const { data: newUser } = await adminClient.auth.admin.createUser({
        email,
        password: tempPw,
        email_confirm: true,
        user_metadata: { provider: 'naver', provider_id: providerId },
      })
      if (newUser?.user) {
        const anonClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
        )
        const { data: signInData } = await anonClient.auth.signInWithPassword({
          email,
          password: tempPw,
        })
        session = signInData?.session
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        provider:   'naver',
        email,
        name:       profile.name  || '',
        avatar:     profile.profile_image || '',
        providerId,
        phone:      profile.mobile || '',
      },
      session,
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
