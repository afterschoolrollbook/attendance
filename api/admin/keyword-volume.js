// Vercel 서버리스 함수 — 관리자 화면 "키워드 관리" 탭의 "키워드 추가 수집" 입력창에서 호출한다.
// 네이버 검색광고 API(hintKeywords)로 연관 키워드 검색량을 조회해 blog_keyword_stats에 저장한다.
//
// 이 프로젝트는 다른 4개 블로그 프로젝트(Next.js, x-admin-token 고정 비밀키)와 달리
// Supabase Auth 기반이라, api/admin/youtube-upload-init.js와 동일하게
// Authorization: Bearer <supabase access token>을 검증해서 로그인한 사용자인지 확인한다.
//
// 이전까지는 이 화면에 직접 수집 버튼이 없어서 MCP naver_keyword_volume 툴(Claude와의 대화)로만
// 키워드를 모을 수 있었는데, 다른 4개 프로젝트와 기능을 맞추기 위해 새로 추가했다.
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const NAVER_BASE_URL = 'https://api.naver.com'
const NAVER_URI = '/keywordstool'

function buildNaverHeaders() {
  const apiKey = process.env.NAVER_AD_API_KEY
  const secretKey = process.env.NAVER_AD_SECRET_KEY
  const customerId = process.env.NAVER_AD_CUSTOMER_ID
  if (!apiKey || !secretKey || !customerId) throw new Error('네이버 검색광고 API 환경변수가 설정되지 않았습니다')
  const timestamp = Date.now().toString()
  const message = `${timestamp}.GET.${NAVER_URI}`
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64')
  return {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Timestamp': timestamp,
    'X-API-KEY': apiKey,
    'X-Customer': String(customerId),
    'X-Signature': signature,
  }
}

function parseCount(val) {
  if (val === '< 10' || val === '<10') return 5
  return Number(val) || 0
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).end(); return }

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace(/^Bearer\s+/i, '')
  if (!userToken) return res.status(401).json({ error: '인증 필요' })

  const authClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await authClient.auth.getUser(userToken)
  if (authErr || !user) return res.status(401).json({ error: '인증 실패' })

  const keyword = (req.query.keyword || '').trim()
  if (!keyword) return res.status(400).json({ error: 'keyword 파라미터가 필요합니다' })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const headers = buildNaverHeaders()
    const url = `${NAVER_BASE_URL}${NAVER_URI}?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`
    const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return res.status(response.status).json({ error: `네이버 API 오류: ${text}` })
    }
    const data = await response.json()
    const list = Array.isArray(data?.keywordList) ? data.keywordList : []

    const nowIso = new Date().toISOString()
    const rows = list.map(item => {
      const pc = parseCount(item.monthlyPcQcCnt)
      const mobile = parseCount(item.monthlyMobileQcCnt)
      return {
        hint: keyword,
        keyword: item.relKeyword,
        pc,
        mobile,
        total: pc + mobile,
        competition: item.compIdx || '-',
        updated_at: nowIso,
      }
    })

    if (rows.length > 0) {
      const { error: dbError } = await supabase
        .from('blog_keyword_stats')
        .upsert(rows, { onConflict: 'hint,keyword' })
      if (dbError) return res.status(500).json({ error: `저장 실패: ${dbError.message}` })
    }

    return res.status(200).json({ keyword, saved: rows.length })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
