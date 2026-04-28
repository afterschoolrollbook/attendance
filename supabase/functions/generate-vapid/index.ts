// supabase/functions/generate-vapid/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as webpush from 'https://esm.sh/web-push@3.6.6'

// CORS: 환경변수 ALLOWED_ORIGIN 으로 배포 도메인을 제한하세요.
// 예) supabase secrets set ALLOWED_ORIGIN=https://your-domain.vercel.app
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || ''
const corsHeaders = {
  'Access-Control-Allow-Origin':  ALLOWED_ORIGIN || '*',  // 환경변수 미설정 시 개발 편의상 * 허용
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const vapidKeys = webpush.generateVAPIDKeys()
    return new Response(
      JSON.stringify({ success: true, publicKey: vapidKeys.publicKey, privateKey: vapidKeys.privateKey }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
