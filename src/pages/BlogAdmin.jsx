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
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/javascript\s*:/gi, '')
}

import React, { useState, useEffect } from 'react'
import { dbCall } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'
import { getBoardPermLevel } from '../constants/permissions.js'

function getBlogWriteMinLevel()     { return getBoardPermLevel('blog', 'write') }
function getBlogNoticeMinLevel()    { return getBoardPermLevel('notice', 'write') }
function getDocsWriteMinLevel()     { return getBoardPermLevel('docs', 'write') }
function getTemplateWriteMinLevel() { return getBoardPermLevel('template', 'write') }

const DEFAULT_BLOG_CATS = ['출석 관리', '교구 관리', '업무 팁', '공지사항', '업데이트', '기타']
const DOCS_CATEGORIES = ['시작하기', '출석부', '교구 관리', '학생 관리', '수업 관리', '리포트', '설정', '기타']
const TEMPLATE_CATEGORIES = ['출석부 양식', '가정통신문', '수업 계획서', '교구 관리표', '학생 평가표', '수업료 안내', '기타 서식']

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

const previewStyles = `
  .md-preview h1 { font-size:22px;font-weight:800;margin:20px 0 10px;color:#111827; }
  .md-preview h2 { font-size:18px;font-weight:700;margin:16px 0 8px;color:#1f2937;border-bottom:2px solid #f3f4f6;padding-bottom:6px; }
  .md-preview h3 { font-size:16px;font-weight:700;margin:14px 0 6px;color:#374151; }
  .md-preview p  { margin:10px 0;line-height:1.8;color:#374151; }
  .md-preview ul,ol { padding-left:22px;margin:10px 0; }
  .md-preview li { margin:5px 0;line-height:1.7; }
  .md-preview strong { font-weight:700;color:#111827; }
  .md-preview em { font-style:italic; }
  .md-preview code { background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;font-family:monospace;color:#e11d48; }
  .md-preview pre { background:#1f2937;color:#f9fafb;padding:14px 18px;border-radius:8px;overflow-x:auto;margin:14px 0; }
  .md-preview pre code { background:none;color:inherit;padding:0; }
  .md-preview blockquote { border-left:4px solid #f97316;padding:8px 14px;background:#fff7ed;margin:14px 0;border-radius:0 6px 6px 0;color:#92400e;font-style:italic; }
  .md-preview a { color:#f97316;text-decoration:underline; }
  .md-preview hr { border:none;border-top:2px solid #f3f4f6;margin:20px 0; }
  .md-preview img { max-width:100%;border-radius:8px;margin:6px 0; }
`

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', background:'#fff' }

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

const emptyForm = () => ({
  type: 'blog', title:'', slug:'', summary:'', content:'', category:'', tags:'',
  coverImage:'', author:'관리자', status:'draft', publishedAt: new Date().toISOString().slice(0,10),
  templateFile:'', templateDesc:'',
})

const C = { primary:'#f97316', border:'#e5e7eb', muted:'#6b7280', text:'#111827', card:'#fff' }

