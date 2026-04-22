import React, { useState, useEffect, useRef } from 'react'
import { dbCall } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'

const CATEGORIES = ['출석 관리', '교구 관리', '업무 팁', '공지사항', '업데이트', '기타']

// 마크다운 미리보기 (Blog.jsx와 동일한 파서)
function parseMarkdown(md) {
  if (!md) return ''
  let html = md
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:8px 0">')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .split('\n\n').map(p => p.trim()).filter(Boolean)
    .map(p => {
      if (/^<(h[1-3]|ul|ol|li|pre|blockquote|hr)/.test(p)) return p
      return `<p>${p.replace(/\n/g, '<br>')}</p>`
    }).join('\n')
  return html
}

const mdStyles = `
  .md-preview h1 { font-size:24px;font-weight:800;margin:24px 0 12px;color:#111827; }
  .md-preview h2 { font-size:20px;font-weight:700;margin:20px 0 10px;color:#1f2937;border-bottom:2px solid #f3f4f6;padding-bottom:6px; }
  .md-preview h3 { font-size:17px;font-weight:700;margin:16px 0 8px;color:#374151; }
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

const iStyle = { width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', boxSizing: 'border-box', background: '#fff' }

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

const emptyForm = () => ({
  title: '', slug: '', summary: '', content: '', category: '', tags: '',
  coverImage: '', author: '관리자', status: 'draft', publishedAt: new Date().toISOString().slice(0, 10),
})

export function BlogAdmin({ user }) {
  const [posts, setPosts] = useState([])
  const [view, setView] = useState('list') // 'list' | 'edit'
  const [form, setForm] = useState(emptyForm())
  const [editId, setEditId] = useState(null)
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const { success, error } = useToast()

  useEffect(() => { loadPosts() }, [])

  const loadPosts = async () => {
    try {
      const rows = await dbCall('getAll', 'blogPosts')
      const sorted = (rows || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setPosts(sorted)
    } catch (e) { error('불러오기 실패') }
  }

  const handleNew = () => {
    setForm(emptyForm())
    setEditId(null)
    setPreview(false)
    setView('edit')
  }

  const handleEdit = (post) => {
    setForm({
      title: post.title || '',
      slug: post.slug || '',
      summary: post.summary || '',
      content: post.content || '',
      category: post.category || '',
      tags: (post.tags || []).join(', '),
      coverImage: post.coverImage || '',
      author: post.author || '관리자',
      status: post.status || 'draft',
      publishedAt: post.publishedAt ? post.publishedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    })
    setEditId(post.id)
    setPreview(false)
    setView('edit')
  }

  const handleDelete = async (post) => {
    if (!window.confirm(`"${post.title}" 글을 삭제하시겠습니까?`)) return
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
      const payload = {
        id: editId || uid(),
        title: form.title.trim(),
        slug,
        summary: form.summary.trim(),
        content: form.content,
        category: form.category,
        tags,
        coverImage: form.coverImage.trim(),
        author: form.author.trim(),
        status: status || form.status,
        publishedAt: status === 'published' ? (form.publishedAt ? new Date(form.publishedAt).toISOString() : now()) : (form.publishedAt ? new Date(form.publishedAt).toISOString() : null),
        updatedAt: now(),
        createdAt: editId ? undefined : now(),
      }
      if (editId) {
        await dbCall('update', 'blogPosts', { id: editId, patch: payload })
      } else {
        await dbCall('insert', 'blogPosts', payload)
      }
      success(status === 'published' ? '발행되었습니다! 🎉' : '임시저장되었습니다.')
      loadPosts()
      setView('list')
    } catch (e) { error('저장 실패: ' + e.message) }
    setLoading(false)
  }

  const C = { primary: '#f97316', border: '#e5e7eb', muted: '#6b7280', text: '#111827', card: '#fff' }

  // ── 목록 뷰
  if (view === 'list') return (
    <div style={{ padding: '24px', maxWidth: '1000px' }}>
      <style>{mdStyles}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>📝 블로그 관리</h1>
          <p style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>SEO 블로그 글을 작성하고 관리하세요. n8n으로 자동 발행도 가능합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="/blog" target="_blank"
            style={{ padding: '9px 18px', borderRadius: '9px', border: `1.5px solid ${C.border}`, background: C.card, color: C.muted, fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🌐 블로그 보기
          </a>
          <button onClick={handleNew}
            style={{ padding: '9px 20px', borderRadius: '9px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            + 새 글 작성
          </button>
        </div>
      </div>

      {/* n8n API 안내 */}
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: '#15803d' }}>
        <strong>🤖 n8n 자동 발행 API</strong>
        <div style={{ marginTop: '6px', fontFamily: 'monospace', background: '#fff', borderRadius: '6px', padding: '8px 12px', color: '#374151', fontSize: '12px', wordBreak: 'break-all' }}>
          POST {window.location.origin.replace('3000','54321')}/functions/v1/db-api
          <br />Body: {'{"action":"insert","table":"blogPosts","data":{...}}'}
        </div>
        <div style={{ marginTop: '8px', color: '#166534' }}>status: "published" | "draft" · slug은 URL에 사용되는 고유 키</div>
      </div>

      {/* 글 목록 */}
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, color: C.muted }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📝</div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>아직 작성된 글이 없습니다</div>
          <button onClick={handleNew}
            style={{ marginTop: '16px', padding: '9px 24px', borderRadius: '9px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            첫 글 작성하기
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {posts.map(post => (
            <div key={post.id} style={{ background: C.card, borderRadius: '12px', border: `1.5px solid ${C.border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '2px 10px',
                    background: post.status === 'published' ? '#f0fdf4' : '#fff7ed',
                    color: post.status === 'published' ? '#16a34a' : '#f97316',
                    border: `1px solid ${post.status === 'published' ? '#86efac' : '#fed7aa'}`
                  }}>
                    {post.status === 'published' ? '✅ 발행됨' : '📝 임시저장'}
                  </span>
                  {post.category && <span style={{ fontSize: '11px', color: C.muted, background: '#f3f4f6', borderRadius: '4px', padding: '2px 8px' }}>{post.category}</span>}
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
                <div style={{ fontSize: '12px', color: C.muted }}>
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('ko-KR') : '날짜 없음'}
                  {post.slug && <span style={{ marginLeft: '8px' }}>/blog/{post.slug}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {post.status === 'published' && (
                  <a href={`/blog/${post.slug || post.id}`} target="_blank"
                    style={{ padding: '6px 12px', borderRadius: '7px', border: `1px solid ${C.border}`, background: '#f9fafb', color: C.muted, fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                    보기
                  </a>
                )}
                <button onClick={() => handleEdit(post)}
                  style={{ padding: '6px 14px', borderRadius: '7px', border: `1px solid ${C.primary}`, background: '#fff7ed', color: C.primary, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  수정
                </button>
                <button onClick={() => handleDelete(post)}
                  style={{ padding: '6px 12px', borderRadius: '7px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── 편집 뷰
  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>
      <style>{mdStyles}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={() => setView('list')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', padding: 0 }}>
          ← 목록
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: C.text, flex: 1 }}>
          {editId ? '글 수정' : '새 글 작성'}
        </h1>
        <button onClick={() => setPreview(v => !v)}
          style={{ padding: '7px 16px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: preview ? '#f3f4f6' : C.card, color: C.muted, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          {preview ? '✏️ 편집' : '👁 미리보기'}
        </button>
        <button onClick={() => handleSave('draft')} disabled={loading}
          style={{ padding: '7px 16px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: C.card, color: C.muted, fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          임시저장
        </button>
        <button onClick={() => handleSave('published')} disabled={loading}
          style={{ padding: '7px 20px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          {loading ? '저장 중...' : '🚀 발행'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: preview ? '1fr 1fr' : '1fr', gap: '24px' }}>
        {/* 편집 패널 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 제목 */}
          <input value={form.title} onChange={e => {
            const title = e.target.value
            setForm(v => ({ ...v, title, slug: v.slug || slugify(title) }))
          }} placeholder="제목을 입력하세요" style={{ ...iStyle, fontSize: '18px', fontWeight: 700, padding: '12px 14px' }} />

          {/* slug / 카테고리 / 작성자 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>URL 슬러그</label>
              <input value={form.slug} onChange={e => setForm(v => ({ ...v, slug: e.target.value }))} placeholder="url-slug" style={iStyle} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>카테고리</label>
              <select value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))} style={{ ...iStyle, background: '#fff' }}>
                <option value="">카테고리 선택</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>발행일</label>
              <input type="date" value={form.publishedAt} onChange={e => setForm(v => ({ ...v, publishedAt: e.target.value }))} style={iStyle} />
            </div>
          </div>

          {/* 요약 */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>요약 (SEO description · 160자)</label>
            <textarea value={form.summary} onChange={e => setForm(v => ({ ...v, summary: e.target.value }))} rows={2}
              placeholder="검색엔진에 표시될 요약 문구 (비워두면 본문에서 자동 추출)"
              style={{ ...iStyle, resize: 'vertical' }} maxLength={200} />
          </div>

          {/* 커버 이미지 */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>커버 이미지 URL</label>
            <input value={form.coverImage} onChange={e => setForm(v => ({ ...v, coverImage: e.target.value }))} placeholder="https://..." style={iStyle} />
          </div>

          {/* 태그 */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>태그 (쉼표로 구분)</label>
            <input value={form.tags} onChange={e => setForm(v => ({ ...v, tags: e.target.value }))} placeholder="출석관리, 방과후, 로봇교육" style={iStyle} />
          </div>

          {/* 본문 */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '4px' }}>본문 (마크다운)</label>
            <textarea value={form.content} onChange={e => setForm(v => ({ ...v, content: e.target.value }))} rows={24}
              placeholder={`# 제목\n\n본문을 마크다운으로 작성하세요.\n\n## 소제목\n\n- 항목 1\n- 항목 2\n\n**굵게** *기울임* \`코드\``}
              style={{ ...iStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.7 }} />
          </div>
        </div>

        {/* 미리보기 패널 */}
        {preview && (
          <div style={{ background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '28px', overflowY: 'auto', maxHeight: '90vh', position: 'sticky', top: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted, marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>미리보기</div>
            {form.coverImage && <img src={form.coverImage} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '10px', marginBottom: '20px' }} />}
            {form.category && <span style={{ fontSize: '11px', color: C.primary, fontWeight: 700, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '999px', padding: '3px 10px', marginBottom: '12px', display: 'inline-block' }}>{form.category}</span>}
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: C.text, marginTop: '10px', marginBottom: '16px', lineHeight: 1.4 }}>{form.title || '제목 없음'}</h1>
            {form.summary && <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px', color: '#92400e', lineHeight: 1.7 }}>{form.summary}</div>}
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: parseMarkdown(form.content) }} />
          </div>
        )}
      </div>
    </div>
  )
}
