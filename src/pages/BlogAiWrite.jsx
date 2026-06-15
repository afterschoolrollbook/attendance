import React, { useState, useEffect, useRef } from 'react'
import { dbCall } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'

const C = {
  bg: '#f8f7f4', white: '#ffffff', border: '#e8e8e8',
  text: '#1a1a1a', muted: '#888888', primary: '#ff6b35',
  dark: '#1c1c1e', success: '#34c759', danger: '#ef4444',
}

const TOPICS = [
  // 교육 정보
  { type: 'edu', title: '초등학교 1학년 학교 적응, 어떻게 도와줄까?' },
  { type: 'edu', title: '연령별 집중력 높이는 수업 운영법' },
  { type: 'edu', title: '아이 발달 단계별 학습 포인트 정리' },
  { type: 'edu', title: '방과후 수업이 아이 학교 적응에 미치는 영향' },
  { type: 'edu', title: '학부모-강사 소통, 이렇게 하면 편해요' },
  { type: 'edu', title: '신학기 아이 적응이 어려울 때 도움이 되는 것들' },
  { type: 'edu', title: '아이가 수업에 집중 못 하는 이유와 대처법' },
  { type: 'edu', title: '방과후 수요조사, 어떻게 이루어지는가' },
  { type: 'edu', title: '돌봄교실 아이들이 학교에 빨리 적응하는 이유' },
  { type: 'edu', title: '방과후 수업, 어떤 과목이 아이에게 도움이 될까?' },
  // 운영 노하우
  { type: 'ops', title: '방과후 강사, 처음 시작할 때 알아야 할 것' },
  { type: 'ops', title: '방과후 공고, 어디서 어떻게 찾을까?' },
  { type: 'ops', title: '방과후 자기소개서 잘 쓰는 법' },
  { type: 'ops', title: '경력단절 후 방과후 강사로 재취업하기' },
  { type: 'ops', title: '위탁업체를 통한 방과후 진입, 장단점은?' },
  { type: 'ops', title: '방과후 분기제 vs 학기제, 뭐가 다를까?' },
  { type: 'ops', title: '방과후 첫 합격 이후, 다음 단계는?' },
  { type: 'ops', title: '학원 강사와 방과후 강사 병행하기' },
  { type: 'ops', title: '출석부 양식 종류와 올바른 작성법' },
  { type: 'ops', title: '안전관리대장 작성 가이드' },
  { type: 'ops', title: '학부모 안내문, 이렇게 쓰면 신뢰도가 올라가요' },
  { type: 'ops', title: '방과후 교구 관리, 이렇게 하면 편해요' },
  { type: 'ops', title: '수업 중 안전사고 예방법과 대처 매뉴얼' },
  { type: 'ops', title: '방과후 단톡방·밴드 활용법' },
  { type: 'ops', title: '여러 학교 동시 운영할 때 일정 관리 요령' },
  { type: 'ops', title: '늘봄강사와 방과후 강사, 무엇이 다른가?' },
  { type: 'ops', title: '방과후 강사 개인 브랜딩 시작하기' },
  { type: 'ops', title: '신설 학교 방과후 자리 노리는 법' },
]

const BLOG_CATEGORIES = ['교육 정보', '업무 팁', '출석 관리', '기타']

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().slice(0, 80) + '-' + Date.now().toString(36)
}

