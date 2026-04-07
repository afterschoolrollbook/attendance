// supabase/functions/generate-vapid/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as webpush from 'https://esm.sh/web-push@3.6.6'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
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
