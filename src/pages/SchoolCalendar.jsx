import React, { useState } from 'react'
import { calcSessionDates, getDayLabel } from '../lib/utils.js'
import { CANCEL_REASONS } from '../constants/config.js'
import { Select, Input, Btn } from '../components/Atoms.jsx'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// 텀별 색상 팔레트
const TERM_COLORS = [
  { bg:'#fff7ed', border:'#f97316', badge:'#f97316', text:'#ea580c' },  // 1텀 - 주황
  { bg:'#f0fdf4', border:'#16a34a', badge:'#16a34a', text:'#15803d' },  // 2텀 - 초록
  { bg:'#eff6ff', border:'#3b82f6', badge:'#3b82f6', text:'#1d4ed8' },  // 3텀 - 파랑
  { bg:'#fdf4ff', border:'#a855f7', badge:'#a855f7', text:'#7e22ce' },  // 4텀 - 보라
  { bg:'#fff1f2', border:'#f43f5e', badge:'#f43f5e', text:'#be123c' },  // 5텀 - 핑크
  { bg:'#fefce8', border:'#eab308', badge:'#eab308', text:'#a16207' },  // 6텀 - 노랑
]
const getTermColor = (termNum) => TERM_COLORS[(termNum - 1) % TERM_COLORS.length] || TERM_COLORS[0]

