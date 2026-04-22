import React, { useState, useEffect } from 'react'
import { dbCall } from '../lib/supabase.js'

// ── 간단한 마크다운 → HTML 변환기 (외부 라이브러리 없이)
function parseMarkdown(md) {
  if (!md) return ''
  let html = md
    // 코드블록
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // 인라인 코드
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // h1~h3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // bold, italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 링크
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // 이미지
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:8px 0">')
    // 수평선
    .replace(/^---$/gm, '<hr>')
    // 순서없는 목록
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    // 순서있는 목록
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 인용
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // 줄바꿈 → p 태그
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      if (/^<(h[1-3]|ul|ol|li|pre|blockquote|hr)/.test(p)) return p
      return `<p>${p.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')
  return html
}

const mdStyles = `
  .md-body { line-height: 1.8; color: #1f2937; font-size: 16px; }
  .md-body h1 { font-size: 28px; font-weight: 800; margin: 32px 0 16px; color: #111827; }
  .md-body h2 { font-size: 22px; font-weight: 700; margin: 28px 0 12px; color: #1f2937; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; }
  .md-body h3 { font-size: 18px; font-weight: 700; margin: 20px 0 10px; color: #374151; }
  .md-body p  { margin: 12px 0; }
  .md-body ul, .md-body ol { padding-left: 24px; margin: 12px 0; }
  .md-body li { margin: 6px 0; }
  .md-body strong { font-weight: 700; color: #111827; }
  .md-body em { font-style: italic; }
  .md-body code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 14px; font-family: monospace; color: #e11d48; }
  .md-body pre { background: #1f2937; color: #f9fafb; padding: 16px 20px; border-radius: 10px; overflow-x: auto; margin: 16px 0; }
  .md-body pre code { background: none; color: inherit; padding: 0; font-size: 14px; }
  .md-body blockquote { border-left: 4px solid #f97316; padding: 10px 16px; background: #fff7ed; margin: 16px 0; border-radius: 0 8px 8px 0; color: #92400e; font-style: italic; }
  .md-body a { color: #f97316; text-decoration: underline; }
  .md-body hr { border: none; border-top: 2px solid #f3f4f6; margin: 24px 0; }
  .md-body img { max-width: 100%; border-radius: 8px; margin: 8px 0; }
`

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`
}

// ── SEO 메타태그 설정
function setMeta(title, desc, url, image) {
  document.title = title
  const set = (sel, attr, val) => {
    let el = document.querySelector(sel)
    if (!el) { el = document.createElement('meta'); document.head.appendChild(el) }
    el.setAttribute(attr, val)
  }
  set('meta[name="description"]', 'content', desc)
  set('meta[property="og:title"]', 'content', title)
  set('meta[property="og:description"]', 'content', desc)
  set('meta[property="og:url"]', 'content', url)
  set('meta[property="og:type"]', 'content', 'article')
  if (image) set('meta[property="og:image"]', 'content', image)
  // canonical
  let canonical = document.querySelector('link[rel="canonical"]')
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
  canonical.href = url
}

// ── 블로그 목록
function BlogList({ posts, onSelect }) {
  const categories = ['전체', ...new Set(posts.map(p => p.category).filter(Boolean))]
  const [selCat, setSelCat] = useState('전체')
  const filtered = selCat === '전체' ? posts : posts.filter(p => p.category === selCat)

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
      <style>{mdStyles}</style>

      {/* 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f97316', letterSpacing: '2px', marginBottom: '12px' }}>BLOG</div>
        <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#111827', marginBottom: '16px' }}>방과후 출석부 블로그</h1>
        <p style={{ fontSize: '17px', color: '#6b7280', lineHeight: 1.7 }}>
          방과후 강사를 위한 출석 관리, 교구 관리, 업무 효율화 팁을 공유합니다.
        </p>
      </div>

      {/* 카테고리 필터 */}
      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '32px', justifyContent: 'center' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelCat(cat)}
              style={{ padding: '6px 18px', borderRadius: '999px', border: `2px solid ${selCat===cat?'#f97316':'#e5e7eb'}`, background: selCat===cat?'#f97316':'#fff', color: selCat===cat?'#fff':'#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all .15s' }}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 글 목록 */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
          <div style={{ fontSize: '16px' }}>아직 게시글이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '24px' }}>
          {filtered.map(post => (
            <article key={post.id}
              onClick={() => onSelect(post)}
              style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', cursor: 'pointer', transition: 'all .2s', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform='translateY(0)' }}>
              {post.coverImage && (
                <img src={post.coverImage} alt={post.title}
                  style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
              )}
              <div style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  {post.category && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '999px', padding: '3px 10px' }}>
                      {post.category}
                    </span>
                  )}
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '10px', lineHeight: 1.4 }}>{post.title}</h2>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {post.summary || post.content?.replace(/[#*`>\-]/g, '').slice(0, 120) + '...'}
                </p>
                <div style={{ marginTop: '16px', fontSize: '13px', fontWeight: 600, color: '#f97316' }}>더 읽기 →</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 블로그 상세
function BlogDetail({ post, onBack }) {
  useEffect(() => {
    const url = `${window.location.origin}/blog/${post.slug || post.id}`
    const desc = post.summary || post.content?.replace(/[#*`>\-]/g, '').slice(0, 160) || ''
    setMeta(`${post.title} | 방과후 출석부 블로그`, desc, url, post.coverImage)
    window.scrollTo(0, 0)
    return () => {
      setMeta('방과후 출석부 블로그', '방과후 강사를 위한 출석 관리 팁', `${window.location.origin}/blog`)
    }
  }, [post])

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '40px 20px' }}>
      <style>{mdStyles}</style>

      {/* 뒤로가기 */}
      <button onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '32px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', padding: 0 }}>
        ← 목록으로
      </button>

      {/* 커버 이미지 */}
      {post.coverImage && (
        <img src={post.coverImage} alt={post.title}
          style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '16px', marginBottom: '32px' }} />
      )}

      {/* 메타 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {post.category && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f97316', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '999px', padding: '4px 12px' }}>
            {post.category}
          </span>
        )}
        <span style={{ fontSize: '13px', color: '#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
        {post.author && <span style={{ fontSize: '13px', color: '#9ca3af' }}>· {post.author}</span>}
      </div>

      {/* 제목 */}
      <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#111827', lineHeight: 1.4, marginBottom: '24px' }}>{post.title}</h1>

      {/* 요약 */}
      {post.summary && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '16px 20px', marginBottom: '32px', fontSize: '15px', color: '#92400e', lineHeight: 1.7 }}>
          {post.summary}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '2px solid #f3f4f6', marginBottom: '32px' }} />

      {/* 본문 */}
      <div className="md-body"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(post.content) }} />

      {/* 태그 */}
      {post.tags && post.tags.length > 0 && (
        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '2px solid #f3f4f6', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {post.tags.map(tag => (
            <span key={tag} style={{ fontSize: '12px', background: '#f3f4f6', color: '#374151', borderRadius: '999px', padding: '4px 12px', fontWeight: 600 }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <div style={{ marginTop: '48px', background: 'linear-gradient(135deg,#fff7ed,#fff)', border: '2px solid #fed7aa', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>📋</div>
        <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>방과후 출석부를 무료로 시작하세요</h3>
        <p style={{ fontSize: '14px', color: '#b45309', marginBottom: '20px', lineHeight: 1.7 }}>
          출석 관리, 교구 관리, 학부모 알림까지 — 방과후 강사를 위한 올인원 솔루션
        </p>
        <a href="/" style={{ display: 'inline-block', padding: '12px 32px', background: '#f97316', color: '#fff', borderRadius: '10px', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}>
          무료로 시작하기 →
        </a>
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <button onClick={onBack}
          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px', color: '#6b7280', fontFamily: 'Noto Sans KR, sans-serif' }}>
          ← 목록으로 돌아가기
        </button>
      </div>
    </div>
  )
}

// ── 메인 Blog 컴포넌트
export function Blog() {
  const [posts, setPosts] = useState([])
  const [selPost, setSelPost] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // SEO 메타 기본값
    setMeta(
      '방과후 출석부 블로그 | 방과후 강사 출석 관리 팁',
      '방과후 강사를 위한 출석 관리, 교구 관리, 업무 효율화 팁을 공유하는 블로그입니다.',
      `${window.location.origin}/blog`
    )
    loadPosts()

    // URL에서 슬러그 감지
    const path = window.location.pathname
    const match = path.match(/^\/blog\/(.+)$/)
    if (match) {
      const slug = match[1]
      loadPostBySlug(slug)
    }
  }, [])

  const loadPosts = async () => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const published = (rows || [])
        .filter(p => p.status === 'published')
        .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt))
      setPosts(published)
    } catch (e) {
      console.error('블로그 로드 실패:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadPostBySlug = async (slug) => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const post = (rows || []).find(p => p.slug === slug || p.id === slug)
      if (post) setSelPost(post)
    } catch {}
  }

  const handleSelect = (post) => {
    setSelPost(post)
    const slug = post.slug || post.id
    window.history.pushState({ blogPostId: post.id }, '', `/blog/${slug}`)
  }

  const handleBack = () => {
    setSelPost(null)
    window.history.pushState({}, '', '/blog')
  }

  // 네비게이션 바
  const Nav = () => (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <span style={{ fontSize: '20px' }}>📋</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>방과후 출석부</span>
          <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '4px' }}>블로그</span>
        </a>
        <a href="/" style={{ padding: '7px 18px', background: '#f97316', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
          앱 시작하기 →
        </a>
      </div>
    </nav>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📝</div>
        <div style={{ color: '#9ca3af' }}>로딩 중...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'Noto Sans KR, sans-serif' }}>
      <Nav />
      {selPost
        ? <BlogDetail post={selPost} onBack={handleBack} />
        : <BlogList posts={posts} onSelect={handleSelect} />
      }
      {/* 푸터 */}
      <footer style={{ borderTop: '1px solid #e5e7eb', padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', background: '#fff' }}>
        <div style={{ marginBottom: '8px' }}>📋 방과후 출석부 — 방과후 강사를 위한 스마트 출석 관리</div>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <a href="/terms" style={{ color: '#9ca3af', textDecoration: 'none' }}>이용약관</a>
          <a href="/privacy" style={{ color: '#9ca3af', textDecoration: 'none' }}>개인정보처리방침</a>
          <a href="/" style={{ color: '#9ca3af', textDecoration: 'none' }}>앱으로 이동</a>
        </div>
      </footer>
    </div>
  )
}
