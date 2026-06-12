// supabase/functions/kakao-oauth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { code, clientId, redirectUri } = await req.json()

    const restApiKey = clientId || Deno.env.get('KAKAO_CLIENT_ID') || ''
    if (!restApiKey) throw new Error('카카오 REST API 키가 설정되지 않았습니다.')
    if (!code) throw new Error('인가 코드가 없습니다.')

    // 1. 인가 코드 → 액세스 토큰 교환
    const tokenParams = new URLSearchParams({
      grant_type:   'authorization_code',
      client_id:    restApiKey,
      redirect_uri: redirectUri,
      code,
    })
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    tokenParams.toString(),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) throw new Error(tokenData.error_description || '토큰 발급 실패')

    // 2. 액세스 토큰 → 사용자 정보 조회
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userData = await userRes.json()
    if (!userData.id) throw new Error('사용자 정보 조회 실패')

    const acc = userData.kakao_account
    const email = acc?.email || `kakao_${userData.id}@kakao.local`
    const providerId = String(userData.id)

    // 3. Supabase Auth에 계정 생성 또는 세션 발급
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SVC_ROLE_KEY')!,
    )

    // 기존 Auth 계정 조회
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.users?.find(u =>
      u.email === email || u.user_metadata?.provider_id === providerId
    )

    let session = null

    if (existingAuthUser) {
      // 기존 계정 → 임시 토큰으로 세션 발급
      const { data: sessionData } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: existingAuthUser.email!,
      })
      // magiclink 대신 직접 세션 생성
      const tempPw = `kakao_${providerId}_${Deno.env.get('SUPABASE_JWT_SECRET')?.slice(0, 8) || 'secret'}`
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
      // 신규 계정 생성
      const tempPw = `kakao_${providerId}_${Deno.env.get('SUPABASE_JWT_SECRET')?.slice(0, 8) || 'secret'}`
      const { data: newUser } = await adminClient.auth.admin.createUser({
        email,
        password: tempPw,
        email_confirm: true,
        user_metadata: { provider: 'kakao', provider_id: providerId },
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
        id:            providerId,
        email,
        name:          acc?.profile?.nickname             || '',
        profile_image: acc?.profile?.thumbnail_image_url || '',
      },
      session,
    }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
