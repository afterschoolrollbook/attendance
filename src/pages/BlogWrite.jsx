import { parseMarkdown, markdownPreviewStyles } from '../lib/parseMarkdown.js'
import React, { useState, useEffect } from 'react'
import { dbCall } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'
import { getBoardPermissions } from '../constants/permissions.js'

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316', success:'#16a34a', danger:'#ef4444' }
const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:`1.5px solid ${C.border}`, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box', background:'#fff' }

const BOARDS = [
  { key:'blog',    label:'📝 블로그',     color:'#f97316' },
  { key:'review',  label:'⭐ 사용자 후기', color:'#eab308' },
  { key:'qna',     label:'❓ 질문',        color:'#3b82f6' },
  { key:'request', label:'🙏 부탁해요~',   color:'#16a34a' },
  { key:'secret',  label:'🔐 비밀게시판',  color:'#dc2626' },
]

const DEFAULT_CATS = ['출석 관리', '교구 관리', '업무 팁', '공지사항', '업데이트', '기타']

function getBoardPerms() {
  return getBoardPermissions()
}

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

const mdStyles = markdownPreviewStyles + `
`

const emptyForm = (author) => ({ title:'', content:'', category:'', tags:'', boardType:'blog', author:author||'', isPrivateRequest:false })

export function BlogWrite({ user, onLogout }) {
  const userLevel = user?.level || 1
  const isAdmin = user?.role === 'admin' || userLevel >= 10
  const boardPerms = getBoardPerms()

  // 접근 가능한 게시판만 필터링
  const accessibleBoards = BOARDS.filter(b => isAdmin || userLevel >= (boardPerms[b.key]?.access ?? 1))

  const [tab, setTab]         = useState(() => accessibleBoards[0]?.key || 'blog')
  const [view, setView]       = useState('list')
  const [posts, setPosts]     = useState([])
  const [editPost, setEditPost] = useState(null)
  const [form, setForm]       = useState(emptyForm(user?.name))
  const [preview, setPreview] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [blogCategories, setBlogCategories] = useState(DEFAULT_CATS)

  useEffect(() => { loadPosts(); loadCategories() }, [tab])

  const loadCategories = async () => {
    try {
      const rows = await dbCall('getAll', 'customCategories')
      const custom = (rows || []).filter(c => c.type === 'blog').map(c => c.name)
      setBlogCategories([...DEFAULT_CATS, ...custom.filter(n => !DEFAULT_CATS.includes(n))])
    } catch (e) { console.warn('[BlogWrite] 카테고리 로딩 실패:', e) }
  }

  const loadPosts = async () => {
    setLoading(true)
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const filtered = (rows||[]).filter(p => {
        const type = p.boardType || p.type || 'blog'
        if (type !== tab) return false
        // 비밀게시판: 본인+관리자만
        if (tab === 'secret') return isAdmin || p.authorId === user?.id
        // 읽기 권한 체크
        const canRead = isAdmin || userLevel >= (boardPerms[tab]?.read ?? 1)
        return canRead
      }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      setPosts(filtered)
    } catch (e) { console.warn('[BlogWrite] 오류:', e) }
    setLoading(false)
  }

  const handleNew = () => {
    setForm({ ...emptyForm(user?.name), boardType: tab })
    setEditPost(null); setPreview(false); setView('write')
  }

  const handleEdit = (post) => {
    setForm({ title:post.title||'', content:post.content||'', category:post.category||'', tags:(post.tags||[]).join(', '), boardType:post.boardType||post.type||'blog', author:post.author||user?.name||'', isPrivateRequest:!!post.isPrivateRequest })
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
      const isSecret = form.boardType === 'secret'
      const isPrivateRequest = form.boardType === 'request' && !!form.isPrivateRequest
      const payload = {
        id: editPost?.id || uid(),
        type: isSecret ? 'secret' : 'blog',
        boardType: form.boardType,
        isSecret,
        isPrivateRequest,
        title: form.title.trim(),
        slug: editPost?.slug || slugify(form.title),
        content: form.content,
        category: isSecret ? '비밀게시판' : form.boardType === 'qna' ? '질문' : form.boardType === 'review' ? '사용자 후기' : form.boardType === 'request' ? '부탁해요' : form.category,
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

  const currentBoard = BOARDS.find(b => b.key === tab)
  const canRead  = isAdmin || userLevel >= (boardPerms[tab]?.read  ?? 1)
  const canWrite = isAdmin || userLevel >= (boardPerms[tab]?.write ?? 1)

  // 접근 가능한 게시판 없음
  if (accessibleBoards.length === 0) return (
    <div style={{ padding:'40px 24px', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔒</div>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>접근 권한이 없습니다</div>
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
          {editPost ? '글 수정' : `${currentBoard?.label || ''} 글 작성`}
        </h1>
        <button onClick={() => setPreview(v=>!v)} style={{ padding:'7px 16px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:preview?'#f3f4f6':'#fff', color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {preview ? '✏️ 편집' : '👁 미리보기'}
        </button>
        <button onClick={handleSave} disabled={saving} style={{ padding:'7px 20px', borderRadius:'8px', border:'none', background: currentBoard?.color || C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {saving ? '저장 중...' : '🚀 발행'}
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:preview?'1fr 1.2fr':'1fr', gap:'24px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <input value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="제목을 입력하세요"
            style={{...iStyle, fontSize:'17px', fontWeight:700, padding:'12px 14px'}} />

          {tab === 'blog' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'4px' }}>카테고리</div>
                <select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))} style={{...iStyle, background:'#fff'}}>
                  <option value="">카테고리 선택</option>
                  {blogCategories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'4px' }}>태그 (쉼표 구분)</div>
                <input value={form.tags} onChange={e=>setForm(v=>({...v,tags:e.target.value}))} placeholder="방과후, 출석, 팁" style={iStyle} />
              </div>
            </div>
          )}

          {tab === 'secret' && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#dc2626' }}>
              🔐 비밀글 — 내용은 본인과 관리자만 볼 수 있습니다.
            </div>
          )}

          {tab === 'request' && (
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'10px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ fontSize:'13px', color:'#15803d' }}>🙏 관리자에게 원하는 기능이나 도움을 요청해보세요.</div>
              <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontSize:'13px', color:'#15803d', fontWeight:600 }}>
                <input type="checkbox" checked={form.isPrivateRequest} onChange={e=>setForm(v=>({...v,isPrivateRequest:e.target.checked}))} style={{ width:'15px', height:'15px' }} />
                🔒 비밀기능 — 제목만 공개되고 내용은 본인과 관리자만 볼 수 있습니다.
              </label>
            </div>
          )}

          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'4px' }}>본문 (마크다운)</div>
            <textarea value={form.content} onChange={e=>setForm(v=>({...v,content:e.target.value}))} rows={22}
              placeholder={tab==='qna' ? '질문 내용을 입력하세요.' : tab==='review' ? '사용 후기를 작성해주세요.' : tab==='request' ? '관리자에게 요청하고 싶은 기능이나 도움을 자유롭게 작성해주세요.' : '내용을 입력하세요.'}
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

  // ── 목록
  return (
    <div style={{ padding:'24px', maxWidth:'960px', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
          <div>
            <div style={{ fontSize:'22px', fontWeight:800, color:C.text }}>📝 블로그</div>
            <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>방과후 출석부 블로그에 글을 작성하세요.</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <a href="/blog" target="_blank" rel="noopener noreferrer"
              onClick={() => {
                // 새 탭에서도 로그인 유지: sessionStorage 토큰을 localStorage로 복사
                try {
                  const key = Object.keys(sessionStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                  if (key) localStorage.setItem(key, sessionStorage.getItem(key))
                } catch(e) {}
              }}
              style={{ padding:'8px 16px', borderRadius:'9px', border:`1.5px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:'6px' }}>
              🌐 블로그 보러가기 →
            </a>
            <button onClick={onLogout}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:'13px', fontWeight:600, color:'#6b7280', fontFamily:'Noto Sans KR, sans-serif', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
              🚪 로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 게시판 탭 */}
      <div style={{ display:'flex', gap:'0', marginBottom:'24px', borderBottom:`2px solid ${C.border}`, overflowX:'auto', position:'relative' }}>
        {accessibleBoards.map(board => {
          const writeMinLv = boardPerms[board.key]?.write ?? 1
          const readMinLv  = boardPerms[board.key]?.read  ?? 1
          const canWriteThis = isAdmin || userLevel >= writeMinLv
          const isActive = tab === board.key
          return (
            <div key={board.key} style={{ position:'relative' }}
              onMouseEnter={e => { const tip = e.currentTarget.querySelector('.tab-tip'); if(tip) tip.style.display='block' }}
              onMouseLeave={e => { const tip = e.currentTarget.querySelector('.tab-tip'); if(tip) tip.style.display='none' }}>
              <button onClick={() => { setTab(board.key); setView('list') }}
                style={{ padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontSize:'14px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? board.color : C.muted,
                  borderBottom: isActive ? `2px solid ${board.color}` : '2px solid transparent',
                  marginBottom:'-2px', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                {board.label}
              </button>
              {/* 툴팁 */}
              <div className="tab-tip" style={{
                display:'none', position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)',
                marginTop:'8px', background:'#1f2937', color:'#fff', borderRadius:'10px',
                padding:'10px 14px', fontSize:'12px', whiteSpace:'nowrap', zIndex:999,
                boxShadow:'0 4px 16px rgba(0,0,0,0.2)', lineHeight:1.8,
              }}>
                <div>📖 읽기: <strong>Lv.{readMinLv} 이상</strong></div>
                <div>✍️ 글쓰기: <strong>Lv.{writeMinLv} 이상</strong></div>
                <div style={{ marginTop:'6px', paddingTop:'6px', borderTop:'1px solid #374151', color: canWriteThis ? '#4ade80' : '#f87171', fontWeight:700 }}>
                  {canWriteThis ? '✅ 글쓰기 가능' : `🔒 Lv.${writeMinLv} 이상만 가능 (현재 Lv.${userLevel})`}
                </div>
                {/* 말풍선 화살표 */}
                <div style={{ position:'absolute', top:'-5px', left:'50%', transform:'translateX(-50%)', width:'10px', height:'10px', background:'#1f2937', rotate:'45deg' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* 읽기 권한 없음 */}
      {!canRead ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'#f9fafb', borderRadius:'12px', border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:'32px', marginBottom:'10px' }}>🔒</div>
          <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>Lv.{boardPerms[tab]?.read ?? 1} 이상 열람 가능합니다</div>
        </div>
      ) : (
        <>
          {canWrite && (
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
              <button onClick={handleNew} style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background: currentBoard?.color || C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                + 글 작성
              </button>
            </div>
          )}

          {/* 비밀게시판 안내 */}
          {tab === 'secret' && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', fontSize:'13px', color:'#dc2626' }}>
              🔐 제목은 모두에게 보이지만 <strong>내용은 작성자 본인과 관리자만</strong> 열람할 수 있습니다.
            </div>
          )}

          {loading ? (
            <div style={{ textAlign:'center', padding:'48px', color:C.muted }}>불러오는 중...</div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', background:'#f9fafb', borderRadius:'12px', border:`1px dashed ${C.border}` }}>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>{currentBoard?.label?.slice(0,2) || '📝'}</div>
              <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>아직 작성된 글이 없어요</div>
              {canWrite && <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>첫 번째 글을 써보세요!</div>}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {posts.map(post => {
                const isSecret = post.boardType === 'secret' || post.isSecret
                const isLocked = isSecret || !!post.isPrivateRequest
                const canReadContent = isAdmin || !isLocked || post.authorId === user?.id
                const isOwn = post.authorId === user?.id
                return (
                  <div key={post.id} style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${isLocked?'#fca5a5':C.border}`, padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:0, cursor: canReadContent ? 'default' : 'not-allowed' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px',
                          background: isSecret ? '#fef2f2' : `${currentBoard?.color}18`,
                          color: isSecret ? '#dc2626' : currentBoard?.color,
                          border: `1px solid ${isSecret ? '#fca5a5' : currentBoard?.color+'44'}` }}>
                          {currentBoard?.label}
                        </span>
                        {post.category && !isSecret && <span style={{ fontSize:'11px', color:C.muted, background:'#f3f4f6', borderRadius:'4px', padding:'2px 8px' }}>{post.category}</span>}
                        <span style={{ fontSize:'11px', color:C.muted }}>{post.author}</span>
                        <span style={{ fontSize:'11px', color:C.muted }}>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : ''}</span>
                      </div>
                      <div style={{ fontSize:'15px', fontWeight:700, color: canReadContent ? C.text : C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {post.title} {isLocked && !canReadContent && <span style={{ fontSize:'12px' }}>🔒</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      {!isSecret && post.slug && (
                        <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" style={{ padding:'6px 12px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', color:C.muted, fontSize:'12px', fontWeight:600, textDecoration:'none' }}>보기</a>
                      )}
                      {(isOwn || isAdmin) && <>
                        <button onClick={()=>handleEdit(post)} style={{ padding:'6px 12px', borderRadius:'7px', border:`1px solid ${currentBoard?.color}`, background:`${currentBoard?.color}18`, color:currentBoard?.color, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                        <button onClick={()=>handleDelete(post)} style={{ padding:'6px 10px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                      </>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
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
`

const emptyForm = (author) => ({ title:'', content:'', category:'', tags:'', boardType:'blog', author:author||'', isPrivateRequest:false })

export function BlogWrite({ user, onLogout }) {
  const userLevel = user?.level || 1
  const isAdmin = user?.role === 'admin' || userLevel >= 10
  const boardPerms = getBoardPerms()

  // 접근 가능한 게시판만 필터링
  const accessibleBoards = BOARDS.filter(b => isAdmin || userLevel >= (boardPerms[b.key]?.access ?? 1))

  const [tab, setTab]         = useState(() => accessibleBoards[0]?.key || 'blog')
  const [view, setView]       = useState('list')
  const [posts, setPosts]     = useState([])
  const [editPost, setEditPost] = useState(null)
  const [form, setForm]       = useState(emptyForm(user?.name))
  const [preview, setPreview] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [blogCategories, setBlogCategories] = useState(DEFAULT_CATS)

  useEffect(() => { loadPosts(); loadCategories() }, [tab])

  const loadCategories = async () => {
    try {
      const rows = await dbCall('getAll', 'customCategories')
      const custom = (rows || []).filter(c => c.type === 'blog').map(c => c.name)
      setBlogCategories([...DEFAULT_CATS, ...custom.filter(n => !DEFAULT_CATS.includes(n))])
    } catch (e) { console.warn('[BlogWrite] 카테고리 로딩 실패:', e) }
  }

  const loadPosts = async () => {
    setLoading(true)
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const filtered = (rows||[]).filter(p => {
        const type = p.boardType || p.type || 'blog'
        if (type !== tab) return false
        // 비밀게시판: 본인+관리자만
        if (tab === 'secret') return isAdmin || p.authorId === user?.id
        // 읽기 권한 체크
        const canRead = isAdmin || userLevel >= (boardPerms[tab]?.read ?? 1)
        return canRead
      }).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      setPosts(filtered)
    } catch (e) { console.warn('[BlogWrite] 오류:', e) }
    setLoading(false)
  }

  const handleNew = () => {
    setForm({ ...emptyForm(user?.name), boardType: tab })
    setEditPost(null); setPreview(false); setView('write')
  }

  const handleEdit = (post) => {
    setForm({ title:post.title||'', content:post.content||'', category:post.category||'', tags:(post.tags||[]).join(', '), boardType:post.boardType||post.type||'blog', author:post.author||user?.name||'', isPrivateRequest:!!post.isPrivateRequest })
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
      const isSecret = form.boardType === 'secret'
      const isPrivateRequest = form.boardType === 'request' && !!form.isPrivateRequest
      const payload = {
        id: editPost?.id || uid(),
        type: isSecret ? 'secret' : 'blog',
        boardType: form.boardType,
        isSecret,
        isPrivateRequest,
        title: form.title.trim(),
        slug: editPost?.slug || slugify(form.title),
        content: form.content,
        category: isSecret ? '비밀게시판' : form.boardType === 'qna' ? '질문' : form.boardType === 'review' ? '사용자 후기' : form.boardType === 'request' ? '부탁해요' : form.category,
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

  const currentBoard = BOARDS.find(b => b.key === tab)
  const canRead  = isAdmin || userLevel >= (boardPerms[tab]?.read  ?? 1)
  const canWrite = isAdmin || userLevel >= (boardPerms[tab]?.write ?? 1)

  // 접근 가능한 게시판 없음
  if (accessibleBoards.length === 0) return (
    <div style={{ padding:'40px 24px', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔒</div>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>접근 권한이 없습니다</div>
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
          {editPost ? '글 수정' : `${currentBoard?.label || ''} 글 작성`}
        </h1>
        <button onClick={() => setPreview(v=>!v)} style={{ padding:'7px 16px', borderRadius:'8px', border:`1.5px solid ${C.border}`, background:preview?'#f3f4f6':'#fff', color:C.muted, fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {preview ? '✏️ 편집' : '👁 미리보기'}
        </button>
        <button onClick={handleSave} disabled={saving} style={{ padding:'7px 20px', borderRadius:'8px', border:'none', background: currentBoard?.color || C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {saving ? '저장 중...' : '🚀 발행'}
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:preview?'1fr 1.2fr':'1fr', gap:'24px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <input value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="제목을 입력하세요"
            style={{...iStyle, fontSize:'17px', fontWeight:700, padding:'12px 14px'}} />

          {tab === 'blog' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'4px' }}>카테고리</div>
                <select value={form.category} onChange={e=>setForm(v=>({...v,category:e.target.value}))} style={{...iStyle, background:'#fff'}}>
                  <option value="">카테고리 선택</option>
                  {blogCategories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'4px' }}>태그 (쉼표 구분)</div>
                <input value={form.tags} onChange={e=>setForm(v=>({...v,tags:e.target.value}))} placeholder="방과후, 출석, 팁" style={iStyle} />
              </div>
            </div>
          )}

          {tab === 'secret' && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#dc2626' }}>
              🔐 비밀글 — 내용은 본인과 관리자만 볼 수 있습니다.
            </div>
          )}

          {tab === 'request' && (
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'10px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ fontSize:'13px', color:'#15803d' }}>🙏 관리자에게 원하는 기능이나 도움을 요청해보세요.</div>
              <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontSize:'13px', color:'#15803d', fontWeight:600 }}>
                <input type="checkbox" checked={form.isPrivateRequest} onChange={e=>setForm(v=>({...v,isPrivateRequest:e.target.checked}))} style={{ width:'15px', height:'15px' }} />
                🔒 비밀기능 — 제목만 공개되고 내용은 본인과 관리자만 볼 수 있습니다.
              </label>
            </div>
          )}

          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'4px' }}>본문 (마크다운)</div>
            <textarea value={form.content} onChange={e=>setForm(v=>({...v,content:e.target.value}))} rows={22}
              placeholder={tab==='qna' ? '질문 내용을 입력하세요.' : tab==='review' ? '사용 후기를 작성해주세요.' : tab==='request' ? '관리자에게 요청하고 싶은 기능이나 도움을 자유롭게 작성해주세요.' : '내용을 입력하세요.'}
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

  // ── 목록
  return (
    <div style={{ padding:'24px', maxWidth:'960px', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div style={{ marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
          <div>
            <div style={{ fontSize:'22px', fontWeight:800, color:C.text }}>📝 블로그</div>
            <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>방과후 출석부 블로그에 글을 작성하세요.</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <a href="/blog" target="_blank" rel="noopener noreferrer"
              onClick={() => {
                // 새 탭에서도 로그인 유지: sessionStorage 토큰을 localStorage로 복사
                try {
                  const key = Object.keys(sessionStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
                  if (key) localStorage.setItem(key, sessionStorage.getItem(key))
                } catch(e) {}
              }}
              style={{ padding:'8px 16px', borderRadius:'9px', border:`1.5px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', fontWeight:600, textDecoration:'none', display:'flex', alignItems:'center', gap:'6px' }}>
              🌐 블로그 보러가기 →
            </a>
            <button onClick={onLogout}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', cursor:'pointer', fontSize:'13px', fontWeight:600, color:'#6b7280', fontFamily:'Noto Sans KR, sans-serif', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
              🚪 로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 게시판 탭 */}
      <div style={{ display:'flex', gap:'0', marginBottom:'24px', borderBottom:`2px solid ${C.border}`, overflowX:'auto', position:'relative' }}>
        {accessibleBoards.map(board => {
          const writeMinLv = boardPerms[board.key]?.write ?? 1
          const readMinLv  = boardPerms[board.key]?.read  ?? 1
          const canWriteThis = isAdmin || userLevel >= writeMinLv
          const isActive = tab === board.key
          return (
            <div key={board.key} style={{ position:'relative' }}
              onMouseEnter={e => { const tip = e.currentTarget.querySelector('.tab-tip'); if(tip) tip.style.display='block' }}
              onMouseLeave={e => { const tip = e.currentTarget.querySelector('.tab-tip'); if(tip) tip.style.display='none' }}>
              <button onClick={() => { setTab(board.key); setView('list') }}
                style={{ padding:'10px 20px', border:'none', background:'none', cursor:'pointer', fontSize:'14px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? board.color : C.muted,
                  borderBottom: isActive ? `2px solid ${board.color}` : '2px solid transparent',
                  marginBottom:'-2px', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                {board.label}
              </button>
              {/* 툴팁 */}
              <div className="tab-tip" style={{
                display:'none', position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)',
                marginTop:'8px', background:'#1f2937', color:'#fff', borderRadius:'10px',
                padding:'10px 14px', fontSize:'12px', whiteSpace:'nowrap', zIndex:999,
                boxShadow:'0 4px 16px rgba(0,0,0,0.2)', lineHeight:1.8,
              }}>
                <div>📖 읽기: <strong>Lv.{readMinLv} 이상</strong></div>
                <div>✍️ 글쓰기: <strong>Lv.{writeMinLv} 이상</strong></div>
                <div style={{ marginTop:'6px', paddingTop:'6px', borderTop:'1px solid #374151', color: canWriteThis ? '#4ade80' : '#f87171', fontWeight:700 }}>
                  {canWriteThis ? '✅ 글쓰기 가능' : `🔒 Lv.${writeMinLv} 이상만 가능 (현재 Lv.${userLevel})`}
                </div>
                {/* 말풍선 화살표 */}
                <div style={{ position:'absolute', top:'-5px', left:'50%', transform:'translateX(-50%)', width:'10px', height:'10px', background:'#1f2937', rotate:'45deg' }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* 읽기 권한 없음 */}
      {!canRead ? (
        <div style={{ textAlign:'center', padding:'60px 20px', background:'#f9fafb', borderRadius:'12px', border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:'32px', marginBottom:'10px' }}>🔒</div>
          <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>Lv.{boardPerms[tab]?.read ?? 1} 이상 열람 가능합니다</div>
        </div>
      ) : (
        <>
          {canWrite && (
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
              <button onClick={handleNew} style={{ padding:'9px 20px', borderRadius:'9px', border:'none', background: currentBoard?.color || C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                + 글 작성
              </button>
            </div>
          )}

          {/* 비밀게시판 안내 */}
          {tab === 'secret' && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', fontSize:'13px', color:'#dc2626' }}>
              🔐 제목은 모두에게 보이지만 <strong>내용은 작성자 본인과 관리자만</strong> 열람할 수 있습니다.
            </div>
          )}

          {loading ? (
            <div style={{ textAlign:'center', padding:'48px', color:C.muted }}>불러오는 중...</div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', background:'#f9fafb', borderRadius:'12px', border:`1px dashed ${C.border}` }}>
              <div style={{ fontSize:'36px', marginBottom:'10px' }}>{currentBoard?.label?.slice(0,2) || '📝'}</div>
              <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>아직 작성된 글이 없어요</div>
              {canWrite && <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>첫 번째 글을 써보세요!</div>}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {posts.map(post => {
                const isSecret = post.boardType === 'secret' || post.isSecret
                const isLocked = isSecret || !!post.isPrivateRequest
                const canReadContent = isAdmin || !isLocked || post.authorId === user?.id
                const isOwn = post.authorId === user?.id
                return (
                  <div key={post.id} style={{ background:'#fff', borderRadius:'12px', border:`1.5px solid ${isLocked?'#fca5a5':C.border}`, padding:'14px 18px', display:'flex', alignItems:'center', gap:'14px', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:0, cursor: canReadContent ? 'default' : 'not-allowed' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px',
                          background: isSecret ? '#fef2f2' : `${currentBoard?.color}18`,
                          color: isSecret ? '#dc2626' : currentBoard?.color,
                          border: `1px solid ${isSecret ? '#fca5a5' : currentBoard?.color+'44'}` }}>
                          {currentBoard?.label}
                        </span>
                        {post.category && !isSecret && <span style={{ fontSize:'11px', color:C.muted, background:'#f3f4f6', borderRadius:'4px', padding:'2px 8px' }}>{post.category}</span>}
                        <span style={{ fontSize:'11px', color:C.muted }}>{post.author}</span>
                        <span style={{ fontSize:'11px', color:C.muted }}>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : ''}</span>
                      </div>
                      <div style={{ fontSize:'15px', fontWeight:700, color: canReadContent ? C.text : C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {post.title} {isLocked && !canReadContent && <span style={{ fontSize:'12px' }}>🔒</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      {!isSecret && post.slug && (
                        <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" style={{ padding:'6px 12px', borderRadius:'7px', border:`1px solid ${C.border}`, background:'#f9fafb', color:C.muted, fontSize:'12px', fontWeight:600, textDecoration:'none' }}>보기</a>
                      )}
                      {(isOwn || isAdmin) && <>
                        <button onClick={()=>handleEdit(post)} style={{ padding:'6px 12px', borderRadius:'7px', border:`1px solid ${currentBoard?.color}`, background:`${currentBoard?.color}18`, color:currentBoard?.color, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>수정</button>
                        <button onClick={()=>handleDelete(post)} style={{ padding:'6px 10px', borderRadius:'7px', border:'1px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                      </>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
