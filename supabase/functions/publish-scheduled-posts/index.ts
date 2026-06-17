// supabase/functions/publish-scheduled-posts/index.ts
// 예약발행 자동 처리 Edge Function
//
// 배포: supabase functions deploy publish-scheduled-posts
//
// ── 호출 방식 두 가지 ──────────────────────────────────────────
// 1) Supabase Cron (권장): Supabase Dashboard → Database → Cron jobs
//    - Schedule: * * * * *  (매 분마다)
//    - HTTP Method: POST
//    - URL: https://<project-ref>.supabase.co/functions/v1/publish-scheduled-posts
//    - Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
//
// 2) 외부 cron 서비스 (cron-job.org 등 무료):
//    - URL과 Authorization 헤더 동일하게 설정
// ──────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Authorization 헤더 검증 (service_role key 또는 cron secret)
  const authHeader = req.headers.get('Authorization') || ''
  const serviceRoleKey = Deno.env.get('SVC_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!authHeader.startsWith('Bearer ') || authHeader.replace('Bearer ', '') !== serviceRoleKey) {
    return new Response(JSON.stringify({ success: false, error: '인증 실패' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey,
    )

    const now = new Date().toISOString()

    // scheduled 상태이고 scheduled_at이 현재 시간 이전인 글 조회
    const { data: posts, error: fetchError } = await supabase
      .from('blog_posts')
      .select('id, title, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)

    if (fetchError) throw fetchError

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ success: true, published: 0, message: '발행할 예약 글 없음' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 해당 글들을 published로 일괄 업데이트
    const ids = posts.map(p => p.id)
    const { error: updateError } = await supabase
      .from('blog_posts')
      .update({
        status: 'published',
        published_at: now,
        updated_at: now,
      })
      .in('id', ids)

    if (updateError) throw updateError

    console.log(`[publish-scheduled-posts] ${posts.length}개 글 자동 발행 완료:`, posts.map(p => p.title))

    return new Response(
      JSON.stringify({
        success: true,
        published: posts.length,
        titles: posts.map(p => p.title),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('[publish-scheduled-posts] 오류:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
