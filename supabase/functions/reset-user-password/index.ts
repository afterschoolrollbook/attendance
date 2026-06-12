// supabase/functions/reset-password-self/index.ts
// 비밀번호 초기화 — 로그인 없이, 이메일로 받은 인증번호 확인 후 새 비밀번호로 변경
// 배포: supabase functions deploy reset-password-self
//
// 기존 authResetPassword(=supabase.auth.resetPasswordForEmail)는
//  1) Supabase 자체 메일 발송 한도(기본 2건/시간)에 걸리고
//  2) 메일의 복구 링크를 클릭해야만 동작하는데 이 앱은 그 링크를 처리하지 않아
//     "완료" 화면은 나오지만 실제로는 비밀번호가 바뀌지 않는 상태였음.
//
// 이 함수는 앱이 자체적으로 보낸 인증번호(verify_codes, purpose='reset')를
// 서버에서 검증한 뒤, service role 권한으로 곧바로 비밀번호를 변경한다.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const { email, code, newPassword } = await req.json()
    if (!email || !code || !newPassword) throw new Error('필수 값이 누락되었습니다.')
    if (String(newPassword).length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.')

    const emailLower = String(email).trim().toLowerCase()

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SVC_ROLE_KEY')!,
    )

    // 1. 인증번호 확인 (앱이 보낸 코드, purpose='reset', 미사용, 만료 전)
    const { data: rows, error: codeErr } = await adminClient
      .from('verify_codes')
      .select('id, expires_at')
      .eq('target', emailLower)
      .eq('code', String(code).trim())
      .eq('purpose', 'reset')
      .eq('used', false)
      .limit(1)
    if (codeErr) throw new Error(codeErr.message)
    if (!rows || rows.length === 0) throw new Error('인증번호가 올바르지 않거나 만료되었습니다.')
    if (new Date(rows[0].expires_at) < new Date()) throw new Error('인증번호가 만료되었습니다.')

    // 2. 인증코드 소진 처리 (재사용 방지)
    await adminClient.from('verify_codes').update({ used: true }).eq('id', rows[0].id)

    // 3. 이메일로 users.auth_id 조회
    const { data: userRow, error: userErr } = await adminClient
      .from('users')
      .select('auth_id, provider')
      .eq('email', emailLower)
      .single()
    if (userErr || !userRow?.auth_id) throw new Error('등록되지 않은 이메일입니다.')
    if (userRow.provider && userRow.provider !== 'email') {
      throw new Error('소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.')
    }

    // 4. 비밀번호 변경 (service role — 로그인 세션 불필요)
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(userRow.auth_id, { password: newPassword })
    if (updateErr) throw new Error(updateErr.message)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 400,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }
    })
  }
})
