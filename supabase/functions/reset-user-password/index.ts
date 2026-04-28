// supabase/functions/reset-user-password/index.ts
// 관리자 전용 — 다른 사용자 비밀번호 초기화
// 배포: supabase functions deploy reset-user-password

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
    const { authId, newPassword } = await req.json()
    if (!authId || !newPassword) throw new Error('authId, newPassword 필수')

    // 요청자가 admin인지 확인
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } }
    )
    const { data: { user: caller } } = await anonClient.auth.getUser()
    if (!caller) throw new Error('인증되지 않은 요청입니다.')

    const { data: callerUser } = await anonClient.from('users').select('level').eq('auth_id', caller.id).single()
    if (!callerUser || callerUser.level < 5) throw new Error('관리자 권한이 필요합니다.')

    // Service Role Key로 대상 유저 비밀번호 변경
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SVC_ROLE_KEY')!,
    )
    const { error } = await adminClient.auth.admin.updateUserById(authId, { password: newPassword })
    if (error) throw new Error(error.message)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
