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

export { isConfigured, FUNCTIONS_BASE }
