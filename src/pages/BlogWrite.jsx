import React, { useState, useEffect } from 'react'
import { dbCall } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'
import { Settings } from '../lib/db.js'

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316', success:'#16a34a', danger:'#ef4444' }

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', background:'#fff' }

const BLOG_CATEGORIES = ['출석 관리', '교구 관리', '업무 팁', '기타']

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim() || uid()
}

function sanitize(html) {
  if (typeof window !== 'undefined' && window.DOMPurify)
    return window.DOMPurify.sanitize(html, { ALLOWED_TAGS:['p','br','b','strong','i','em','u','h1','h2','h3','ul','ol','li','blockquote','code','pre','hr','a','img'], ALLOWED_ATTR:['href','src','alt','target','rel'] })
  return html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/on\w+\s*=\s*["'][^"']*["']/gi,'')
}

function parseMd(text) {
  if (!text) return ''
  const html = text
    .replace(/```[\w]*\n?([\s\S]*?)```/g,'<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^---$/gm,'<hr>').replace(/^\- (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>)/gs,'<ul>$1</ul>')
    .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
    .split('\n\n').map(p=>p.trim()).filter(Boolean)
    .map(p=>/^<(h[1-3]|ul|ol|li|pre|blockquote|hr)/.test(p)?p:`<p>${p.replace(/\n/g,'<br>')}</p>`)
    .join('\n')
  return sanitize(html)
}

const mdStyles = `
  .md-preview h1{font-size:20px;font-weight:800;margin:16px 0 8px;color:#111827}
  .md-preview h2{font-size:17px;font-weight:700;margin:14px 0 6px;color:#1f2937;border-bottom:2px solid #f3f4f6;padding-bottom:4px}
  .md-preview h3{font-size:15px;font-weight:700;margin:12px 0 4px;color:#374151}
  .md-preview p{margin:8px 0;line-height:1.8;color:#374151}
  .md-preview ul,ol{padding-left:20px;margin:8px 0}
  .md-preview li{margin:4px 0;line-height:1.7}
  .md-preview strong{font-weight:700;color:#111827}
  .md-preview em{font-style:italic}
  .md-preview code{background:#f3f4f6;padding:2px 5px;border-radius:4px;font-size:12px;color:#e11d48}
  .md-preview pre{background:#1f2937;color:#f9fafb;padding:12px 16px;border-radius:8px;overflow-x:auto;margin:12px 0}
  .md-preview blockquote{border-left:4px solid #f97316;padding:6px 12px;background:#fff7ed;margin:12px 0;border-radius:0 6px 6px 0;color:#92400e;font-style:italic}
  .md-preview a{color:#f97316;text-decoration:underline}
  .md-preview hr{border:none;border-top:2px solid #f3f4f6;margin:16px 0}
  .md-preview img{max-width:100%;border-radius:8px;margin:4px 0}
`

const emptyForm = (author) => ({ title:'', content:'', category:'', tags:'', summary:'', author: author||'', isSecret: false })

export function BlogWrite({ user }) {
  const isAdmin = user?.role === 'admin' || (user?.level||1) >= 10
  const blogWriteMinLevel = Settings.get('blogWriteMinLevel') ?? 1
  const canWrite = isAdmin || (user?.level||1) >= blogWriteMinLevel

  const [view, setView]       = useState('list') // 'list' | 'write'
  const [posts, setPosts]     = useState([])
  const [editPost, setEditPost] = useState(null)
  const [form, setForm]       = useState(emptyForm(user?.name))
  const [preview, setPreview] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadPosts() }, [])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      // 내 글 + 비밀글은 본인+관리자만
      const mine = (rows||[]).filter(p => {
        if (p.isSecret || p.type === 'secret') return isAdmin || p.authorId === user?.id
        return p.authorId === user?.id
      }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      setPosts(mine)
    } catch {}
    setLoading(false)
  }

  const handleNew = () => { setForm(emptyForm(user?.name)); setEditPost(null); setPreview(false); setView('write') }
  const handleEdit = (post) => {
    setForm({ title:post.title||'', content:post.content||'', category:post.category||'', tags:(post.tags||[]).join(', '), summary:post.summary||'', author:post.author||user?.name||'', isSecret: !!(post.isSecret||post.type==='secret') })
    setEditPost(post); setPreview(false); setView('write')
  }
  const handleDelete = async (post) => {
    if (!window.confirm(`"${post.title}" 을(를) 삭제하시겠습니까?`)) return
    try { await dbCall('delete','blogPosts',{id:post.id}); loadPosts() } catch { alert('삭제 실패') }
  }

  const handleSave = async () => {
    if (!form.title.trim()) return alert('제목을 입력해주세요.')
    if (!form.content.trim()) return alert('내용을 입력해주세요.')
    setSaving(true)
    try {
      const tags = form.tags ? form.tags.split(',').map(t=>t.trim()).filter(Boolean) : []
      const payload = {
        id: editPost?.id || uid(),
        type: form.isSecret ? 'secret' : 'blog',
        isSecret: form.isSecret,
        title: form.title.trim(),
        slug: editPost?.slug || slugify(form.title),
        summary: form.summary.trim(),
        content: form.content,
        category: form.isSecret ? '비밀게시판' : form.category,
        tags, author: form.author||user?.name, authorId: user?.id,
        status: 'published',
        publishedAt: now(), updatedAt: now(),
        createdAt: editPost ? undefined : now(),
      }
      if (editPost?.id) await dbCall('update','blogPosts',{id:editPost.id,patch:payload})
      else await dbCall('insert','blogPosts',payload)
      setView('list'); setEditPost(null); loadPosts()
    } catch(e) { alert('저장 실패: '+e.message) }
    setSaving(false)
  }

  // ── 권한 없음
  if (!canWrite) return (
    <div style={{ padding:'40px 24px', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔒</div>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>Lv.{blogWriteMinLevel} 이상 이용 가능합니다</div>
      <div style={{ fontSize:'13px', color:C.muted, marginTop:'6px' }}>관리자에게 문의해주세요.</div>
    </div>
  )

  // ── 글쓰기 폼
  if (view === 'write') return (
    <div style={{ padding:'24px', maxWidth:'1400px', fontFamily:'Noto Sans KR, sans-serif' }}>
      <style>{mdStyles}</style>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px', flexWrap:'wrap' }}>
        <button onClick={() => setView('list')} style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, fontSize:'14px', padding:0, fontFamily:'Noto Sans KR, sans-serif' }}>← 목록</button>
        <h1 style={{ fontSize:'20px', fontWeight:700, color:C.text, flex:1 }}>
          {editPost ? '글 수정' : form.isSecret ? '🔐 비밀글 작성' : '📝 블로그 글 작성'}
        </h1>
        <button onClick={() => setPreview(v=>!v)} style={{ padding:'7px 16px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:preview?'#f3f4f6':'#fff', color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {preview ? '✏️ 편집' : '👁 미리보기'}
        </button>
        <button onClick={handleSave} disabled={saving} style={{ padding:'7px 20px', borderRadius:'8px', border:'none', background:form.isSecret?'#dc2626':C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {saving ? '저장 중...' : '🚀 발행'}
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:preview?'1fr 1.2fr':'1fr', gap:'24px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* 비밀글 여부 */}
          <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', border:`1.5px solid ${form.isSecret?'#fca5a5':C.border}`, background:form.isSecret?'#fef2f2':'#fff', cursor:'pointer' }}>
            <input type="checkbox" checked={form.isSecret} onChange={e=>setForm(v=>({...v,isSecret:e.target.checked}))} style={{ width:'16px', height:'16px', cursor:'pointer' }} />
            <div>
              <div style={{ fontSize:'14px', fontWeight:600, color:form.isSecret?'#dc2626':C.text }}>🔐 비밀글</div>
              <div style={{ fontSize:'12px', color:C.muted }}>제목만 공개되고 내용은 본인과 관리자만 볼 수 있습니다</div>
            </div>
          </label>

          <input value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="제목을 입력하세요"
            style={{...iStyle, fontSize:'17px', fontWeight:700, padding:'12px 14px'}} />

          {!form.isSecret && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'4px' }}>카테고리</div>
                <select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))} style={{...iStyle, background:'#fff'}}>
                  <option value="">카테고리 선택</option>
                  {BLOG_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'4px' }}>태그 (쉼표 구분)</div>
                <input value={form.tags} onChange={e=>setForm(v=>({...v,tags:e.target.value}))} placeholder="방과후, 출석, 팁" style={iStyle} />
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'4px' }}>본문 (마크다운)</div>
            <textarea value={form.content} onChange={e=>setForm(v=>({...v,content:e.target.value}))} rows={22}
              placeholder="내용을 입력하세요."
              style={{...iStyle, resize:'vertical', fontFamily:'monospace', fontSize:'13px', lineHeight:1.7}} />
          </div>
        </div>

        {preview && (
          <div style={{ background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}`, padding:'24px', overflowY:'auto', maxHeight:'85vh', position:'sticky', top:'24px' }}>
            <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, marginBottom:'12px', textTransform:'uppercase' }}>미리보기</div>
            <h1 style={{ fontSize:'20px', fontWeight:800, color:C.text, marginBottom:'12px' }}>{form.title||'(제목 없음)'}</h1>
            <div className="md-preview" dangerouslySetInnerHTML={{__html:parseMd(form.content)}} />
          </div>
        )}
      </div>
    </div>
  )

  // ── 내 글 목록
  return (
    <div style={{ padding:'24px', maxWidth:'900px', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ fontSize:'22px', fontWeight:800, color:C.text }}>📝 블로그</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>방과후 출석부 블로그에 글을 작성하세요.</div>
        </div>
        <button onClick={handleNew} style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 새 글 작성
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'48px', color:C.muted }}>불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'#f9fafb', borderRadius:'12px', border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>📝</div>
          <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>아직 작성한 글이 없어요</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>첫 번째 글을 써보세요!</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {posts.map(post => {
            const isSecret = post.isSecret || post.type === 'secret'
            return (
              <div key={post.id} style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${isSecret?'#fca5a5':C.border}`, padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                    {isSecret
                      ? <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fca5a5' }}>🔐 비밀글</span>
                      : <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa' }}>📝 블로그</span>
                    }
                    {post.category && !isSecret && <span style={{ fontSize:'11px', color:C.muted, background:'#f3f4f6', borderRadius:'4px', padding:'2px 8px' }}>{post.category}</span>}
                    <span style={{ fontSize:'11px', color:C.muted }}>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : ''}</span>
                  </div>
                  <div style={{ fontSize:'15px', fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{post.title}</div>
                </div>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  {!isSecret && post.slug && (
                    <a href={`/blog/${post.slug}`} target="_blank" style={{ padding:'6px 12px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', color:C.muted, fontSize:'12px', fontWeight:600, textDecoration:'none' }}>보기</a>
                  )}
                  <button onClick={()=>handleEdit(post)} style={{ padding:'6px 14px', borderRadius:'7px', border:`1px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                  <button onClick={()=>handleDelete(post)} style={{ padding:'6px 12px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