function MonthCalendar({ year, month, sessionMap, cancelled, cancelledDates, makeupDates, termMap, onDateClick, applyStartAt, applyEndAt }) {
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= lastDate; d++) cells.push(d)
  const makeupSet = new Set(makeupDates.map(m => m.date))

  // 신청기간 날짜 범위 계산 (날짜 단위)
  const applyStartDay = applyStartAt ? applyStartAt.slice(0,10) : null
  const applyEndDay   = applyEndAt   ? applyEndAt.slice(0,10)   : null

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:'4px' }}>
        {DAY_LABELS.map((d, i) => (
          <div key={d} style={{ textAlign:'center', fontSize:'11px', fontWeight:700, padding:'4px 0',
            color: i===0?'#ef4444': i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={'e'+idx} />
          const dateStr = year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0')
          const sessInfo = sessionMap[dateStr]
          const session  = sessInfo  // 하위 호환
          const isCancelled = cancelled.has(dateStr)
          const isMakeup    = makeupSet.has(dateStr)
          const isSession   = !!sessInfo && !isCancelled && !isMakeup
          const cancelInfo  = cancelledDates.find(c => c.date === dateStr)
          const makeupInfo  = makeupDates.find(m => m.date === dateStr)
          const reasonLabel = CANCEL_REASONS.find(r => r.value === cancelInfo?.reason)?.label
          const termNum     = termMap[dateStr]
          const dow = (firstDay + day - 1) % 7
          const isSun = dow === 0, isSat = dow === 6

          // 신청기간 포함 여부
          const inApply = applyStartDay && applyEndDay && dateStr >= applyStartDay && dateStr <= applyEndDay
          const isApplyStart = applyStartDay === dateStr
          const isApplyEnd   = applyEndDay === dateStr
          const applyDot = inApply ? (
            <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#3b82f6', margin:'1px auto 0' }} />
          ) : null

          // 수동 추가 수업일 (makeupDates + type:'session')
          if (isMakeup && makeupInfo?.type === 'session') {
            return (
              <button key={day} onClick={() => onDateClick(dateStr, 'makeup')}
                title={`수업일 ${sessInfo?.total||''}차시: ${makeupInfo?.memo||''} — 클릭하면 변경`}
                style={{ padding:'4px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                  background: inApply ? '#fff7ed' : '#fff7ed',
                  outline: inApply ? '1.5px solid #93c5fd' : '1.5px solid #f97316',
                  outlineOffset:'-1px',
                  textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color: isSun?'#ef4444': isSat?'#3b82f6':'#111827' }}>{day}</div>
                <div style={{ fontSize:'10px', color:'#ea580c', fontWeight:700, lineHeight:1.2 }}>수업일</div>
                <div style={{ fontSize:'9px', color:'#fff', background:'#f97316', borderRadius:'4px',
                  padding:'0 3px', marginTop:'1px', lineHeight:'14px' }}>{sessInfo?.total||''}차시</div>
                {applyDot}
              </button>
            )
          }

          // 보강일 (정규 수업일 아님)
          if (isMakeup) {
            return (
              <button key={day} onClick={() => onDateClick(dateStr, 'makeup')}
                title={`보강 ${sessInfo?.total||''}차시: ${makeupInfo?.memo||''} — 클릭하면 삭제`}
                style={{ padding:'4px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                  background:'#eff6ff', outline:'1.5px solid #3b82f6', outlineOffset:'-1px',
                  textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color: isSun?'#ef4444': isSat?'#3b82f6':'#1d4ed8' }}>{day}</div>
                <div style={{ fontSize:'10px', color:'#3b82f6', fontWeight:700, lineHeight:1.2 }}>보강</div>
                {makeupInfo?.memo && <div style={{ fontSize:'9px', color:'#93c5fd', lineHeight:1.1 }}>{makeupInfo.memo.slice(0,4)}</div>}
                {applyDot}
              </button>
            )
          }

          // 취소된 수업일
          if (isCancelled) {
            return (
              <button key={day} onClick={() => onDateClick(dateStr, 'cancelled')}
                title={`취소됨: ${reasonLabel||''} — 클릭하면 복원`}
                style={{ padding:'4px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                  background:'#fef2f2', outline:'1.5px solid #fca5a5', outlineOffset:'-1px',
                  textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:'#d1d5db' }}>{day}</div>
                <div style={{ fontSize:'9px', color:'#ef4444', lineHeight:1.2 }}>{reasonLabel||'취소'}</div>
                {applyDot}
              </button>
            )
          }

          // 정규 수업일
          if (isSession) {
            const tc = getTermColor(sessInfo.termNum || 1)
            return (
              <button key={day} onClick={() => onDateClick(dateStr, 'session')}
                title={`전체 ${sessInfo.total}차시 | ${sessInfo.termNum}텀 ${sessInfo.termSess}차시 — 클릭하면 처리`}
                style={{ padding:'4px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                  background: tc.bg, outline:`1.5px solid ${tc.border}`, outlineOffset:'-1px',
                  textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color: isSun?'#ef4444': isSat?'#3b82f6':'#111827' }}>{day}</div>
                <div style={{ fontSize:'10px', color: tc.text, fontWeight:700, lineHeight:1.3 }}>
                  {sessInfo.total}차시
                </div>
                <div style={{ fontSize:'9px', color:'#fff', background: tc.badge, borderRadius:'4px',
                  padding:'0 3px', marginTop:'1px', lineHeight:'14px', whiteSpace:'nowrap' }}>
                  {sessInfo.termNum}텀{sessInfo.termSess}차
                </div>
                {applyDot}
              </button>
            )
          }

          // 일반 날짜 — 신청기간 내 날짜는 파란 배경
          return (
            <button key={day} onClick={() => onDateClick(dateStr, 'normal')}
              title={inApply ? '신청기간' : '클릭하면 휴일 또는 보강 추가'}
              style={{ padding:'6px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                background: inApply ? '#eff6ff' : 'transparent',
                outline: inApply ? '1px solid #bfdbfe' : 'none',
                textAlign:'center', fontFamily:'Noto Sans KR, sans-serif',
                color: isSun?'#fca5a5': isSat?'#93c5fd': inApply ? '#1d4ed8' : '#9ca3af', fontSize:'12px',
                transition:'all .12s' }}
              onMouseEnter={e => e.currentTarget.style.background= inApply ? '#dbeafe' : '#f0fdf4'}
              onMouseLeave={e => e.currentTarget.style.background= inApply ? '#eff6ff' : 'transparent'}>
              {day}
              {inApply && <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#3b82f6', margin:'1px auto 0' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SchoolCalendar({ cls, onUpdate, onSave, session }) {
  const [localCls, setLocalCls] = React.useState(() => ({
    title: '', days: [], termType: 'semester', termCount: 4, termSizes: [4,4,4,4],
    repeatType: 'every', startDate: '', endDate: '',
    cancelledDates: [], makeupDates: [], totalSessions: null,
    applyStartAt: null, applyEndAt: null,
    ...cls,
  }))
  const updateLocal = (patch) => {
    const updated = { ...localCls, ...patch }
    setLocalCls(updated)
    onUpdate(updated)
  }

  // cls 외부 변경 시 동기화 (다른 일정 선택)
  React.useEffect(() => {
    setLocalCls({
      title: '', days: [], termType: 'semester', termCount: 4, termSizes: [4,4,4,4],
      repeatType: 'every', startDate: '', endDate: '',
      cancelledDates: [], makeupDates: [], totalSessions: null,
      applyStartAt: null, applyEndAt: null,
      ...cls,
    })
  }, [cls?.id])

  const set = (k, v) => updateLocal({ [k]: v })

  const HOLIDAYS_DATA = {
    2025:[ {date:'2025-01-01',name:'신정'},{date:'2025-01-28',name:'설날'},{date:'2025-01-29',name:'설날'},{date:'2025-01-30',name:'설날'},
      {date:'2025-03-01',name:'삼일절'},{date:'2025-05-05',name:'어린이날'},{date:'2025-05-06',name:'어린이날 대체'},
      {date:'2025-05-13',name:'부처님오신날'},{date:'2025-06-06',name:'현충일'},{date:'2025-08-15',name:'광복절'},
      {date:'2025-10-03',name:'개천절'},{date:'2025-10-05',name:'추석'},{date:'2025-10-06',name:'추석'},{date:'2025-10-07',name:'추석'},
      {date:'2025-10-08',name:'추석 대체'},{date:'2025-10-09',name:'한글날'},{date:'2025-12-25',name:'성탄절'} ],
    2026:[ {date:'2026-01-01',name:'신정'},{date:'2026-01-28',name:'설날'},{date:'2026-01-29',name:'설날'},{date:'2026-01-30',name:'설날'},
      {date:'2026-03-01',name:'삼일절'},{date:'2026-05-05',name:'어린이날'},{date:'2026-05-24',name:'부처님오신날'},
      {date:'2026-06-03',name:'지방선거일'},{date:'2026-06-06',name:'현충일'},{date:'2026-08-15',name:'광복절'},
      {date:'2026-09-24',name:'추석'},{date:'2026-09-25',name:'추석'},{date:'2026-09-26',name:'추석'},
      {date:'2026-10-03',name:'개천절'},{date:'2026-10-09',name:'한글날'},{date:'2026-12-25',name:'성탄절'} ],
    2027:[ {date:'2027-01-01',name:'신정'},{date:'2027-02-16',name:'설날'},{date:'2027-02-17',name:'설날'},{date:'2027-02-18',name:'설날'},
      {date:'2027-03-01',name:'삼일절'},{date:'2027-05-05',name:'어린이날'},{date:'2027-05-13',name:'부처님오신날'},
      {date:'2027-06-06',name:'현충일'},{date:'2027-08-15',name:'광복절'},
      {date:'2027-09-14',name:'추석'},{date:'2027-09-15',name:'추석'},{date:'2027-09-16',name:'추석'},
      {date:'2027-10-03',name:'개천절'},{date:'2027-10-09',name:'한글날'},{date:'2027-12-25',name:'성탄절'} ],
  }

  const hasConfig = localCls.startDate && localCls.endDate && localCls.days?.length
  const [selectedDate,  setSelectedDate]  = useState(null)
  const [clickType,     setClickType]     = useState(null)  // 'normal' | 'session' | 'cancelled' | 'makeup'
  const [showNormalAction,     setShowNormalAction]     = useState(false)  // 빈 날짜 클릭
  const [showRegisteredAction, setShowRegisteredAction] = useState(false)  // 있는 날짜 클릭
  const [showCancel,    setShowCancel]    = useState(false)
  const [showMakeup,    setShowMakeup]    = useState(false)
  const [reason,        setReason]        = useState('public_holiday')
  const [memo,          setMemo]          = useState('')

  // 신청기간 모달
  const [showApplyPeriod, setShowApplyPeriod] = useState(false)
  const [applyStart, setApplyStart] = useState('')
  const [applyEnd,   setApplyEnd]   = useState('')

  const CANCEL_OPTIONS = [
    { value: 'public_holiday', label: '공휴일' },
    { value: 'election_day',   label: '선거일' },
    { value: 'school_holiday', label: '학교재량휴일' },
    { value: 'teacher_absent', label: '강사사정' },
    { value: 'etc',            label: '기타' },
  ]

  const defaultYear = localCls?.year || new Date().getFullYear()

  const allSessions   = hasConfig ? calcSessionDates(localCls) : []
  const sessions      = hasConfig && localCls.totalSessions ? allSessions.slice(0, localCls.totalSessions) : allSessions
  const cancelled     = new Set((localCls.cancelledDates || []).map(c => c.date))
  const cancelledDates = localCls.cancelledDates || []
  const makeupDates   = localCls.makeupDates || []

  const termSizes = (localCls.termSizes?.length > 0)
    ? localCls.termSizes.slice(0, localCls.termCount || localCls.termSizes.length).map(n => Number(n) || 4)
    : [localCls.termSize ? Number(localCls.termSize) : 4]

  const sessionMap = {}
  const termMap    = {}
  let totalIdx = 1
  let cursor   = 0
  if (hasConfig) {
    termSizes.forEach((size, ti) => {
      let termIdx = 1
      sessions.slice(cursor, cursor + size).forEach(d => {
        if (!cancelled.has(d)) {
          sessionMap[d] = { total: totalIdx++, termNum: ti+1, termSess: termIdx++ }
          termMap[d] = ti + 1
        } else {
          termMap[d] = ti + 1
        }
      })
      cursor += size
    })
    if (!localCls.totalSessions && cursor < sessions.length) {
      let termIdx = 1
      sessions.slice(cursor).forEach(d => {
        if (!cancelled.has(d)) {
          sessionMap[d] = { total: totalIdx++, termNum: termSizes.length, termSess: termIdx++ }
        }
        termMap[d] = termSizes.length
      })
    }
  }
  makeupDates.forEach(m => {
    sessionMap[m.date] = { total: totalIdx++, termNum: 0, termSess: 0, isMakeup: true }
  })

  const months = []
  if (hasConfig) {
    const startD = new Date(localCls.startDate + 'T00:00:00')
    const endD   = new Date(localCls.endDate   + 'T00:00:00')
    let cur = new Date(startD.getFullYear(), startD.getMonth(), 1)
    while (cur <= endD) {
      months.push({ year: cur.getFullYear(), month: cur.getMonth() })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  } else {
    for (let m = 0; m < 12; m++) {
      months.push({ year: defaultYear, month: m })
    }
  }

  // 신청기간 모달 열 때 기존 값 로드
  const openApplyPeriod = () => {
    setApplyStart(localCls.applyStartAt ? localCls.applyStartAt.slice(0,16) : '')
    setApplyEnd(  localCls.applyEndAt   ? localCls.applyEndAt.slice(0,16)   : '')
    setShowApplyPeriod(true)
  }
  const saveApplyPeriod = () => {
    onUpdate({ ...localCls, applyStartAt: applyStart || null, applyEndAt: applyEnd || null })
    setShowApplyPeriod(false)
  }

  // 신청기간 상태 계산
  const now = new Date()
  const applyStartD = localCls.applyStartAt ? new Date(localCls.applyStartAt) : null
  const applyEndD   = localCls.applyEndAt   ? new Date(localCls.applyEndAt)   : null
  const isApplyOpen = applyStartD && applyEndD && now >= applyStartD && now <= applyEndD
  const isApplyPast = applyEndD && now > applyEndD
  const fmtDT = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const handleDateClick = (date, type) => {
    setSelectedDate(date)
    setClickType(type)
    if (type === 'normal') {
      setShowNormalAction(true)
    } else {
      // session / cancelled / makeup 모두 동일 모달
      setShowRegisteredAction(true)
    }
  }

  const handleCancelSave = () => {
    onUpdate({ ...localCls, cancelledDates: [...cancelledDates, { date: selectedDate, reason, memo }] })
    setShowCancel(false)
  }

  const handleMakeupSave = () => {
    onUpdate({ ...localCls, makeupDates: [...makeupDates, { date: selectedDate, memo }] })
    setShowMakeup(false)
  }

  const activeCount = sessions.filter(d => !cancelled.has(d)).length
  const makeupCount = makeupDates.length
  const cancelCount = cancelledDates.length

  const termSummary = termSizes.map((size, ti) => {
    const start = termSizes.slice(0,ti).reduce((a,b)=>a+b,0)
    const globalStart = start + 1
    const globalEnd   = Math.min(start + size, sessions.length)
    const termSessions = sessions.slice(start, start + size)
    const active = termSessions.filter(d => !cancelled.has(d)).length
    return { num: ti+1, active, total: size, globalStart, globalEnd }
  })

  // ── 유효성 검사 ────────────────────────────────────────────
  const totalConfigured = localCls.totalSessions ? Number(localCls.totalSessions) : sessions.length
  const termSum         = termSizes.reduce((a, b) => a + b, 0)
  const warnings = []
  if (localCls.totalSessions && allSessions.length < Number(localCls.totalSessions)) {
    warnings.push(`달력 날짜(${allSessions.length}회)가 설정한 전체 수업일수(${localCls.totalSessions}회)보다 부족합니다. 날짜 범위를 늘리거나 수업일수를 줄이세요.`)
  }
  if (activeCount + makeupCount > totalConfigured) {
    warnings.push(`실제 수업 횟수(${activeCount + makeupCount}회)가 전체 수업일수(${totalConfigured}회)를 초과했습니다.`)
  }
  if (termSum !== totalConfigured) {
    warnings.push(`텀별 차시 합계(${termSum}차시)가 전체 수업일수(${totalConfigured}회)와 맞지 않습니다.`)
  }

  return (
    <div>
      {/* ── 기본 정보 설정 패널 */}
      <div style={{ background:'#f8fafc', border:'1.5px solid #e5e7eb', borderRadius:'12px', padding:'16px', marginBottom:'14px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'12px' }}>📋 기본 정보</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'4px' }}>일정명 *</label>
              <input value={localCls.title||''} onChange={e=>set('title',e.target.value)} placeholder="예: 2026 월요일 수업"
                style={{ width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'4px' }}>운영 방식</label>
              <select value={localCls.termType||'semester'} onChange={e=>set('termType',e.target.value)}
                style={{ width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                <option value="semester">학기제</option>
                <option value="quarter">분기제</option>
                <option value="monthly">월정액</option>
                <option value="custom">자유</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'6px' }}>수업 요일 *</label>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {['월','화','수','목','금','토','일'].map(d => {
                const sel = (localCls.days||[]).includes(d)
                return (
                  <button key={d} type="button" onClick={() => {
                    const cur = localCls.days||[]
                    set('days', sel ? cur.filter(x=>x!==d) : [...cur,d])
                  }} style={{ width:'36px', height:'36px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:700,
                    background:sel?'#1e3a5f':'#f3f4f6', color:sel?'#fff':'#374151', fontFamily:'Noto Sans KR, sans-serif' }}>{d}</button>
                )
              })}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'4px' }}>시작일 *</label>
              <input type="date" value={localCls.startDate||''} onChange={e=>set('startDate',e.target.value)}
                style={{ width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'4px' }}>종료일 *</label>
              <input type="date" value={localCls.endDate||''} onChange={e=>set('endDate',e.target.value)}
                style={{ width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 텀 구성 설정 */}
      <div style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:'12px', padding:'14px 16px', marginBottom:'14px' }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:'#ea580c', marginBottom:'12px' }}>📅 텀 구성 설정</div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
          <label style={{ fontSize:'12px', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>총 수업횟수</label>
          <input type="number" min="1" max="200" value={localCls.totalSessions||''} placeholder="예: 20"
            onChange={e => set('totalSessions', parseInt(e.target.value)||null)}
            style={{ width:'72px', padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #fbd38d', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'center', background:'#fff' }} />
          {localCls.totalSessions > 0 && localCls.totalSessions !== (localCls.termSizes||[4,4,4,4]).slice(0,localCls.termCount||4).reduce((a,b)=>a+b,0) && (
            <span style={{ fontSize:'12px', color:'#ef4444', fontWeight:600 }}>
              ⚠️ 텀 합산({(localCls.termSizes||[4,4,4,4]).slice(0,localCls.termCount||4).reduce((a,b)=>a+b,0)}차시)과 다릅니다.
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
          <label style={{ fontSize:'12px', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>총 텀 수</label>
          <div style={{ display:'flex', gap:'6px' }}>
            {[1,2,3,4,5,6].map(n => (
              <button key={n} type="button" onClick={() => {
                const prev = localCls.termSizes||[4]
                const next = Array.from({length:n},(_,i)=>prev[i]||4)
                updateLocal({ termCount:n, termSizes:next })
              }} style={{ width:'32px', height:'32px', borderRadius:'8px', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontSize:'13px', fontWeight:700, background:(localCls.termCount||4)===n?'#f97316':'#f3f4f6', color:(localCls.termCount||4)===n?'#fff':'#374151', transition:'all .15s' }}>{n}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'flex-end' }}>
          {Array.from({length:localCls.termCount||4},(_,i) => {
            const sizes = localCls.termSizes||[4,4,4,4]
            const startSession = sizes.slice(0,i).reduce((a,b)=>a+b,0)+1
            const endSession   = sizes.slice(0,i+1).reduce((a,b)=>a+b,0)
            return (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                <label style={{ fontSize:'11px', color:'#ea580c', fontWeight:700 }}>{i+1}텀</label>
                <input type="number" min="1" max="99" value={sizes[i]||4}
                  onChange={e => { const next=[...sizes]; next[i]=parseInt(e.target.value)||1; set('termSizes',next) }}
                  style={{ width:'52px', padding:'7px 6px', borderRadius:'8px', border:'1.5px solid #fbd38d', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'center', background:'#fff' }} />
                <span style={{ fontSize:'10px', color:'#9ca3af' }}>{startSession}~{endSession}차시</span>
              </div>
            )
          })}
          <div style={{ fontSize:'12px', color:'#9ca3af', marginLeft:'4px', marginBottom:'18px' }}>
            = 총 {(localCls.termSizes||[4,4,4,4]).slice(0,localCls.termCount||4).reduce((a,b)=>a+b,0)}차시
          </div>
        </div>
      </div>

      {/* 신청기간 배너 */}
      {(localCls.applyStartAt || localCls.applyEndAt) && (
        <div style={{
          display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px',
          borderRadius:'10px', marginBottom:'12px',
          background: isApplyOpen ? '#f0fdf4' : isApplyPast ? '#f9fafb' : '#eff6ff',
          border: `1.5px solid ${isApplyOpen ? '#86efac' : isApplyPast ? '#e5e7eb' : '#93c5fd'}`,
        }}>
          <span style={{ fontSize:'16px' }}>{isApplyOpen ? '🟢' : isApplyPast ? '⚫' : '🔵'}</span>
          <div style={{ flex:1, fontSize:'13px', color: isApplyOpen ? '#15803d' : isApplyPast ? '#9ca3af' : '#1d4ed8', fontWeight:600 }}>
            {isApplyOpen ? '신청 접수 중' : isApplyPast ? '신청 종료됨' : '신청 예정'}
            <span style={{ fontWeight:400, marginLeft:'8px', fontSize:'12px' }}>
              {fmtDT(localCls.applyStartAt)} ~ {fmtDT(localCls.applyEndAt)}
            </span>
          </div>
          <button onClick={openApplyPeriod}
            style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #e5e7eb', background:'#fff',
              fontSize:'12px', color:'#6b7280', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            수정
          </button>
          <button onClick={() => onUpdate({ ...localCls, applyStartAt: null, applyEndAt: null })}
            style={{ padding:'4px 10px', borderRadius:'6px', border:'none', background:'none',
              fontSize:'12px', color:'#d1d5db', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            ✕
          </button>
        </div>
      )}

      {/* 요약 */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px', alignItems:'center' }}>
        {termSummary.map(t => {
          const tc = getTermColor(t.num)
          return (
            <div key={t.num} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 12px',
              background: tc.bg, border:`1.5px solid ${tc.border}`, borderRadius:'20px' }}>
              <span style={{ fontSize:'12px', fontWeight:700, color: tc.text }}>{t.num}텀</span>
              <span style={{ fontSize:'11px', color:'#6b7280', fontWeight:600 }}>{t.active}회</span>
              <span style={{ fontSize:'10px', color:'#d1d5db' }}>|</span>
              <span style={{ fontSize:'10px', color:'#9ca3af' }}>{t.globalStart}~{t.globalEnd}차시</span>
            </div>
          )
        })}
        <div style={{ display:'flex', gap:'8px', fontSize:'12px', marginLeft:'4px' }}>
          <span style={{ color:'#f97316', fontWeight:600 }}>수업 {activeCount}회</span>
          {cancelCount > 0 && <span style={{ color:'#ef4444' }}>휴일 {cancelCount}회</span>}
          {makeupCount > 0 && <span style={{ color:'#3b82f6' }}>보강 {makeupCount}회</span>}
        </div>
        {!localCls.applyStartAt && (
          <button onClick={openApplyPeriod}
            style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:'7px', border:'1.5px dashed #93c5fd',
              background:'#eff6ff', color:'#3b82f6', fontSize:'12px', fontWeight:600,
              cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            📅 신청기간 설정
          </button>
        )}
      </div>

      {/* 경고 배너 */}
      {warnings.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'12px' }}>
          {warnings.map((msg, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'10px 14px',
              background:'#fffbeb', border:'1.5px solid #f59e0b', borderRadius:'10px',
              fontSize:'13px', color:'#92400e', lineHeight:1.5 }}>
              <span style={{ flexShrink:0, fontSize:'15px' }}>⚠️</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* 달력 2열 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'12px' }}>
        {months.map(({ year, month }) => (
          <div key={year+'-'+month} style={{ background:'#fff', border:'1px solid #e5e7eb',
            borderRadius:'12px', padding:'12px' }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px', textAlign:'center' }}>
              {year}년 {month+1}월
            </div>
            <MonthCalendar
              year={year} month={month}
              sessionMap={sessionMap} cancelled={cancelled}
              cancelledDates={cancelledDates} makeupDates={makeupDates}
              termMap={termMap} onDateClick={handleDateClick}
              applyStartAt={localCls.applyStartAt} applyEndAt={localCls.applyEndAt}
            />
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div style={{ display:'flex', gap:'12px', marginTop:'12px', fontSize:'11px', color:'#9ca3af', flexWrap:'wrap' }}>
        {TERM_COLORS.slice(0, termSizes.length).map((tc, i) => (
          <span key={i} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ width:'14px', height:'14px', borderRadius:'4px', background: tc.bg,
              border:`1.5px solid ${tc.border}`, display:'inline-block', flexShrink:0 }} />
            {i+1}텀 수업
          </span>
        ))}
        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:'#fef2f2',
            border:'1.5px solid #fca5a5', display:'inline-block', flexShrink:0 }} />휴일
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:'#eff6ff',
            border:'1.5px solid #3b82f6', display:'inline-block', flexShrink:0 }} />보강
        </span>
        {(localCls.applyStartAt || localCls.applyEndAt) && (
          <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:'#eff6ff',
              border:'1px solid #bfdbfe', display:'inline-block', flexShrink:0, position:'relative' }}>
              <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#3b82f6',
                position:'absolute', bottom:'2px', left:'50%', transform:'translateX(-50%)' }} />
            </span>신청기간
          </span>
        )}
      </div>

      {/* 신청기간 설정 인라인 패널 */}
      {showApplyPeriod && (
        <div style={{ marginTop:'14px', borderRadius:'14px', border:'1.5px solid #bfdbfe',
          background:'#eff6ff', padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#1d4ed8' }}>📅 신청기간 설정</div>
            <button onClick={() => setShowApplyPeriod(false)}
              style={{ background:'none', border:'none', fontSize:'18px', color:'#9ca3af', cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
          </div>
          <div style={{ fontSize:'13px', color:'#3b82f6', marginBottom:'14px', lineHeight:1.6 }}>
            수강 신청 접수 기간을 설정합니다. 날짜와 시간까지 입력하세요.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              <label style={{ fontSize:'13px', fontWeight:600, color:'#374151' }}>신청 시작</label>
              <input type="datetime-local" value={applyStart} onChange={e => setApplyStart(e.target.value)}
                style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #bfdbfe',
                  fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', color:'#111827', background:'#fff' }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              <label style={{ fontSize:'13px', fontWeight:600, color:'#374151' }}>신청 종료</label>
              <input type="datetime-local" value={applyEnd} onChange={e => setApplyEnd(e.target.value)}
                style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #bfdbfe',
                  fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', color:'#111827', background:'#fff' }} />
            </div>
            {applyStart && applyEnd && (
              <div style={{ padding:'10px 14px', borderRadius:'9px', background:'#fff', border:'1px solid #bfdbfe', fontSize:'13px', color:'#1d4ed8' }}>
                📅 {fmtDT(applyStart)} ~ {fmtDT(applyEnd)}
              </div>
            )}
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <Btn variant="ghost" onClick={() => setShowApplyPeriod(false)}>닫기</Btn>
              {(localCls.applyStartAt || localCls.applyEndAt) && (
                <Btn variant="danger" onClick={() => { onUpdate({ ...localCls, applyStartAt: null, applyEndAt: null }); setShowApplyPeriod(false) }}>삭제</Btn>
              )}
              <Btn onClick={saveApplyPeriod}>저장</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── 인라인 패널 (모달 대신) ── */}
      {(showNormalAction || showRegisteredAction || showCancel || showMakeup) && (
        <div style={{ marginTop:'14px', borderRadius:'14px', border:'1.5px solid #e5e7eb',
          background:'#fff', padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>

          {/* 헤더 */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#374151' }}>
              {showCancel ? '🚫 공휴일 처리' : showMakeup ? '🔄 보강일 추가'
                : showNormalAction ? '📅 날짜 등록' : '📅 날짜 변경'}
              <span style={{ fontWeight:400, color:'#9ca3af', marginLeft:'8px', fontSize:'13px' }}>
                {selectedDate} ({selectedDate && getDayLabel(selectedDate)}요일)
              </span>
            </div>
            <button onClick={() => { setShowNormalAction(false); setShowRegisteredAction(false); setShowCancel(false); setShowMakeup(false) }}
              style={{ background:'none', border:'none', fontSize:'18px', color:'#9ca3af', cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
          </div>

          {/* 빈 날짜 — 등록 선택 */}
          {showNormalAction && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {[
                { label:'🚫 공휴일', desc:'공휴일, 선거일, 재량휴일, 강사사정 등', border:'#fca5a5', bg:'#fef2f2', hover:'#fee2e2', color:'#ef4444',
                  action: () => { setShowNormalAction(false); setReason('public_holiday'); setMemo(''); setShowCancel(true) } },
                { label:'🔄 보강', desc:'이 날을 보강일로 추가', border:'#93c5fd', bg:'#eff6ff', hover:'#dbeafe', color:'#3b82f6',
                  action: () => { setShowNormalAction(false); setMemo(''); setShowMakeup(true) } },
                { label:'📚 수업일', desc:'이 날을 수업일로 추가', border:'#fed7aa', bg:'#fff7ed', hover:'#ffedd5', color:'#ea580c',
                  action: () => {
                    if (!makeupDates.some(m => m.date === selectedDate))
                      onUpdate({ ...cls, makeupDates: [...makeupDates, { date: selectedDate, memo: '수업일', type: 'session' }] })
                    setShowNormalAction(false)
                  } },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action}
                  style={{ padding:'12px 16px', borderRadius:'12px', border:`1.5px solid ${btn.border}`, background:btn.bg, cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.background=btn.hover}
                  onMouseLeave={e => e.currentTarget.style.background=btn.bg}>
                  <div style={{ fontSize:'14px', fontWeight:700, color:btn.color, marginBottom:'2px' }}>{btn.label}</div>
                  <div style={{ fontSize:'12px', color:'#9ca3af' }}>{btn.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* 있는 날짜 — 변경 선택 */}
          {showRegisteredAction && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              <div style={{ fontSize:'13px', color:'#6b7280', marginBottom:'4px' }}>
                현재 <strong>{clickType === 'session' ? '수업일' : clickType === 'cancelled' ? '휴일' : '보강'}</strong>로 등록되어 있습니다.
              </div>
              {[
                { label:'✅ 정상일', desc:'등록을 취소하고 원래 상태로 되돌리기', border:'#86efac', bg:'#f0fdf4', hover:'#dcfce7', color:'#16a34a',
                  action: () => {
                    let updated = { ...localCls }
                    if (clickType === 'cancelled') updated.cancelledDates = cancelledDates.filter(c => c.date !== selectedDate)
                    else if (clickType === 'makeup') updated.makeupDates = makeupDates.filter(m => m.date !== selectedDate)
                    updateLocal(updated); setShowRegisteredAction(false)
                  } },
                { label:'🚫 공휴일', desc:'공휴일, 선거일, 재량휴일, 강사사정 등', border:'#fca5a5', bg:'#fef2f2', hover:'#fee2e2', color:'#ef4444',
                  action: () => {
                    let updated = { ...localCls }
                    if (clickType === 'makeup') updated.makeupDates = makeupDates.filter(m => m.date !== selectedDate)
                    onUpdate(updated)
                    setShowRegisteredAction(false); setReason('public_holiday'); setMemo(''); setShowCancel(true)
                  } },
                { label:'🔄 보강', desc:'이 날을 보강일로 변경', border:'#93c5fd', bg:'#eff6ff', hover:'#dbeafe', color:'#3b82f6',
                  action: () => {
                    let updated = { ...localCls }
                    if (clickType === 'cancelled') updated.cancelledDates = cancelledDates.filter(c => c.date !== selectedDate)
                    if (!makeupDates.some(m => m.date === selectedDate))
                      updated.makeupDates = [...(updated.makeupDates || makeupDates), { date: selectedDate, memo: '보강' }]
                    onUpdate(updated); setShowRegisteredAction(false)
                  } },
                { label:'📚 수업일', desc:'이 날을 수업일로 변경', border:'#fed7aa', bg:'#fff7ed', hover:'#ffedd5', color:'#ea580c',
                  action: () => {
                    let updated = { ...localCls }
                    if (clickType === 'cancelled') {
                      updated.cancelledDates = cancelledDates.filter(c => c.date !== selectedDate)
                    } else if (clickType === 'makeup') {
                      updated.makeupDates = makeupDates.map(m =>
                        m.date === selectedDate ? { ...m, type: 'session' } : m
                      )
                    }
                    onUpdate(updated); setShowRegisteredAction(false)
                  } },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action}
                  style={{ padding:'12px 16px', borderRadius:'12px', border:`1.5px solid ${btn.border}`, background:btn.bg, cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.background=btn.hover}
                  onMouseLeave={e => e.currentTarget.style.background=btn.bg}>
                  <div style={{ fontSize:'14px', fontWeight:700, color:btn.color, marginBottom:'2px' }}>{btn.label}</div>
                  <div style={{ fontSize:'12px', color:'#9ca3af' }}>{btn.desc}</div>
                </button>
              ))}
            </div>
          )}

          {/* 공휴일 사유 */}
          {showCancel && (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <Select label="사유" value={reason} onChange={setReason} options={CANCEL_OPTIONS} />
              {reason === 'etc' && (
                <Input label="직접 입력" value={memo} onChange={setMemo} placeholder="사유를 입력하세요" />
              )}
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <Btn variant="ghost" onClick={() => setShowCancel(false)}>닫기</Btn>
                <Btn variant="danger" onClick={handleCancelSave}>공휴일 처리</Btn>
              </div>
            </div>
          )}

          {/* 보강 메모 */}
          {showMakeup && (
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <Input label="메모 (선택)" value={memo} onChange={setMemo} placeholder="예: 5월 5일 어린이날 보강" />
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <Btn variant="ghost" onClick={() => setShowMakeup(false)}>닫기</Btn>
                <Btn onClick={handleMakeupSave}>보강 추가</Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


