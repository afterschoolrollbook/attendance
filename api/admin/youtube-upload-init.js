// Vercel 서버리스 함수 — 관리자/게시판 글쓴이가 유튜브에 영상을 직접 업로드할 수 있도록
// resumable upload 세션을 열어준다. 실제 영상 바이트는 브라우저가 이 서버를 거치지 않고
// 반환된 uploadUrl로 직접 PUT한다(Vercel 요청 본문 크기 제한 회피).
//
// 이 프로젝트는 다른 4개 블로그 프로젝트(Next.js)와 달리 x-admin-token 고정 비밀키가 아니라
// Supabase Auth 기반이라, 클라이언트가 보낸 Authorization: Bearer <supabase access token>을
// 검증해서 로그인한 사용자인지 확인한다(기존 이미지 업로드 dbCall('storageUpload')가 RLS로
// 걷는 것과 동등한 수준의 인증 — 새 시크릿 불필요, VITE_SUPABASE_URL/ANON_KEY만 재사용).
const { createClient } = require('@supabase/supabase-js')
const { OAuth2Client } = require('google-auth-library')

async function getYoutubeAccessToken() {
  const client = new OAuth2Client(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET)
  client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN })
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('유튜브 access token 발급 실패')
  return token
}

const MAX_MB = 500

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return }

  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace(/^Bearer\s+/i, '')
  if (!userToken) return res.status(401).json({ error: '인증 필요' })

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(userToken)
  if (authErr || !user) return res.status(401).json({ error: '인증 실패' })

  const { title, description, contentType, fileSize } = req.body || {}
  if (!contentType || !fileSize) return res.status(400).json({ error: 'contentType/fileSize 필요' })
  if (!contentType.startsWith('video/')) {
    return res.status(400).json({ error: '동영상 파일만 업로드할 수 있습니다.' })
  }
  if (fileSize > MAX_MB * 1024 * 1024) {
    return res.status(400).json({ error: `${MAX_MB}MB 이하 파일만 업로드할 수 있습니다.` })
  }

  try {
    const accessToken = await getYoutubeAccessToken()
    const initRes = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify({
        snippet: { title: title || '방과후 출석부 블로그 영상', description: description || '' },
        status: { privacyStatus: 'unlisted' },
      }),
    })
    if (!initRes.ok) {
      const errText = await initRes.text()
      return res.status(500).json({ error: `유튜브 업로드 세션 생성 실패: ${errText}` })
    }
    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) return res.status(500).json({ error: '유튜브 업로드 URL을 받지 못했습니다.' })
    return res.status(200).json({ uploadUrl })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
