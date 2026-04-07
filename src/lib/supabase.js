// Supabase 클라이언트 + Edge Function 호출 헬퍼

const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL    || ''
const SUPABASE_ANON   = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const FUNCTIONS_BASE  = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : ''

const isConfigured = !!SUPABASE_URL && !!SUPABASE_ANON

// ─── Edge Function 호출 공통 함수
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

// ─── DB API 호출
export async function dbCall(action, table, payload = {}) {
  return callFunction('db-api', { action, table, ...payload })
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
// subscription: JSON 문자열 (ParentMembers의 pushSubscription 필드)
// title/body: 알림 제목/내용
// url: 클릭 시 이동할 경로 (기본 /parent-invite)
export async function sendPush(subscription, { title, body, url = '/parent-invite', tag = 'attendance' }) {
  if (!subscription) return  // 구독 없으면 조용히 스킵
  try {
    await callFunction('send-push', { subscription, title, body, url, tag })
  } catch (e) {
    // 푸시 실패해도 출석 처리에 영향 없어야 함
    console.warn('[Push] 발송 실패:', e.message)
  }
}

export { isConfigured, FUNCTIONS_BASE }
