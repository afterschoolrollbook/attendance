function sanitizeHtml(html) {
  if (typeof window !== 'undefined' && window.DOMPurify) {
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','b','strong','i','em','u','h1','h2','h3','ul','ol','li',
        'blockquote','code','pre','hr','a','img','table','thead','tbody','tr','th','td',
        'svg','g','rect','circle','ellipse','line','polyline','polygon','path','text',
        'tspan','defs','linearGradient','stop','clipPath','marker','title','desc'],
      ALLOWED_ATTR: ['href','src','alt','target','rel','style','class',
        'viewBox','xmlns','width','height','fill','stroke','stroke-width','d',
        'x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','points',
        'transform','text-anchor','font-size','font-weight','font-family',
        'id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform',
        'preserveAspectRatio','dominant-baseline'],
      ALLOW_DATA_ATTR: false,
    })
  }
  // DOMPurify 없을 때 — script/iframe/이벤트핸들러만 제거, SVG는 허용
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/javascript\s*:/gi, '')
}

import React, { useState, useEffect } from 'react'
import { dbCall, supabase } from '../lib/supabase.js'
import { BlogAdmin } from './BlogAdmin.jsx'
import { uid, now } from '../lib/utils.js'
import { getBoardPermLevel } from '../constants/permissions.js'

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
    .replace(/^- (.+)$/gm, '<li>$1</li>')
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
  .blog-nav-tabs { display:flex; gap:2px; overflow-x:auto; -ms-overflow-style:none; scrollbar-width:none; }
  .blog-nav-tabs::-webkit-scrollbar { display:none; }
  .blog-nav-tabs button { white-space:nowrap; flex-shrink:0; }
  .blog-nav-brand-text { display:inline; }
  .blog-nav-actions { flex-shrink:0; }
  @media (max-width:860px) {
    .blog-nav-brand-text { display:none; }
    .blog-nav-tabs button { padding:6px 10px !important; font-size:13px !important; }
  }
  @media (max-width:600px) {
    .blog-nav-actions .blog-nav-dashboard,
    .blog-nav-actions .blog-nav-login { display:none !important; }
    .blog-nav-tabs button { padding:6px 8px !important; font-size:12px !important; }
  }
`

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str)
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`
}

