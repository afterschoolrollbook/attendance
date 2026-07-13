/**
 * BlogSystemPrompt.jsx
 * 방과후 출석부 블로그 — 클로드(Claude) 시스템 프롬프트 관리 패널
 * - Fresh_Season SystemPromptPanel.js를 출석부 스타일(밝은 테마)로 이식
 * - system_prompts 테이블 직접 조회/수정 (supabase 클라이언트)
 * - MCP get_system_prompt / update_system_prompt 툴이 같은 테이블을 사용
 * - Fresh_Season의 4번째 탭(글감관리 월기획지침)은 출석부에 글감관리 기능이 없어 제외 — 3탭만 사용
 */

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const TABS = [
  { id: 'claude', label: '1️⃣ 클로드 실행지침', desc: 'Claude 전체 행동 지침 — 대화 시작 시 가장 먼저 불러오는 메인 시스템 프롬프트예요.' },
  { id: 'main',   label: '2️⃣ 블로그 글작성지침', desc: '"오늘 블로그 글 써줘" 할 때 사용하는 지침 — 글 1편 작성·발행 절차예요.' },
  { id: 'main2',  label: '3️⃣ 추가 지침', desc: '위 두 지침과 별도로 관리하는 추가 지침이에요.' },
]

const C = {
  primary: '#f97316', border: '#e5e7eb', muted: '#6b7280', text: '#111827',
  card: '#fff', bg: '#f9fafb', danger: '#ef4444', success: '#16a34a',
}

const S = {
  card: { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 12 },
  btn: { padding: '9px 18px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' },
  btnGhost: { padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' },
}

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', fontFamily: 'Noto Sans KR, sans-serif' }}>{msg}</div>
  )
}

