// supabase/functions/naver-oauth/index.ts
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

    const { code, state } = await req.json()

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SVC_ROLE_KEY')!,
    )

    // settings 테이블에서 키 읽기 (client id는 social, secret은 social_secret - 보안 분리)
    const { data: socialCfg } = await adminClient.from('settings').select('value').eq('key', 'social').single()
    const { data: socialSecretCfg } = await adminClient.from('settings').select('value').eq('key', 'social_secret').single()
    const cfg = socialCfg?.value || {}
    const secretCfg = socialSecretCfg?.value || {}
    const CLIENT_ID     = cfg.naverClientId           || Deno.env.get('NAVER_CLIENT_ID')     || ''
    const CLIENT_SECRET = secretCfg.naverClientSecret || Deno.env.get('NAVER_CLIENT_SECRET') || ''

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

    // 기존 Auth 계정 조회 또는 신규 생성 (비밀번호를 만들거나 변경하지 않음)
    let authUser = existingAuthUser
    if (!authUser) {
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { provider: 'naver', provider_id: providerId },
      })
      if (createErr) throw createErr
      authUser = newUser?.user
    }

    // 매직링크 토큰을 발급받아 즉시 세션으로 교환 (비밀번호 미사용)
    let session = null
    if (authUser?.email) {
      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: authUser.email,
      })
      if (linkErr) throw linkErr
      const hashedToken = linkData?.properties?.hashed_token
      if (hashedToken) {
        const anonClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
        )
        const { data: verifyData, error: verifyErr } = await anonClient.auth.verifyOtp({
          email: authUser.email,
          token: hashedToken,
          type: 'magiclink',
        })
        if (verifyErr) throw verifyErr
        session = verifyData?.session
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
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