export function BlogAdmin({ user }) {
  const userLevel = user?.level || 1
  const isAdmin = user?.role === 'admin' || userLevel >= 10
  const blogWriteMinLevel = getBlogWriteMinLevel()
  const blogNoticeMinLevel = getBlogNoticeMinLevel()
  const docsWriteMinLevel = getDocsWriteMinLevel()
  const templateWriteMinLevel = getTemplateWriteMinLevel()
  const canWrite = isAdmin || userLevel >= blogWriteMinLevel
  const canWriteNotice = isAdmin || userLevel >= blogNoticeMinLevel
  const canWriteDocs = isAdmin || userLevel >= docsWriteMinLevel
  const canWriteTemplate = isAdmin || userLevel >= templateWriteMinLevel

  const [posts, setPosts] = useState([])
  const [view, setView] = useState('list')
  const [form, setForm] = useState(emptyForm())
  const [editId, setEditId] = useState(null)
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [myPostsOnly, setMyPostsOnly] = useState(false)
  const [blogCategories, setBlogCategories] = useState(DEFAULT_BLOG_CATS)
  const { success, error } = useToast()

  // state 선언 이후에 blogCategories 참조
  const filteredBlogCategories = blogCategories.filter(c =>
    canWriteNotice ? true : (c !== '공지사항' && c !== '업데이트')
  )

  useEffect(() => { loadPosts(); loadCategories() }, [])

  const loadCategories = async () => {
    try {
      const rows = await dbCall('getAll', 'customCategories')
      const custom = (rows || []).filter(c => c.type === 'blog').map(c => c.name)
      setBlogCategories([...DEFAULT_BLOG_CATS, ...custom.filter(n => !DEFAULT_BLOG_CATS.includes(n))])
    } catch (e) { console.warn('[BlogAdmin] 카테고리 로딩 실패:', e) }
  }

  const loadPosts = async () => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      setPosts((rows||[]).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)))
    } catch { error('불러오기 실패') }
  }

  const handleNew = (type = 'blog') => {
    setForm({ ...emptyForm(), type })
    setEditId(null); setPreview(false); setView('edit')
  }

  const handleEdit = (post) => {
    setForm({
      type: post.type || 'blog',
      title: post.title||'', slug: post.slug||'', summary: post.summary||'',
      content: post.content||'', category: post.category||'',
      tags: (post.tags||[]).join(', '), coverImage: post.coverImage||'',
      author: post.author||'관리자', status: post.status||'draft',
      publishedAt: post.publishedAt ? post.publishedAt.slice(0,10) : new Date().toISOString().slice(0,10),
      templateFile: post.templateFile||'', templateDesc: post.templateDesc||'',
    })
    setEditId(post.id); setPreview(false); setView('edit')
  }

  const handleDelete = async (post) => {
    if (!window.confirm(`"${post.title}" 을(를) 삭제하시겠습니까?`)) return
    try {
      await dbCall('delete', 'blogPosts', { id: post.id })
      success('삭제되었습니다.')
      loadPosts()
    } catch { error('삭제 실패') }
  }

  const handleSave = async (status) => {
    if (!form.title.trim()) { error('제목을 입력해주세요'); return }
    if (!form.content.trim()) { error('내용을 입력해주세요'); return }
    setLoading(true)
    try {
      const slug = form.slug.trim() || slugify(form.title)
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      const finalStatus = status || form.status
      const basePayload = {
        id: editId || uid(),
        type: form.type,
        title: form.title.trim(), slug, summary: form.summary.trim(),
        content: form.content, category: form.category, tags,
        coverImage: form.coverImage.trim(), author: form.author.trim(),
        authorId: user?.id || null,
        status: finalStatus,
        publishedAt: finalStatus==='published' ? (form.publishedAt ? new Date(form.publishedAt).toISOString() : now()) : null,
        updatedAt: now(),
        templateFile: form.type==='template' ? form.templateFile.trim() : undefined,
        templateDesc: form.type==='template' ? form.templateDesc.trim() : undefined,
      }
      const payload = editId ? basePayload : { ...basePayload, createdAt: now() }
      if (editId) await dbCall('update', 'blogPosts', { id: editId, patch: payload })
      else await dbCall('insert', 'blogPosts', payload)
      success(finalStatus==='published' ? '발행되었습니다! 🎉' : '임시저장되었습니다.')
      loadPosts(); setView('list')
    } catch (e) { error('저장 실패: ' + e.message) }
    setLoading(false)
  }

  const filteredPosts = posts.filter(p => {
    const typeMatch = filterType === 'all' || (p.type||'blog') === filterType
    const authorMatch = !myPostsOnly || p.authorId === (user?.id)
    return typeMatch && authorMatch
  })
  const categories = form.type === 'docs' ? DOCS_CATEGORIES : form.type === 'template' ? TEMPLATE_CATEGORIES : filteredBlogCategories

  // ── 목록 뷰
  if (view === 'list') return (
    <div style={{ padding:'24px', maxWidth:'1000px' }}>
      <style>{previewStyles}</style>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:700, color:C.text }}>📝 블로그 · 설명서 관리</h1>
          <p style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>블로그 글과 사용 설명서를 작성하고 관리하세요.</p>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <a href="/blog" target="_blank" rel="noopener noreferrer" title="발행된 블로그 페이지를 새 탭으로 봅니다"
            onClick={() => {
              // 새 탭에서도 로그인 유지: sessionStorage 토큰을 localStorage로 복사
              try {
                const key = Object.keys(sessionStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                if (key) localStorage.setItem(key, sessionStorage.getItem(key))
              } catch(e) {}
            }}
            style={{ padding:'9px 16px', borderRadius:'9px', border:`1.5px solid ${C.border}`, background:C.card, color:C.muted, fontSize:'13px', fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:'6px' }}>
            🌐 블로그 보기
          </a>
          <a href="/docs" target="_blank" rel="noopener noreferrer" title="발행된 설명서 페이지를 새 탭으로 봅니다"
            onClick={() => {
              // 새 탭에서도 로그인 유지: sessionStorage 토큰을 localStorage로 복사
              try {
                const key = Object.keys(sessionStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                if (key) localStorage.setItem(key, sessionStorage.getItem(key))
              } catch(e) {}
            }}
            style={{ padding:'9px 16px', borderRadius:'9px', border:`1.5px solid #bfdbfe`, background:'#eff6ff', color:'#3b82f6', fontSize:'13px', fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:'6px' }}>
            📖 설명서 보기
          </a>
          {canWrite && <>
          <button onClick={() => handleNew('blog')} title="블로그 글을 새로 작성합니다"
            style={{ padding:'9px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            + 블로그 글
          </button>
          {canWriteDocs && <button onClick={() => handleNew('docs')} title={`사용 설명서를 새로 작성합니다 (Lv.${docsWriteMinLevel} 이상)`}
            style={{ padding:'9px 18px', borderRadius:'9px', border:'none', background:'#3b82f6', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            + 설명서
          </button>}
          {canWriteTemplate && <button onClick={() => handleNew('template')} title={`템플릿을 새로 등록합니다 (Lv.${templateWriteMinLevel} 이상)`}
            style={{ padding:'9px 18px', borderRadius:'9px', border:'none', background:'#7c3aed', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            + 템플릿
          </button>}
          </>}
          {!canWrite && (
            <div style={{ fontSize:'13px', color:'#9ca3af', padding:'9px 12px', borderRadius:'9px', background:'#f9fafb', border:'1.5px solid #e5e7eb' }}>
              🔒 Lv.{blogWriteMinLevel} 이상 글 작성 가능 (현재 Lv.{userLevel})
            </div>
          )}
        </div>
      </div>

      {/* 타입 필터 탭 + 내 글만 보기 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'10px', marginBottom:'20px' }}>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {[['all','전체'],['blog','블로그'],['docs','설명서'],['template','📋 템플릿']].map(([key,label]) => (
            <button key={key} onClick={() => setFilterType(key)}
              style={{ padding:'6px 16px', borderRadius:'8px', border:`1.5px solid ${filterType===key?(key==='template'?'#7c3aed':C.primary):C.border}`, background:filterType===key?(key==='template'?'#f5f3ff':'#fff7ed'):C.card, color:filterType===key?(key==='template'?'#7c3aed':C.primary):C.muted, fontSize:'13px', fontWeight:filterType===key?700:500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              {label} {key==='all'?posts.length:posts.filter(p=>(p.type||'blog')===key).length}
            </button>
          ))}
        </div>
        {user && (
          <button onClick={() => setMyPostsOnly(v => !v)}
            style={{ padding:'6px 16px', borderRadius:'8px', border:`1.5px solid ${myPostsOnly?'#059669':'#e5e7eb'}`, background:myPostsOnly?'#ecfdf5':'#fff', color:myPostsOnly?'#059669':'#6b7280', fontSize:'13px', fontWeight:myPostsOnly?700:500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', gap:'6px' }}>
            {myPostsOnly ? '✅ 내 글만 보는 중' : '👤 내 글만 보기'}
          </button>
        )}
      </div>

      {/* 글 목록 */}
      {filteredPosts.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>📝</div>
          <div style={{ fontSize:'15px', fontWeight:600 }}>아직 작성된 글이 없습니다</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {filteredPosts.map(post => (
            <div key={post.id} style={{ background:C.card, borderRadius:'12px', border:`1.5px solid ${C.border}`, padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'11px', fontWeight:700, borderRadius:'4px', padding:'2px 8px', background:(post.type||'blog')==='docs'?'#eff6ff':(post.type||'blog')==='template'?'#f5f3ff':'#fff7ed', color:(post.type||'blog')==='docs'?'#3b82f6':(post.type||'blog')==='template'?'#7c3aed':'#f97316', border:`1px solid ${(post.type||'blog')==='docs'?'#bfdbfe':(post.type||'blog')==='template'?'#ddd6fe':'#fed7aa'}` }}>
                    {(post.type||'blog')==='docs'?'📖 설명서':(post.type||'blog')==='template'?'📋 템플릿':'📝 블로그'}
                  </span>
                  <span style={{ fontSize:'11px', fontWeight:700, borderRadius:'999px', padding:'2px 10px', background:post.status==='published'?'#f0fdf4':'#f9fafb', color:post.status==='published'?'#16a34a':'#9ca3af', border:`1px solid ${post.status==='published'?'#86efac':'#e5e7eb'}` }}>
                    {post.status==='published'?'✅ 발행':'📝 임시'}
                  </span>
                  {post.category && <span style={{ fontSize:'11px', color:C.muted, background:'#f3f4f6', borderRadius:'4px', padding:'2px 8px' }}>{post.category}</span>}
                </div>
                <div style={{ fontSize:'15px', fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'3px' }}>{post.title}</div>
                <div style={{ fontSize:'12px', color:C.muted }}>
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : '날짜 없음'}
                  {post.slug && <span style={{ marginLeft:'8px', opacity:.6 }}>/{post.type==='docs'?'docs':'blog'}/{post.slug}</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                {post.status==='published' && (
                  <a href={`/${post.type==='docs'?'docs':'blog'}/${post.slug||post.id}`} target="_blank" rel="noopener noreferrer"
                    style={{ padding:'6px 12px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', color:C.muted, fontSize:'12px', fontWeight:600, textDecoration:'none' }}>보기</a>
                )}
                {(() => {
                  const type = post.type || 'blog'
                  const canEditThis = type === 'docs' ? canWriteDocs : type === 'template' ? canWriteTemplate : canWrite
                  return canEditThis && <>
                    <button onClick={() => handleEdit(post)}
                      style={{ padding:'6px 14px', borderRadius:'7px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                    <button onClick={() => handleDelete(post)}
                      style={{ padding:'6px 12px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                  </>
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── 편집 뷰
  const typeColor = form.type === 'docs' ? '#3b82f6' : C.primary
  return (
    <div style={{ padding:'24px', maxWidth:'1600px' }}>
      <style>{previewStyles}</style>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px', flexWrap:'wrap' }}>
        <button onClick={() => setView('list')}
          style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', padding:0 }}>← 목록</button>
        <h1 style={{ fontSize:'20px', fontWeight:700, color:C.text, flex:1 }}>
          {editId ? '글 수정' : (form.type==='docs'?'📖 설명서 작성':'📝 블로그 글 작성')}
        </h1>
        <button onClick={() => setPreview(v => !v)}
          style={{ padding:'7px 16px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:preview?'#f3f4f6':C.card, color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {preview ? '✏️ 편집' : '👁 미리보기'}
        </button>
        <button onClick={() => handleSave('draft')} disabled={loading}
          style={{ padding:'7px 16px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:C.card, color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          임시저장
        </button>
        <button onClick={() => handleSave('published')} disabled={loading}
          style={{ padding:'7px 20px', borderRadius:'8px', border:'none', background:typeColor, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {loading ? '저장 중...' : '🚀 발행'}
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:preview?'1fr 1.2fr':'1fr', gap:'24px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* 타입 선택 */}
          {!editId && (
            <div style={{ display:'flex', gap:'8px' }}>
              {[['blog','📝 블로그 글',C.primary,canWrite],['docs','📖 사용 설명서','#3b82f6',canWriteDocs],['template','📋 템플릿','#7c3aed',canWriteTemplate]].filter(([,,,allowed]) => allowed).map(([key,label,color]) => (
                <button key={key} onClick={() => setForm(v => ({ ...v, type:key, category:'' }))}
                  style={{ flex:1, padding:'10px', borderRadius:'9px', border:`2px solid ${form.type===key?color:C.border}`, background:form.type===key?`${color}10`:C.card, color:form.type===key?color:C.muted, fontSize:'14px', fontWeight:form.type===key?700:500, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* 제목 */}
          <input value={form.title} onChange={e => setForm(v => ({ ...v, title:e.target.value, slug:v.slug||slugify(e.target.value) }))}
            placeholder="제목을 입력하세요"
            style={{ ...iStyle, fontSize:'18px', fontWeight:700, padding:'12px 14px' }} />

          {/* slug / 카테고리 / 발행일 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>URL 슬러그</label>
              <input value={form.slug} onChange={e => setForm(v => ({ ...v, slug:e.target.value }))} placeholder="url-slug" style={iStyle} />
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>카테고리</label>
              <select value={form.category} onChange={e => setForm(v => ({ ...v, category:e.target.value }))} style={{ ...iStyle, background:'#fff' }}>
                <option value="">카테고리 선택</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>발행일</label>
              <input type="date" value={form.publishedAt} onChange={e => setForm(v => ({ ...v, publishedAt:e.target.value }))} style={iStyle} />
            </div>
          </div>

          {/* 요약 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>요약 (SEO description)</label>
            <textarea value={form.summary} onChange={e => setForm(v => ({ ...v, summary:e.target.value }))} rows={2}
              placeholder="검색엔진에 표시될 요약 문구"
              style={{ ...iStyle, resize:'vertical' }} maxLength={200} />
          </div>

          {/* 커버 이미지 — 블로그만 */}
          {form.type === 'blog' && (
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>커버 이미지 URL</label>
              <input value={form.coverImage} onChange={e => setForm(v => ({ ...v, coverImage:e.target.value }))} placeholder="https://..." style={iStyle} />
            </div>
          )}

          {/* 템플릿 전용 필드 */}
          {form.type === 'template' && (
            <>
              <div style={{ background:'#f5f3ff', border:'1.5px solid #ddd6fe', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#7c3aed', marginBottom:'12px' }}>📋 템플릿 파일 정보</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>파일 다운로드 URL (구글 드라이브, Dropbox 등)</label>
                    <input value={form.templateFile} onChange={e => setForm(v => ({ ...v, templateFile:e.target.value }))} placeholder="https://drive.google.com/..." style={iStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>파일 설명 (형식, 용도 등)</label>
                    <input value={form.templateDesc} onChange={e => setForm(v => ({ ...v, templateDesc:e.target.value }))} placeholder="예: 엑셀(.xlsx) | A4 출석부 양식 | 수정 가능" style={iStyle} />
                  </div>
                </div>
              </div>
              <div>
                <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>미리보기 이미지 URL</label>
                <input value={form.coverImage} onChange={e => setForm(v => ({ ...v, coverImage:e.target.value }))} placeholder="https://... (템플릿 미리보기 이미지)" style={iStyle} />
              </div>
            </>
          )}

          {/* 태그 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>태그 (쉼표로 구분)</label>
            <input value={form.tags} onChange={e => setForm(v => ({ ...v, tags:e.target.value }))} placeholder="출석관리, 방과후, 로봇교육" style={iStyle} />
          </div>

          {/* 본문 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'4px' }}>
              본문 (마크다운)
              {form.type==='docs' && <span style={{ marginLeft:'8px', fontWeight:400, color:'#9ca3af' }}>— ## 소제목으로 목차 구성 권장</span>}
            </label>
            <textarea value={form.content} onChange={e => setForm(v => ({ ...v, content:e.target.value }))} rows={24}
              placeholder={form.type==='docs'
                ? `# 기능 제목\n\n기능에 대한 설명을 입력하세요.\n\n## 사용 방법\n\n1. 첫 번째 단계\n2. 두 번째 단계\n\n## 주의 사항\n\n- 항목 1\n- 항목 2`
                : `# 제목\n\n본문을 마크다운으로 작성하세요.\n\n## 소제목\n\n- 항목 1\n- 항목 2\n\n**굵게** *기울임* \`코드\``
              }
              style={{ ...iStyle, resize:'vertical', fontFamily:'monospace', fontSize:'13px', lineHeight:1.7 }} />
          </div>
        </div>

        {/* 미리보기 */}
        {preview && (
          <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, padding:'28px', overflowY:'auto', maxHeight:'90vh', position:'sticky', top:'24px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, marginBottom:'16px', textTransform:'uppercase', letterSpacing:'1px' }}>미리보기</div>
            {form.coverImage && form.type==='blog' && <img src={form.coverImage} alt="" style={{ width:'100%', height:'160px', objectFit:'cover', borderRadius:'10px', marginBottom:'20px' }} />}
            {form.category && (
              <span style={{ fontSize:'11px', fontWeight:700, borderRadius:'999px', padding:'3px 10px', marginBottom:'12px', display:'inline-block', background:form.type==='docs'?'#eff6ff':'#fff7ed', color:form.type==='docs'?'#3b82f6':C.primary, border:`1px solid ${form.type==='docs'?'#bfdbfe':'#fed7aa'}` }}>
                {form.category}
              </span>
            )}
            <h1 style={{ fontSize:'22px', fontWeight:800, color:C.text, marginTop:'10px', marginBottom:'16px', lineHeight:1.4 }}>{form.title || '제목 없음'}</h1>
            {form.summary && (
              <div style={{ background:form.type==='docs'?'#eff6ff':'#fff7ed', border:`1px solid ${form.type==='docs'?'#bfdbfe':'#fed7aa'}`, borderRadius:'8px', padding:'12px 16px', marginBottom:'20px', fontSize:'14px', color:form.type==='docs'?'#1e40af':'#92400e', lineHeight:1.7 }}>
                {form.summary}
              </div>
            )}
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: parseMarkdown(form.content) }} />
          </div>
        )}
      </div>
    </div>
  )
}
