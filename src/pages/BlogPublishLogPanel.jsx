/**
 * BlogPublishLogPanel.jsx
 * 바른 교육 블로그 발행기록 패널
 * - 카드뉴스의 ContentLogPanel을 출석부 스타일(밝은 테마)로 이식
 * - blog_content_log 테이블 직접 조회 (supabase 클라이언트)
 * - 수동 기록 추가 + Claude 프롬프트 생성 기능 포함
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

// ── 시리즈 목록 (MCP route.js의 SERIES 와 동일하게 유지)
const SERIES_LIST = [
  { id: 'series-a', label: '📚 시리즈A — 초등 역량' },
  { id: 'series-b', label: '🌍 시리즈B — 세계 교육법' },
  { id: 'series-c', label: '💬 시리즈C — 고민 해결' },
  { id: 'series-d', label: '🧩 시리즈D — 역량·활동 연결' },
]
const seriesLabel = (id) => SERIES_LIST.find(s => s.id === id)?.label || id

// ── 카테고리 (시리즈별 공통 각도 흐름)
const ANGLE_ORDER = ['개념 소개', '현장 적용', '뇌과학 근거', '학부모 설득', '실전 팁']

// ── 스타일 상수 (출석부 밝은 테마)
const C = {
  primary: '#f97316',
  border: '#e5e7eb',
  muted: '#6b7280',
  text: '#111827',
  card: '#fff',
  bg: '#f9fafb',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',
}

const S = {
  card: {
    background: C.card,
    border: `1.5px solid ${C.border}`,
    borderRadius: 12,
    padding: '20px 22px',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: C.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: C.muted,
    display: 'block',
    marginBottom: 5,
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: `1.5px solid ${C.border}`,
    fontSize: 14,
    fontFamily: 'Noto Sans KR, sans-serif',
    outline: 'none',
    background: C.card,
    color: C.text,
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 8,
    border: `1.5px solid ${C.border}`,
    fontSize: 13,
    fontFamily: 'Noto Sans KR, sans-serif',
    outline: 'none',
    background: C.card,
    color: C.text,
    resize: 'vertical',
    lineHeight: 1.7,
    boxSizing: 'border-box',
  },
  btn: {
    padding: '9px 18px',
    borderRadius: 8,
    border: 'none',
    background: C.primary,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Noto Sans KR, sans-serif',
  },
  btnGhost: {
    padding: '7px 14px',
    borderRadius: 8,
    border: `1.5px solid ${C.border}`,
    background: C.card,
    color: C.muted,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Noto Sans KR, sans-serif',
  },
}

// ── 토스트 컴포넌트
function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#1f2937', color: '#fff', borderRadius: 10, padding: '10px 22px',
      fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
      fontFamily: 'Noto Sans KR, sans-serif',
    }}>{msg}</div>
  )
}

const emptyForm = () => ({
  series: 'series-a',
  category: '',
  angle: '',
  title: '',
  slug: '',
  memo: '',
  targetKeyword: '',
  searchPc: '',
  searchMobile: '',
  searchTotal: '',
  competition: '',
  publishedAt: new Date().toISOString().slice(0, 10),
})

export function BlogPublishLogPanel({ isAdmin }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterSeries, setFilterSeries] = useState('all')
  const [toast, setToast] = useState('')
  const [promptText, setPromptText] = useState('')
  const [promptOpen, setPromptOpen] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parseMsg, setParseMsg] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  // ── 발행 기록 로드
  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('blog_content_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setLogs(Array.isArray(data) ? data : [])
    } catch (e) {
      showToast('❌ 불러오기 실패: ' + e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Claude 프롬프트 생성
  const buildClaudePrompt = () => {
    const lines = []
    lines.push('아래는 바른 교육 이야기 블로그 발행 기록입니다. 이 기록을 기준으로 중복 없이 오늘 블로그 글 1편을 써줘.')
    lines.push('')
    if (logs.length === 0) {
      lines.push('발행 기록: 없음 (처음 시작)')
    } else {
      lines.push(`발행 기록 (${logs.length}건, 최신순):`)
      logs.slice(0, 50).forEach(l => {
        let line = `- 시리즈: ${l.series || l.category} / 각도: ${l.angle} / 제목: ${l.title} / 슬러그: ${l.slug}`
        if (l.published_at) line += ` / 발행일: ${l.published_at}`
        if (l.target_keyword) {
          line += ` / 타겟키워드: ${l.target_keyword}`
          if (l.search_total) line += ` (검색수 ${Number(l.search_total).toLocaleString()}${l.competition ? ' / 경쟁도 ' + l.competition : ''})`
        }
        lines.push(line)
      })
    }
    lines.push('')

    // 다음 차례 시리즈 계산
    let nextSeries = SERIES_LIST[0].id
    if (logs.length > 0) {
      const lastSeries = logs[0].series || logs[0].category
      const idx = SERIES_LIST.findIndex(s => s.id === lastSeries)
      nextSeries = idx >= 0 ? SERIES_LIST[(idx + 1) % SERIES_LIST.length].id : SERIES_LIST[0].id
    }
    const usedAngles = logs.filter(l => (l.series || l.category) === nextSeries).map(l => l.angle)
    const nextAngle = ANGLE_ORDER.find(a => !usedAngles.includes(a)) || ANGLE_ORDER[usedAngles.length % ANGLE_ORDER.length]

    lines.push(`→ 순환 로직상 다음 시리즈는 "${seriesLabel(nextSeries)}(${nextSeries})", 아직 안 쓴 각도는 "${nextAngle}"로 추정됩니다.`)
    lines.push('이 시리즈·각도가 맞으면 그대로 진행하고, 사용자가 다른 시리즈를 지정하면 그걸 우선해줘.')
    return lines.join('\n')
  }

  const openClaudePrompt = () => {
    setPromptText(buildClaudePrompt())
    setPromptOpen(true)
  }

  // ── 붙여넣기 자동 파싱
  const parsePastedLog = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const picked = { series: '', category: '', angle: '', title: '', slug: '', memo: '', targetKeyword: '', searchPc: '', searchMobile: '', searchTotal: '', competition: '', publishedAt: '' }
    const patterns = {
      series:        /^(시리즈|series)\s*[:：]\s*(.+)$/i,
      category:      /^(카테고리|category)\s*[:：]\s*(.+)$/i,
      angle:         /^(각도|angle)\s*[:：]\s*(.+)$/i,
      title:         /^(제목|title)\s*[:：]\s*(.+)$/i,
      slug:          /^(슬러그|slug)\s*[:：]\s*(.+)$/i,
      memo:          /^(메모|비고|memo)\s*[:：]\s*(.+)$/i,
      targetKeyword: /^(타겟\s*키워드|타겟키워드|target.?keyword)\s*[:：]\s*(.+)$/i,
      searchPc:      /^(PC\s*검색수|검색수\s*PC|search.?pc)\s*[:：]\s*(.+)$/i,
      searchMobile:  /^(모바일\s*검색수|검색수\s*모바일|search.?mobile)\s*[:：]\s*(.+)$/i,
      searchTotal:   /^(검색수\s*합계|합계\s*검색수|search.?total)\s*[:：]\s*(.+)$/i,
      competition:   /^(경쟁도|competition)\s*[:：]\s*(.+)$/i,
      publishedAt:   /^(발행일|발행날짜|publishedat|date)\s*[:：]\s*(.+)$/i,
    }
    lines.forEach(line => {
      for (const key of Object.keys(patterns)) {
        const m = line.match(patterns[key])
        if (m) picked[key] = m[2].trim()
      }
    })
    return picked
  }

  const handlePasteParse = (text) => {
    setPasteText(text)
    if (!text.trim()) { setParseMsg(''); return }
    const picked = parsePastedLog(text)
    const found = Object.entries(picked).filter(([, v]) => v)
    if (found.length === 0) {
      setParseMsg('⚠️ 인식된 항목이 없습니다. "시리즈: ...", "제목: ..." 형식인지 확인해주세요.')
      return
    }
    setForm(f => ({
      series:        picked.series ? (SERIES_LIST.find(s => s.id === picked.series)?.id || f.series) : f.series,
      category:      picked.category || f.category,
      angle:         picked.angle || f.angle,
      title:         picked.title || f.title,
      slug:          picked.slug || f.slug,
      memo:          picked.memo || f.memo,
      targetKeyword: picked.targetKeyword || f.targetKeyword,
      searchPc:      picked.searchPc || f.searchPc,
      searchMobile:  picked.searchMobile || f.searchMobile,
      searchTotal:   picked.searchTotal || f.searchTotal,
      competition:   picked.competition || f.competition,
      publishedAt:   picked.publishedAt || f.publishedAt,
    }))
    const labels = { series: '시리즈', category: '카테고리', angle: '각도', title: '제목', slug: '슬러그', memo: '메모', targetKeyword: '타겟키워드', searchPc: 'PC검색수', searchMobile: '모바일검색수', searchTotal: '합계검색수', competition: '경쟁도', publishedAt: '발행일' }
    setParseMsg(`✅ ${found.map(([k]) => labels[k]).join(', ')} 자동 입력됨 — 내용 확인 후 "기록 추가" 버튼을 눌러주세요`)
    setFormOpen(true)
  }

  // ── 기록 추가
  const addLog = async () => {
    if (!form.series || !form.angle.trim() || !form.title.trim() || !form.slug.trim()) {
      showToast('⚠️ 시리즈·각도·제목·슬러그는 필수입니다'); return
    }
    if (!supabase) { showToast('❌ Supabase 미설정'); return }
    setSaving(true)
    try {
      const row = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        series: form.series,
        category: form.category || form.series,
        angle: form.angle.trim(),
        title: form.title.trim(),
        slug: form.slug.trim(),
        memo: form.memo.trim() || null,
        target_keyword: form.targetKeyword.trim() || null,
        search_pc: form.searchPc ? parseInt(form.searchPc) : null,
        search_mobile: form.searchMobile ? parseInt(form.searchMobile) : null,
        search_total: form.searchTotal ? parseInt(form.searchTotal) : null,
        competition: form.competition || null,
        published_at: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
        created_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('blog_content_log').insert([row])
      if (error) throw error
      setForm(emptyForm())
      setPasteText('')
      setParseMsg('')
      setFormOpen(false)
      showToast('✅ 기록 추가됨')
      load()
    } catch (e) {
      showToast('❌ 저장 실패: ' + e.message)
    }
    setSaving(false)
  }

  // ── 기록 삭제
  const deleteLog = async (id) => {
    if (!confirm('이 기록을 삭제할까요?')) return
    if (!supabase) return
    try {
      const { error } = await supabase.from('blog_content_log').delete().eq('id', id)
      if (error) throw error
      showToast('🗑 삭제됨')
      load()
    } catch (e) {
      showToast('❌ 삭제 실패: ' + e.message)
    }
  }

  // ── 클립보드 복사
  const copyText = (text) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('✅ 복사됨 — Claude 채팅창에 붙여넣으세요'))
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;'
      document.body.appendChild(ta)
      ta.focus(); ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
      showToast('✅ 복사됨')
    }
  }

  const filtered = filterSeries === 'all' ? logs : logs.filter(l => (l.series || l.category) === filterSeries)

  const competitionColor = (c) => {
    if (c === '낮음') return { color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' }
    if (c === '높음') return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
    return { color: '#d97706', bg: '#fefce8', border: '#fde68a' }
  }

  if (!isAdmin) return null

  return (
    <div>
      <Toast msg={toast} />

      {/* ── 상단: 설명 + 입력 폼 */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={S.cardTitle}>📋 블로그 발행 기록</div>
          <button onClick={() => setFormOpen(v => !v)} style={S.btnGhost}>
            {formOpen ? '▲ 입력 접기' : '+ 수동 기록 추가'}
          </button>
        </div>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, marginBottom: formOpen ? 18 : 0 }}>
          공개 블로그에는 노출되지 않는 내부 기록입니다. Claude가 글을 작성할 때마다
          어떤 시리즈·각도·키워드로 다뤘는지 남겨두면 중복 없이 다음 글을 기획할 때 활용됩니다.
          MCP <code style={{ background: '#fff7ed', color: C.primary, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>add_publish_log</code> 툴로 자동 기록되며, 아래에서 수동으로도 추가할 수 있습니다.
        </p>

        {formOpen && (
          <>
            {/* 붙여넣기 자동 파싱 */}
            <div style={{ marginBottom: 18 }}>
              <label style={S.label}>📋 Claude가 준 발행 기록을 여기에 붙여넣으세요 (자동 파싱)</label>
              <textarea
                value={pasteText}
                onChange={e => handlePasteParse(e.target.value)}
                placeholder={'시리즈: series-a\n각도: 현장 적용\n제목: 초등 집중력 키우는 방법 — 바둑으로 훈련되는 이유\n슬러그: elementary-focus-training-baduk\n타겟키워드: 초등 집중력\n발행일: 2026-06-22'}
                rows={5}
                style={{ ...S.textarea, marginBottom: 6 }}
              />
              {parseMsg && (
                <div style={{ fontSize: 12, color: parseMsg.startsWith('✅') ? '#15803d' : '#d97706', fontWeight: 600 }}>{parseMsg}</div>
              )}
            </div>

            {/* 수동 입력 폼 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={S.label}>시리즈</label>
                <select value={form.series} onChange={e => setForm(f => ({ ...f, series: e.target.value }))} style={S.input}>
                  {SERIES_LIST.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>각도</label>
                <input value={form.angle} onChange={e => setForm(f => ({ ...f, angle: e.target.value }))}
                  placeholder="예: 현장 적용, 뇌과학 근거" style={S.input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>제목 <span style={{ color: C.danger }}>*</span></label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="글 제목" style={S.input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>슬러그 <span style={{ color: C.danger }}>*</span></label>
                <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="elementary-focus-training-baduk" style={S.input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>타겟 키워드</label>
                <input value={form.targetKeyword} onChange={e => setForm(f => ({ ...f, targetKeyword: e.target.value }))}
                  placeholder="예: 초등 집중력" style={S.input} />
              </div>
              <div>
                <label style={S.label}>PC 검색수</label>
                <input type="number" value={form.searchPc} onChange={e => setForm(f => ({ ...f, searchPc: e.target.value }))}
                  placeholder="0" style={S.input} />
              </div>
              <div>
                <label style={S.label}>모바일 검색수</label>
                <input type="number" value={form.searchMobile} onChange={e => setForm(f => ({ ...f, searchMobile: e.target.value }))}
                  placeholder="0" style={S.input} />
              </div>
              <div>
                <label style={S.label}>합계 검색수</label>
                <input type="number" value={form.searchTotal} onChange={e => setForm(f => ({ ...f, searchTotal: e.target.value }))}
                  placeholder="0" style={S.input} />
              </div>
              <div>
                <label style={S.label}>경쟁도</label>
                <select value={form.competition} onChange={e => setForm(f => ({ ...f, competition: e.target.value }))} style={S.input}>
                  <option value="">-</option>
                  <option value="낮음">낮음</option>
                  <option value="중간">중간</option>
                  <option value="높음">높음</option>
                </select>
              </div>
              <div>
                <label style={S.label}>발행일</label>
                <input type="date" value={form.publishedAt} onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))} style={S.input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>메모 (선택)</label>
                <input value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  placeholder="비고" style={S.input} />
              </div>
            </div>
            <button onClick={addLog} disabled={saving}
              style={{ ...S.btn, opacity: saving ? 0.6 : 1 }}>
              {saving ? '저장 중...' : '+ 기록 추가'}
            </button>
          </>
        )}
      </div>

      {/* ── 기록 목록 */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ ...S.cardTitle, marginBottom: 0 }}>📜 기록 목록 ({filtered.length}건)</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={openClaudePrompt} style={S.btn}>
              🤖 Claude에게 다음 글 요청
            </button>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all', '전체'], ...SERIES_LIST.map(s => [s.id, s.label.split(' — ')[0]])].map(([key, label]) => (
                <button key={key} onClick={() => setFilterSeries(key)}
                  style={{
                    padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: filterSeries === key ? 700 : 500,
                    border: `1.5px solid ${filterSeries === key ? C.primary : C.border}`,
                    background: filterSeries === key ? '#fff7ed' : C.card,
                    color: filterSeries === key ? C.primary : C.muted,
                    cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                  }}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Claude 프롬프트 팝업 */}
        {promptOpen && (
          <div style={{ background: '#fff7ed', border: `1.5px solid ${C.primary}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                💬 아래 내용을 복사해서 Claude 채팅창에 붙여넣으세요
              </div>
              <button onClick={() => setPromptOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <textarea
              readOnly
              value={promptText}
              rows={Math.min(Math.max(promptText.split('\n').length + 1, 6), 16)}
              style={{ ...S.textarea, marginBottom: 10, fontSize: 12, background: '#fffbf5', color: C.text }}
              onFocus={e => e.target.select()}
            />
            <button onClick={() => copyText(promptText)} style={S.btn}>
              📋 복사하기
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', background: C.bg, borderRadius: 12, border: `1.5px solid ${C.border}`, color: C.muted }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>아직 기록이 없습니다</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>첫 글을 발행하면 여기에 쌓입니다.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(log => (
              <div key={log.id} style={{
                background: C.bg,
                border: `1.5px solid ${C.border}`,
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, background: '#fff7ed', borderRadius: 4, padding: '2px 8px', border: `1px solid #fed7aa` }}>
                      {seriesLabel(log.series || log.category).split(' — ')[0]}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{log.angle}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 3 }}>{log.title}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    /blog/{log.slug}
                    {log.published_at && (
                      <span style={{ marginLeft: 8 }}>
                        · {new Date(log.published_at).toLocaleDateString('ko-KR')} 발행
                      </span>
                    )}
                    {log.memo && <span style={{ marginLeft: 8 }}>· {log.memo}</span>}
                    <span style={{ marginLeft: 8, opacity: 0.6 }}>
                      (기록 {log.created_at ? new Date(log.created_at).toLocaleDateString('ko-KR') : ''})
                    </span>
                  </div>
                  {log.target_keyword && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#2563eb', background: '#eff6ff', borderRadius: 4, padding: '2px 8px', border: '1px solid #bfdbfe', fontWeight: 700 }}>
                        🔑 {log.target_keyword}
                      </span>
                      {log.search_total != null && (
                        <span style={{ fontSize: 11, color: C.muted }}>
                          검색수 <strong style={{ color: C.text }}>{Number(log.search_total).toLocaleString()}</strong>
                          {log.search_pc != null && <span> (PC {Number(log.search_pc).toLocaleString()} / 모바일 {Number(log.search_mobile).toLocaleString()})</span>}
                        </span>
                      )}
                      {log.competition && (() => {
                        const cs = competitionColor(log.competition)
                        return (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
                            경쟁도 {log.competition}
                          </span>
                        )
                      })()}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteLog(log.id)}
                  style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${C.dangerBorder}`, background: C.dangerBg, color: C.danger, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', flexShrink: 0 }}>
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
