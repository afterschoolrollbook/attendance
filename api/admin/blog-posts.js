// Vercel 서버리스 함수 — 블로그/게시판 글(blog_posts) 쓰기를 서비스롤 키로 처리한다.
// BlogWrite.jsx(게시판) / BlogAdmin.jsx(블로그 관리) / BlogAiWrite.jsx(AI 블로그 글쓰기)가
// 공통으로 사용한다. 원래는 dbCall('insert'/'update'/'delete', 'blogPosts', ...)로
// anon 키 + RLS 정책(blog_posts_write: is_admin()만 허용)에 의존했는데, blog-images.js와
// 같은 이유로 서비스롤 구조로 전환한다(2026-07-19).
// delete는 실제 DELETE가 아니라 기존 dbCall과 동일하게 _deleted=true로 소프트 삭제한다.
//
// ⚠️ Vercel 프로젝트 환경변수에 SUPABASE_SERVICE_ROLE_KEY가 반드시 있어야 한다
//    (VITE_ 접두사 없이 — VITE_ 접두사가 붙으면 Vite가 클라이언트 번들에 그대로 노출시킨다).
const { createClient } = require('@supabase/supabase-js')

async function verifyAdminAndGetClient(req) {
  const authHeader = req.headers.authorization || ''
  const userToken = authHeader.replace(/^Bearer\s+/i, '')
  if (!userToken) return null

  const anonClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(userToken)
  if (authErr || !user) return null

  const serviceClient = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: rows, error: dbErr } = await serviceClient.from('users').select('level, role').eq('id', user.id).limit(1)
  if (dbErr) return null
  const profile = rows?.[0]
  const isAdmin = profile?.role === 'admin' || (profile?.level || 1) >= 10
  return isAdmin ? serviceClient : null
}

// 클라이언트(lib/supabase.js dbCall)와 동일한 camelCase <-> snake_case 변환
function toSnake(obj) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
    result[snake] = v !== null && typeof v === 'object' && !Array.isArray(v) ? toSnake(v) : v
  }
  return result
}
function toCamel(obj) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj
  const result = {}
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = v !== null && typeof v === 'object' && !Array.isArray(v) ? toCamel(v) : v
  }
  return result
}

module.exports = async (req, res) => {
  const serviceClient = await verifyAdminAndGetClient(req)
  if (!serviceClient) return res.status(401).json({ error: '인증 필요(관리자만 가능)' })

  if (req.method === 'POST') {
    const { data } = req.body || {}
    if (!data) return res.status(400).json({ error: 'data 필요' })
    try {
      const { data: rows, error } = await serviceClient.from('blog_posts').insert(toSnake(data)).select()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ row: rows?.[0] ? toCamel(rows[0]) : null })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'PUT') {
    const { id, patch } = req.body || {}
    if (!id || !patch) return res.status(400).json({ error: 'id/patch 필요' })
    try {
      const { data: rows, error } = await serviceClient.from('blog_posts').update(toSnake(patch)).eq('id', id).select()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ row: rows?.[0] ? toCamel(rows[0]) : null })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id 필요' })
    try {
      const { error } = await serviceClient.from('blog_posts').update({ _deleted: true, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ deleted: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  res.status(405).end()
}
