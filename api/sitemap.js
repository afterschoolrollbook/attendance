// Vercel 서버리스 함수 — 블로그 글을 Supabase에서 가져와 sitemap.xml 동적 생성
const { createClient } = require('@supabase/supabase-js')

const DOMAIN = 'https://afterschoolrollbook.kr'

// 고정 페이지 목록
const STATIC_PAGES = [
  { url: '/',           priority: '1.0', changefreq: 'weekly'  },
  { url: '/blog',       priority: '0.9', changefreq: 'daily'   },
  { url: '/docs',       priority: '0.8', changefreq: 'weekly'  },
  { url: '/templates',  priority: '0.8', changefreq: 'weekly'  },
  { url: '/reviews',    priority: '0.7', changefreq: 'weekly'  },
]

function escapeXml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function toW3Date(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0]
  return new Date(dateStr).toISOString().split('T')[0]
}

module.exports = async (req, res) => {
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )

    // 발행된 블로그 글 전체 가져오기
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, id, type, board_type, published_at, updated_at, created_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })

    const blogPosts = (posts || []).filter(p => {
      const type = p.type || 'blog'
      const boardType = p.board_type || type
      return type !== 'docs' && type !== 'template' && type !== 'secret'
        && boardType !== 'secret' && boardType !== 'review' && boardType !== 'request'
    })
    const docsPosts  = (posts || []).filter(p => p.type === 'docs')
    const templates  = (posts || []).filter(p => p.type === 'template')

    const urlset = [
      // 고정 페이지
      ...STATIC_PAGES.map(p => `
  <url>
    <loc>${DOMAIN}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`),

      // 블로그 글
      ...blogPosts.map(p => `
  <url>
    <loc>${DOMAIN}/blog/${escapeXml(p.slug || p.id)}</loc>
    <lastmod>${toW3Date(p.updated_at || p.published_at || p.created_at)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`),

      // 설명서
      ...docsPosts.map(p => `
  <url>
    <loc>${DOMAIN}/docs/${escapeXml(p.slug || p.id)}</loc>
    <lastmod>${toW3Date(p.updated_at || p.published_at || p.created_at)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`),

      // 템플릿
      ...templates.map(p => `
  <url>
    <loc>${DOMAIN}/templates/${escapeXml(p.slug || p.id)}</loc>
    <lastmod>${toW3Date(p.updated_at || p.published_at || p.created_at)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`),
    ].join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlset}
</urlset>`

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate') // 1시간 캐시
    res.status(200).send(xml)

  } catch (err) {
    console.error('[sitemap] 오류:', err)
    res.status(500).send('sitemap 생성 실패')
  }
}
