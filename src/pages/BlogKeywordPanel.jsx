/**
 * BlogKeywordPanel.jsx
 * 바른 교육 블로그 키워드 관리 패널
 * - 카드뉴스의 KeywordPanel을 출석부 스타일(밝은 테마)로 이식
 * - blog_keyword_stats / blog_keyword_picks / blog_feature_ideas 테이블 직접 조회
 * - 네이버 키워드 검색량 조회는 MCP naver_keyword_volume 툴을 통해서만 가능
 *   (클라이언트에서 직접 호출 불가 → 안내 메시지로 대체)
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

// ── 시리즈(그룹) 목록 — MCP의 SERIES와 동기화
const GROUPS = [
  { id: 'series-a', label: '📚 시리즈A — 초등 역량' },
  { id: 'series-b', label: '🌍 시리즈B — 세계 교육법' },
  { id: 'series-c', label: '💬 시리즈C — 고민 해결' },
  { id: 'series-d', label: '🧩 시리즈D — 역량·활동 연결' },
]

function fmt(n) { return (n || 0).toLocaleString('ko-KR') }

// 찜(별) 아이콘 — 유니코드 ☆/⭐ 글자 대신 SVG로.
function StarIcon({ filled, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? '#facc15' : 'none'}
      stroke={filled ? '#eab308' : '#9ca3af'}
      strokeWidth="1.6" strokeLinejoin="round"
      style={{ display: 'block' }}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function formatDate(iso) {
  if (!iso) return '기록 없음'
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

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
  success: '#15803d',
  successBg: '#dcfce7',
  successBorder: '#bbf7d0',
}

const S = {
  card: { background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '20px 22px', marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: 600, color: C.muted, display: 'block', marginBottom: 5 },
  input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: 'Noto Sans KR, sans-serif', outline: 'none', background: C.card, color: C.text, boxSizing: 'border-box' },
  btn: { padding: '9px 18px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' },
  btnGhost: { padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' },
  th: { fontSize: 12, color: C.muted, fontWeight: 700, padding: '8px 12px', textAlign: 'left', borderBottom: `1.5px solid ${C.border}`, background: C.bg, whiteSpace: 'nowrap' },
  td: { fontSize: 13, color: C.text, padding: '9px 12px', borderBottom: `1px solid ${C.border}` },
  tdNum: { fontSize: 13, color: C.text, fontWeight: 700, padding: '9px 12px', borderBottom: `1px solid ${C.border}`, textAlign: 'right' },
}

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', fontFamily: 'Noto Sans KR, sans-serif' }}>{msg}</div>
  )
}

function competitionStyle(c) {
  if (c === '낮음') return { color: C.success, bg: C.successBg, border: C.successBorder }
  if (c === '높음') return { color: C.danger, bg: C.dangerBg, border: C.dangerBorder }
  return { color: '#d97706', bg: '#fefce8', border: '#fde68a' }
}

// ── 아이디어 제안 탭
function FeatureIdeasTab({ showToast }) {
  const [ideas, setIdeas] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  const STATUS_LABELS = {
    proposed: { label: '검토 중', color: '#d97706', bg: '#fefce8', border: '#fde68a' },
    building: { label: '개발 중', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    done:     { label: '완료',   color: C.success, bg: C.successBg, border: C.successBorder },
    rejected: { label: '보류',   color: C.muted, bg: C.bg, border: C.border },
  }

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      let q = supabase.from('blog_feature_ideas').select('*').order('created_at', { ascending: false })
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      const { data } = await q
      setIdeas(Array.isArray(data) ? data : [])
    } catch { setIdeas([]) }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (id, newStatus) => {
    if (!supabase) return
    try {
      const { error } = await supabase.from('blog_feature_ideas').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
      showToast('✅ 상태 변경됨')
    } catch { showToast('❌ 변경 실패') }
  }

  const filtered = statusFilter === 'all' ? ideas : ideas.filter(i => i.status === statusFilter)

  return (
    <div>
      <div style={{ marginBottom: 14, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
        MCP <code style={{ background: '#fff7ed', color: C.primary, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>suggest_feature</code> 툴로 기록된 새 각도·주제 제안 목록입니다.<br />
        Claude가 황금키워드를 발견했을 때 새로운 각도로 쓸 만하다고 판단하면 여기에 쌓입니다.
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['all', '전체'], ['proposed', '검토 중'], ['building', '개발 중'], ['done', '완료'], ['rejected', '보류']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            style={{ padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${statusFilter === v ? C.primary : C.border}`, cursor: 'pointer', background: statusFilter === v ? '#fff7ed' : C.card, color: statusFilter === v ? C.primary : C.muted, fontSize: 12, fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>{l}
          </button>
        ))}
        <button onClick={load} style={S.btnGhost}>🔄 새로고침</button>
      </div>

      {loading ? (
        <div style={{ color: C.muted, fontSize: 13, padding: 20, textAlign: 'center' }}>로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 14, padding: 40, textAlign: 'center', background: C.bg, borderRadius: 12, border: `1.5px solid ${C.border}` }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>💡</div>
          아직 기록된 아이디어가 없습니다.<br />
          <span style={{ fontSize: 12, marginTop: 6, display: 'block' }}>Claude가 글 작성 중 suggest_feature 툴을 호출하면 여기에 나타납니다.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(idea => {
            const s = STATUS_LABELS[idea.status] || STATUS_LABELS.proposed
            return (
              <div key={idea.id} style={{ background: C.bg, borderRadius: 10, padding: '14px 18px', border: `1.5px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fff7ed', color: C.primary, border: `1px solid #fed7aa` }}>
                        {idea.series || idea.tool_id}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{idea.feature_name}</span>
                    </div>
                    {idea.keyword && (
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                        🔑 키워드: <span style={{ color: C.text, fontWeight: 600 }}>{idea.keyword}</span>
                        {idea.total ? <span style={{ marginLeft: 8, color: C.primary, fontWeight: 700 }}>검색수 {fmt(idea.total)}</span> : ''}
                        {idea.competition ? <span style={{ marginLeft: 8 }}>경쟁도 {idea.competition}</span> : ''}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{idea.notes}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                      {idea.created_at ? new Date(idea.created_at).toLocaleDateString('ko-KR') : ''} 기록
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                    <select value={idea.status} onChange={e => handleStatusChange(idea.id, e.target.value)}
                      style={{ background: C.card, border: `1.5px solid ${C.border}`, color: C.text, borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }}>
                      <option value="proposed">검토 중</option>
                      <option value="building">개발 중</option>
                      <option value="done">완료</option>
                      <option value="rejected">보류</option>
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트
export function BlogKeywordPanel({ isAdmin }) {
  const [tab, setTab]                         = useState('stats')
  const [stats, setStats]                     = useState([])
  const [statsLoading, setStatsLoading]       = useState(true)
  const [expanded, setExpanded]               = useState(null)
  const [topData, setTopData]                 = useState({})
  const [topLoading, setTopLoading]           = useState({})
  const [picks, setPicks]                     = useState([])
  const [picksLoading, setPicksLoading]       = useState(false)
  const [allKw, setAllKw]                     = useState([])
  const [allKwLoading, setAllKwLoading]       = useState(false)
  const [allKwLimit, setAllKwLimit]           = useState(100)
  const [goldenKw, setGoldenKw]               = useState([])
  const [goldenLoading, setGoldenLoading]     = useState(false)
  const [goldenComp, setGoldenComp]           = useState('낮음')
  const [todayRows, setTodayRows]             = useState([])
  const [todayLoading, setTodayLoading]       = useState(false)
  const [toast, setToast]                     = useState('')
  const [addKeyword, setAddKeyword]           = useState('')
  const [addLoading, setAddLoading]           = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // ── 통계 요약 로드 (hint별 count) — DB의 blog_keyword_stats_summary() 함수로 집계한다.
  // (예전엔 blog_keyword_stats 전체를 .limit() 없이 select()해서 브라우저에서 그룹핑했는데,
  //  Supabase 기본 응답 상한(1,000행)에 걸려 테이블이 1,000행을 넘으면 뒤쪽 그룹이 누락됐다.
  //  supabase/014_blog_keyword_stats_summary.sql 참고.)
  const loadStats = useCallback(async () => {
    if (!supabase) return
    setStatsLoading(true)
    try {
      const { data, error } = await supabase.rpc('blog_keyword_stats_summary')
      if (error) throw error
      setStats((Array.isArray(data) ? data : []).sort((a, b) => a.hint.localeCompare(b.hint, 'ko')))
    } catch (e) { console.error(e) }
    setStatsLoading(false)
  }, [])

  // ── hint별 TOP 키워드 로드
  const loadTop = useCallback(async (hint) => {
    if (!supabase || topData[hint]) return
    setTopLoading(l => ({ ...l, [hint]: true }))
    try {
      const { data } = await supabase
        .from('blog_keyword_stats')
        .select('keyword, pc, mobile, total, competition')
        .eq('hint', hint)
        .order('total', { ascending: false })
        .limit(50)
      setTopData(d => ({ ...d, [hint]: data || [] }))
    } catch (e) { console.error(e) }
    setTopLoading(l => ({ ...l, [hint]: false }))
  }, [topData])

  const handleExpand = (hint) => {
    if (expanded === hint) { setExpanded(null); return }
    setExpanded(hint)
    loadTop(hint)
  }

  // ── 키워드 추가 수집 — 카드뉴스컨버터 KeywordPanel.js의 handleAdd를 그대로 이식.
  // 다른 4개 프로젝트는 x-admin-token 고정 비밀키로 /api/tools/keyword-volume을 부르지만,
  // 이 프로젝트는 Supabase Auth 기반이라 세션 access_token을 Bearer로 실어
  // /api/admin/keyword-volume(신규)을 부르는 것만 다르다.
  const handleAdd = async () => {
    if (!supabase) return
    const kw = addKeyword.trim()
    if (!kw) return showToast('키워드를 입력해주세요')
    const exists = stats.find(h => h.hint === kw)
    if (exists) return showToast(`⚠️ "${kw}"는 이미 수집된 키워드예요. 아래 목록에서 펼쳐보세요.`)

    setAddLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다.')
      const res = await fetch(`/api/admin/keyword-volume?keyword=${encodeURIComponent(kw)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '오류')
      loadStats()
      showToast(`✅ "${kw}" 연관 키워드 ${data.saved}개 추가됨!`)
      setAddKeyword('')
    } catch (e) { showToast(`❌ 오류: ${e.message}`) }
    setAddLoading(false)
  }

  // ── 찜 목록 로드
  const loadPicks = useCallback(async () => {
    if (!supabase) return
    setPicksLoading(true)
    try {
      const { data } = await supabase
        .from('blog_keyword_picks')
        .select('tool_id, hint, keyword, pc, mobile, total, competition, memo, used_at, used_in_title, used_in_slug')
        .order('total', { ascending: false })
      setPicks(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setPicksLoading(false)
  }, [])

  // ── 전체 키워드 순위
  const loadAllKw = useCallback(async (lim) => {
    if (!supabase) return
    setAllKwLoading(true)
    try {
      const { data } = await supabase
        .from('blog_keyword_stats')
        .select('hint, keyword, pc, mobile, total, competition')
        .order('total', { ascending: false })
        .limit(lim || allKwLimit)
      setAllKw(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setAllKwLoading(false)
  }, [allKwLimit])

  // ── 황금 키워드
  const loadGolden = useCallback(async (comp) => {
    if (!supabase) return
    setGoldenLoading(true)
    try {
      let q = supabase
        .from('blog_keyword_stats')
        .select('hint, keyword, pc, mobile, total, competition')
        .order('total', { ascending: false })
        .limit(200)
      const c = comp || goldenComp
      if (c !== 'all') q = q.eq('competition', c)
      const { data } = await q
      setGoldenKw(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setGoldenLoading(false)
  }, [goldenComp])

  // ── 오늘 실시간 조회된 키워드 (naver_keyword_volume MCP 툴이 오늘 캐시한 것만)
  // .limit()이 없으면 이 역시 Supabase 기본 1,000행 상한에 걸릴 수 있어 방어적으로 추가.
  const loadToday = useCallback(async () => {
    if (!supabase) return
    setTodayLoading(true)
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const { data } = await supabase
        .from('blog_keyword_stats')
        .select('hint, keyword, pc, mobile, total, competition')
        .gte('updated_at', todayStart.toISOString())
        .order('total', { ascending: false })
        .limit(3000)
      setTodayRows(Array.isArray(data) ? data : [])
    } catch (e) { console.error(e) }
    setTodayLoading(false)
  }, [])

  useEffect(() => { loadStats(); loadPicks() }, [])

  const handleTabChange = (t) => {
    setTab(t)
    if (t === 'all') loadAllKw()
    if (t === 'golden') loadGolden()
    if (t === 'today') loadToday()
  }

  // ── 찜 토글
  const handlePick = async (hint, item, isPicked) => {
    if (!supabase) return
    try {
      if (isPicked) {
        await supabase.from('blog_keyword_picks').delete().eq('tool_id', hint).eq('keyword', item.keyword)
        showToast('⭐ 찜 해제됨')
      } else {
        await supabase.from('blog_keyword_picks').upsert({
          tool_id: hint, hint, keyword: item.keyword,
          pc: item.pc || 0, mobile: item.mobile || 0, total: item.total || 0,
          competition: item.competition || null,
        }, { onConflict: 'tool_id,keyword' })
        showToast('⭐ 찜에 추가됨!')
      }
      loadPicks()
    } catch (e) { showToast('❌ 오류: ' + e.message) }
  }

  const handleUnpick = async (toolId, keyword) => {
    if (!supabase) return
    try {
      await supabase.from('blog_keyword_picks').delete().eq('tool_id', toolId).eq('keyword', keyword)
      setPicks(p => p.filter(k => !(k.tool_id === toolId && k.keyword === keyword)))
      showToast('⭐ 찜 해제됨')
    } catch (e) { showToast('❌ 오류: ' + e.message) }
  }

  const handleMarkUsed = async (item) => {
    const title = window.prompt('이 키워드를 사용한 글 제목을 입력하세요')
    if (!title) return
    const slug = window.prompt('슬러그 (선택, 비워도 됩니다)') || ''
    if (!supabase) return
    try {
      await supabase.from('blog_keyword_picks').upsert({
        tool_id: item.tool_id, hint: item.hint || item.tool_id, keyword: item.keyword,
        pc: item.pc || 0, mobile: item.mobile || 0, total: item.total || 0,
        used_at: new Date().toISOString(),
        used_in_title: title, used_in_slug: slug || null,
      }, { onConflict: 'tool_id,keyword' })
      loadPicks()
      showToast('✅ 사용 처리됨')
    } catch (e) { showToast('❌ 오류: ' + e.message) }
  }

  const handleUnmarkUsed = async (toolId, keyword) => {
    if (!supabase) return
    try {
      await supabase.from('blog_keyword_picks').upsert({
        tool_id: toolId, keyword,
        used_at: null, used_in_title: null, used_in_slug: null,
      }, { onConflict: 'tool_id,keyword' })
      loadPicks()
      showToast('↩️ 미사용으로 되돌림')
    } catch (e) { showToast('❌ 오류: ' + e.message) }
  }

  const pendingPicks = picks.filter(p => !p.used_at)
  const usedPicks = picks.filter(p => p.used_at).sort((a, b) => new Date(b.used_at) - new Date(a.used_at))

  if (!isAdmin) return null

  const TABS = [
    ['stats',  '📊 수집 현황'],
    ['all',    '📈 전체 순위'],
    ['golden', '🏆 황금키워드'],
    ['today',  '🔴 오늘 실시간'],
    ['picks',  `⭐ 찜 (${pendingPicks.length})`],
    ['used',   '✅ 사용 기록'],
    ['ideas',  '💡 아이디어'],
  ]

  return (
    <div>
      <Toast msg={toast} />

      {/* 헤더 */}
      <div style={S.card}>
        <div style={S.cardTitle}>🔍 키워드 검색량 관리</div>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
          MCP <code style={{ background: '#fff7ed', color: C.primary, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>naver_keyword_volume</code> 툴을 통해 키워드 검색량이 수집됩니다.
          Claude에게 "이 키워드 검색량 조회해줘"라고 요청하면 자동으로 여기에 저장됩니다.
        </p>
        {/* 수집 현황 요약 */}
        {stats.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff7ed', border: `1.5px solid #fed7aa`, borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>전체 수집 키워드</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: C.primary }}>{stats.reduce((s, r) => s + (r.count || 0), 0).toLocaleString()}</span>
              <span style={{ fontSize: 13, color: C.muted }}>개</span>
            </div>
            <div style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>시리즈 그룹</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: C.text }}>{stats.length}</span>
              <span style={{ fontSize: 13, color: C.muted }}>개</span>
            </div>
            <div style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>찜한 키워드</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#2563eb' }}>{pendingPicks.length}</span>
              <span style={{ fontSize: 13, color: C.muted }}>개</span>
            </div>
          </div>
        )}
      </div>

      {/* 키워드 추가 수집 */}
      <div style={S.card}>
        <div style={S.cardTitle}>➕ 키워드 추가 수집</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={addKeyword}
            onChange={e => setAddKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="예: 바둑수업효과, 초등집중력, 방과후바둑"
            style={S.input}
          />
          <button onClick={handleAdd} disabled={addLoading} style={{ ...S.btn, cursor: addLoading ? 'wait' : 'pointer', opacity: addLoading ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            {addLoading ? '수집 중...' : '수집'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>수집하면 아래 "수집 현황" 목록에 새 그룹으로 추가됩니다.</div>
      </div>

      {/* 탭 버튼 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => handleTabChange(id)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${tab === id ? C.primary : C.border}`, cursor: 'pointer', background: tab === id ? '#fff7ed' : C.card, color: tab === id ? C.primary : C.muted, fontSize: 13, fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 탭: 수집 현황 */}
      {tab === 'stats' && (
        <div style={S.card}>
          {statsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>로딩 중...</div>
          ) : stats.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, background: C.bg, borderRadius: 12, border: `1.5px solid ${C.border}` }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
              <div style={{ fontWeight: 600 }}>아직 수집된 키워드가 없습니다</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Claude에게 키워드 검색량 조회를 요청하면 여기에 쌓입니다.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.map(row => {
                const isExpanded = expanded === row.hint
                const topList = topData[row.hint] || []
                return (
                  <div key={row.hint} style={{ marginBottom: 2 }}>
                    <div
                      onClick={() => handleExpand(row.hint)}
                      style={{ background: isExpanded ? '#fff7ed' : C.bg, border: `1.5px solid ${isExpanded ? C.primary : C.border}`, borderRadius: isExpanded ? '10px 10px 0 0' : 10, padding: '13px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                          {GROUPS.find(g => g.id === row.hint)?.label || row.hint}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted }}>
                          최근 업데이트: <b style={{ color: C.text }}>{formatDate(row.collected_at)}</b>
                          {' · '}키워드 <b style={{ color: C.primary }}>{fmt(row.count)}개</b>
                          {row.count > 0 && ' · TOP 50 클릭해서 보기'}
                        </div>
                      </div>
                      <span style={{ fontSize: 16, color: isExpanded ? C.primary : C.muted }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                    {isExpanded && (
                      <div style={{ border: `1.5px solid ${C.primary}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                        {topLoading[row.hint] ? (
                          <div style={{ padding: 20, color: C.muted, fontSize: 13, textAlign: 'center' }}>로딩 중...</div>
                        ) : topList.length === 0 ? (
                          <div style={{ padding: 20, color: C.muted, fontSize: 13, textAlign: 'center' }}>데이터 없음</div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={S.th}>순위</th>
                                <th style={S.th}>키워드</th>
                                <th style={{ ...S.th, textAlign: 'right' }}>PC</th>
                                <th style={{ ...S.th, textAlign: 'right' }}>모바일</th>
                                <th style={{ ...S.th, textAlign: 'right' }}>합계</th>
                                <th style={S.th}>경쟁</th>
                                <th style={{ ...S.th, textAlign: 'center' }}>찜</th>
                              </tr>
                            </thead>
                            <tbody>
                              {topList.map((item, i) => {
                                const isPicked = picks.some(p => p.keyword === item.keyword && p.tool_id === row.hint)
                                const cs = item.competition ? competitionStyle(item.competition) : null
                                return (
                                  <tr key={item.keyword} style={{ background: isPicked ? '#fff7ed' : C.card }}>
                                    <td style={{ ...S.td, color: C.muted }}>{i + 1}</td>
                                    <td style={{ ...S.td, fontWeight: 600 }}>{item.keyword}</td>
                                    <td style={S.tdNum}>{fmt(item.pc)}</td>
                                    <td style={S.tdNum}>{fmt(item.mobile)}</td>
                                    <td style={{ ...S.tdNum, color: C.primary }}>{fmt(item.total)}</td>
                                    <td style={S.td}>
                                      {cs && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>{item.competition}</span>}
                                    </td>
                                    <td style={{ ...S.td, textAlign: 'center' }}>
                                      <button onClick={e => { e.stopPropagation(); handlePick(row.hint, item, isPicked) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                                        <StarIcon filled={isPicked} />
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 전체 순위 */}
      {tab === 'all' && (
        <div style={S.card}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            {[100, 200, 500].map(n => (
              <button key={n} onClick={() => { setAllKwLimit(n); loadAllKw(n) }}
                style={{ padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${allKwLimit === n ? C.primary : C.border}`, cursor: 'pointer', background: allKwLimit === n ? '#fff7ed' : C.card, color: allKwLimit === n ? C.primary : C.muted, fontSize: 12, fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
                {n}개
              </button>
            ))}
            <button onClick={() => loadAllKw(allKwLimit)} style={S.btnGhost}>🔄 새로고침</button>
            <span style={{ fontSize: 12, color: C.muted }}>{allKw.length.toLocaleString()}개 표시</span>
          </div>
          {allKwLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>로딩 중...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th}>순위</th>
                    <th style={S.th}>그룹</th>
                    <th style={S.th}>키워드</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>PC</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>모바일</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>합계</th>
                    <th style={S.th}>경쟁</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>찜</th>
                  </tr>
                </thead>
                <tbody>
                  {allKw.map((item, i) => {
                    const isPicked = picks.some(p => p.keyword === item.keyword && p.tool_id === item.hint)
                    const cs = item.competition ? competitionStyle(item.competition) : null
                    return (
                      <tr key={`${item.hint}-${item.keyword}`} style={{ background: isPicked ? '#fff7ed' : C.card }}>
                        <td style={{ ...S.td, color: C.muted }}>{i + 1}</td>
                        <td style={{ ...S.td, fontSize: 11, color: C.muted }}>{item.hint}</td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{item.keyword}</td>
                        <td style={S.tdNum}>{fmt(item.pc)}</td>
                        <td style={S.tdNum}>{fmt(item.mobile)}</td>
                        <td style={{ ...S.tdNum, color: C.primary }}>{fmt(item.total)}</td>
                        <td style={S.td}>{cs && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>{item.competition}</span>}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <button onClick={() => handlePick(item.hint, item, isPicked)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                            <StarIcon filled={isPicked} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 황금 키워드 */}
      {tab === 'golden' && (
        <div style={S.card}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, lineHeight: 1.6 }}>
            검색량은 높고 경쟁도는 낮은 키워드를 전체에서 찾아 보여줍니다. <b style={{ color: C.text }}>위쪽일수록 더 좋은 후보</b>입니다.
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {['낮음', '중간', '높음', 'all'].map(c => (
              <button key={c} onClick={() => { setGoldenComp(c); loadGolden(c) }}
                style={{ padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${goldenComp === c ? C.primary : C.border}`, cursor: 'pointer', background: goldenComp === c ? '#fff7ed' : C.card, color: goldenComp === c ? C.primary : C.muted, fontSize: 12, fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif' }}>
                {c === 'all' ? '전체' : '경쟁 ' + c}
              </button>
            ))}
            <button onClick={() => loadGolden(goldenComp)} style={S.btnGhost}>🔄 새로고침</button>
            <span style={{ fontSize: 12, color: C.muted, alignSelf: 'center' }}>{goldenKw.length.toLocaleString()}개</span>
          </div>
          {goldenLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>로딩 중...</div>
          ) : goldenKw.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>해당 경쟁도의 키워드가 없습니다.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th}>순위</th>
                    <th style={S.th}>그룹</th>
                    <th style={S.th}>키워드</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>PC</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>모바일</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>합계</th>
                    <th style={S.th}>경쟁</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>찜</th>
                  </tr>
                </thead>
                <tbody>
                  {goldenKw.map((item, i) => {
                    const isPicked = picks.some(p => p.keyword === item.keyword && p.tool_id === item.hint)
                    const cs = item.competition ? competitionStyle(item.competition) : null
                    return (
                      <tr key={`${item.hint}-${item.keyword}`} style={{ background: isPicked ? '#fff7ed' : C.card }}>
                        <td style={{ ...S.td, color: C.muted }}>{i + 1}</td>
                        <td style={{ ...S.td, fontSize: 11, color: C.muted }}>{item.hint}</td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{item.keyword}</td>
                        <td style={S.tdNum}>{fmt(item.pc)}</td>
                        <td style={S.tdNum}>{fmt(item.mobile)}</td>
                        <td style={{ ...S.tdNum, color: C.primary }}>{fmt(item.total)}</td>
                        <td style={S.td}>{cs && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>{item.competition}</span>}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <button onClick={() => handlePick(item.hint, item, isPicked)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                            <StarIcon filled={isPicked} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 오늘 실시간 조회 */}
      {tab === 'today' && (
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
              오늘 Claude가 <code style={{ background: '#fff7ed', color: C.primary, padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>naver_keyword_volume</code> 툴로 실시간 조회한 키워드 목록입니다.<br />
              ☆ 버튼으로 찜해두면 "찜" 탭에서 관리할 수 있습니다.
            </div>
            <button onClick={loadToday} style={S.btnGhost}>🔄 새로고침</button>
          </div>
          {todayLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>로딩 중...</div>
          ) : todayRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, background: C.bg, borderRadius: 12, border: `1.5px solid ${C.border}` }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔴</div>
              <div style={{ fontWeight: 600 }}>오늘 실시간 조회한 키워드가 없어요</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Claude와 대화 중 naver_keyword_volume 툴이 호출되면 여기에 나타납니다.</div>
            </div>
          ) : (() => {
            const groups = {}
            todayRows.forEach(r => { if (!groups[r.hint]) groups[r.hint] = []; groups[r.hint].push(r) })
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(groups).map(([hint, rows]) => (
                  <div key={hint} style={{ background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>🔍 {GROUPS.find(g => g.id === hint)?.label || hint}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>연관 키워드 {rows.length}개</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr>
                        <th style={S.th}>순위</th><th style={S.th}>키워드</th>
                        <th style={{ ...S.th, textAlign: 'right' }}>PC</th>
                        <th style={{ ...S.th, textAlign: 'right' }}>모바일</th>
                        <th style={{ ...S.th, textAlign: 'right' }}>합계</th>
                        <th style={S.th}>경쟁</th>
                        <th style={{ ...S.th, textAlign: 'center' }}>찜</th>
                      </tr></thead>
                      <tbody>
                        {rows.map((item, i) => {
                          const isPicked = picks.some(p => p.keyword === item.keyword && p.tool_id === hint)
                          const cs = item.competition ? competitionStyle(item.competition) : null
                          return (
                            <tr key={item.keyword} style={{ background: isPicked ? '#fff7ed' : C.card }}>
                              <td style={{ ...S.td, color: C.muted }}>{i + 1}</td>
                              <td style={{ ...S.td, fontWeight: 600 }}>{item.keyword}</td>
                              <td style={S.tdNum}>{fmt(item.pc)}</td>
                              <td style={S.tdNum}>{fmt(item.mobile)}</td>
                              <td style={{ ...S.tdNum, color: C.primary }}>{fmt(item.total)}</td>
                              <td style={S.td}>{cs && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>{item.competition}</span>}</td>
                              <td style={{ ...S.td, textAlign: 'center' }}>
                                <button onClick={() => handlePick(hint, item, isPicked)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                                  <StarIcon filled={isPicked} />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── 탭: 찜한 키워드 */}
      {tab === 'picks' && (
        <div style={S.card}>
          {picksLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>로딩 중...</div>
          ) : pendingPicks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, background: C.bg, borderRadius: 12, border: `1.5px solid ${C.border}` }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⭐</div>
              <div style={{ fontWeight: 600 }}>아직 찜한 키워드가 없습니다</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>수집 현황 / 전체 순위 / 황금키워드 탭에서 ☆ 버튼으로 찜해두세요!</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th}>그룹</th>
                    <th style={S.th}>키워드</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>PC</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>모바일</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>합계</th>
                    <th style={S.th}>경쟁</th>
                    <th style={S.th}>메모</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>사용 처리</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>해제</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPicks.map(item => {
                    const cs = item.competition ? competitionStyle(item.competition) : null
                    return (
                      <tr key={`${item.tool_id}-${item.keyword}`}>
                        <td style={{ ...S.td, fontSize: 11, color: C.muted }}>{item.tool_id}</td>
                        <td style={{ ...S.td, fontWeight: 700 }}>{item.keyword}</td>
                        <td style={S.tdNum}>{fmt(item.pc)}</td>
                        <td style={S.tdNum}>{fmt(item.mobile)}</td>
                        <td style={{ ...S.tdNum, color: C.primary }}>{fmt(item.total)}</td>
                        <td style={S.td}>{cs && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>{item.competition}</span>}</td>
                        <td style={{ ...S.td, fontSize: 12, color: C.muted, maxWidth: 160 }}>{item.memo || '-'}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <button onClick={() => handleMarkUsed(item)} style={{ background: C.successBg, border: `1px solid ${C.successBorder}`, color: C.success, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                            ✅ 사용함
                          </button>
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <button onClick={() => handleUnpick(item.tool_id, item.keyword)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}><StarIcon filled /></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 사용 기록 */}
      {tab === 'used' && (
        <div style={S.card}>
          {picksLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>로딩 중...</div>
          ) : usedPicks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, background: C.bg, borderRadius: 12, border: `1.5px solid ${C.border}` }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
              <div style={{ fontWeight: 600 }}>아직 사용 처리된 키워드가 없습니다</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>찜한 키워드 탭의 "✅ 사용함" 버튼으로 기록해두세요!</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th}>사용일</th>
                    <th style={S.th}>그룹</th>
                    <th style={S.th}>키워드</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>합계</th>
                    <th style={S.th}>사용한 글</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>되돌리기</th>
                  </tr>
                </thead>
                <tbody>
                  {usedPicks.map(item => (
                    <tr key={`${item.tool_id}-${item.keyword}`}>
                      <td style={{ ...S.td, fontSize: 12, color: C.muted }}>{formatDate(item.used_at)}</td>
                      <td style={{ ...S.td, fontSize: 11, color: C.muted }}>{item.tool_id}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{item.keyword}</td>
                      <td style={{ ...S.tdNum, color: C.primary }}>{fmt(item.total)}</td>
                      <td style={S.td}>
                        <div style={{ fontSize: 13 }}>{item.used_in_title || '-'}</div>
                        {item.used_in_slug && <div style={{ fontSize: 11, color: C.muted }}>/blog/{item.used_in_slug}</div>}
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        <button onClick={() => handleUnmarkUsed(item.tool_id, item.keyword)} style={{ background: C.card, border: `1.5px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                          ↩️ 되돌리기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 탭: 아이디어 제안 */}
      {tab === 'ideas' && (
        <div style={S.card}>
          <FeatureIdeasTab showToast={showToast} />
        </div>
      )}
    </div>
  )
}
