// Vercel 서버리스 함수 — 쿠팡상품(coupang_products / coupang_product_categories) 쓰기를
// 서비스롤 키로 처리한다. CoupangProducts.jsx(쿠팡상품 — 블로그 글 등에 수동으로 붙여넣을
// 상품 카탈로그)에서 사용. 원래는 supabase 클라이언트로 anon 키 + RLS 정책에 의존했는데,
// blog-images.js/blog-posts.js와 같은 이유로 서비스롤 구조로 전환한다(2026-07-19).
// 두 테이블 다 _deleted 컬럼이 없어 실제 DELETE를 쓴다(dbCall의 소프트 삭제와 다름 —
// 원래 코드도 supabase.from(...).delete()로 실제 삭제였다).
//
// ⚠️ users 테이블의 PK(id)는 Supabase Auth uid와 다른 앱 내부 텍스트 ID다(예: "moim663ls2un9").
//    Auth uid와 매칭되는 컬럼은 auth_id(uuid)이므로 반드시 auth_id로 조회해야 한다
//    (2026-07-19: id로 조회하도록 되어 있어서 관리자도 전부 401 "인증 필요"가 뜨던 버그를 수정함).
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
  const { data: rows, error: dbErr } = await serviceClient.from('users').select('level, role').eq('auth_id', user.id).limit(1)
  if (dbErr) return null
  const profile = rows?.[0]
  const isAdmin = profile?.role === 'admin' || (profile?.level || 1) >= 10
  return isAdmin ? serviceClient : null
}

const TABLES = { category: 'coupang_product_categories', product: 'coupang_products' }

module.exports = async (req, res) => {
  const serviceClient = await verifyAdminAndGetClient(req)
  if (!serviceClient) return res.status(401).json({ error: '인증 필요(관리자만 가능)' })

  const { resource } = req.body || {}
  const table = TABLES[resource]
  if (!table) return res.status(400).json({ error: 'resource는 category 또는 product여야 합니다' })

  if (req.method === 'POST') {
    const { data } = req.body || {}
    if (!data) return res.status(400).json({ error: 'data 필요' })
    try {
      const { data: rows, error } = await serviceClient.from(table).insert(data).select()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ row: rows?.[0] || null })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'PUT') {
    const { id, patch } = req.body || {}
    if (!id || !patch) return res.status(400).json({ error: 'id/patch 필요' })
    try {
      const { data: rows, error } = await serviceClient.from(table).update(patch).eq('id', id).select()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ row: rows?.[0] || null })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id 필요' })
    try {
      const { error } = await serviceClient.from(table).delete().eq('id', id)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ deleted: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  res.status(405).end()
}