function slugify(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9가-힣\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim() || uid()
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

// ── JSON-LD 구조화 데이터 (구글 리치스니펫)
function setJsonLd(post) {
  const existing = document.getElementById('blog-jsonld')
  if (existing) existing.remove()
  if (!post) return
  const script = document.createElement('script')
  script.id = 'blog-jsonld'
  script.type = 'application/ld+json'
  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.summary || post.content?.replace(/[#*`>-]/g,'').slice(0,160),
    "datePublished": post.publishedAt || post.createdAt,
    "dateModified": post.updatedAt || post.publishedAt || post.createdAt,
    "author": { "@type": "Person", "name": post.author || "방과후 출석부" },
    "publisher": { "@type": "Organization", "name": "방과후 출석부", "url": window.location.origin },
    "url": `${window.location.origin}/blog/${post.slug||post.id}`,
    "keywords": Array.isArray(post.tags) ? post.tags.join(', ') : post.tags,
    "articleSection": post.category,
  })
  document.head.appendChild(script)
}

// ── 애드센스 (승인 전 플레이스홀더)
function AdSense({ slot, label = '광고', style = {} }) {
  const isApproved = false // 애드센스 승인 후 true로 변경
  useEffect(() => {
    if (!isApproved) return
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch (e) { console.warn('[Blog] 오류:', e) }
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
function BlogList({ posts, onSelect, currentUser, loggedIn, writePerm, onPostSaved }) {
  const [search, setSearch] = useState('')
  const [selCat, setSelCat] = useState('전체')
  const [writing, setWriting] = useState(false)
  const [allCategories, setAllCategories] = useState(['전체', '출석 관리', '교구 관리', '업무 팁', '공지사항', '업데이트', '기타'])

  const DEFAULT_CATS = ['출석 관리', '교구 관리', '업무 팁', '공지사항', '업데이트', '기타']

  useEffect(() => {
    const loadCats = async () => {
      try {
        const rows = await dbCall('getAll', 'customCategories')
        const custom = (rows || []).filter(c => c.type === 'blog').map(c => c.name)
        setAllCategories(['전체', ...DEFAULT_CATS, ...custom.filter(n => !DEFAULT_CATS.includes(n))])
      } catch (e) { console.warn('[Blog] 카테고리 로딩 실패:', e) }
    }
    loadCats()
  }, [])

  const WRITE_CATEGORIES = allCategories.filter(c => c !== '전체')
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
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', marginBottom:'24px' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="글 제목, 내용으로 검색..." />
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center' }}>
          {allCategories.map(cat => (
            <button key={cat} onClick={() => setSelCat(cat)}
              style={{ padding:'6px 18px', borderRadius:'999px', border:`2px solid ${selCat===cat?'#f97316':'#e5e7eb'}`, background:selCat===cat?'#f97316':'#fff', color:selCat===cat?'#fff':'#374151', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      {loggedIn && !writing && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
          <button onClick={() => setWriting(true)}
            style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:'#f97316', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            ✏️ 글쓰기
          </button>
        </div>
      )}
      {loggedIn && writing && (
        <InlineWriteForm
          currentUser={currentUser} boardType="blog" boardLabel="블로그" color="#f97316"
          placeholder="방과후 강사를 위한 출석 관리, 교구 관리, 업무 효율화 팁을 자유롭게 작성해주세요."
          categories={WRITE_CATEGORIES}
          writePerm={writePerm}
          onCancel={() => setWriting(false)}
          onSaved={() => { setWriting(false); onPostSaved?.() }}
        />
      )}
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
                  {post.summary || post.content?.replace(/[#*`>-]/g, '').slice(0, 120) + '...'}
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
// ── 댓글 컴포넌트
function Comments({ postId }) {
  const [comments, setComments]   = useState([])
  const [form, setForm]           = useState({ author:'', content:'', isSecret: false, password:'' })
  const [saving, setSaving]       = useState(false)
  const [unlocked, setUnlocked]   = useState({}) // { commentId: true } 비밀댓글 잠금 해제
  const [pwInput, setPwInput]     = useState({})  // { commentId: '입력값' }
  const [pwError, setPwError]     = useState({})

  useEffect(() => { loadComments() }, [postId])

  const loadComments = async () => {
    try {
      const rows = await dbCall('getAll', 'blogComments')
      const postComments = (rows||[]).filter(c => c.postId === postId)
        .sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))
      setComments(postComments)
    } catch (e) { console.warn('[Blog] 오류:', e) }
  }

  const handleSubmit = async () => {
    if (!form.author.trim()) return alert('이름을 입력해주세요.')
    if (!form.content.trim()) return alert('내용을 입력해주세요.')
    if (form.isSecret && !form.password.trim()) return alert('비밀댓글은 비밀번호를 입력해주세요.')
    setSaving(true)
    try {
      await dbCall('insert', 'blogComments', {
        id: uid(), postId,
        author: form.author.trim(),
        content: form.content.trim(),
        isSecret: form.isSecret,
        password: form.isSecret ? form.password : '',
        createdAt: now(),
      })
      setForm({ author:'', content:'', isSecret:false, password:'' })
      loadComments()
    } catch(e) { alert('댓글 저장 실패: ' + e.message) }
    setSaving(false)
  }

  const handleUnlock = (c) => {
    if (pwInput[c.id] === c.password) {
      setUnlocked(p => ({ ...p, [c.id]: true }))
      setPwError(p => ({ ...p, [c.id]: '' }))
    } else {
      setPwError(p => ({ ...p, [c.id]: '비밀번호가 틀렸습니다.' }))
    }
  }

  const handleDelete = async (c) => {
    if (c.isSecret) {
      const pw = window.prompt('댓글 비밀번호를 입력하세요.')
      if (pw !== c.password) return alert('비밀번호가 틀렸습니다.')
    } else {
      if (!window.confirm('댓글을 삭제하시겠습니까?')) return
    }
    try { await dbCall('delete', 'blogComments', { id: c.id }); loadComments() } catch (e) { console.warn('[Blog] 오류:', e) }
  }

  const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', background:'#fff' }

  return (
    <div style={{ marginTop:'48px', paddingTop:'32px', borderTop:'2px solid #f3f4f6' }}>
      <div style={{ fontSize:'17px', fontWeight:700, color:'#111827', marginBottom:'20px' }}>
        💬 댓글 {comments.length > 0 && <span style={{ fontSize:'14px', color:'#9ca3af', fontWeight:400 }}>{comments.length}개</span>}
      </div>

      {/* 댓글 목록 */}
      {comments.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'28px' }}>
          {comments.map(c => {
            const isOpen = !c.isSecret || unlocked[c.id]
            return (
              <div key={c.id} style={{ background: c.isSecret ? '#fef2f2' : '#f9fafb', borderRadius:'12px', padding:'16px 18px', border:`1.5px solid ${c.isSecret ? '#fca5a5' : '#e5e7eb'}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <span style={{ fontSize:'14px', fontWeight:700, color:'#111827' }}>{c.author}</span>
                    {c.isSecret && <span style={{ fontSize:'11px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5', borderRadius:'6px', padding:'1px 7px', fontWeight:700 }}>🔐 비밀댓글</span>}
                    <span style={{ fontSize:'12px', color:'#9ca3af' }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString('ko-KR') : ''}</span>
                  </div>
                  <button onClick={() => handleDelete(c)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'12px', color:'#9ca3af', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                </div>

                {isOpen ? (
                  <div style={{ fontSize:'14px', color:'#374151', lineHeight:1.7 }}>{c.content}</div>
                ) : (
                  <div>
                    <div style={{ fontSize:'13px', color:'#9ca3af', marginBottom:'10px' }}>🔒 비밀번호를 입력하면 댓글을 볼 수 있어요.</div>
                    <div style={{ display:'flex', gap:'8px' }}>
                      <input type="password" placeholder="비밀번호" value={pwInput[c.id]||''} onChange={e => setPwInput(p => ({...p,[c.id]:e.target.value}))}
                        onKeyDown={e => e.key==='Enter' && handleUnlock(c)}
                        style={{ ...iStyle, flex:1, fontSize:'13px' }} />
                      <button onClick={() => handleUnlock(c)} style={{ padding:'8px 16px', borderRadius:'8px', border:'none', background:'#dc2626', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>확인</button>
                    </div>
                    {pwError[c.id] && <div style={{ fontSize:'12px', color:'#dc2626', marginTop:'4px' }}>⚠️ {pwError[c.id]}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 댓글 작성 */}
      <div style={{ background:'#f9fafb', borderRadius:'12px', padding:'20px', border:'1.5px solid #e5e7eb' }}>
        <div style={{ fontSize:'14px', fontWeight:700, color:'#111827', marginBottom:'14px' }}>댓글 작성</div>
        <div style={{ display:'grid', gridTemplateColumns: form.isSecret ? '1fr 1fr' : '1fr', gap:'10px', marginBottom:'10px' }}>
          <input value={form.author} onChange={e=>setForm(v=>({...v,author:e.target.value}))} placeholder="이름" style={iStyle} />
          {form.isSecret && <input type="password" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))} placeholder="비밀번호 (댓글 확인/삭제 시 필요)" style={iStyle} />}
        </div>
        <textarea value={form.content} onChange={e=>setForm(v=>({...v,content:e.target.value}))} placeholder="댓글을 입력하세요." rows={3}
          style={{...iStyle, resize:'vertical', marginBottom:'10px'}} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
          <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontSize:'13px', color:'#374151' }}>
            <input type="checkbox" checked={form.isSecret} onChange={e=>setForm(v=>({...v,isSecret:e.target.checked,password:''}))} style={{ width:'15px', height:'15px' }} />
            🔐 비밀댓글
          </label>
          <button onClick={handleSubmit} disabled={saving} style={{ padding:'8px 20px', borderRadius:'8px', border:'none', background:'#f97316', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            {saving ? '등록 중...' : '댓글 등록'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BlogDetail({ post, onBack }) {
  useEffect(() => {
    setMeta(`${post.title} | 방과후 출석부 블로그`, post.summary || post.content?.replace(/[#*`>-]/g, '').slice(0, 160) || '', `${window.location.origin}/blog/${post.slug||post.id}`, post.coverImage)
    setJsonLd(post)
    window.scrollTo(0, 0)
    return () => { setMeta('방과후 출석부 블로그', '방과후 강사를 위한 출석 관리 팁', `${window.location.origin}/blog`); setJsonLd(null) }
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
      <Comments postId={post.id} />
    </div>
  )
}

// ── 블로그 인라인 글쓰기 폼 (사용후기/부탁해요~ 목록에서 마이페이지로 가지 않고 바로 작성)
function InlineWriteForm({ currentUser, boardType, boardLabel, color, placeholder, writePerm, categories, onSaved, onCancel }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [isPrivateRequest, setIsPrivateRequest] = useState(false)
  const [saving, setSaving] = useState(false)

  const iStyle = { width:'100%', padding:'10px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', background:'#fff' }
  const allowed = writePerm?.allowed ?? true

  const handleSubmit = async () => {
    if (!allowed) {
      return alert(`글쓰기 권한이 없습니다. (현재 Lv.${writePerm?.currentLevel ?? 1} / 필요 Lv.${writePerm?.requiredLevel ?? 1} 이상)`)
    }
    if (!title.trim()) return alert('제목을 입력해주세요.')
    if (!content.trim()) return alert('내용을 입력해주세요.')
    setSaving(true)
    try {
      const payload = {
        id: uid(),
        type: 'blog',
        boardType,
        isSecret: false,
        isPrivateRequest: boardType === 'request' ? isPrivateRequest : false,
        title: title.trim(),
        slug: slugify(title),
        content: content.trim(),
        category: boardType === 'review' ? '사용자 후기' : boardType === 'request' ? '부탁해요' : category,
        tags: [],
        author: currentUser?.name || currentUser?.email || '익명',
        authorId: currentUser?.id,
        status: 'published',
        publishedAt: now(), updatedAt: now(), createdAt: now(),
      }
      await dbCall('insert', 'blogPosts', payload)
      setTitle(''); setContent(''); setCategory(''); setIsPrivateRequest(false)
      onSaved(payload)
    } catch (e) { alert('저장 실패: ' + e.message) }
    setSaving(false)
  }

  return (
    <div style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${color}`, padding:'20px 22px', marginBottom:'28px', display:'flex', flexDirection:'column', gap:'10px' }}>
      <div style={{ fontSize:'14px', fontWeight:700, color:'#111827' }}>✏️ {boardLabel} 작성</div>
      {!allowed && (
        <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#dc2626', fontWeight:600 }}>
          ⚠️ 현재 등급(Lv.{writePerm?.currentLevel ?? 1})으로는 글쓰기 권한이 없습니다. (Lv.{writePerm?.requiredLevel ?? 1} 이상 필요) — 작성은 가능하지만 등록되지 않습니다.
        </div>
      )}
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="제목을 입력하세요" style={{ ...iStyle, fontWeight:700 }} />
      {categories?.length > 0 && (
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{ ...iStyle, background:'#fff' }}>
          <option value="">카테고리 선택</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder={placeholder} rows={5} style={{ ...iStyle, resize:'vertical', lineHeight:1.7 }} />
      {boardType === 'request' && (
        <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontSize:'13px', color:'#15803d', fontWeight:600 }}>
          <input type="checkbox" checked={isPrivateRequest} onChange={e=>setIsPrivateRequest(e.target.checked)} style={{ width:'15px', height:'15px' }} />
          🔒 비밀기능 — 제목만 공개되고 내용은 본인과 관리자만 볼 수 있습니다.
        </label>
      )}
      <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
        {onCancel && <button onClick={onCancel} style={{ padding:'8px 18px', borderRadius:'8px', border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>취소</button>}
        <button onClick={handleSubmit} disabled={saving} style={{ padding:'8px 22px', borderRadius:'8px', border:'none', background:allowed ? color : '#9ca3af', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {saving ? '등록 중...' : '등록'}
        </button>
      </div>
    </div>
  )
}

// ── 사용후기 목록
function ReviewList({ posts, onSelect, currentUser, loggedIn, writePerm, onPostSaved }) {
  const [search, setSearch] = useState('')
  const [writing, setWriting] = useState(false)
  const filtered = posts.filter(p => {
    const q = search.toLowerCase()
    return !q || p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q) || p.author?.toLowerCase().includes(q)
  })

  return (
    <div style={{ maxWidth:'900px', margin:'0 auto', padding:'40px 20px' }}>
      <div style={{ textAlign:'center', marginBottom:'40px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#eab308', letterSpacing:'2px', marginBottom:'12px' }}>REVIEWS</div>
        <h1 style={{ fontSize:'34px', fontWeight:800, color:'#111827', marginBottom:'14px' }}>⭐ 사용후기</h1>
        <p style={{ fontSize:'16px', color:'#6b7280', lineHeight:1.7 }}>방과후 출석부를 직접 사용하신 선생님들의 생생한 후기를 만나보세요.</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', marginBottom:'24px' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="후기 제목, 내용으로 검색..." />
      </div>
      {loggedIn && !writing && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
          <button onClick={() => setWriting(true)}
            style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:'#eab308', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            ✏️ 후기 작성
          </button>
        </div>
      )}
      {loggedIn && writing && (
        <InlineWriteForm
          currentUser={currentUser} boardType="review" boardLabel="사용후기" color="#eab308"
          placeholder="방과후 출석부를 사용하면서 느낀 점을 자유롭게 작성해주세요."
          writePerm={writePerm}
          onCancel={() => setWriting(false)}
          onSaved={() => { setWriting(false); onPostSaved?.() }}
        />
      )}
      {search && <div style={{ fontSize:'13px', color:'#6b7280', marginBottom:'16px' }}>"<strong>{search}</strong>" 검색 결과 {filtered.length}개</div>}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>⭐</div>
          <div>{search ? '검색 결과가 없습니다.' : '아직 등록된 후기가 없습니다.'}</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:'20px' }}>
          {filtered.map(post => (
            <article key={post.id} onClick={() => onSelect(post)}
              style={{ background:'#fff', borderRadius:'16px', border:'1.5px solid #fef08a', overflow:'hidden', cursor:'pointer', transition:'all .2s', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(234,179,8,0.15)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.05)'; e.currentTarget.style.transform='translateY(0)' }}>
              <div style={{ padding:'22px 24px', display:'flex', flexDirection:'column', gap:'10px', flex:1 }}>
                <div style={{ fontSize:'20px', color:'#eab308', fontWeight:900, lineHeight:1 }}>"</div>
                <h2 style={{ fontSize:'17px', fontWeight:700, color:'#111827', marginBottom:'2px', lineHeight:1.4 }}>{post.title}</h2>
                <p style={{ fontSize:'14px', color:'#6b7280', lineHeight:1.7, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', flex:1 }}>
                  {post.summary || post.content?.replace(/[#*`>-]/g, '').slice(0, 120) + '...'}
                </p>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'4px' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color:'#92400e' }}>{post.author || '익명'}</span>
                  <span style={{ fontSize:'12px', color:'#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {/* CTA */}
      {!loggedIn && (
        <div style={{ marginTop:'48px', background:'linear-gradient(135deg,#fefce8,#fff)', border:'2px solid #fef08a', borderRadius:'16px', padding:'32px', textAlign:'center' }}>
          <div style={{ fontSize:'24px', marginBottom:'12px' }}>✍️</div>
          <h3 style={{ fontSize:'18px', fontWeight:700, color:'#92400e', marginBottom:'8px' }}>방과후 출석부를 사용해보셨나요?</h3>
          <p style={{ fontSize:'14px', color:'#b45309', marginBottom:'20px', lineHeight:1.7 }}>
            로그인 후 사용후기를 작성해주세요!
          </p>
          <a href="/?page=login" style={{ display:'inline-block', padding:'12px 32px', background:'#eab308', color:'#fff', borderRadius:'10px', fontWeight:700, fontSize:'15px', textDecoration:'none' }}>로그인하러 가기 →</a>
        </div>
      )}
    </div>
  )
}

// ── 사용후기 상세
function ReviewDetail({ post, onBack }) {
  useEffect(() => {
    setMeta(`${post.title} | 방과후 출석부 사용후기`, post.summary || post.content?.replace(/[#*`>-]/g, '').slice(0, 160) || '', `${window.location.origin}/reviews/${post.slug||post.id}`)
    window.scrollTo(0, 0)
    return () => setMeta('방과후 출석부 블로그', '방과후 강사를 위한 출석 관리 팁', `${window.location.origin}/blog`)
  }, [post])

  return (
    <div style={{ maxWidth:'780px', margin:'0 auto', padding:'40px 20px' }}>
      <button onClick={onBack} style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginBottom:'32px', background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', padding:0 }}>← 목록으로</button>
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:'12px', fontWeight:700, color:'#92400e', background:'#fefce8', border:'1px solid #fef08a', borderRadius:'999px', padding:'4px 12px' }}>⭐ 사용후기</span>
        <span style={{ fontSize:'13px', color:'#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
        {post.author && <span style={{ fontSize:'13px', color:'#9ca3af' }}>· {post.author}</span>}
      </div>
      <h1 style={{ fontSize:'32px', fontWeight:800, color:'#111827', lineHeight:1.4, marginBottom:'24px' }}>{post.title}</h1>
      <hr style={{ border:'none', borderTop:'2px solid #f3f4f6', marginBottom:'32px' }} />
      <div className="md-body" dangerouslySetInnerHTML={{ __html: parseMarkdown(post.content) }} />
      {/* CTA */}
      <div style={{ marginTop:'40px', background:'linear-gradient(135deg,#fff7ed,#fff)', border:'2px solid #fed7aa', borderRadius:'16px', padding:'32px', textAlign:'center' }}>
        <div style={{ fontSize:'24px', marginBottom:'12px' }}>📋</div>
        <h3 style={{ fontSize:'20px', fontWeight:700, color:'#92400e', marginBottom:'8px' }}>방과후 출석부를 무료로 시작하세요</h3>
        <p style={{ fontSize:'14px', color:'#b45309', marginBottom:'20px', lineHeight:1.7 }}>출석 관리, 교구 관리, 학부모 알림까지 — 방과후 강사를 위한 올인원 솔루션</p>
        <a href="/" style={{ display:'inline-block', padding:'12px 32px', background:'#f97316', color:'#fff', borderRadius:'10px', fontWeight:700, fontSize:'15px', textDecoration:'none' }}>무료로 시작하기 →</a>
      </div>
      <div style={{ marginTop:'24px', textAlign:'center' }}>
        <button onClick={onBack} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 24px', cursor:'pointer', fontSize:'14px', color:'#6b7280', fontFamily:'Noto Sans KR, sans-serif' }}>← 목록으로 돌아가기</button>
      </div>
      <Comments postId={post.id} />
    </div>
  )
}

// ── 부탁해요~ (요청게시판) 목록
function RequestList({ posts, onSelect, currentUser, isAdmin, loggedIn, writePerm, onPostSaved }) {
  const [search, setSearch] = useState('')
  const [writing, setWriting] = useState(false)
  const filtered = posts.filter(p => {
    const q = search.toLowerCase()
    const isLocked = !!p.isPrivateRequest
    return !q || p.title?.toLowerCase().includes(q) || (!isLocked && p.content?.toLowerCase().includes(q))
  })

  return (
    <div style={{ maxWidth:'900px', margin:'0 auto', padding:'40px 20px' }}>
      <div style={{ textAlign:'center', marginBottom:'40px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#16a34a', letterSpacing:'2px', marginBottom:'12px' }}>REQUESTS</div>
        <h1 style={{ fontSize:'34px', fontWeight:800, color:'#111827', marginBottom:'14px' }}>🙏 부탁해요~</h1>
        <p style={{ fontSize:'16px', color:'#6b7280', lineHeight:1.7 }}>원하는 기능이나 도움이 필요한 점을 자유롭게 요청해주세요. 🔒 비밀기능으로 등록하면 내용은 작성자와 관리자만 볼 수 있어요.</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', marginBottom:'24px' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="요청 제목으로 검색..." />
      </div>
      {loggedIn && !writing && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
          <button onClick={() => setWriting(true)}
            style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:'#16a34a', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            ✏️ 요청 작성
          </button>
        </div>
      )}
      {loggedIn && writing && (
        <InlineWriteForm
          currentUser={currentUser} boardType="request" boardLabel="부탁해요~" color="#16a34a"
          placeholder="관리자에게 요청하고 싶은 기능이나 도움을 자유롭게 작성해주세요."
          writePerm={writePerm}
          onCancel={() => setWriting(false)}
          onSaved={() => { setWriting(false); onPostSaved?.() }}
        />
      )}
      {search && <div style={{ fontSize:'13px', color:'#6b7280', marginBottom:'16px' }}>"<strong>{search}</strong>" 검색 결과 {filtered.length}개</div>}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>🙏</div>
          <div>{search ? '검색 결과가 없습니다.' : '아직 등록된 요청이 없습니다.'}</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {filtered.map(post => {
            const isLocked = !!post.isPrivateRequest
            const canRead = !isLocked || isAdmin || (currentUser && currentUser.id === post.authorId)
            return (
              <article key={post.id} onClick={() => onSelect(post)}
                style={{ background:'#fff', borderRadius:'14px', border:`1.5px solid ${isLocked?'#bbf7d0':'#e5e7eb'}`, padding:'18px 22px', cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow='0 6px 20px rgba(22,163,74,0.10)'; e.currentTarget.style.transform='translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='translateY(0)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
                  {isLocked && <span style={{ fontSize:'13px' }}>🔒</span>}
                  <h2 style={{ fontSize:'16px', fontWeight:700, color: canRead ? '#111827' : '#9ca3af', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{post.title}</h2>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
                  <span style={{ fontSize:'12px', fontWeight:600, color:'#15803d' }}>{post.author || '익명'}</span>
                  <span style={{ fontSize:'12px', color:'#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {/* CTA */}
      {!loggedIn && (
        <div style={{ marginTop:'48px', background:'linear-gradient(135deg,#f0fdf4,#fff)', border:'2px solid #bbf7d0', borderRadius:'16px', padding:'32px', textAlign:'center' }}>
          <div style={{ fontSize:'24px', marginBottom:'12px' }}>🙏</div>
          <h3 style={{ fontSize:'18px', fontWeight:700, color:'#15803d', marginBottom:'8px' }}>필요한 기능이 있으신가요?</h3>
          <p style={{ fontSize:'14px', color:'#16a34a', marginBottom:'20px', lineHeight:1.7 }}>
            로그인 후 "🙏 부탁해요~" 게시판에 요청을 남겨주세요!
          </p>
          <a href="/?page=login" style={{ display:'inline-block', padding:'12px 32px', background:'#16a34a', color:'#fff', borderRadius:'10px', fontWeight:700, fontSize:'15px', textDecoration:'none' }}>로그인하러 가기 →</a>
        </div>
      )}
    </div>
  )
}

// ── 부탁해요~ (요청게시판) 상세
function RequestDetail({ post, onBack, currentUser, isAdmin }) {
  useEffect(() => {
    setMeta(`${post.title} | 방과후 출석부 부탁해요~`, '', `${window.location.origin}/requests/${post.slug||post.id}`)
    window.scrollTo(0, 0)
    return () => setMeta('방과후 출석부 블로그', '방과후 강사를 위한 출석 관리 팁', `${window.location.origin}/blog`)
  }, [post])

  const isLocked = !!post.isPrivateRequest
  const canRead = !isLocked || isAdmin || (currentUser && currentUser.id === post.authorId)

  return (
    <div style={{ maxWidth:'780px', margin:'0 auto', padding:'40px 20px' }}>
      <button onClick={onBack} style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginBottom:'32px', background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', padding:0 }}>← 목록으로</button>
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:'12px', fontWeight:700, color:'#15803d', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'999px', padding:'4px 12px' }}>🙏 부탁해요~</span>
        {isLocked && <span style={{ fontSize:'12px', fontWeight:700, color:'#dc2626', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'999px', padding:'4px 12px' }}>🔒 비밀기능</span>}
        <span style={{ fontSize:'13px', color:'#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
        {post.author && <span style={{ fontSize:'13px', color:'#9ca3af' }}>· {post.author}</span>}
      </div>
      <h1 style={{ fontSize:'32px', fontWeight:800, color:'#111827', lineHeight:1.4, marginBottom:'24px' }}>{post.title}</h1>
      <hr style={{ border:'none', borderTop:'2px solid #f3f4f6', marginBottom:'32px' }} />
      {canRead ? (
        <div className="md-body" dangerouslySetInnerHTML={{ __html: parseMarkdown(post.content) }} />
      ) : (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af', background:'#f9fafb', borderRadius:'14px', border:'1px dashed #e5e7eb' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔒</div>
          <div style={{ fontSize:'15px', fontWeight:600 }}>비밀기능으로 등록된 요청입니다.</div>
          <div style={{ fontSize:'13px', marginTop:'6px' }}>작성자와 관리자만 내용을 볼 수 있어요.</div>
        </div>
      )}
      <div style={{ marginTop:'24px', textAlign:'center' }}>
        <button onClick={onBack} style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:'8px', padding:'10px 24px', cursor:'pointer', fontSize:'14px', color:'#6b7280', fontFamily:'Noto Sans KR, sans-serif' }}>← 목록으로 돌아가기</button>
      </div>
      {canRead && <Comments postId={post.id} />}
    </div>
  )
}

// ── 템플릿 목록
function TemplateList({ posts, onSelect }) {
  const [search, setSearch] = useState('')
  const [selCat, setSelCat] = useState('전체')
  const FIXED_CATEGORIES = ['전체', '출석부 양식', '가정통신문', '수업 계획서', '교구 관리표', '학생 평가표', '수업료 안내', '기타 서식']
  const filtered = posts.filter(p => {
    const matchCat = selCat === '전체' || p.category === selCat
    const q = search.toLowerCase()
    const matchSearch = !q || p.title?.toLowerCase().includes(q) || p.summary?.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  return (
    <div style={{ maxWidth:'900px', margin:'0 auto', padding:'40px 20px' }}>
      <div style={{ textAlign:'center', marginBottom:'40px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#7c3aed', letterSpacing:'2px', marginBottom:'12px' }}>TEMPLATES</div>
        <h1 style={{ fontSize:'34px', fontWeight:800, color:'#111827', marginBottom:'14px' }}>📋 무료 템플릿</h1>
        <p style={{ fontSize:'16px', color:'#6b7280', lineHeight:1.7 }}>방과후 강사를 위한 출석부, 가정통신문, 수업 계획서 등 실용 서식을 무료로 제공합니다.</p>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', marginBottom:'36px' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="템플릿 검색..." />
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'center' }}>
          {FIXED_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setSelCat(cat)}
              style={{ padding:'6px 18px', borderRadius:'999px', border:`2px solid ${selCat===cat?'#7c3aed':'#e5e7eb'}`, background:selCat===cat?'#7c3aed':'#fff', color:selCat===cat?'#fff':'#374151', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
              {cat}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px', color:'#9ca3af' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>📋</div>
          <div>{search ? '검색 결과가 없습니다.' : '아직 등록된 템플릿이 없습니다.'}</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'20px' }}>
          {filtered.map(post => (
            <article key={post.id} onClick={() => onSelect(post)}
              style={{ background:'#fff', borderRadius:'16px', border:'2px solid #e5e7eb', overflow:'hidden', cursor:'pointer', transition:'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#7c3aed'; e.currentTarget.style.boxShadow='0 8px 24px rgba(124,58,237,0.12)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.boxShadow='none'; e.currentTarget.style.transform='translateY(0)' }}>
              {post.coverImage
                ? <img src={post.coverImage} alt={post.title} style={{ width:'100%', height:'140px', objectFit:'cover' }} />
                : <div style={{ width:'100%', height:'100px', background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px' }}>📄</div>
              }
              <div style={{ padding:'16px 18px' }}>
                {post.category && <span style={{ fontSize:'11px', fontWeight:700, color:'#7c3aed', background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:'999px', padding:'3px 10px', display:'inline-block', marginBottom:'8px' }}>{post.category}</span>}
                <h2 style={{ fontSize:'15px', fontWeight:700, color:'#111827', marginBottom:'6px', lineHeight:1.4 }}>{post.title}</h2>
                {post.templateDesc && <p style={{ fontSize:'12px', color:'#7c3aed', background:'#f5f3ff', borderRadius:'6px', padding:'4px 8px', marginBottom:'8px', fontWeight:600 }}>📎 {post.templateDesc}</p>}
                <p style={{ fontSize:'13px', color:'#6b7280', lineHeight:1.6, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {post.summary || post.content?.replace(/[#*`>-]/g, '').slice(0, 80)}
                </p>
                <div style={{ marginTop:'12px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'12px', color:'#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
                  <span style={{ fontSize:'12px', fontWeight:700, color:'#7c3aed' }}>무료 다운로드 →</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 템플릿 상세
function TemplateDetail({ post, onBack }) {
  useEffect(() => {
    setMeta(`${post.title} | 방과후 출석부 템플릿`, post.summary || '', `${window.location.origin}/templates/${post.slug||post.id}`, post.coverImage)
    window.scrollTo(0, 0)
    return () => setMeta('방과후 출석부 블로그', '방과후 강사를 위한 출석 관리 팁', `${window.location.origin}/blog`)
  }, [post])

  return (
    <div style={{ maxWidth:'780px', margin:'0 auto', padding:'40px 20px' }}>
      <button onClick={onBack} style={{ display:'inline-flex', alignItems:'center', gap:'6px', marginBottom:'32px', background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', padding:0 }}>← 목록으로</button>
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:'12px', fontWeight:700, color:'#7c3aed', background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:'999px', padding:'4px 12px' }}>📋 템플릿</span>
        {post.category && <span style={{ fontSize:'12px', fontWeight:700, color:'#7c3aed', background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:'999px', padding:'4px 12px' }}>{post.category}</span>}
        <span style={{ fontSize:'13px', color:'#9ca3af' }}>{formatDate(post.publishedAt || post.createdAt)}</span>
      </div>
      <h1 style={{ fontSize:'28px', fontWeight:800, color:'#111827', lineHeight:1.4, marginBottom:'24px' }}>{post.title}</h1>
      {post.coverImage && <img src={post.coverImage} alt={post.title} style={{ width:'100%', maxHeight:'360px', objectFit:'cover', borderRadius:'14px', marginBottom:'28px' }} />}

      {/* 다운로드 CTA */}
      {post.templateFile && (
        <div style={{ background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'2px solid #7c3aed', borderRadius:'16px', padding:'24px 28px', marginBottom:'32px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'14px' }}>
          <div>
            <div style={{ fontSize:'16px', fontWeight:700, color:'#6d28d9', marginBottom:'4px' }}>📎 무료 다운로드</div>
            {post.templateDesc && <div style={{ fontSize:'13px', color:'#7c3aed', fontWeight:600 }}>{post.templateDesc}</div>}
          </div>
          <a href={post.templateFile} target="_blank" rel="noopener noreferrer"
            style={{ padding:'12px 28px', background:'#7c3aed', color:'#fff', borderRadius:'10px', fontWeight:700, fontSize:'15px', textDecoration:'none', whiteSpace:'nowrap', display:'inline-flex', alignItems:'center', gap:'8px' }}>
            ⬇️ 다운로드
          </a>
        </div>
      )}

      {post.summary && <div style={{ background:'#f5f3ff', border:'1px solid #ddd6fe', borderRadius:'10px', padding:'16px 20px', marginBottom:'28px', fontSize:'15px', color:'#6d28d9', lineHeight:1.7 }}>{post.summary}</div>}
      <hr style={{ border:'none', borderTop:'2px solid #f3f4f6', marginBottom:'28px' }} />
      <div className="md-body" dangerouslySetInnerHTML={{ __html: parseMarkdown(post.content) }} />
      {post.tags?.length > 0 && (
        <div style={{ marginTop:'32px', paddingTop:'20px', borderTop:'2px solid #f3f4f6', display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {post.tags.map(tag => <span key={tag} style={{ fontSize:'12px', background:'#f5f3ff', color:'#7c3aed', borderRadius:'999px', padding:'4px 12px', fontWeight:600 }}>#{tag}</span>)}
        </div>
      )}
      {post.templateFile && (
        <div style={{ marginTop:'36px', background:'linear-gradient(135deg,#f5f3ff,#ede9fe)', border:'2px solid #7c3aed', borderRadius:'16px', padding:'28px', textAlign:'center' }}>
          <div style={{ fontSize:'32px', marginBottom:'10px' }}>📋</div>
          <h3 style={{ fontSize:'18px', fontWeight:700, color:'#6d28d9', marginBottom:'6px' }}>템플릿을 무료로 다운로드하세요</h3>
          <p style={{ fontSize:'13px', color:'#7c3aed', marginBottom:'18px' }}>{post.templateDesc || '방과후 강사를 위한 실용 서식'}</p>
          <a href={post.templateFile} target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-block', padding:'12px 32px', background:'#7c3aed', color:'#fff', borderRadius:'10px', fontWeight:700, fontSize:'15px', textDecoration:'none' }}>
            ⬇️ 무료 다운로드
          </a>
        </div>
      )}
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
                      {doc.summary || doc.content?.replace(/[#*`>-]/g, '').slice(0, 80)}
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
                    <div style={{ fontSize:'13px', color:'#6b7280', lineHeight:1.6 }}>{doc.summary || doc.content?.replace(/[#*`>-]/g, '').slice(0, 80)}</div>
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
// ─── 상단 네비게이션 (Blog 밖으로 분리, 일반 렌더 함수)
function renderNav({ blogAdminMode, switchTab, tab, selPost, currentUser, canWrite, setBlogAdminMode }) {
  return (
    <nav style={{ position:'sticky', top:0, zIndex:100, background:'rgba(255,255,255,0.95)', backdropFilter:'blur(8px)', borderBottom:'1px solid #e5e7eb', padding:'0 16px' }}>
      <div style={{ maxWidth:'1100px', margin:'0 auto', height:'56px', display:'flex', alignItems:'center', gap:'12px' }}>
        <a href="/" style={{ display:'flex', alignItems:'center', gap:'8px', textDecoration:'none', flexShrink:0 }}>
          <span style={{ fontSize:'20px' }}>📋</span>
          <span className="blog-nav-brand-text" style={{ fontSize:'15px', fontWeight:700, color:'#111827', whiteSpace:'nowrap' }}>방과후 출석부</span>
        </a>
        {!blogAdminMode && (
          <div className="blog-nav-tabs" style={{ flex:1, minWidth:0 }}>
            {[['blog','📝 블로그','#f97316'],['reviews','⭐ 사용후기','#eab308'],['requests','🙏 부탁해요~','#16a34a'],['docs','📖 설명서','#3b82f6'],['templates','📋 템플릿','#7c3aed']].map(([key,label,color]) => (
              <button key={key} onClick={() => switchTab(key)}
                style={{ padding:'6px 16px', borderRadius:'8px', border:'none', background:tab===key&&!selPost?`${color}18`:'transparent', color:tab===key&&!selPost?color:'#6b7280', fontSize:'14px', fontWeight:tab===key&&!selPost?700:500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="blog-nav-actions" style={{ display:'flex', gap:'8px', alignItems:'center', marginLeft:'auto' }}>
          {currentUser && (
            <a href="/?page=dashboard" className="blog-nav-dashboard" style={{ padding:'7px 16px', background:'none', border:'1px solid #e5e7eb', color:'#374151', borderRadius:'8px', fontSize:'13px', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
              🏠 대시보드
            </a>
          )}
          {canWrite && (
            <button onClick={() => setBlogAdminMode(v => !v)}
              style={{ padding:'7px 16px', background:blogAdminMode?'#1f2937':'#f97316', color:'#fff', borderRadius:'8px', fontSize:'13px', fontWeight:700, border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
              {blogAdminMode ? '← 블로그' : '✏️ 글관리'}
            </button>
          )}
          {currentUser ? (
            <button onClick={async () => {
                await supabase?.auth?.signOut()
                // BlogWrite에서 복사해둔 localStorage 토큰도 함께 삭제
                try {
                  const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                  if (key) localStorage.removeItem(key)
                } catch(e) {}
                window.location.href = '/'
              }}
              style={{ padding:'7px 16px', background:'none', border:'1px solid #fecaca', color:'#ef4444', borderRadius:'8px', fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
              🚪 로그아웃
            </button>
          ) : (
            <a href="/?page=login" className="blog-nav-login" style={{ padding:'7px 16px', background:'none', border:'1px solid #e5e7eb', color:'#374151', borderRadius:'8px', fontSize:'13px', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
              로그인
            </a>
          )}
          <a href="/" style={{ padding:'7px 18px', background:'#f97316', color:'#fff', borderRadius:'8px', fontSize:'13px', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>앱 시작하기 →</a>
        </div>
      </div>
    </nav>
  )
}

// ─── 본문 영역 (Blog 밖으로 분리, 일반 렌더 함수)
function renderMainContent({ blogAdminMode, currentUser, selPost, docsPosts, templatePosts, blogPosts, reviewPosts, requestPosts, handleBack, handleSelect, tab, isAdmin, loggedIn, getWritePermInfo, onPostSaved }) {
  if (blogAdminMode) return <div style={{ padding:'24px' }}><BlogAdmin user={currentUser} /></div>
  if (selPost) {
    if (selPost.type === 'docs') return <DocsDetail doc={selPost} allDocs={docsPosts} onBack={handleBack} onSelect={handleSelect} />
    if (selPost.type === 'template') return <TemplateDetail post={selPost} onBack={handleBack} />
    if ((selPost.boardType || selPost.type) === 'review') return <ReviewDetail post={selPost} onBack={handleBack} />
    if ((selPost.boardType || selPost.type) === 'request') return <RequestDetail post={selPost} onBack={handleBack} currentUser={currentUser} isAdmin={isAdmin} />
    return <BlogDetail post={selPost} onBack={handleBack} />
  }
  if (tab === 'docs') return <DocsList docs={docsPosts} onSelect={handleSelect} />
  if (tab === 'templates') return <TemplateList posts={templatePosts} onSelect={handleSelect} />
  if (tab === 'reviews') return <ReviewList posts={reviewPosts} onSelect={handleSelect} currentUser={currentUser} loggedIn={loggedIn} writePerm={getWritePermInfo('review')} onPostSaved={onPostSaved} />
  if (tab === 'requests') return <RequestList posts={requestPosts} onSelect={handleSelect} currentUser={currentUser} isAdmin={isAdmin} loggedIn={loggedIn} writePerm={getWritePermInfo('request')} onPostSaved={onPostSaved} />
  return <BlogList posts={blogPosts} onSelect={handleSelect} currentUser={currentUser} loggedIn={loggedIn} writePerm={getWritePermInfo('blog')} onPostSaved={onPostSaved} />
}

export function Blog() {
  const [allPosts, setAllPosts] = useState([])
  const [tab, setTab] = useState('blog')
  const [selPost, setSelPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(() => {
    // sessionStorage(현재 탭) 또는 localStorage(새 탭에서 복사된)에서 Supabase 토큰 탐색
    try {
      const findToken = (storage) => {
        const key = Object.keys(storage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        if (!key) return null
        let token = JSON.parse(storage.getItem(key) || 'null')
        if (Array.isArray(token)) token = token[0]
        return token
      }
      const token = findToken(sessionStorage) || findToken(localStorage)
      if (!token) return null
      const accessToken = token?.access_token
      if (!accessToken) return null
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      const email = token?.user?.email || payload?.email
      if (!email) return null
      return { email, level: 1, _pending: true }
    } catch { return null }
  })
  const [blogAdminMode, setBlogAdminMode] = useState(false)

  const blogWriteMinLevel = getBoardPermLevel('blog', 'write')
  const canWrite = currentUser && !currentUser._pending &&
    (currentUser.role === 'admin' || (currentUser.level ?? 1) >= (blogWriteMinLevel ?? 1))
  const isAdmin = currentUser && !currentUser._pending &&
    (currentUser.role === 'admin' || (currentUser.level ?? 1) >= 10)
  const loggedIn = !!(currentUser && !currentUser._pending)

  const canWriteBoard = (boardKey) => {
    if (!currentUser || currentUser._pending) return false
    if (currentUser.role === 'admin' || (currentUser.level ?? 1) >= 10) return true
    const minLevel = getBoardPermLevel(boardKey, 'write')
    return (currentUser.level ?? 1) >= (minLevel ?? 1)
  }

  // 글쓰기 폼에 표시할 권한 정보 (현재 레벨 / 필요 레벨)
  const getWritePermInfo = (boardKey) => ({
    allowed: canWriteBoard(boardKey),
    currentLevel: currentUser?.level ?? 1,
    requiredLevel: getBoardPermLevel(boardKey, 'write') ?? 1,
  })

  const blogPosts = allPosts.filter(p => {
    const type = p.type || 'blog'
    const boardType = p.boardType || type
    // 비밀글, 후기, 질문, 요청, secret 타입 제외 — 일반 블로그/공지 글만
    return type !== 'docs' && type !== 'template' && type !== 'secret' && !p.isSecret
      && boardType !== 'secret' && boardType !== 'review' && boardType !== 'qna' && boardType !== 'request'
  })
  const docsPosts = allPosts.filter(p => p.type === 'docs')
  const templatePosts = allPosts.filter(p => p.type === 'template')
  const reviewPosts = allPosts.filter(p => {
    const type = p.type || 'blog'
    const boardType = p.boardType || type
    return boardType === 'review' && type !== 'secret' && !p.isSecret
  })
  const requestPosts = allPosts.filter(p => {
    const type = p.type || 'blog'
    const boardType = p.boardType || type
    return boardType === 'request' && type !== 'secret' && !p.isSecret
  })

  useEffect(() => {
    const path = window.location.pathname
    if (path.startsWith('/docs')) { setTab('docs'); const slug = path.match(/^\/docs\/(.+)$/)?.[1]; if (slug) loadPostBySlug(slug) }
    else if (path.startsWith('/templates')) { setTab('templates'); const slug = path.match(/^\/templates\/(.+)$/)?.[1]; if (slug) loadPostBySlug(slug) }
    else if (path.startsWith('/reviews')) { setTab('reviews'); const slug = path.match(/^\/reviews\/(.+)$/)?.[1]; if (slug) loadPostBySlug(slug) }
    else if (path.startsWith('/requests')) { setTab('requests'); const slug = path.match(/^\/requests\/(.+)$/)?.[1]; if (slug) loadPostBySlug(slug) }
    else { setTab('blog'); const slug = path.match(/^\/blog\/(.+)$/)?.[1]; if (slug) loadPostBySlug(slug) }
    setMeta('방과후 출석부 블로그', '방과후 강사를 위한 출석 관리 팁', `${window.location.origin}/blog`)
    loadPosts()
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      let session = null

      // 1차: Supabase 클라이언트 세션 조회 (같은 탭이면 sessionStorage에서 바로 나옴)
      const { data: { session: existingSession } } = await supabase.auth.getSession()
      session = existingSession

      // 2차: 새 탭으로 열린 경우 sessionStorage가 비어있어 null
      //      → BlogWrite에서 localStorage로 복사해둔 토큰으로 setSession 복원
      if (!session?.user?.email) {
        const lsKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        if (lsKey) {
          try {
            let token = JSON.parse(localStorage.getItem(lsKey) || 'null')
            if (Array.isArray(token)) token = token[0]
            if (token?.access_token && token?.refresh_token) {
              const { data: restored } = await supabase.auth.setSession({
                access_token: token.access_token,
                refresh_token: token.refresh_token,
              })
              session = restored?.session ?? null
            }
          } catch (e) {
            console.warn('[Blog] 토큰 복원 실패:', e)
          }
        }
      }

      if (!session?.user?.email) { setCurrentUser(null); return }
      const email = session.user.email
      const { data: rows } = await supabase.from('users').select('*').eq('email', email).limit(1)
      if (rows?.[0]) {
        const u = rows[0]
        setCurrentUser({
          id: u.id, email: u.email,
          level: u.level ?? 1,
          role: u.role,
          name: u.name,
          permissionOverrides: u.permission_overrides,
        })
      } else {
        setCurrentUser({ email, level: 1, role: 'teacher' })
      }
    } catch (e) {
      console.warn('[Blog] loadCurrentUser 실패:', e)
    }
  }

  const loadPosts = async () => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const published = (rows||[]).filter(p => p.status==='published').sort((a,b) => new Date(b.publishedAt||b.createdAt) - new Date(a.publishedAt||a.createdAt))
      setAllPosts(published)
    } catch (e) { console.warn('[Blog] 오류:', e) }
    finally { setLoading(false) }
  }

  const loadPostBySlug = async (slug) => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const post = (rows||[]).find(p => p.slug===slug || p.id===slug)
      if (post) setSelPost(post)
    } catch (e) { console.warn('[Blog] 오류:', e) }
  }

  const handleSelect = (post) => {
    setSelPost(post)
    const boardType = post.boardType || post.type
    const base = post.type === 'docs' ? 'docs' : post.type === 'template' ? 'templates' : boardType === 'review' ? 'reviews' : boardType === 'request' ? 'requests' : 'blog'
    window.history.pushState({}, '', `/${base}/${post.slug||post.id}`)
  }

  const handleBack = () => {
    setSelPost(null)
    window.history.pushState({}, '', tab === 'docs' ? '/docs' : tab === 'templates' ? '/templates' : tab === 'reviews' ? '/reviews' : tab === 'requests' ? '/requests' : '/blog')
  }

  const switchTab = (t) => { setTab(t); setSelPost(null); window.history.pushState({}, '', `/${t}`) }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fafafa' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'40px', marginBottom:'16px' }}>📝</div>
        <div style={{ color:'#9ca3af' }}>로딩 중...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#fafafa', fontFamily:'Noto Sans KR, sans-serif' }}>
      <style>{globalStyles}</style>
      {renderNav({ blogAdminMode, switchTab, tab, selPost, currentUser, canWrite, setBlogAdminMode })}
      <div style={{ display:'flex', justifyContent:'center', gap:'20px', padding:'0 16px', maxWidth:'1500px', margin:'0 auto' }}>
        <div className="blog-side-ad" style={{ width:'160px', flexShrink:0, paddingTop:'32px' }}>
          <div style={{ position:'sticky', top:'80px' }}>
            <AdSense slot="1111111111" label="왼쪽 광고" style={{ width:'160px', minHeight:'600px' }} />
          </div>
        </div>
        <div style={{ flex:1, minWidth:0, maxWidth:'1100px' }}>
          {renderMainContent({ blogAdminMode, currentUser, selPost, docsPosts, templatePosts, blogPosts, reviewPosts, requestPosts, handleBack, handleSelect, tab, isAdmin, loggedIn, getWritePermInfo, onPostSaved: loadPosts })}
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