export function BlogSystemPrompt({ user }) {
  const isAdmin = user?.role === 'admin' || (user?.level || 1) >= 10
  const [activeTab, setActiveTab] = useState('claude')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [copied, setCopied] = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  const activeTabInfo = TABS.find(t => t.id === activeTab)
  const tabState = data[activeTab] || { content: '', original: '', updatedAt: null, loaded: false }
  const isDirty = tabState.loaded && tabState.content !== tabState.original

  const loadTab = useCallback(async (tabId) => {
    if (!supabase) return
    setLoading(true)
    try {
      const { data: row, error } = await supabase.from('system_prompts').select('*').eq('id', tabId).maybeSingle()
      if (error) throw error
      const content = row?.content || ''
      setData(v => ({ ...v, [tabId]: { content, original: content, updatedAt: row?.updated_at || null, loaded: true } }))
    } catch (e) {
      showToast('❌ 불러오기 실패: ' + e.message)
    }
    setLoading(false)
  }, [])

  const handleTabClick = (tabId) => {
    setActiveTab(tabId)
    if (!data[tabId]?.loaded) loadTab(tabId)
  }

  // 최초 진입 시 첫 탭(claude) 로드
  useEffect(() => { loadTab('claude') }, [loadTab])

  const setContent = (content) => {
    setData(v => ({ ...v, [activeTab]: { ...v[activeTab], content } }))
  }

  const save = async () => {
    if (!supabase) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const { error } = await supabase.from('system_prompts').upsert({ id: activeTab, content: tabState.content, updated_at: now })
      if (error) throw error
      setData(v => ({ ...v, [activeTab]: { ...v[activeTab], original: tabState.content, updatedAt: now } }))
      showToast('✅ 저장되었습니다')
    } catch (e) {
      showToast('❌ 저장 실패: ' + e.message)
    }
    setSaving(false)
  }

  const revert = () => {
    setData(v => ({ ...v, [activeTab]: { ...v[activeTab], content: v[activeTab].original } }))
  }

  const copyAll = () => {
    const text = tabState.content
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;'
      document.body.appendChild(ta)
      ta.focus(); ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadMd = () => {
    const blob = new Blob([tabState.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${activeTab}.md`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const uploadFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setContent(String(reader.result || ''))
    reader.readAsText(file)
    e.target.value = ''
  }

  if (!isAdmin) return null

  const charCount = tabState.content.length
  const lineCount = tabState.content ? tabState.content.split('\n').length : 0

  return (
    <div style={{ padding: '24px', maxWidth: '1000px' }}>
      <Toast msg={toast} />

      {/* 헤더 */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
          <div style={S.cardTitle}>🤖 Claude 시스템 프롬프트</div>
          {tabState.updatedAt && (
            <div style={{ fontSize: 12, color: C.muted }}>마지막 저장: {new Date(tabState.updatedAt).toLocaleString('ko-KR')}</div>
          )}
        </div>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
          MCP <code style={{ background: '#fff7ed', color: C.primary, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>get_system_prompt</code> 툴로 Claude가 이 내용을 불러가고,
          <code style={{ background: '#fff7ed', color: C.primary, padding: '1px 6px', borderRadius: 4, fontSize: 12, marginLeft: 4 }}>update_system_prompt</code> 툴로 이 화면과 동일한 내용을 갱신할 수 있어요.
        </p>

        {/* 탭 바 */}
        <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${C.border}`, marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => handleTabClick(t.id)}
              style={{
                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: activeTab === t.id ? 700 : 500,
                color: activeTab === t.id ? C.primary : C.muted,
                borderBottom: `2px solid ${activeTab === t.id ? C.primary : 'transparent'}`,
                marginBottom: -2, fontFamily: 'Noto Sans KR, sans-serif',
              }}>{t.label}</button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{activeTabInfo?.desc}</p>

        {/* 상태 칩 */}
        {tabState.loaded && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', minWidth: 90 }}>
              <div style={{ fontSize: 11, color: C.muted }}>글자수</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{charCount.toLocaleString()}</div>
            </div>
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', minWidth: 90 }}>
              <div style={{ fontSize: 11, color: C.muted }}>줄수</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{lineCount.toLocaleString()}</div>
            </div>
            <div style={{
              background: isDirty ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${isDirty ? '#fde68a' : '#86efac'}`,
              borderRadius: 8, padding: '8px 14px', minWidth: 90,
            }}>
              <div style={{ fontSize: 11, color: C.muted }}>상태</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: isDirty ? '#d97706' : C.success }}>
                {isDirty ? '⚠️ 미저장' : '✅ 저장됨'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 에디터 */}
      <div style={S.card}>
        {loading && !tabState.loaded ? (
          <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>불러오는 중...</div>
        ) : (
          <>
            <textarea
              value={tabState.content}
              onChange={e => setContent(e.target.value)}
              spellCheck={false}
              placeholder="이 탭의 시스템 프롬프트 내용을 입력하세요..."
              style={{
                width: '100%', minHeight: 520, padding: '14px 16px', borderRadius: 8,
                border: `1.5px solid ${C.border}`, fontSize: 13, lineHeight: 1.75,
                fontFamily: "'Fira Mono', Consolas, monospace", outline: 'none', resize: 'vertical',
                color: C.text, background: C.bg, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button onClick={save} disabled={!isDirty || saving} style={{ ...S.btn, opacity: (!isDirty || saving) ? 0.5 : 1 }}>
                {saving ? '저장 중...' : '💾 저장'}
              </button>
              <label style={{ ...S.btnGhost, display: 'inline-flex', alignItems: 'center' }}>
                📁 파일 업로드
                <input type="file" accept=".md,.txt" onChange={uploadFile} style={{ display: 'none' }} />
              </label>
              <button onClick={copyAll} style={S.btnGhost}>{copied ? '✅ 복사됨!' : '📋 전체 복사'}</button>
              <button onClick={downloadMd} style={S.btnGhost}>⬇️ MD 다운로드</button>
              {isDirty && (
                <button onClick={revert} style={{ ...S.btnGhost, color: '#e63946', borderColor: '#e63946' }}>↩ 되돌리기</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 안내 */}
      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '16px 20px', fontSize: 12, color: '#166534', lineHeight: 1.8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>사용 방법</div>
        1. 여기서 지침을 작성/수정하고 저장하면 <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 4 }}>system_prompts</code> 테이블에 반영됩니다.<br />
        2. Claude가 대화를 시작할 때 <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 4 }}>get_system_prompt</code> 툴로 이 내용을 불러갑니다.<br />
        3. Claude Project 설정의 커스텀 지침에는 아래 한 줄만 넣어두면 됩니다:<br />
        <code style={{ background: '#fff', padding: '4px 8px', borderRadius: 6, display: 'inline-block', marginTop: 6 }}>대화 시작 시 get_system_prompt 툴로 클로드 실행지침(claude)을 먼저 불러와서 그대로 따라줘.</code>
      </div>
    </div>
  )
}
