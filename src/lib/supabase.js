// Supabase 클라이언트
// DB 접근: Supabase JS 클라이언트 직접 사용 (Edge Function 없음)
// Edge Function: 이메일/SMS/푸시/OAuth 전용

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL     || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const isConfigured = !!SUPABASE_URL && !!SUPABASE_ANON

// ─── Supabase JS 클라이언트 (DB 직접 접근)
export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null

// ─── Edge Function 호출 (이메일/SMS/푸시/OAuth 전용)
const FUNCTIONS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : ''

async function callFunction(name, body) {
  if (!FUNCTIONS_BASE) throw new Error('Supabase URL이 설정되지 않았습니다.')
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || `${name} 호출 실패`)
  return data.data
}

// ─── 이메일 발송
export async function sendEmail(to, code) {
  return callFunction('send-email', { to, code })
}

// ─── SMS 발송
export async function sendSMS(to, text, type = 'SMS') {
  return callFunction('send-sms', { to, text, type })
}

// ─── 네이버 OAuth 토큰 교환
export async function naverOAuth(code, state) {
  return callFunction('naver-oauth', { code, state })
}

// ─── 웹 푸시 발송
export async function sendPush(subscription, { title, body, url = '/parent-invite', tag = 'attendance' }) {
  if (!subscription) return
  try {
    await callFunction('send-push', { subscription, title, body, url, tag })
  } catch (e) {
    console.warn('[Push] 발송 실패:', e.message)
  }
}

// ─── 파일 업로드 (Storage 직접)
export async function storageUpload(bucket, filePath, file, contentType) {
  if (!supabase) throw new Error('Supabase 미설정')
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { contentType, upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  return { url: data.publicUrl }
}