function parseMd(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .split('\n\n').map(p => p.trim()).filter(Boolean)
    .map(p => /^<(h[1-3]|ul|ol|li|pre|blockquote|hr)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

const mdStyles = `
  .md-preview h1{font-size:20px;font-weight:800;margin:16px 0 8px;color:#111}
  .md-preview h2{font-size:17px;font-weight:700;margin:14px 0 6px;color:#1f2937;border-bottom:2px solid #f3f4f6;padding-bottom:4px}
  .md-preview h3{font-size:15px;font-weight:700;margin:12px 0 4px;color:#374151}
  .md-preview p{margin:8px 0;line-height:1.9;color:#374151}
  .md-preview ul,ol{padding-left:20px;margin:8px 0}
  .md-preview li{margin:4px 0;line-height:1.7}
  .md-preview strong{font-weight:700;color:#111}
  .md-preview em{font-style:italic}
  .md-preview blockquote{border-left:3px solid #ff6b35;padding:6px 14px;background:#fff7f4;margin:12px 0;border-radius:0 8px 8px 0;color:#8b3a1a;font-style:italic}
  .md-preview hr{border:none;border-top:1px solid #f0f0f0;margin:16px 0}
  .md-preview code{background:#f3f4f6;padding:2px 5px;border-radius:4px;font-size:12px}
`

export function BlogAiWrite({ user }) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [topic, setTopic]       = useState('')
  const [category, setCategory] = useState('교육 정보')
  const [length, setLength]     = useState('medium')
  const [tags, setTags]         = useState('')
  const [title, setTitle]       = useState('')
  const [content, setContent]   = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [status, setStatus]     = useState(null) // { msg, type }
  const [done, setDone]         = useState(false)
  const previewRef = useRef(null)

  const isAdmin = user?.role === 'admin' || (user?.level || 1) >= 10

  useEffect(() => {
    if (previewRef.current) previewRef.current.innerHTML = parseMd(content)
  }, [content])

  function selectTopic(i) {
    setSelectedIdx(i)
    const t = TOPICS[i]
    setTopic(t.title)
    setCategory(t.type === 'edu' ? '교육 정보' : '업무 팁')
    setTags(t.type === 'edu' ? '교육, 아이, 학부모' : '방과후, 강사, 운영')
  }

  async function generate() {
    if (!topic.trim()) return setStatus({ msg: '주제를 입력하거나 선택해주세요.', type: 'err' })
    const wordCount = length === 'short' ? 400 : length === 'medium' ? 800 : 1300

    setGenerating(true)
    setStatus({ msg: 'AI가 글을 작성하고 있어요...', type: 'loading' })
    setTitle(''); setContent('')

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: `당신은 방과후 강사와 교육 종사자를 위한 블로그 글을 쓰는 전문 작가입니다.
독자는 방과후 강사, 돌봄교실 선생님, 학원 강사, 공부방 운영자, 학부모입니다.
톤: 친절하고 현실적이며 실용적. "막막함→해결" 스토리 구조. 과도한 홍보 없이.
형식: 마크다운. ## 소제목 2~3개, 본문 단락, 적절한 볼드 강조.
길이: 약 ${wordCount}자 내외.
첫 줄은 반드시 "# [제목]" 형식으로 시작하세요.`,
          messages: [{ role: 'user', content: `카테고리: ${category}\n주제: ${topic}\n\n위 주제로 블로그 글을 작성해주세요.` }]
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)

      const text = data.content?.[0]?.text || ''
      const titleMatch = text.match(/^#\s+(.+)/m)
      const parsedTitle = titleMatch ? titleMatch[1].trim() : topic
      const body = text.replace(/^#\s+.+\n?/, '').trim()

      setTitle(parsedTitle)
      setContent(body)
      setStatus({ msg: '글 생성 완료! 수정 후 발행하세요.', type: 'ok' })
    } catch (e) {
      setStatus({ msg: '생성 실패: ' + e.message, type: 'err' })
    } finally {
      setGenerating(false)
    }
  }

  async function publish() {
    if (!title.trim() || !content.trim()) return setStatus({ msg: '제목과 내용을 확인해주세요.', type: 'err' })
    setSaving(true)
    try {
      const tagArr = tags.split(',').map(t => t.trim()).filter(Boolean)
      const payload = {
        id: uid(),
        type: 'blog',
        boardType: 'blog',
        isSecret: false,
        title: title.trim(),
        slug: slugify(title),
        content,
        category,
        tags: tagArr,
        author: user?.name || user?.email || '관리자',
        authorId: user?.id,
        status: 'published',
        publishedAt: now(),
        updatedAt: now(),
        createdAt: now(),
      }
      await dbCall('insert', 'blogPosts', { d: payload })
      setDone(true)
      setStatus({ msg: '발행 완료!', type: 'ok' })
    } catch (e) {
      setStatus({ msg: '발행 실패: ' + e.message, type: 'err' })
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setTitle(''); setContent(''); setDone(false); setStatus(null)
    setSelectedIdx(null); setTopic('')
  }

  if (!isAdmin) return (
    <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'Noto Sans KR, sans-serif' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
      <div style={{ fontSize: '16px', fontWeight: 700 }}>관리자만 접근할 수 있습니다.</div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh', fontFamily: 'Noto Sans KR, sans-serif', background: C.bg }}>
      <style>{mdStyles}</style>

      {/* 사이드바 — 주제 목록 */}
      <aside style={{ background: C.dark, padding: '24px 16px', overflowY: 'auto', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#ff6b35', marginBottom: '20px', letterSpacing: '-0.3px' }}>✨ AI 블로그 글쓰기</div>

        {['edu', 'ops'].map(type => (
          <div key={type} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '4px' }}>
              {type === 'edu' ? '📚 교육 정보' : '💡 운영 노하우'}
            </div>
            {TOPICS.filter(t => t.type === type).map((t, _) => {
              const i = TOPICS.indexOf(t)
              return (
                <div key={i} onClick={() => selectTopic(i)}
                  style={{ padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', lineHeight: 1.5, color: selectedIdx === i ? '#ff8c5a' : '#bbb',
                    background: selectedIdx === i ? '#ff6b3518' : 'transparent',
                    border: `1px solid ${selectedIdx === i ? '#ff6b3540' : 'transparent'}`,
                    marginBottom: '2px', transition: 'all 0.1s' }}>
                  {t.title}
                </div>
              )
            })}
          </div>
        ))}
      </aside>

      {/* 메인 */}
      <main style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>AI 블로그 글쓰기</div>
          <div style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>주제를 선택하고 AI 초안을 생성한 뒤 수정해서 바로 발행하세요.</div>
        </div>

        {/* 컨트롤 */}
        <div style={{ background: C.white, borderRadius: '14px', padding: '22px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <Label>주제</Label>
            <input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="왼쪽에서 선택하거나 직접 입력"
              style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <Label>카테고리</Label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                {BLOG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label>글 길이</Label>
              <select value={length} onChange={e => setLength(e.target.value)} style={inputStyle}>
                <option value="short">짧게 (~500자)</option>
                <option value="medium">보통 (~900자)</option>
                <option value="long">길게 (~1400자)</option>
              </select>
            </div>
            <div>
              <Label>태그 (쉼표 구분)</Label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="방과후, 강사" style={inputStyle} />
            </div>
          </div>
          <button onClick={generate} disabled={generating}
            style={{ padding: '13px', background: generating ? '#ccc' : C.primary, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 800, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {generating ? <><Spinner /> 생성 중...</> : '✨ AI로 글 생성하기'}
          </button>

          {status && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
              background: status.type === 'ok' ? '#f0fdf4' : status.type === 'err' ? '#fef2f2' : '#fff7ed',
              color: status.type === 'ok' ? '#15803d' : status.type === 'err' ? '#dc2626' : '#c2410c',
              border: `1px solid ${status.type === 'ok' ? '#bbf7d0' : status.type === 'err' ? '#fca5a5' : '#fed7aa'}` }}>
              {status.type === 'loading' ? <Spinner /> : status.type === 'ok' ? '✅' : '❌'} {status.msg}
            </div>
          )}
        </div>

        {/* 에디터 */}
        {(title || content) && (
          <div style={{ background: C.white, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {/* 헤더 */}
            <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>📝 초안 — 수정 후 발행하세요</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn onClick={generate} disabled={generating} outline>🔄 재생성</Btn>
                {done
                  ? <Btn onClick={reset}>+ 새 글 쓰기</Btn>
                  : <Btn onClick={publish} disabled={saving} primary>{saving ? '발행 중...' : '🚀 발행하기'}</Btn>
                }
              </div>
            </div>

            {/* 제목 */}
            <div style={{ padding: '12px 22px', borderBottom: `1px solid #f5f5f5` }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#bbb', textTransform: 'uppercase', marginBottom: '4px' }}>제목</div>
              <input value={title} onChange={e => setTitle(e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: '18px', fontWeight: 800, fontFamily: 'Noto Sans KR, sans-serif', color: C.text, background: 'transparent' }} />
            </div>

            {/* 본문 에디터 / 미리보기 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '480px' }}>
              <div style={{ borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
                <PaneLabel>마크다운 편집</PaneLabel>
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  style={{ flex: 1, padding: '18px 20px', border: 'none', outline: 'none', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.8, color: '#444', resize: 'none', background: '#fff' }} />
              </div>
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <PaneLabel>미리보기</PaneLabel>
                <div className="md-preview" ref={previewRef}
                  style={{ padding: '18px 22px', fontSize: '14px', lineHeight: 1.9 }} />
              </div>
            </div>

            {done && (
              <div style={{ padding: '16px 22px', background: '#f0fdf4', borderTop: `1px solid #bbf7d0`, fontSize: '14px', color: '#15803d', fontWeight: 700, textAlign: 'center' }}>
                🎉 블로그에 발행되었어요!
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── 헬퍼 컴포넌트
const inputStyle = {
  width: '100%', padding: '9px 12px', background: '#f8f7f4', border: '1.5px solid #e8e8e8',
  borderRadius: '8px', color: '#1a1a1a', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif',
  outline: 'none', boxSizing: 'border-box',
}

function Label({ children }) {
  return <div style={{ fontSize: '11px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>{children}</div>
}
function PaneLabel({ children }) {
  return <div style={{ padding: '8px 16px', fontSize: '10px', fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f5f5f5', background: '#fafafa' }}>{children}</div>
}
function Spinner() {
  return <span style={{ display: 'inline-block', width: '13px', height: '13px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
}
function Btn({ children, onClick, disabled, primary, outline }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif', border: '1.5px solid', opacity: disabled ? 0.4 : 1,
        background: primary ? '#ff6b35' : 'transparent',
        color: primary ? '#fff' : outline ? '#888' : '#ff6b35',
        borderColor: primary ? '#ff6b35' : outline ? '#e8e8e8' : '#ff6b35' }}>
      {children}
    </button>
  )
}
