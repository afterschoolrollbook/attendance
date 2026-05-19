function sanitizeHtml(html) {
  if (typeof window !== 'undefined' && window.DOMPurify) {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','b','strong','i','em','u','h1','h2','h3','ul','ol','li',
        'blockquote','code','pre','hr','a','img'],
      ALLOWED_ATTR: ['href','src','alt','target','rel'],
      ALLOW_DATA_ATTR: false,
    })
  }
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
}

import React, { useState, useEffect } from 'react'
import { dbCall } from '../lib/supabase.js'
import { Users } from '../lib/db.js'
import { verifyPassword } from '../lib/crypto.js'
import { BlogAdmin } from './BlogAdmin.jsx'

// ── 마크다운 파서
// replaced
function _OLD_sanitizeHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/javascript\s*:/gi, '')
}

function parseMarkdown(md) {
  if (!md) return ''
  const html = md
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:8px 0">')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .split('\n\n').map(p => p.trim()).filter(Boolean)
    .map(p => /^<(h[1-3]|ul|ol|li|pre|blockquote|hr)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return sanitizeHtml(html)
}

const globalStyles = `
  .md-body { line-height:1.8; color:#1f2937; font-size:16px; }
  .md-body h1 { font-size:28px; font-weight:800; margin:32px 0 16px; color:#111827; }
  .md-body h2 { font-size:22px; font-weight:700; margin:28px 0 12px; color:#1f2937; border-bottom:2px solid #f3f4f6; padding-bottom:8px; }
  .md-body h3 { font-size:18px; font-weight:700; margin:20px 0 10px; color:#374151; }
  .md-body p  { margin:12px 0; }
  .md-body ul, .md-body ol { padding-left:24px; margin:12px 0; }
  .md-body li { margin:6px 0; }
  .md-body strong { font-weight:700; color:#111827; }
  .md-body em { font-style:italic; }
  .md-body code { background:#f3f4f6; padding:2px 6px; border-radius:4px; font-size:14px; font-family:monospace; color:#e11d48; }
  .md-body pre { background:#1f2937; color:#f9fafb; padding:16px 20px; border-radius:10px; overflow-x:auto; margin:16px 0; }
  .md-body pre code { background:none; color:inherit; padding:0; font-size:14px; }
  .md-body blockquote { border-left:4px solid #f97316; padding:10px 16px; background:#fff7ed; margin:16px 0; border-radius:0 8px 8px 0; color:#92400e; font-style:italic; }
  .md-body a { color:#f97316; text-decoration:underline; }
  .md-body hr { border:none; border-top:2px solid #f3f4f6; margin:24px 0; }
  .md-body img { max-width:100%; border-radius:8px; margin:8px 0; }
  .blog-side-ad { display:none; }
  @media (min-width:1200px) { .blog-side-ad { display:block; } }
`

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`
}

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
  if (image) set('meta[property="og:image"]', 'content', image)
  let canonical = document.querySelector('link[rel="canonical"]')
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
  canonical.href = url
}

// ── 애드센스 (승인 전 플레이스홀더)
function AdSense({ slot, label = '광고', style = {} }) {
  const isApproved = false // 애드센스 승인 후 true로 변경
  useEffect(() => {
    if (!isApproved) return
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch {}
  }, [])
  if (!isApproved) return (
    <div style={{ background:'#f9fafb', border:'2px dashed #e5e7eb', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'4px', minHeight:'90px', color:'#d1d5db', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', ...style }}>
      <span style={{ fontSize:'18px' }}>📢</span>
      <span>{label}</span>
    </div>
  )
  return (
    <div style={{ textAlign:'center', ...style }}>
      <ins className="adsbygoogle" style={{ display:'block' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot={slot}
        data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  )
}

// ── 검색바
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div style={{ position:'relative', maxWidth:'480px', width:'100%' }}>
      <span style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', fontSize:'16px' }}>🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', padding:'10px 36px 10px 38px', borderRadius:'10px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', boxSizing:'border-box' }} />
      {value && (
        <button onClick={() => onChange('')} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'18px', lineHeight:1 }}>×</button>
      )}
    </div>
  )
}

// ── 블로그 목록
function BlogList({ posts, onSelect }) {
  const [search, setSearch] = useState('')
  const [selCat, setSelCat] = useState('전체')
  const categories = ['전체', ...new Set(posts.map(p => p.category).filter(Boolean))]
  const filtered = posts.filter(p => {
    const matchCat = selCat === '전체' || p.category === selCat
    const q = search.toLowerCase()
    const matchSearch = !q || p.title?.toLowerCase().includes(q) || p.summary?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  return (
    <div style={{ maxWidth:'900px', margin:'0 auto', padding:'40px 20px' }}>
      <div style={{ textAlign:'center', marginBottom:'40px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#f97316', letterSpacing:'2px', marginBottom:'12px' }}>BLOG</div>
        <h1 style={{ fontSize:'34px', fontWeight:800, color:'#111827', marginBottom:'14px' }}>방과후 출석부 블로그</h1>
        <p style={{ fontSize:'16px', color:'#6b7280', lineHeight:1.7 }}>방과후 강사를 위한 출석 관리, 교구 관리, 업무 효율화 팁을 공유합니다.</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', marginBottom:'36px' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="글 제목, 내용으로 검색..." />
        {categories.length > 1 && (
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center' }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelCat(cat)}
                style={{ padding:'6px 18px', borderRadius:'999px', border:`2px solid ${selCat===cat?'#f97316':'#e5e7eb'}`, background:selCat===cat?'#f97316':'#fff', color:selCat===cat?'#fff':'#374151', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>
      {search && <div style={{ fontSize:'13px', color:'#6b7280', marginBottom:'16px' }}>"<strong>{search}</strong>" 검색 결과 {filtered.length}개</div>}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>📝</div>
          <div>{search ? '검색 결과가 없습니다.' : '아직 게시글이 없습니다.'}</div>
        </div>
      ) : (
        <div style={{ display:'grid', gap:'24px' }}>
          {filtered.map(post => (
            <article key={post.id} onClick={() => onSelect(post)}
              style={{ background:'#fff', borderRadius:'16px', border:'1px solid #e5e7eb', overflow:'hidden', cursor:'pointer', transition:'all .2s', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform='translateY(0)' }}>
              {post.coverImage && <img src={post.coverImage} alt={post.title} style={{ width:'100%', height:'200px', objectFit:'cover' }} />}
              <div style={{ padding:'24px 28px' }}>
                <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap', alignItems:'center' }}>
                  {post.category && <span style={{ fontSize:'11px', fontWeight:700, color:'#f97316', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'999px', padding:'3px 10px' }}>{post.category}</span>}
                  <span style={{ fontSize:'12px', color:'#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
                </div>
                <h2 style={{ fontSize:'20px', fontWeight:700, color:'#111827', marginBottom:'10px', lineHeight:1.4 }}>{post.title}</h2>
                <p style={{ fontSize:'14px', color:'#6b7280', lineHeight:1.7, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {post.summary || post.content?.replace(/[#*`>\-]/g, '').slice(0, 120) + '...'}
                </p>
                <div style={{ marginTop:'16px', fontSize:'13px', fontWeight:600, color:'#f97316' }}>더 읽기 →</div>
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
    setMeta(`${post.title} | 방과후 출석부 블로그`, post.summary || post.content?.replace(/[#*`>\-]/g, '').slice(0, 160) || '', `${window.location.origin}/blog/${post.slug||post.id}`, post.coverImage)
    window.scrollTo(0, 0)
    return () => setMeta('방과후 출석부 블로그', '방과후 강사를 위한 출석 관리 팁', `${window.location.origin}/blog`)
  }, [post])

  return (
    <div style={{ maxWidth:'780px', margin:'0 auto', padding:'40px 20px' }}>
      <button onClick={onBack} style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginBottom:'32px', background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', padding:0 }}>← 목록으로</button>
      {post.coverImage && <img src={post.coverImage} alt={post.title} style={{ width:'100%', maxHeight:'400px', objectFit:'cover', borderRadius:'16px', marginBottom:'32px' }} />}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        {post.category && <span style={{ fontSize:'12px', fontWeight:700, color:'#f97316', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'999px', padding:'4px 12px' }}>{post.category}</span>}
        <span style={{ fontSize:'13px', color:'#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
        {post.author && <span style={{ fontSize:'13px', color:'#9ca3af' }}>· {post.author}</span>}
      </div>
      <h1 style={{ fontSize:'32px', fontWeight:800, color:'#111827', lineHeight:1.4, marginBottom:'24px' }}>{post.title}</h1>
      {post.summary && <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'10px', padding:'16px 20px', marginBottom:'32px', fontSize:'15px', color:'#92400e', lineHeight:1.7 }}>{post.summary}</div>}
      <hr style={{ border:'none', borderTop:'2px solid #f3f4f6', marginBottom:'32px' }} />
      <div className="md-body" dangerouslySetInnerHTML={{ __html: parseMarkdown(post.content) }} />
      {post.tags?.length > 0 && (
        <div style={{ marginTop:'40px', paddingTop:'24px', borderTop:'2px solid #f3f4f6', display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {post.tags.map(tag => <span key={tag} style={{ fontSize:'12px', background:'#f3f4f6', color:'#374151', borderRadius:'999px', padding:'4px 12px', fontWeight:600 }}>#{tag}</span>)}
        </div>
      )}
      {/* 설명서 유도 */}
      <div style={{ marginTop:'40px', background:'#eff6ff', border:'2px solid #bfdbfe', borderRadius:'14px', padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ fontSize:'15px', fontWeight:700, color:'#1e40af', marginBottom:'4px' }}>📖 사용 설명서 보기</div>
          <div style={{ fontSize:'13px', color:'#3b82f6' }}>자세한 기능 사용법이 궁금하다면 설명서를 확인해보세요</div>
        </div>
        <a href="/docs" style={{ padding:'9px 20px', background:'#3b82f6', color:'#fff', borderRadius:'9px', fontSize:'13px', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>설명서 보러가기 →</a>
      </div>
      {/* CTA */}
      <div style={{ marginTop:'24px', background:'linear-gradient(135deg,#fff7ed,#fff)', border:'2px solid #fed7aa', borderRadius:'16px', padding:'32px', textAlign:'center' }}>
        <div style={{ fontSize:'24px', marginBottom:'12px' }}>📋</div>
        <h3 style={{ fontSize:'20px', fontWeight:700, color:'#92400e', marginBottom:'8px' }}>방과후 출석부를 무료로 시작하세요</h3>
        <p style={{ fontSize:'14px', color:'#b45309', marginBottom:'20px', lineHeight:1.7 }}>출석 관리, 교구 관리, 학부모 알림까지 — 방과후 강사를 위한 올인원 솔루션</p>
        <a href="/" style={{ display:'inline-block', padding:'12px 32px', background:'#f97316', color:'#fff', borderRadius:'10px', fontWeight:700, fontSize:'15px', textDecoration:'none' }}>무료로 시작하기 →</a>
      </div>
      <div style={{ marginTop:'24px', textAlign:'center' }}>
        <button onClick={onBack} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 24px', cursor:'pointer', fontSize:'14px', color:'#6b7280', fontFamily:'Noto Sans KR, sans-serif' }}>← 목록으로 돌아가기</button>
      </div>
    </div>
  )
}

// ── 설명서 목록
function DocsList({ docs, onSelect }) {
  const [search, setSearch] = useState('')
  const chapters = [...new Set(docs.map(d => d.category).filter(Boolean))]
  const filtered = docs.filter(d => {
    const q = search.toLowerCase()
    return !q || d.title?.toLowerCase().includes(q) || d.summary?.toLowerCase().includes(q) || d.content?.toLowerCase().includes(q)
  })
  const grouped = chapters.reduce((acc, ch) => { acc[ch] = filtered.filter(d => d.category === ch); return acc }, {})
  const uncategorized = filtered.filter(d => !d.category)

  return (
    <div style={{ maxWidth:'900px', margin:'0 auto', padding:'40px 20px' }}>
      <div style={{ textAlign:'center', marginBottom:'40px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#3b82f6', letterSpacing:'2px', marginBottom:'12px' }}>DOCS</div>
        <h1 style={{ fontSize:'34px', fontWeight:800, color:'#111827', marginBottom:'14px' }}>사용 설명서</h1>
        <p style={{ fontSize:'16px', color:'#6b7280', lineHeight:1.7 }}>방과후 출석부의 모든 기능을 자세히 안내합니다.</p>
      </div>
      <div style={{ display:'flex', justifyContent:'center', marginBottom:'36px' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="기능, 설명 검색..." />
      </div>
      {search && <div style={{ fontSize:'13px', color:'#6b7280', marginBottom:'16px' }}>"<strong>{search}</strong>" 검색 결과 {filtered.length}개</div>}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>📖</div>
          <div>{search ? '검색 결과가 없습니다.' : '아직 설명서가 없습니다.'}</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'32px' }}>
          {chapters.map(ch => grouped[ch]?.length > 0 && (
            <div key={ch}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', paddingBottom:'10px', borderBottom:'2px solid #eff6ff' }}>
                <span style={{ fontSize:'18px' }}>📂</span>
                <h2 style={{ fontSize:'18px', fontWeight:700, color:'#1e40af' }}>{ch}</h2>
                <span style={{ fontSize:'12px', color:'#93c5fd', background:'#eff6ff', borderRadius:'999px', padding:'2px 10px' }}>{grouped[ch].length}개</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'14px' }}>
                {grouped[ch].map(doc => (
                  <div key={doc.id} onClick={() => onSelect(doc)}
                    style={{ background:'#fff', borderRadius:'12px', border:'1.5px solid #e5e7eb', padding:'18px 20px', cursor:'pointer', transition:'all .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#3b82f6'; e.currentTarget.style.boxShadow='0 4px 16px rgba(59,130,246,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.boxShadow='none' }}>
                    <div style={{ fontSize:'15px', fontWeight:700, color:'#111827', marginBottom:'6px' }}>{doc.title}</div>
                    <div style={{ fontSize:'13px', color:'#6b7280', lineHeight:1.6, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {doc.summary || doc.content?.replace(/[#*`>\-]/g, '').slice(0, 80)}
                    </div>
                    <div style={{ marginTop:'10px', fontSize:'12px', fontWeight:600, color:'#3b82f6' }}>읽어보기 →</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div>
              <div style={{ fontSize:'16px', fontWeight:700, color:'#374151', marginBottom:'14px' }}>기타</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'14px' }}>
                {uncategorized.map(doc => (
                  <div key={doc.id} onClick={() => onSelect(doc)}
                    style={{ background:'#fff', borderRadius:'12px', border:'1.5px solid #e5e7eb', padding:'18px 20px', cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#3b82f6'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#e5e7eb'}>
                    <div style={{ fontSize:'15px', fontWeight:700, color:'#111827', marginBottom:'6px' }}>{doc.title}</div>
                    <div style={{ fontSize:'13px', color:'#6b7280', lineHeight:1.6 }}>{doc.summary || doc.content?.replace(/[#*`>\-]/g, '').slice(0, 80)}</div>
                    <div style={{ marginTop:'10px', fontSize:'12px', fontWeight:600, color:'#3b82f6' }}>읽어보기 →</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 설명서 상세 (왼쪽 목차 + 오른쪽 본문)
function DocsDetail({ doc, allDocs, onBack, onSelect }) {
  const chapters = [...new Set(allDocs.map(d => d.category).filter(Boolean))]

  useEffect(() => {
    setMeta(`${doc.title} | 방과후 출석부 설명서`, doc.summary || '', `${window.location.origin}/docs/${doc.slug||doc.id}`)
    window.scrollTo(0, 0)
  }, [doc])

  return (
    <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'32px 20px', display:'grid', gridTemplateColumns:'220px 1fr', gap:'28px', alignItems:'start' }}>
      {/* 왼쪽 목차 */}
      <div style={{ position:'sticky', top:'80px', background:'#fff', borderRadius:'12px', border:'1px solid #e5e7eb', padding:'16px', maxHeight:'80vh', overflowY:'auto' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'16px', background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', padding:0 }}>← 목록</button>
        <div style={{ fontSize:'11px', fontWeight:700, color:'#9ca3af', letterSpacing:'1px', marginBottom:'12px' }}>목차</div>
        {chapters.map(ch => (
          <div key={ch} style={{ marginBottom:'16px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:'#3b82f6', marginBottom:'6px', textTransform:'uppercase' }}>{ch}</div>
            {allDocs.filter(d => d.category === ch).map(d => (
              <div key={d.id} onClick={() => onSelect(d)}
                style={{ padding:'6px 10px', borderRadius:'6px', fontSize:'13px', cursor:'pointer', color:d.id===doc.id?'#1e40af':'#374151', background:d.id===doc.id?'#eff6ff':'transparent', fontWeight:d.id===doc.id?700:400, marginBottom:'2px', transition:'background .1s' }}
                onMouseEnter={e => { if (d.id!==doc.id) e.currentTarget.style.background='#f9fafb' }}
                onMouseLeave={e => { if (d.id!==doc.id) e.currentTarget.style.background='transparent' }}>
                {d.title}
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* 오른쪽 본문 */}
      <div>
        <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
          {doc.category && <span style={{ fontSize:'12px', fontWeight:700, color:'#3b82f6', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'999px', padding:'4px 12px' }}>{doc.category}</span>}
          <span style={{ fontSize:'13px', color:'#9ca3af' }}>{formatDate(doc.publishedAt || doc.createdAt)}</span>
        </div>
        <h1 style={{ fontSize:'30px', fontWeight:800, color:'#111827', lineHeight:1.4, marginBottom:'24px' }}>{doc.title}</h1>
        {doc.summary && <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'10px', padding:'16px 20px', marginBottom:'28px', fontSize:'15px', color:'#1e40af', lineHeight:1.7 }}>{doc.summary}</div>}
        <hr style={{ border:'none', borderTop:'2px solid #f3f4f6', marginBottom:'28px' }} />
        <div className="md-body" dangerouslySetInnerHTML={{ __html: parseMarkdown(doc.content) }} />
        {/* 블로그 유도 */}
        <div style={{ marginTop:'40px', background:'#fff7ed', border:'2px solid #fed7aa', borderRadius:'14px', padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
          <div>
            <div style={{ fontSize:'15px', fontWeight:700, color:'#92400e', marginBottom:'4px' }}>📝 블로그도 구경해보세요</div>
            <div style={{ fontSize:'13px', color:'#b45309' }}>방과후 강사를 위한 다양한 팁과 소식을 공유합니다</div>
          </div>
          <a href="/blog" style={{ padding:'9px 20px', background:'#f97316', color:'#fff', borderRadius:'9px', fontSize:'13px', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>블로그 보러가기 →</a>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트
export function Blog() {
  const [allPosts, setAllPosts] = useState([])
  const [tab, setTab] = useState('blog')
  const [selPost, setSelPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [adminUser, setAdminUser] = useState(null)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [loginForm, setLoginForm] = useState({ email:'', pw:'' })
  const [loginError, setLoginError] = useState('')
  const [blogAdminMode, setBlogAdminMode] = useState(false)

  const blogPosts = allPosts.filter(p => p.type !== 'docs')
  const docsPosts = allPosts.filter(p => p.type === 'docs')

  useEffect(() => {
    const path = window.location.pathname
    if (path.startsWith('/docs')) { setTab('docs'); const slug = path.match(/^\/docs\/(.+)$/)?.[1]; if (slug) loadPostBySlug(slug) }
    else { setTab('blog'); const slug = path.match(/^\/blog\/(.+)$/)?.[1]; if (slug) loadPostBySlug(slug) }
    setMeta('방과후 출석부 블로그', '방과후 강사를 위한 출석 관리 팁', `${window.location.origin}/blog`)
    loadPosts()
  }, [])

  const loadPosts = async () => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const published = (rows||[]).filter(p => p.status==='published').sort((a,b) => new Date(b.publishedAt||b.createdAt) - new Date(a.publishedAt||a.createdAt))
      setAllPosts(published)
    } catch {}
    finally { setLoading(false) }
  }

  const loadPostBySlug = async (slug) => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const post = (rows||[]).find(p => p.slug===slug || p.id===slug)
      if (post) setSelPost(post)
    } catch {}
  }

  const handleSelect = (post) => {
    setSelPost(post)
    window.history.pushState({}, '', `/${post.type==='docs'?'docs':'blog'}/${post.slug||post.id}`)
  }

  const handleBack = () => {
    setSelPost(null)
    window.history.pushState({}, '', tab==='docs' ? '/docs' : '/blog')
  }

  const handleAdminLogin = async () => {
    setLoginError('')
    const user = Users.findByEmail(loginForm.email.trim().toLowerCase())
    const ok = user ? await verifyPassword(loginForm.pw, user.pw) : false
    if (!user || !ok) { setLoginError('이메일 또는 비밀번호가 올바르지 않습니다.'); return }
    if (user.level < 5) { setLoginError('관리자 권한이 없습니다.'); return }
    // 세션 저장 후 앱 관리자 페이지로 이동
    sessionStorage.setItem('asa_user', JSON.stringify(user))
    window.location.href = '/?page=blog_admin'
  }

  const switchTab = (t) => { setTab(t); setSelPost(null); window.history.pushState({}, '', `/${t}`) }

  const Nav = () => (
    <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(255,255,255,0.95)', backdropFilter:'blur(8px)', borderBottom:'1px solid #e5e7eb', padding:'0 24px' }}>
      <div style={{ maxWidth:'1100px', margin:'0 auto', height:'56px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'20px' }}>
          <a href="/" style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none' }}>
            <span style={{ fontSize:'20px' }}>📋</span>
            <span style={{ fontSize:'15px', fontWeight:700, color:'#111827' }}>방과후 출석부</span>
          </a>
          {!blogAdminMode && (
            <div style={{ display:'flex', gap:'2px' }}>
              {[['blog','📝 블로그','#f97316'],['docs','📖 설명서','#3b82f6']].map(([key,label,color]) => (
                <button key={key} onClick={() => switchTab(key)}
                  style={{ padding:'6px 16px', borderRadius:'8px', border:'none', background:tab===key&&!selPost?`${color}18`:'transparent', color:tab===key&&!selPost?color:'#6b7280', fontSize:'14px', fontWeight:tab===key&&!selPost?700:500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {adminUser ? (
            <button onClick={() => setBlogAdminMode(v => !v)}
              style={{ padding:'7px 16px', background:blogAdminMode?'#1f2937':'#f97316', color:'#fff', borderRadius:'8px', fontSize:'13px', fontWeight:700, border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              {blogAdminMode ? '← 블로그' : '✏️ 글관리'}
            </button>
          ) : (
            <button onClick={() => setShowAdminLogin(true)}
              style={{ padding:'7px 16px', background:'none', border:'1px solid #e5e7eb', color:'#6b7280', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              관리자
            </button>
          )}
          <a href="/" style={{ padding:'7px 18px', background:'#f97316', color:'#fff', borderRadius:'8px', fontSize:'13px', fontWeight:700, textDecoration:'none' }}>앱 시작하기 →</a>
        </div>
      </div>
    </nav>
  )

  const AdminLoginModal = () => (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
      onClick={e => { if (e.target===e.currentTarget) { setShowAdminLogin(false); setLoginError('') } }}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'32px', width:'100%', maxWidth:'380px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <h2 style={{ fontSize:'18px', fontWeight:700, color:'#111827', marginBottom:'8px' }}>🔐 관리자 로그인</h2>
        <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'24px' }}>블로그 및 설명서 작성·관리</p>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <input type="email" placeholder="이메일" value={loginForm.email}
            onChange={e => setLoginForm(v => ({ ...v, email:e.target.value }))}
            onKeyDown={e => e.key==='Enter' && handleAdminLogin()}
            style={{ padding:'10px 14px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          <input type="password" placeholder="비밀번호" value={loginForm.pw}
            onChange={e => setLoginForm(v => ({ ...v, pw:e.target.value }))}
            onKeyDown={e => e.key==='Enter' && handleAdminLogin()}
            style={{ padding:'10px 14px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          {loginError && <div style={{ fontSize:'13px', color:'#ef4444', fontWeight:600 }}>{loginError}</div>}
          <button onClick={handleAdminLogin}
            style={{ padding:'11px', borderRadius:'9px', border:'none', background:'#f97316', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', marginTop:'4px' }}>
            로그인
          </button>
        </div>
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fafafa' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'40px', marginBottom:'16px' }}>📝</div>
        <div style={{ color:'#9ca3af' }}>로딩 중...</div>
      </div>
    </div>
  )

  const MainContent = () => {
    if (blogAdminMode) return <div style={{ padding:'24px' }}><BlogAdmin user={adminUser} /></div>
    if (selPost) {
      if (selPost.type === 'docs') return <DocsDetail doc={selPost} allDocs={docsPosts} onBack={handleBack} onSelect={handleSelect} />
      return <BlogDetail post={selPost} onBack={handleBack} />
    }
    if (tab === 'docs') return <DocsList docs={docsPosts} onSelect={handleSelect} />
    return <BlogList posts={blogPosts} onSelect={handleSelect} />
  }

  return (
    <div style={{ minHeight:'100vh', background:'#fafafa', fontFamily:'Noto Sans KR, sans-serif' }}>
      <style>{globalStyles}</style>
      <Nav />
      {showAdminLogin && <AdminLoginModal />}
      <div style={{ display:'flex', justifyContent:'center', gap:'20px', padding:'0 16px', maxWidth:'1500px', margin:'0 auto' }}>
        <div className="blog-side-ad" style={{ width:'160px', flexShrink:0, paddingTop:'32px' }}>
          <div style={{ position:'sticky', top:'80px' }}>
            <AdSense slot="1111111111" label="왼쪽 광고" style={{ width:'160px', minHeight:'600px' }} />
          </div>
        </div>
        <div style={{ flex:1, minWidth:0, maxWidth:'1100px' }}>
          <MainContent />
          {!blogAdminMode && (
            <div style={{ padding:'0 20px 40px' }}>
              <AdSense slot="3333333333" label="하단 광고" style={{ minHeight:'90px' }} />
            </div>
          )}
        </div>
        <div className="blog-side-ad" style={{ width:'160px', flexShrink:0, paddingTop:'32px' }}>
          <div style={{ position:'sticky', top:'80px' }}>
            <AdSense slot="2222222222" label="오른쪽 광고" style={{ width:'160px', minHeight:'600px' }} />
          </div>
        </div>
      </div>
      <footer style={{ borderTop:'1px solid #e5e7eb', padding:'32px 20px', textAlign:'center', color:'#9ca3af', fontSize:'13px', background:'#fff' }}>
        <div style={{ marginBottom:'8px' }}>📋 방과후 출석부 — 방과후 강사를 위한 스마트 출석 관리</div>
        <div style={{ display:'flex', gap:'16px', justifyContent:'center' }}>
          <a href="/terms" style={{ color:'#9ca3af', textDecoration:'none' }}>이용약관</a>
          <a href="/privacy" style={{ color:'#9ca3af', textDecoration:'none' }}>개인정보처리방침</a>
          <a href="/" style={{ color:'#9ca3af', textDecoration:'none' }}>앱으로 이동</a>
        </div>
      </footer>
    </div>
  )
}
