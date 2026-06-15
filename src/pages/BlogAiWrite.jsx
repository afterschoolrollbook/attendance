import React, { useState, useEffect, useRef } from 'react'
import { dbCall } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'

const C = {
  bg: '#f8f7f4', white: '#ffffff', border: '#e8e8e8',
  text: '#1a1a1a', muted: '#888888', primary: '#ff6b35',
  dark: '#1c1c1e', success: '#34c759', danger: '#ef4444',
}

const TOPICS = [
  { type: 'edu', title: '초등학교 1학년 학교 적응, 어떻게 도와줄까?', keywords: '초등학교 1학년 적응, 신입생 학교 적응, 초등학교 입학 준비' },
  { type: 'edu', title: '연령별 집중력 높이는 수업 운영법', keywords: '수업 집중력, 아이 집중력, 방과후 수업 운영' },
  { type: 'edu', title: '아이 발달 단계별 학습 포인트 정리', keywords: '아이 발달 단계, 연령별 학습, 초등 발달' },
  { type: 'edu', title: '방과후 수업이 아이 학교 적응에 미치는 영향', keywords: '방과후 수업 효과, 학교 적응, 방과후 프로그램' },
  { type: 'edu', title: '학부모-강사 소통, 이렇게 하면 편해요', keywords: '학부모 소통, 강사 학부모 연락, 방과후 소통' },
  { type: 'edu', title: '신학기 아이 적응이 어려울 때 도움이 되는 것들', keywords: '신학기 적응, 학교 적응 방법, 신학기 준비' },
  { type: 'edu', title: '아이가 수업에 집중 못 하는 이유와 대처법', keywords: '수업 집중 안함, 아이 주의력, ADHD 수업' },
  { type: 'edu', title: '방과후 수요조사, 어떻게 이루어지는가', keywords: '방과후 수요조사, 방과후 개설, 방과후 과목 선정' },
  { type: 'edu', title: '돌봄교실 아이들이 학교에 빨리 적응하는 이유', keywords: '돌봄교실, 방과후 돌봄, 초등 돌봄' },
  { type: 'edu', title: '방과후 수업, 어떤 과목이 아이에게 도움이 될까?', keywords: '방과후 과목 추천, 방과후 프로그램 종류, 초등 방과후' },
  { type: 'ops', title: '방과후 강사, 처음 시작할 때 알아야 할 것', keywords: '방과후 강사 시작, 방과후 강사 되는법, 방과후 입문' },
  { type: 'ops', title: '방과후 공고, 어디서 어떻게 찾을까?', keywords: '방과후 강사 공고, 방과후 채용, 방과후 모집' },
  { type: 'ops', title: '방과후 자기소개서 잘 쓰는 법', keywords: '방과후 자기소개서, 방과후 서류전형, 방과후 지원서' },
  { type: 'ops', title: '경력단절 후 방과후 강사로 재취업하기', keywords: '경력단절 재취업, 방과후 강사 재취업, 육아후 취업' },
  { type: 'ops', title: '위탁업체를 통한 방과후 진입, 장단점은?', keywords: '방과후 위탁업체, 방과후 업체, 방과후 위탁' },
  { type: 'ops', title: '방과후 분기제 vs 학기제, 뭐가 다를까?', keywords: '방과후 분기제, 방과후 학기제, 방과후 운영 방식' },
  { type: 'ops', title: '방과후 첫 합격 이후, 다음 단계는?', keywords: '방과후 합격 후, 방과후 첫 수업, 방과후 시작' },
  { type: 'ops', title: '학원 강사와 방과후 강사 병행하기', keywords: '방과후 학원 겸업, 방과후 부업, 강사 겸직' },
  { type: 'ops', title: '출석부 양식 종류와 올바른 작성법', keywords: '출석부 양식, 방과후 출석부, 출석 관리' },
  { type: 'ops', title: '안전관리대장 작성 가이드', keywords: '안전관리대장, 방과후 안전교육, 안전관리 기록' },
  { type: 'ops', title: '학부모 안내문, 이렇게 쓰면 신뢰도가 올라가요', keywords: '학부모 안내문, 가정통신문, 학부모 공지' },
  { type: 'ops', title: '방과후 교구 관리, 이렇게 하면 편해요', keywords: '방과후 교구 관리, 수업 준비물, 교구 정리' },
  { type: 'ops', title: '수업 중 안전사고 예방법과 대처 매뉴얼', keywords: '수업 안전사고, 방과후 안전, 학생 안전관리' },
  { type: 'ops', title: '방과후 단톡방·밴드 활용법', keywords: '방과후 단체카톡, 방과후 밴드, 강사 소통 채널' },
  { type: 'ops', title: '여러 학교 동시 운영할 때 일정 관리 요령', keywords: '방과후 다중 학교, 여러 학교 강사, 방과후 일정 관리' },
  { type: 'ops', title: '늘봄강사와 방과후 강사, 무엇이 다른가?', keywords: '늘봄학교 강사, 늘봄 방과후 차이, 늘봄 강사' },
  { type: 'ops', title: '방과후 강사 개인 브랜딩 시작하기', keywords: '방과후 강사 브랜딩, 강사 마케팅, 방과후 홍보' },
  { type: 'ops', title: '신설 학교 방과후 자리 노리는 법', keywords: '신설 학교 방과후, 방과후 경쟁 적은 학교, 방과후 합격 전략' },
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
    // 테이블 파싱
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim() && !c.match(/^[-\s]+$/))
      return cells.length ? `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join('')}</tr>` : match
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, m => `<table style="width:100%;border-collapse:collapse;margin:16px 0">${m.replace(/<tr>/g,'<tr style="border-bottom:1px solid #e5e7eb">').replace(/<td>/g,'<td style="padding:8px 12px;font-size:14px">')}</table>`)
    .split('\n\n').map(p => p.trim()).filter(Boolean)
    .map(p => /^<(h[1-3]|ul|ol|li|pre|blockquote|hr|table|tr)/.test(p) ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

// summary 추출 (첫 번째 <p> 태그 내용 160자)
function extractSummary(content) {
  const plain = content.replace(/^#+\s.+$/gm, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/^[->\|].+$/gm, '').replace(/\n+/g, ' ').trim()
  return plain.slice(0, 160)
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
  .md-preview table{width:100%;border-collapse:collapse;margin:16px 0}
  .md-preview td,.md-preview th{padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px}
`

export function BlogAiWrite({ user }) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [topic, setTopic]       = useState('')
  const [category, setCategory] = useState('교육 정보')
  const [length, setLength]     = useState('medium')
  const [tags, setTags]         = useState('')
  const [title, setTitle]       = useState('')
  const [summary, setSummary]   = useState('')
  const [content, setContent]   = useState('')
  const [seoScore, setSeoScore] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [status, setStatus]     = useState(null)
  const [done, setDone]         = useState(false)
  const previewRef = useRef(null)

  const isAdmin = user?.role === 'admin' || (user?.level || 1) >= 10

  useEffect(() => {
    if (previewRef.current) previewRef.current.innerHTML = parseMd(content)
    if (content) setSeoScore(calcSeoScore(title, summary, content, tags))
  }, [content, title, summary, tags])

  // SEO 점수 계산
  function calcSeoScore(t, s, c, tg) {
    let score = 0; const issues = []; const goods = []
    if (t?.length >= 20 && t?.length <= 60) { score += 20; goods.push('제목 길이 적절') } else issues.push('제목 20~60자 권장')
    if (s?.length >= 50 && s?.length <= 160) { score += 20; goods.push('메타설명 적절') } else issues.push('메타설명 50~160자 권장')
    if (c?.match(/^## /m)) { score += 15; goods.push('H2 소제목 있음') } else issues.push('H2 소제목 추가 권장')
    if (c?.match(/^### /m)) { score += 10; goods.push('H3 소제목 있음') } else issues.push('H3 소제목 추가 권장')
    if (c?.length >= 800) { score += 15; goods.push('글 분량 충분') } else issues.push('800자 이상 권장')
    if (c?.includes('자주 묻는 질문') || c?.includes('FAQ')) { score += 10; goods.push('FAQ 섹션 있음') } else issues.push('FAQ 섹션 추가 권장')
    if (tg?.split(',').filter(Boolean).length >= 3) { score += 10; goods.push('태그 3개 이상') } else issues.push('태그 3개 이상 권장')
    if (c?.match(/\*\*.+\*\*/)) { score += 5; goods.push('굵은 글씨 강조') } else issues.push('키워드 굵게 강조 권장')
    if (c?.match(/^- /m)) { score += 5; goods.push('목록 사용') } else issues.push('목록 형식 활용 권장')
    return { score, issues, goods }
  }

  function selectTopic(i) {
    setSelectedIdx(i)
    const t = TOPICS[i]
    setTopic(t.title)
    setCategory(t.type === 'edu' ? '교육 정보' : '업무 팁')
    setTags(t.keywords || (t.type === 'edu' ? '교육, 아이, 학부모' : '방과후, 강사, 운영'))
  }

  async function generate() {
    if (!topic.trim()) return setStatus({ msg: '주제를 입력하거나 선택해주세요.', type: 'err' })
    const wordCount = length === 'short' ? 500 : length === 'medium' ? 900 : 1400
    const selectedTopic = selectedIdx !== null ? TOPICS[selectedIdx] : null

    setGenerating(true)
    setStatus({ msg: 'AI가 SEO 최적화 글을 작성하고 있어요...', type: 'loading' })
    setTitle(''); setSummary(''); setContent(''); setSeoScore(null)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 3000,
          system: `당신은 방과후 강사와 교육 종사자를 위한 SEO 최적화 블로그 글을 쓰는 전문 작가입니다.
독자: 방과후 강사, 돌봄교실 선생님, 학원 강사, 공부방 운영자, 학부모.
톤: 친절하고 현실적이며 실용적. "막막함→해결" 스토리 구조.

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "title": "검색 키워드가 포함된 제목 (20~55자)",
  "summary": "구글 검색 결과에 표시될 메타 설명. 핵심 내용 요약 (80~155자)",
  "content": "마크다운 본문 (## H2 소제목 3~4개, ### H3 소제목 포함, 굵은 강조, 목록, FAQ 섹션 필수 포함, ${wordCount}자 내외)"
}

content 작성 규칙:
1. ## 소제목으로 글을 3~4개 섹션으로 나누기
2. 각 섹션에 ### 소소제목 1~2개
3. 핵심 키워드는 **굵게** 강조
4. 실용적인 팁은 - 목록으로
5. 마지막에 반드시 ## 자주 묻는 질문 (FAQ) 섹션 추가 (Q&A 3개)
6. 과도한 홍보 없이 정보 위주`,
          messages: [{
            role: 'user',
            content: `카테고리: ${category}
주제: ${topic}
${selectedTopic?.keywords ? `타겟 키워드: ${selectedTopic.keywords}` : ''}

위 주제로 SEO 최적화 블로그 글을 JSON 형식으로 작성해주세요.`
          }]
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message)

      const text = data.content?.[0]?.text || ''
      // JSON 파싱
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI 응답 형식 오류')
      const parsed = JSON.parse(jsonMatch[0])

      setTitle(parsed.title || topic)
      setSummary(parsed.summary || extractSummary(parsed.content || ''))
      setContent(parsed.content || '')
      setStatus({ msg: '✅ SEO 최적화 글 생성 완료! 점수를 확인하고 발행하세요.', type: 'ok' })
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
        summary: summary.trim(),
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
      setStatus({ msg: '발행 완료! 블로그에 올라갔어요.', type: 'ok' })
    } catch (e) {
      setStatus({ msg: '발행 실패: ' + e.message, type: 'err' })
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setTitle(''); setSummary(''); setContent(''); setDone(false); setStatus(null); setSeoScore(null)
    setSelectedIdx(null); setTopic('')
  }

  if (!isAdmin) return (
    <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'Noto Sans KR, sans-serif' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
      <div style={{ fontSize: '16px', fontWeight: 700 }}>관리자만 접근할 수 있습니다.</div>
    </div>
  )

  const scoreColor = seoScore ? (seoScore.score >= 80 ? '#34c759' : seoScore.score >= 60 ? '#ff9500' : '#ff3b30') : '#ccc'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh', fontFamily: 'Noto Sans KR, sans-serif', background: C.bg }}>
      <style>{mdStyles}</style>

      {/* 사이드바 */}
      <aside style={{ background: C.dark, padding: '24px 16px', overflowY: 'auto', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#ff6b35', marginBottom: '4px', letterSpacing: '-0.3px' }}>✨ AI 블로그 글쓰기</div>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '20px' }}>SEO 최적화 자동 적용</div>

        {['edu', 'ops'].map(type => (
          <div key={type} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '4px' }}>
              {type === 'edu' ? '📚 교육 정보' : '💡 운영 노하우'}
            </div>
            {TOPICS.filter(t => t.type === type).map((t) => {
              const i = TOPICS.indexOf(t)
              return (
                <div key={i} onClick={() => selectTopic(i)}
                  style={{ padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', lineHeight: 1.5,
                    color: selectedIdx === i ? '#ff8c5a' : '#bbb',
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
      <main style={{ padding: '32px 36px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>AI 블로그 글쓰기</div>
          <div style={{ fontSize: '13px', color: C.muted, marginTop: '4px' }}>검색봇이 좋아하는 SEO 최적화 글을 자동으로 생성해요.</div>
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
                <option value="short">짧게 (~600자)</option>
                <option value="medium">보통 (~1000자)</option>
                <option value="long">길게 (~1500자)</option>
              </select>
            </div>
            <div>
              <Label>태그 / 키워드</Label>
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="방과후, 강사, 출석부" style={inputStyle} />
            </div>
          </div>
          <button onClick={generate} disabled={generating}
            style={{ padding: '13px', background: generating ? '#ccc' : C.primary, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 800, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {generating ? <><Spinner /> SEO 최적화 글 생성 중...</> : '✨ AI로 SEO 최적화 글 생성하기'}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>📝 초안</div>
                {seoScore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '999px', background: `${scoreColor}18`, border: `1px solid ${scoreColor}40` }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: scoreColor }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: scoreColor }}>SEO {seoScore.score}점</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Btn onClick={generate} disabled={generating} outline>🔄 재생성</Btn>
                {done
                  ? <Btn onClick={reset}>+ 새 글 쓰기</Btn>
                  : <Btn onClick={publish} disabled={saving} primary>{saving ? '발행 중...' : '🚀 발행하기'}</Btn>
                }
              </div>
            </div>

            {/* SEO 체크 패널 */}
            {seoScore && (
              <div style={{ padding: '12px 22px', background: '#fafafa', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#34c759', marginBottom: '4px' }}>✅ 잘 된 점</div>
                  {seoScore.goods.map((g, i) => <div key={i} style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>• {g}</div>)}
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff9500', marginBottom: '4px' }}>⚠️ 개선 권장</div>
                  {seoScore.issues.map((issue, i) => <div key={i} style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>• {issue}</div>)}
                </div>
              </div>
            )}

            {/* 제목 + summary */}
            <div style={{ padding: '12px 22px', borderBottom: `1px solid #f5f5f5` }}>
              <div style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#bbb', textTransform: 'uppercase', marginBottom: '4px' }}>제목 (검색 결과 노출)</div>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', fontSize: '18px', fontWeight: 800, fontFamily: 'Noto Sans KR, sans-serif', color: C.text, background: 'transparent' }} />
                <div style={{ fontSize: '11px', color: title.length > 60 ? '#ff3b30' : '#aaa', marginTop: '2px' }}>{title.length}자 (권장 20~60자)</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#bbb', textTransform: 'uppercase', marginBottom: '4px' }}>메타 설명 (구글 검색 미리보기)</div>
                <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2}
                  style={{ width: '100%', border: '1px solid #e8e8e8', outline: 'none', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', color: '#555', background: '#fafafa', borderRadius: '8px', padding: '8px 10px', resize: 'none', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '11px', color: summary.length > 160 ? '#ff3b30' : '#aaa', marginTop: '2px' }}>{summary.length}자 (권장 80~160자)</div>
              </div>
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
                <div className="md-preview" ref={previewRef} style={{ padding: '18px 22px', fontSize: '14px', lineHeight: 1.9 }} />
              </div>
            </div>

            {done && (
              <div style={{ padding: '16px 22px', background: '#f0fdf4', borderTop: `1px solid #bbf7d0`, fontSize: '14px', color: '#15803d', fontWeight: 700, textAlign: 'center' }}>
                🎉 블로그에 발행되었어요! 검색봇이 곧 수집해갈 거예요.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

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
