import React, { useState, useEffect } from 'react'
import { dbCall } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'

const C = {
  border: '#e5e7eb', text: '#111827', muted: '#6b7280',
  primary: '#f97316', success: '#16a34a', danger: '#ef4444', card: '#ffffff',
}

const iStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '8px',
  border: `1.5px solid ${C.border}`, fontSize: '14px',
  fontFamily: 'Noto Sans KR, sans-serif', outline: 'none',
  boxSizing: 'border-box', background: '#fff',
}

const BLOG_CATEGORIES = ['출석 관리', '교구 관리', '업무 팁', '공지사항', '업데이트', '기타']

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

function sanitize(html) {
  if (typeof window !== 'undefined' && window.DOMPurify)
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p','br','b','strong','i','em','u','h1','h2','h3','ul','ol','li','blockquote','code','pre','hr','a','img'],
      ALLOWED_ATTR: ['href','src','alt','target','rel'],
    })
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
}

function parseMd(text) {
  if (!text) return ''
  const html = text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^---$/gm, '<hr>').replace(/^\- (.+)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .split('\n\n').map(p => p.trim()).filter(Boolean)
    .map(p => /^<(h[1-3]|ul|ol|li|pre|blockquote|hr)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)
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

function Btn({ onClick, children, color = C.primary, disabled, size = 'md' }) {
  const pad = size === 'sm' ? '6px 14px' : '8px 18px'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: pad, borderRadius: '9px', border: 'none',
      background: disabled ? '#e5e7eb' : color, color: '#fff',
      fontSize: '13px', fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
      fontFamily: 'Noto Sans KR, sans-serif',
    }}>{children}</button>
  )
}

function OutlineBtn({ onClick, children, size = 'md' }) {
  const pad = size === 'sm' ? '5px 12px' : '8px 16px'
  return (
    <button onClick={onClick} style={{
      padding: pad, borderRadius: '9px', border: `1.5px solid ${C.border}`,
      background: '#fff', color: C.muted, fontSize: '13px', fontWeight: 600,
      cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
    }}>{children}</button>
  )
}

