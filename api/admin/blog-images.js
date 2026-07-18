// Vercel 서버리스 함수 — "블로그 사진" 관리 화면의 업로드/삭제를 서비스롤 키로 처리한다.
// 원래는 dbCall('storageUpload', ...)로 anon 키 + RLS 정책에 의존했는데, 블로그 관리
// 화면에 기능을 추가할 때마다 새 RLS 정책이 필요해서 반복적으로 문제가 생겼다(2026-07-19).
// 다른 4개 블로그 프로젝트(Next.js)의 pages/api/admin/upload-image.js와 동일한 구조로,
// 여기서부터는 서비스롤 키가 RLS를 완전히 우회하므로 이 화면 쪽 기능은 앞으로 RLS 정책이
// 필요 없다. 인증은 youtube-upload-init.js와 동일하게 Supabase Auth 토큰을 검증한 뒤,
// users 테이블에서 level/role을 확인해 관리자(Lv.10 이상 또는 role='admin')인지 판별한다.
//
// ⚠️ users 테이블의 PK(id)는 Supabase Auth uid와 다른 앱 내부 텍스트 ID다(예: "moim663ls2un9").
//    Auth uid와 매칭되는 컬럼은 auth_id(uuid)이므로 반드시 auth_id로 조회해야 한다
//    (2026-07-19: id로 조회하도록 되어 있어서 관리자도 전부 401 "인증 필요"가 뜨던 버그를 수정함).
// ⚠️ Vercel 프로젝트 환경변수에 SUPABASE_SERVICE_ROLE_KEY가 반드시 있어야 한다
//    (VITE_ 접두사 없이 — VITE_ 접두사가 붙으면 Vite가 클라이언트 번들에 그대로 노출시킨다).
const { createClient } = require('@supabase/supabase-js')

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_MB = 10

async function verifyAdminAndGetClient(req) {
  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace(/^Bearer\s+/i, '')
  if (!userToken) return null

  const anonClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(userToken)
  if (authErr || !user) return null

  const serviceClient = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: rows, error: dbErr } = await serviceClient.from('users').select('level, role').eq('auth_id', user.id).limit(1)
  if (dbErr) return null
  const profile = rows?.[0]
  const isAdmin = profile?.role === 'admin' || (profile?.level || 1) >= 10
  return isAdmin ? serviceClient : null
}

module.exports = async (req, res) => {
  const serviceClient = await verifyAdminAndGetClient(req)
  if (!serviceClient) return res.status(401).json({ error: '인증 필요(관리자만 가능)' })

  if (req.method === 'POST') {
    const { base64, contentType } = req.body || {}
    if (!base64 || !contentType) return res.status(400).json({ error: 'base64/contentType 필요' })
    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ error: '이미지 파일(jpg/png/gif/webp)만 업로드할 수 있습니다.' })
    }
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length > MAX_MB * 1024 * 1024) {
      return res.status(400).json({ error: `${MAX_MB}MB 이하 파일만 업로드할 수 있습니다.` })
    }
    const ext = (contentType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `uploads/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`

    try {
      const { error: upErr } = await serviceClient.storage.from('blog-images').upload(path, buffer, { contentType, upsert: false })
      if (upErr) return res.status(500).json({ error: upErr.message })
      const { data: pub } = serviceClient.storage.from('blog-images').getPublicUrl(path)
      return res.status(200).json({ url: pub.publicUrl, path })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'DELETE') {
    const { path } = req.body || {}
    if (!path) return res.status(400).json({ error: 'path 필요' })
    try {
      const { error } = await serviceClient.storage.from('blog-images').remove([path])
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  res.status(405).end()
}