// ── 글 작성/수정 폼
function PostForm({ user, post, isSecret, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: post?.title || '',
    content: post?.content || '',
    category: post?.category || '',
    tags: post ? (post.tags || []).join(', ') : '',
    summary: post?.summary || '',
  })
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.title.trim()) return alert('제목을 입력해주세요.')
    if (!form.content.trim()) return alert('내용을 입력해주세요.')
    setSaving(true)
    try {
      const tags = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
      const payload = {
        id: post?.id || uid(),
        type: isSecret ? 'secret' : 'blog',
        title: form.title.trim(),
        slug: post?.slug || slugify(form.title) || uid(),
        summary: form.summary.trim(),
        content: form.content,
        category: isSecret ? '비밀게시판' : form.category,
        tags,
        author: user.name,
        authorId: user.id,
        status: 'published',
        isSecret: isSecret || false,
        publishedAt: now(),
        updatedAt: now(),
        createdAt: post ? undefined : now(),
      }
      if (post?.id) await dbCall('update', 'blogPosts', { id: post.id, patch: payload })
      else await dbCall('insert', 'blogPosts', payload)
      onSave()
    } catch (e) { alert('저장 실패: ' + e.message) }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{mdStyles}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
          {post ? '글 수정' : isSecret ? '🔐 비밀 글 작성' : '✍️ 블로그 글 작성'}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <OutlineBtn onClick={() => setPreview(v => !v)}>{preview ? '✏️ 편집' : '👁 미리보기'}</OutlineBtn>
          <OutlineBtn onClick={onCancel}>취소</OutlineBtn>
          <Btn onClick={save} disabled={saving}>{saving ? '저장 중...' : '💾 저장'}</Btn>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))}
            placeholder="제목을 입력하세요"
            style={{ ...iStyle, fontSize: '17px', fontWeight: 700, padding: '12px 14px' }} />

          {!isSecret && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>카테고리</div>
                <select value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}
                  style={{ ...iStyle, background: '#fff' }}>
                  <option value="">카테고리 선택</option>
                  {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>태그 (쉼표 구분)</div>
                <input value={form.tags} onChange={e => setForm(v => ({ ...v, tags: e.target.value }))}
                  placeholder="방과후, 출석, 팁" style={iStyle} />
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '4px' }}>본문 (마크다운)</div>
            <textarea value={form.content} onChange={e => setForm(v => ({ ...v, content: e.target.value }))}
              rows={20} placeholder="내용을 입력하세요."
              style={{ ...iStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.7 }} />
          </div>
        </div>

        {preview && (
          <div style={{ background: '#f9fafb', borderRadius: '12px', border: `1px solid ${C.border}`, padding: '24px', overflowY: 'auto', maxHeight: '80vh', position: 'sticky', top: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted, marginBottom: '12px', textTransform: 'uppercase' }}>미리보기</div>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: C.text, marginBottom: '12px' }}>{form.title || '(제목 없음)'}</h1>
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: parseMd(form.content) }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── 비밀글 카드 (제목은 모두에게 보이고, 내용은 작성자+관리자만)
function SecretPostCard({ post, user, isAdmin, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const canRead = isAdmin || post.authorId === user.id
  const date = post.createdAt ? new Date(post.createdAt).toLocaleDateString('ko-KR') : ''
  const isOwn = post.authorId === user.id

  const handleExpand = () => {
    if (!canRead) return alert('본인이 작성한 글과 관리자만 내용을 볼 수 있습니다.')
    setExpanded(v => !v)
  }

  return (
    <div style={{
      background: C.card, borderRadius: '12px',
      border: `1.5px solid ${isOwn ? '#fed7aa' : C.border}`,
      overflow: 'hidden', transition: 'box-shadow .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, cursor: canRead ? 'pointer' : 'default' }} onClick={handleExpand}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '6px', padding: '2px 8px', fontWeight: 700 }}>🔐 비밀</span>
              {isOwn && <span style={{ fontSize: '11px', background: '#fff7ed', color: C.primary, border: `1px solid #fed7aa`, borderRadius: '6px', padding: '2px 8px', fontWeight: 600 }}>내 글</span>}
              {isAdmin && !isOwn && <span style={{ fontSize: '11px', background: '#f0fdf4', color: C.success, border: '1px solid #86efac', borderRadius: '6px', padding: '2px 8px', fontWeight: 600 }}>관리자</span>}
              <span style={{ fontSize: '11px', color: C.muted }}>{date}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: canRead ? C.text : C.muted }}>
                {post.title}
              </span>
              {!canRead && <span style={{ fontSize: '12px', color: '#9ca3af' }}>🔒 비공개</span>}
            </div>
          </div>

          {/* 본인 or 관리자만 수정/삭제 */}
          {(isOwn || isAdmin) && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {isOwn && <button onClick={() => onEdit(post)} style={{ padding: '5px 10px', borderRadius: '7px', border: `1.5px solid ${C.border}`, background: '#fff', color: C.muted, fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>수정</button>}
              <button onClick={() => onDelete(post)} style={{ padding: '5px 10px', borderRadius: '7px', border: '1.5px solid #fca5a5', background: '#fef2f2', color: C.danger, fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>삭제</button>
            </div>
          )}
        </div>

        {expanded && canRead && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
            <style>{mdStyles}</style>
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: parseMd(post.content) }} />
            <button onClick={() => setExpanded(false)} style={{ marginTop: '12px', fontSize: '12px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>▲ 접기</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 일반 블로그 글 카드
function BlogPostCard({ post, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : ''

  return (
    <div style={{ background: C.card, borderRadius: '12px', border: `1.5px solid ${C.border}`, overflow: 'hidden', transition: 'box-shadow .15s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              {post.category && <span style={{ fontSize: '11px', background: '#fff7ed', color: C.primary, border: `1px solid #fed7aa`, borderRadius: '6px', padding: '2px 8px', fontWeight: 600 }}>{post.category}</span>}
              <span style={{ fontSize: '11px', color: C.muted }}>{date}</span>
              {post.status === 'draft' && <span style={{ fontSize: '11px', background: '#f3f4f6', color: C.muted, borderRadius: '6px', padding: '2px 8px' }}>임시저장</span>}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{post.title}</div>
            {post.summary && !expanded && <div style={{ fontSize: '13px', color: C.muted, marginTop: '4px', lineHeight: 1.6 }}>{post.summary}</div>}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            <button onClick={() => onEdit(post)} style={{ padding: '5px 10px', borderRadius: '7px', border: `1.5px solid ${C.border}`, background: '#fff', color: C.muted, fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>수정</button>
            <button onClick={() => onDelete(post)} style={{ padding: '5px 10px', borderRadius: '7px', border: '1.5px solid #fca5a5', background: '#fef2f2', color: C.danger, fontSize: '12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>삭제</button>
          </div>
        </div>

        {expanded && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
            <style>{mdStyles}</style>
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: parseMd(post.content) }} />
            <button onClick={() => setExpanded(false)} style={{ marginTop: '12px', fontSize: '12px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer' }}>▲ 접기</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트
export function MyBlog({ user }) {
  const isAdmin = user?.role === 'admin' || (user?.level || 1) >= 10
  const [tab, setTab] = useState('blog') // 'blog' | 'secret'
  const [view, setView] = useState('list') // 'list' | 'write'
  const [editPost, setEditPost] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadPosts() }, [])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      // 블로그 글: 내 글만
      // 비밀게시판: 관리자면 전체, 아니면 전체 목록(제목만) - 내용 제한은 카드에서 처리
      setPosts((rows || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    } catch { /* silent */ }
    setLoading(false)
  }

  const handleDelete = async (post) => {
    if (!window.confirm(`"${post.title}" 을(를) 삭제하시겠습니까?`)) return
    try { await dbCall('delete', 'blogPosts', { id: post.id }); loadPosts() }
    catch { alert('삭제 실패') }
  }

  const handleSaved = () => { setView('list'); setEditPost(null); loadPosts() }

  // 블로그 탭: 내 글만
  const blogPosts = posts.filter(p => (p.type === 'blog' || !p.type) && !p.isSecret && (p.authorId === user.id || p.author === user.name))
  // 비밀게시판: 전체 글 목록 (읽기 권한은 카드에서 처리)
  const secretPosts = posts.filter(p => p.type === 'secret' || p.isSecret)

  const currentPosts = tab === 'secret' ? secretPosts : blogPosts
  const isSecret = tab === 'secret'

  return (
    <div style={{ padding: '24px', maxWidth: '900px', fontFamily: 'Noto Sans KR, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '22px', fontWeight: 800, color: C.text }}>✍️ 내 블로그</div>
        <div style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>블로그 글을 작성하고 관리하세요.</div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', marginBottom: '24px', borderBottom: `2px solid ${C.border}` }}>
        {[
          { key: 'blog', label: '📝 블로그 글', count: blogPosts.length },
          { key: 'secret', label: '🔐 비밀 게시판', count: secretPosts.length },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setView('list'); setEditPost(null) }}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '14px', fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? C.primary : C.muted,
              borderBottom: tab === t.key ? `2px solid ${C.primary}` : '2px solid transparent',
              marginBottom: '-2px', fontFamily: 'Noto Sans KR, sans-serif',
            }}>
            {t.label}&nbsp;
            <span style={{ fontSize: '12px', background: tab === t.key ? '#fff7ed' : '#f3f4f6', color: tab === t.key ? C.primary : C.muted, borderRadius: '999px', padding: '1px 7px' }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* 비밀게시판 안내 */}
      {tab === 'secret' && view === 'list' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔐 비밀 게시판 — 글 제목은 모두에게 보이지만, <strong>내용은 작성자 본인과 관리자만</strong> 열람할 수 있습니다.
        </div>
      )}

      {/* 글 작성/수정 폼 */}
      {view === 'write' ? (
        <PostForm user={user} post={editPost} isSecret={isSecret}
          onSave={handleSaved} onCancel={() => { setView('list'); setEditPost(null) }} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <Btn onClick={() => { setEditPost(null); setView('write') }}>+ 새 글 작성</Btn>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: C.muted, fontSize: '14px' }}>불러오는 중...</div>
          ) : currentPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: '#f9fafb', borderRadius: '12px', border: `1px dashed ${C.border}` }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>{isSecret ? '🔐' : '✍️'}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>아직 작성한 글이 없어요</div>
              <div style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>첫 번째 글을 써보세요!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isSecret
                ? currentPosts.map(post => (
                    <SecretPostCard key={post.id} post={post} user={user} isAdmin={isAdmin}
                      onEdit={p => { setEditPost(p); setView('write') }}
                      onDelete={handleDelete} />
                  ))
                : currentPosts.map(post => (
                    <BlogPostCard key={post.id} post={post}
                      onEdit={p => { setEditPost(p); setView('write') }}
                      onDelete={handleDelete} />
                  ))
              }
            </div>
          )}
        </>
      )}
    </div>
  )
}
