/**
 * SchoolCalendar.jsx  (전면 재작성)
 *
 * 핵심 변경사항:
 * 1. onUpdate 호출 조건 수정 → title/days/startDate/endDate 없어도 저장 가능 (중간 저장)
 * 2. 달력 개념 수정 → "월요일 수업 N차시 / 화요일 수업 N차시" 요일별 독립 차시
 * 3. 분기별 차시 수(sessionsPerTerm) 입력 필드 추가 (예: 12 → 4분기×12=48차시)
 * 4. 기본 설정 / 휴일 섹션 접기·펼치기 토글
 * 5. 공휴일 마운트 시 자동 추가
 * 6. 일정명 placeholder 수정
 * 7. setForm is not defined 에러 원천 제거 (onUpdate 조건 완화)
 */
import React, { useState, useEffect, useRef } from 'react'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const TERM_COLORS = [
  { bg:'#fff7ed', border:'#f97316', badge:'#f97316', text:'#ea580c' },
  { bg:'#f0fdf4', border:'#16a34a', badge:'#16a34a', text:'#15803d' },
  { bg:'#eff6ff', border:'#3b82f6', badge:'#3b82f6', text:'#1d4ed8' },
  { bg:'#fdf4ff', border:'#a855f7', badge:'#a855f7', text:'#7e22ce' },
  { bg:'#fff1f2', border:'#f43f5e', badge:'#f43f5e', text:'#be123c' },
  { bg:'#fefce8', border:'#eab308', badge:'#eab308', text:'#a16207' },
  { bg:'#f0fdfa', border:'#14b8a6', badge:'#14b8a6', text:'#0f766e' },
  { bg:'#fef9c3', border:'#ca8a04', badge:'#ca8a04', text:'#92400e' },
]
const getTermColor = (n) => TERM_COLORS[(n - 1) % TERM_COLORS.length] || TERM_COLORS[0]

// ── 공휴일 데이터
const HOLIDAYS = {
  2025: [
    { date:'2025-01-01', name:'신정' },
    { date:'2025-01-28', name:'설날' }, { date:'2025-01-29', name:'설날' }, { date:'2025-01-30', name:'설날' },
    { date:'2025-03-01', name:'삼일절' }, { date:'2025-05-05', name:'어린이날' },
    { date:'2025-05-06', name:'어린이날 대체' }, { date:'2025-05-13', name:'부처님오신날' },
    { date:'2025-06-06', name:'현충일' }, { date:'2025-08-15', name:'광복절' },
    { date:'2025-10-03', name:'개천절' }, { date:'2025-10-05', name:'추석' },
    { date:'2025-10-06', name:'추석' }, { date:'2025-10-07', name:'추석' },
    { date:'2025-10-08', name:'추석 대체' }, { date:'2025-10-09', name:'한글날' },
    { date:'2025-12-25', name:'성탄절' },
  ],
  2026: [
    { date:'2026-01-01', name:'신정' },
    { date:'2026-01-28', name:'설날' }, { date:'2026-01-29', name:'설날' }, { date:'2026-01-30', name:'설날' },
    { date:'2026-03-01', name:'삼일절' }, { date:'2026-05-05', name:'어린이날' },
    { date:'2026-05-24', name:'부처님오신날' }, { date:'2026-06-03', name:'지방선거일' },
    { date:'2026-06-06', name:'현충일' }, { date:'2026-08-15', name:'광복절' },
    { date:'2026-09-24', name:'추석' }, { date:'2026-09-25', name:'추석' }, { date:'2026-09-26', name:'추석' },
    { date:'2026-10-03', name:'개천절' }, { date:'2026-10-09', name:'한글날' },
    { date:'2026-12-25', name:'성탄절' },
  ],
  2027: [
    { date:'2027-01-01', name:'신정' },
    { date:'2027-02-16', name:'설날' }, { date:'2027-02-17', name:'설날' }, { date:'2027-02-18', name:'설날' },
    { date:'2027-03-01', name:'삼일절' }, { date:'2027-05-05', name:'어린이날' },
    { date:'2027-05-13', name:'부처님오신날' }, { date:'2027-06-06', name:'현충일' },
    { date:'2027-08-15', name:'광복절' },
    { date:'2027-09-14', name:'추석' }, { date:'2027-09-15', name:'추석' }, { date:'2027-09-16', name:'추석' },
    { date:'2027-10-03', name:'개천절' }, { date:'2027-10-09', name:'한글날' },
    { date:'2027-12-25', name:'성탄절' },
  ],
}

// ── 날짜 유틸
const fmt = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const addDays = (str, n) => {
  const d = new Date(str + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate())
}
const getDayOfWeek = (str) => new Date(str + 'T00:00:00').getDay()
const getDayLabel  = (str) => ['일','월','화','수','목','금','토'][getDayOfWeek(str)]

function getDatesInRange(startStr, endStr, dayNums) {
  const result = []
  if (!startStr || !endStr || !dayNums.length) return result
  const cur = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr   + 'T00:00:00')
  while (cur <= end) {
    if (dayNums.includes(cur.getDay()))
      result.push(fmt(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

const dayNameToNum = { '일':0, '월':1, '화':2, '수':3, '목':4, '금':5, '토':6 }

// ══ 핵심 차시 계산 로직
//
// 개념:
//   분기(quarter) = 큰 단위. 예) 1분기, 2분기
//   텀(sub-term)  = 분기 안에서 sessionsPerTerm 차시씩 묶은 소단위
//
// 달력 표시:
//   윗줄: "N분기 M차"  (분기 내 누적 차시)
//   아랫줄: "P텀 Q차"  (텀 번호 / 텀 내 차시)
//
// 예) sessionsPerTerm=4:
//   수업1 → 1분기 1차 / 1텀 1차
//   수업4 → 1분기 4차 / 1텀 4차
//   수업5 → 1분기 5차 / 2텀 1차
//   수업7 → 1분기 7차 / 2텀 3차
//
function buildSessionMap({ allSessionDates, termBoundaries, sessionsPerTerm }) {
  const sessionMap     = {}
  const termMap        = {}
  let globalSubTermNum = 0

  termBoundaries.forEach((boundary, tIdx) => {
    const quarterNum   = tIdx + 1
    const termDates    = allSessionDates.filter(d => d >= boundary.start && d <= boundary.end)

    let quarterSession = 0
    let localSubTerm   = 0
    let subTermSession = 0

    termDates.forEach(d => {
      quarterSession++
      subTermSession++

      if (subTermSession === 1) {
        localSubTerm++
        globalSubTermNum++
      }

      sessionMap[d] = {
        quarterNum,
        quarterSession,
        localSubTerm,
        globalSubTermNum,
        subTermSession,
      }
      termMap[d] = quarterNum

      if (subTermSession >= sessionsPerTerm) {
        subTermSession = 0
      }
    })
  })

  return { sessionMap, termMap }
}

// ══ 월 달력 컴포넌트
function MonthCalendar({ year, month, sessionMap, cancelledDates, makeupDates, termMap, onDateClick, vacationSet }) {
  const cancelledSet = new Set(cancelledDates.map(c => c.date))
  const makeupSet    = new Set(makeupDates.map(m => m.date))
  const firstDay  = new Date(year, month, 1).getDay()
  const lastDate  = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= lastDate; d++) cells.push(d)

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
          const dateStr    = fmt(year, month + 1, day)
          const sessInfo   = sessionMap[dateStr]
          const isCancelled= cancelledSet.has(dateStr)
          const isMakeup   = makeupSet.has(dateStr)
          const isVacation = vacationSet.has(dateStr)
          const cancelInfo = cancelledDates.find(c => c.date === dateStr)
          const dow        = (firstDay + day - 1) % 7
          const isSun = dow === 0, isSat = dow === 6
          const termNum = termMap[dateStr]
          const tc      = termNum ? getTermColor(termNum) : null

          // 보강일
          if (isMakeup) {
            return (
              <button key={day} onClick={() => onDateClick(dateStr, 'makeup')}
                style={{ padding:'3px 2px', borderRadius:'7px', border:'none', cursor:'pointer',
                  background:'#eff6ff', outline:'1.5px solid #3b82f6', outlineOffset:'-1px',
                  textAlign:'center', fontFamily:'Noto Sans KR, sans-serif' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:isSun?'#ef4444':isSat?'#3b82f6':'#1d4ed8' }}>{day}</div>
                <div style={{ fontSize:'9px', color:'#3b82f6', fontWeight:700 }}>보강</div>
                {sessInfo && (
                  <div style={{ fontSize:'9px', color:'#fff', background:'#3b82f6', borderRadius:'3px', padding:'0 2px', marginTop:'1px' }}>
                    {sessInfo.dayLabel} {sessInfo.daySession}차시
                  </div>
                )}
              </button>
            )
          }

          // 취소(휴일/방학)
          if (isCancelled) {
            return (
              <button key={day} onClick={() => onDateClick(dateStr, 'cancelled')}
                style={{ padding:'3px 2px', borderRadius:'7px', border:'none', cursor:'pointer',
                  background: isVacation ? '#f0f9ff' : '#fef2f2',
                  outline: `1.5px solid ${isVacation ? '#7dd3fc' : '#fca5a5'}`, outlineOffset:'-1px',
                  textAlign:'center', fontFamily:'Noto Sans KR, sans-serif' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:'#d1d5db' }}>{day}</div>
                <div style={{ fontSize:'9px', color:isVacation?'#0284c7':'#ef4444', lineHeight:1.2 }}>
                  {cancelInfo?.memo ? cancelInfo.memo.slice(0, 4) : (isVacation ? '방학' : '휴일')}
                </div>
              </button>
            )
          }

          // 수업일
          if (sessInfo) {
            return (
              <button key={day} onClick={() => onDateClick(dateStr, 'session')}
                style={{ padding:'3px 2px', borderRadius:'7px', border:'none', cursor:'pointer',
                  background: tc?.bg || '#fff7ed', outline:`1.5px solid ${tc?.border || '#f97316'}`,
                  outlineOffset:'-1px', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:isSun?'#ef4444':isSat?'#3b82f6':'#111827' }}>{day}</div>
                {/* 분기 내 누적 차시 */}
                <div style={{ fontSize:'9px', color:tc?.text || '#ea580c', fontWeight:700, lineHeight:1.3 }}>
                  {sessInfo.quarterNum}분기 {sessInfo.quarterSession}차
                </div>
                {/* 텀 번호 + 텀 내 차시 */}
                <div style={{ fontSize:'9px', color:'#fff', background: tc?.badge || '#f97316', borderRadius:'3px',
                  padding:'0 2px', marginTop:'1px', lineHeight:'14px', whiteSpace:'nowrap' }}>
                  {sessInfo.localSubTerm}텀 {sessInfo.subTermSession}차
                </div>
              </button>
            )
          }

          // 일반
          return (
            <button key={day} onClick={() => onDateClick(dateStr, 'normal')}
              style={{ padding:'5px 2px', borderRadius:'7px', border:'none', cursor:'pointer',
                background:'transparent', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ fontSize:'12px', color:isSun?'#ef4444':isSat?'#3b82f6':'#374151' }}>{day}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const CANCEL_OPTIONS = [
  { value:'public_holiday',  label:'공휴일' },
  { value:'election_day',    label:'선거일' },
  { value:'school_holiday',  label:'학교재량휴일' },
  { value:'teacher_absent',  label:'강사사정' },
  { value:'vacation',        label:'방학' },
  { value:'etc',             label:'기타' },
]

// ══ 메인 컴포넌트
export function SchoolCalendar({ cls, onUpdate, session }) {
  const currentYear = new Date().getFullYear()

  // ── 설정 상태
  const [year,        setYear]       = useState(cls?.year || currentYear)
  const [termType,    setTermType]   = useState(cls?.termType || 'quarter')
  const [days,        setDays]       = useState(cls?.days || [])
  const [title,       setTitle]      = useState(cls?.title || '')
  const [quarters,    setQuarters]   = useState(cls?.quarters || 4)
  const [qEnds,       setQEnds]      = useState(cls?.qEnds || ['', '', '', ''])
  // 분기당 차시 수 (요일별 독립 카운터 최대값 — 표시용)
  const [sessionsPerTerm, setSessionsPerTerm] = useState(cls?.sessionsPerTerm || 12)

  // 학기제
  const [sem1End,  setSem1End]  = useState(cls?.sem1End  || '')
  const [sumStart, setSumStart] = useState(cls?.sumStart || '')
  const [sumEnd,   setSumEnd]   = useState(cls?.sumEnd   || '')
  const [sem2End,  setSem2End]  = useState(cls?.sem2End  || '')
  const [winStart, setWinStart] = useState(cls?.winStart || '')
  const [winEnd,   setWinEnd]   = useState(cls?.winEnd   || '')

  // 휴일/보강
  const [cancelledDates, setCancelledDates] = useState(cls?.cancelledDates || [])
  const [makeupDates,    setMakeupDates]    = useState(cls?.makeupDates    || [])

  // UI 토글 — 기본 접힌 상태 (설정 완료 후 숨김)
  const [settingOpen, setSettingOpen]   = useState(true)
  const [holidayOpen, setHolidayOpen]   = useState(false)

  // 날짜 클릭 패널
  const [selectedDate,   setSelectedDate]   = useState(null)
  const [clickType,      setClickType]      = useState(null)
  const [showAction,     setShowAction]     = useState(false)
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [showMakeupForm, setShowMakeupForm] = useState(false)
  const [cancelReason,   setCancelReason]   = useState('public_holiday')
  const [cancelMemo,     setCancelMemo]     = useState('')
  const [makeupMemo,     setMakeupMemo]     = useState('')

  // 공휴일 자동 적용 여부 트래킹 (최초 1회)
  const holidayInitialized = useRef(false)

  // ── 외부 cls 변경 동기화
  useEffect(() => {
    if (!cls) return
    setYear(cls.year || currentYear)
    setTermType(cls.termType || 'quarter')
    setDays(cls.days || [])
    setTitle(cls.title || '')
    setQuarters(cls.quarters || 4)
    setQEnds(cls.qEnds || ['', '', '', ''])
    setSessionsPerTerm(cls.sessionsPerTerm || 12)
    setSem1End(cls.sem1End || '')
    setSumStart(cls.sumStart || '')
    setSumEnd(cls.sumEnd || '')
    setSem2End(cls.sem2End || '')
    setWinStart(cls.winStart || '')
    setWinEnd(cls.winEnd || '')
    setCancelledDates(cls.cancelledDates || [])
    setMakeupDates(cls.makeupDates || [])
    holidayInitialized.current = false
  }, [cls?.id])

  // ── 공휴일 자동 추가 (마운트 시, 또는 연도 변경 시 1회)
  useEffect(() => {
    if (holidayInitialized.current) return
    holidayInitialized.current = true
    const hols = HOLIDAYS[year] || HOLIDAYS[2026] || []
    setCancelledDates(prev => {
      const existing = new Set(prev.map(c => c.date))
      const toAdd = hols.filter(h => !existing.has(h.date)).map(h => ({ date:h.date, reason:'public_holiday', memo:h.name }))
      if (toAdd.length === 0) return prev
      const updated = [...prev, ...toAdd]
      // onUpdate는 saveAll을 통해 호출하므로 여기서는 상태만 설정
      return updated
    })
  }, [year])

  // ── 공휴일 수동 전체 추가 버튼
  const autoSetHolidays = () => {
    const hols = HOLIDAYS[year] || HOLIDAYS[2026] || []
    setCancelledDates(prev => {
      const existing = new Set(prev.map(c => c.date))
      const toAdd = hols.filter(h => !existing.has(h.date)).map(h => ({ date:h.date, reason:'public_holiday', memo:h.name }))
      const updated = [...prev, ...toAdd]
      saveAll({ cancelledDates: updated })
      return updated
    })
  }

  // ── 날짜 계산
  const dayNums    = days.map(d => dayNameToNum[d]).filter(n => n !== undefined)
  const marchStart = fmt(year, 3, 1)
  const yearEnd    = fmt(year, 12, 31)

  // 방학 Set
  const vacationDates = new Set()
  if (sumStart && sumEnd) {
    let d = new Date(sumStart + 'T00:00:00')
    const e = new Date(sumEnd + 'T00:00:00')
    while (d <= e) { vacationDates.add(fmt(d.getFullYear(), d.getMonth()+1, d.getDate())); d.setDate(d.getDate()+1) }
  }
  if (winStart && winEnd) {
    let d = new Date(winStart + 'T00:00:00')
    const e = new Date(winEnd + 'T00:00:00')
    while (d <= e) { vacationDates.add(fmt(d.getFullYear(), d.getMonth()+1, d.getDate())); d.setDate(d.getDate()+1) }
  }

  const cancelledSet = new Set(cancelledDates.map(c => c.date))

  const allSessionDates = dayNums.length > 0
    ? getDatesInRange(marchStart, yearEnd, dayNums).filter(d => !cancelledSet.has(d) && !vacationDates.has(d))
    : []

  // 텀 경계
  let termBoundaries = []
  if (termType === 'semester') {
    const sem2Start = sumEnd ? addDays(sumEnd, 1) : fmt(year, 9, 1)
    termBoundaries = [
      { start: marchStart, end: sem1End || fmt(year, 7, 15), label: '1학기' },
      { start: sem2Start,  end: sem2End || fmt(year, 12, 20), label: '2학기' },
    ]
  } else {
    let prevEnd = fmt(year, 2, 28)
    for (let i = 0; i < quarters; i++) {
      const qEnd = qEnds[i] || fmt(year, 3 + Math.floor(12 / quarters * (i + 1)) - 1, 28)
      termBoundaries.push({ start: addDays(prevEnd, 1), end: qEnd, label: `${i + 1}분기` })
      prevEnd = qEnd
    }
  }

  // 차시 맵 빌드 (요일별 독립)
  const { sessionMap, termMap } = buildSessionMap({ allSessionDates, termBoundaries, sessionsPerTerm })

  const months          = Array.from({ length: 12 }, (_, i) => ({ year, month: i }))
  const totalSessions   = allSessionDates.length
  const makeupCount     = makeupDates.length

  // 요일별 차시 통계
  const dayStats = days.map(d => {
    const num   = dayNameToNum[d]
    const dates = allSessionDates.filter(dt => getDayOfWeek(dt) === num)
    return { day: d, count: dates.length }
  })

  // ── 저장
  const saveAll = (patch = {}) => {
    if (!onUpdate) return
    onUpdate({
      title, year, termType, days,
      sem1End, sumStart, sumEnd, sem2End, winStart, winEnd,
      quarters, qEnds, sessionsPerTerm,
      cancelledDates, makeupDates,
      startDate: marchStart,
      endDate:   yearEnd,
      termCount: termBoundaries.length,
      ...patch,
    })
  }

  // ── 날짜 클릭
  const handleDateClick = (date, type) => {
    setSelectedDate(date); setClickType(type)
    setShowAction(true); setShowCancelForm(false); setShowMakeupForm(false)
  }

  const handleCancelSave = () => {
    const updated = [...cancelledDates.filter(c => c.date !== selectedDate), { date:selectedDate, reason:cancelReason, memo:cancelMemo }]
    setCancelledDates(updated); setShowAction(false); setShowCancelForm(false)
    saveAll({ cancelledDates: updated })
  }
  const handleMakeupSave = () => {
    const updated = [...makeupDates.filter(m => m.date !== selectedDate), { date:selectedDate, memo:makeupMemo }]
    setMakeupDates(updated); setShowAction(false); setShowMakeupForm(false)
    saveAll({ makeupDates: updated })
  }
  const handleRestore = () => {
    const updC = cancelledDates.filter(c => c.date !== selectedDate)
    const updM = makeupDates.filter(m => m.date !== selectedDate)
    setCancelledDates(updC); setMakeupDates(updM); setShowAction(false)
    saveAll({ cancelledDates: updC, makeupDates: updM })
  }

  const sectionStyle = {
    background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:'14px',
    marginBottom:'14px', overflow:'hidden',
  }
  const sectionHeaderStyle = (open) => ({
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'14px 18px', cursor:'pointer', userSelect:'none',
    background: open ? '#f8fafc' : '#fff',
    borderBottom: open ? '1.5px solid #e2e8f0' : 'none',
  })

  return (
    <div style={{ fontFamily:'Noto Sans KR, sans-serif' }}>

      {/* ════ 기본 설정 섹션 (접기/펼치기) ════ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle(settingOpen)} onClick={() => setSettingOpen(v => !v)}>
          <div style={{ fontSize:'14px', fontWeight:800, color:'#1e3a5f', display:'flex', alignItems:'center', gap:'6px' }}>
            📋 기본 설정
            {!settingOpen && title && (
              <span style={{ fontSize:'12px', fontWeight:400, color:'#6b7280', marginLeft:'4px' }}>— {title}</span>
            )}
          </div>
          <span style={{ fontSize:'18px', color:'#9ca3af', lineHeight:1 }}>{settingOpen ? '▲' : '▼'}</span>
        </div>

        {settingOpen && (
          <div style={{ padding:'18px' }}>
            {/* 연도 + 일정명 */}
            <div style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:'12px', marginBottom:'14px' }}>
              <div>
                <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'4px' }}>연도</label>
                <select value={year} onChange={e => { setYear(parseInt(e.target.value)); holidayInitialized.current = false }}
                  style={{ width:'100%', padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                  {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'4px' }}>일정명</label>
                <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => saveAll()}
                  placeholder={`예: ${year}년 대한초 방과후 연간계획`}
                  style={{ width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>

            {/* 운영방식 */}
            <div style={{ marginBottom:'14px' }}>
              <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'6px' }}>운영 방식</label>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {[{ v:'semester', l:'학기제 (1·2학기)' }, { v:'quarter', l:'분기제' }].map(({ v, l }) => (
                  <button key={v} onClick={() => setTermType(v)}
                    style={{ padding:'8px 16px', borderRadius:'9px', border:`1.5px solid ${termType===v?'#1e3a5f':'#e5e7eb'}`,
                      background:termType===v?'#1e3a5f':'#fff', color:termType===v?'#fff':'#374151',
                      fontSize:'13px', fontWeight:termType===v?700:400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>{l}</button>
                ))}
                {termType === 'quarter' && [2, 3, 4].map(n => (
                  <button key={n} onClick={() => setQuarters(n)}
                    style={{ padding:'8px 14px', borderRadius:'9px', border:`1.5px solid ${quarters===n?'#f97316':'#e5e7eb'}`,
                      background:quarters===n?'#f97316':'#fff', color:quarters===n?'#fff':'#374151',
                      fontSize:'13px', fontWeight:quarters===n?700:400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>{n}분기</button>
                ))}
              </div>
            </div>

            {/* 분기당 차시 수 */}
            {termType === 'quarter' && (
              <div style={{ marginBottom:'14px' }}>
                <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'6px' }}>
                  분기당 차시 수
                  <span style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'6px' }}>
                    (총 {quarters * sessionsPerTerm}차시 / 요일별 각 {sessionsPerTerm}차시)
                  </span>
                </label>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  {[8, 10, 12, 15, 16].map(n => (
                    <button key={n} onClick={() => { setSessionsPerTerm(n); saveAll({ sessionsPerTerm: n }) }}
                      style={{ padding:'6px 14px', borderRadius:'8px', border:`1.5px solid ${sessionsPerTerm===n?'#3b82f6':'#e5e7eb'}`,
                        background:sessionsPerTerm===n?'#eff6ff':'#fff', color:sessionsPerTerm===n?'#1d4ed8':'#374151',
                        fontSize:'13px', fontWeight:sessionsPerTerm===n?700:400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>{n}차시</button>
                  ))}
                  <input type="number" min={1} max={99} value={sessionsPerTerm}
                    onChange={e => setSessionsPerTerm(parseInt(e.target.value)||1)}
                    onBlur={() => saveAll()}
                    style={{ width:'70px', padding:'6px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', outline:'none', textAlign:'center' }} />
                </div>
              </div>
            )}

            {/* 수업 요일 */}
            <div style={{ marginBottom:'14px' }}>
              <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'6px' }}>수업 요일</label>
              <div style={{ display:'flex', gap:'6px' }}>
                {['월', '화', '수', '목', '금', '토', '일'].map(d => {
                  const sel = days.includes(d)
                  return (
                    <button key={d} onClick={() => setDays(sel ? days.filter(x => x !== d) : [...days, d])}
                      style={{ width:'38px', height:'38px', borderRadius:'9px', border:'none', cursor:'pointer',
                        fontSize:'14px', fontWeight:700, background:sel?'#1e3a5f':'#f3f4f6',
                        color:sel?'#fff':'#374151', fontFamily:'Noto Sans KR, sans-serif' }}>{d}</button>
                  )
                })}
              </div>
            </div>

            {/* 학기제 */}
            {termType === 'semester' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
                <div style={{ background:'#eff6ff', borderRadius:'10px', padding:'12px' }}>
                  <div style={{ fontSize:'12px', fontWeight:700, color:'#1d4ed8', marginBottom:'8px' }}>🏫 1학기</div>
                  <div style={{ fontSize:'11px', color:'#6b7280', marginBottom:'3px' }}>시작: {year}-03-01 (자동)</div>
                  <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'3px' }}>종료일</label>
                  <input type="date" value={sem1End} onChange={e => setSem1End(e.target.value)} onBlur={() => saveAll()}
                    style={{ width:'100%', padding:'6px 10px', borderRadius:'7px', border:'1.5px solid #bfdbfe', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'12px' }}>
                  <div style={{ fontSize:'12px', fontWeight:700, color:'#15803d', marginBottom:'8px' }}>🏫 2학기</div>
                  <div style={{ fontSize:'11px', color:'#6b7280', marginBottom:'3px' }}>시작: 여름방학 다음날 (자동)</div>
                  <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'3px' }}>종료일</label>
                  <input type="date" value={sem2End} onChange={e => setSem2End(e.target.value)} onBlur={() => saveAll()}
                    style={{ width:'100%', padding:'6px 10px', borderRadius:'7px', border:'1.5px solid #86efac', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ background:'#fff7ed', borderRadius:'10px', padding:'12px' }}>
                  <div style={{ fontSize:'12px', fontWeight:700, color:'#ea580c', marginBottom:'8px' }}>☀️ 여름방학</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                    <div>
                      <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'3px' }}>시작</label>
                      <input type="date" value={sumStart} onChange={e => setSumStart(e.target.value)} onBlur={() => saveAll()}
                        style={{ width:'100%', padding:'6px 8px', borderRadius:'7px', border:'1.5px solid #fed7aa', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'3px' }}>종료</label>
                      <input type="date" value={sumEnd} onChange={e => setSumEnd(e.target.value)} onBlur={() => saveAll()}
                        style={{ width:'100%', padding:'6px 8px', borderRadius:'7px', border:'1.5px solid #fed7aa', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
                    </div>
                  </div>
                </div>
                <div style={{ background:'#f0f9ff', borderRadius:'10px', padding:'12px' }}>
                  <div style={{ fontSize:'12px', fontWeight:700, color:'#0369a1', marginBottom:'8px' }}>❄️ 겨울방학</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px' }}>
                    <div>
                      <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'3px' }}>시작</label>
                      <input type="date" value={winStart} onChange={e => setWinStart(e.target.value)} onBlur={() => saveAll()}
                        style={{ width:'100%', padding:'6px 8px', borderRadius:'7px', border:'1.5px solid #bae6fd', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'3px' }}>종료</label>
                      <input type="date" value={winEnd} onChange={e => setWinEnd(e.target.value)} onBlur={() => saveAll()}
                        style={{ width:'100%', padding:'6px 8px', borderRadius:'7px', border:'1.5px solid #bae6fd', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 분기제 종료일 설정 */}
            {termType === 'quarter' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'10px', marginBottom:'14px' }}>
                {Array.from({ length: quarters }, (_, i) => (
                  <div key={i} style={{ background: getTermColor(i+1).bg, border:`1.5px solid ${getTermColor(i+1).border}`, borderRadius:'10px', padding:'12px' }}>
                    <div style={{ fontSize:'12px', fontWeight:700, color:getTermColor(i+1).text, marginBottom:'8px' }}>{i+1}분기</div>
                    <div style={{ fontSize:'11px', color:'#6b7280', marginBottom:'3px' }}>
                      시작: {i === 0 ? `${year}-03-01` : (qEnds[i-1] ? addDays(qEnds[i-1], 1) : '이전 분기 종료 다음날')}
                    </div>
                    <label style={{ fontSize:'11px', color:'#6b7280', display:'block', marginBottom:'3px' }}>종료일</label>
                    <input type="date" value={qEnds[i] || ''}
                      onChange={e => { const n = [...qEnds]; n[i] = e.target.value; setQEnds(n) }}
                      onBlur={() => saveAll()}
                      style={{ width:'100%', padding:'6px 8px', borderRadius:'7px', border:`1.5px solid ${getTermColor(i+1).border}`, fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
                  </div>
                ))}
              </div>
            )}

            {/* 저장 버튼 */}
            <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
              <button onClick={() => { saveAll(); setSettingOpen(false) }}
                style={{ padding:'8px 20px', borderRadius:'9px', border:'none', background:'#1e3a5f', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                💾 저장 후 접기
              </button>
              {totalSessions > 0 && (
                <span style={{ fontSize:'13px', color:'#6b7280' }}>
                  총 <strong style={{ color:'#1e3a5f' }}>{totalSessions}회</strong> 수업
                  {dayStats.length > 0 && ' — ' + dayStats.map(s => `${s.day}요일 ${s.count}회`).join(' / ')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ════ 텀 요약 배지 ════ */}
      {totalSessions > 0 && (
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' }}>
          {termBoundaries.map((b, i) => {
            const cnt = allSessionDates.filter(d => d >= b.start && d <= b.end).length
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 12px',
                background: getTermColor(i+1).bg, border:`1.5px solid ${getTermColor(i+1).border}`, borderRadius:'20px' }}>
                <span style={{ fontSize:'12px', fontWeight:700, color:getTermColor(i+1).text }}>{b.label}</span>
                <span style={{ fontSize:'11px', color:'#6b7280' }}>{cnt}회</span>
              </div>
            )
          })}
          <span style={{ fontSize:'12px', color:'#6b7280', display:'flex', alignItems:'center', marginLeft:'4px' }}>
            공휴일 {cancelledDates.filter(c => c.reason==='public_holiday' || c.reason==='election_day').length}일
            {makeupCount > 0 && ` · 보강 ${makeupCount}회`}
          </span>
        </div>
      )}

      {/* ════ 휴일 직접 추가 섹션 (접기/펼치기) ════ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle(holidayOpen)} onClick={() => setHolidayOpen(v => !v)}>
          <div style={{ fontSize:'13px', fontWeight:700, color:'#374151' }}>
            📌 휴일 직접 추가 (개교기념일 등)
            {!holidayOpen && cancelledDates.length > 0 && (
              <span style={{ fontSize:'11px', fontWeight:400, color:'#6b7280', marginLeft:'8px' }}>
                {cancelledDates.length}일 등록됨
              </span>
            )}
          </div>
          <span style={{ fontSize:'18px', color:'#9ca3af', lineHeight:1 }}>{holidayOpen ? '▲' : '▼'}</span>
        </div>

        {holidayOpen && (
          <div style={{ padding:'14px 16px' }}>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
              <input type="date"
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', outline:'none' }}
                onChange={e => {
                  const date = e.target.value; if (!date) return
                  if (cancelledDates.some(c => c.date === date)) return
                  const updated = [...cancelledDates, { date, reason:'school_holiday', memo:'' }]
                  setCancelledDates(updated); saveAll({ cancelledDates: updated })
                  e.target.value = ''
                }} />
              <select
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', background:'#fff', outline:'none' }}
                onChange={e => {
                  const date = e.target.value; if (!date) return
                  const hol = (HOLIDAYS[year] || HOLIDAYS[2026] || []).find(h => h.date === date)
                  if (!cancelledDates.some(c => c.date === date)) {
                    const updated = [...cancelledDates, { date, reason:'public_holiday', memo:hol?.name||'공휴일' }]
                    setCancelledDates(updated); saveAll({ cancelledDates: updated })
                  }
                  e.target.value = ''
                }} defaultValue="">
                <option value="">공휴일 빠른 추가</option>
                {(HOLIDAYS[year] || HOLIDAYS[2026] || []).map(h => (
                  <option key={h.date} value={h.date}>{h.date.slice(5)} {h.name}</option>
                ))}
              </select>
              <button onClick={autoSetHolidays}
                style={{ padding:'7px 14px', borderRadius:'8px', border:'1.5px solid #f97316', background:'#fff7ed', color:'#ea580c', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                🗓️ {year}년 공휴일 전체 추가
              </button>
            </div>
            {cancelledDates.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'3px', maxHeight:'160px', overflowY:'auto' }}>
                {[...cancelledDates].sort((a, b) => a.date.localeCompare(b.date)).map((c, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 10px', background:'#fff', borderRadius:'7px', border:'1px solid #f3f4f6' }}>
                    <span style={{ fontSize:'12px', fontWeight:600, color:'#374151', minWidth:'75px' }}>{c.date.slice(5)}</span>
                    <span style={{ fontSize:'11px', color:'#6b7280', flex:1 }}>{c.memo || c.reason}</span>
                    <button onClick={() => {
                      const updated = cancelledDates.filter((_, j) => j !== i)
                      setCancelledDates(updated); saveAll({ cancelledDates: updated })
                    }} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'16px', padding:'0 2px', lineHeight:1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════ 달력 그리드 ════ */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
        {months.map(({ year: y, month: m }) => (
          <div key={y + '-' + m} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'12px' }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px', textAlign:'center' }}>
              {y}년 {m + 1}월
            </div>
            <MonthCalendar
              year={y} month={m}
              sessionMap={sessionMap}
              cancelledDates={cancelledDates}
              makeupDates={makeupDates}
              termMap={termMap}
              onDateClick={handleDateClick}
              vacationSet={vacationDates}
            />
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div style={{ display:'flex', gap:'10px', marginTop:'12px', fontSize:'11px', color:'#9ca3af', flexWrap:'wrap' }}>
        {termBoundaries.slice(0, Math.min(termBoundaries.length, 4)).map((b, i) => (
          <span key={i} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:getTermColor(i+1).bg, border:`1.5px solid ${getTermColor(i+1).border}`, display:'inline-block', flexShrink:0 }} />
            {b.label}
          </span>
        ))}
        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:'#fef2f2', border:'1.5px solid #fca5a5', display:'inline-block' }} />휴일
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:'#f0f9ff', border:'1.5px solid #7dd3fc', display:'inline-block' }} />방학
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:'#eff6ff', border:'1.5px solid #3b82f6', display:'inline-block' }} />보강
        </span>
      </div>

      {/* ── 날짜 클릭 인라인 패널 */}
      {showAction && selectedDate && (
        <div style={{ marginTop:'14px', borderRadius:'14px', border:'1.5px solid #e5e7eb', background:'#fff', padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#374151' }}>
              📅 {selectedDate} ({getDayLabel(selectedDate)}요일)
              <span style={{ fontSize:'12px', fontWeight:400, color:'#9ca3af', marginLeft:'8px' }}>
                {clickType === 'session' ? '수업일' : clickType === 'cancelled' ? '휴일' : clickType === 'makeup' ? '보강' : '일반'}
              </span>
            </div>
            <button onClick={() => setShowAction(false)} style={{ background:'none', border:'none', fontSize:'18px', color:'#9ca3af', cursor:'pointer' }}>✕</button>
          </div>

          {!showCancelForm && !showMakeupForm && (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {(clickType === 'session' || clickType === 'cancelled' || clickType === 'makeup') && (
                <button onClick={handleRestore} style={{ padding:'10px 14px', borderRadius:'10px', border:'1.5px solid #86efac', background:'#f0fdf4', cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif' }}>
                  <div style={{ fontSize:'13px', fontWeight:700, color:'#16a34a' }}>✅ 원래 상태로 복원</div>
                </button>
              )}
              <button onClick={() => setShowCancelForm(true)} style={{ padding:'10px 14px', borderRadius:'10px', border:'1.5px solid #fca5a5', background:'#fef2f2', cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#ef4444' }}>🚫 휴일 처리</div>
                <div style={{ fontSize:'11px', color:'#9ca3af' }}>공휴일, 선거일, 재량휴일, 강사사정 등</div>
              </button>
              <button onClick={() => setShowMakeupForm(true)} style={{ padding:'10px 14px', borderRadius:'10px', border:'1.5px solid #93c5fd', background:'#eff6ff', cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#3b82f6' }}>🔄 보강일 추가</div>
              </button>
            </div>
          )}

          {showCancelForm && (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div>
                <label style={{ fontSize:'12px', color:'#6b7280', display:'block', marginBottom:'4px' }}>사유</label>
                <select value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  style={{ width:'100%', padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff' }}>
                  {CANCEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {cancelReason === 'etc' && (
                <input value={cancelMemo} onChange={e => setCancelMemo(e.target.value)} placeholder="사유 직접 입력"
                  style={{ padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
              )}
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button onClick={() => setShowCancelForm(false)} style={{ padding:'7px 16px', borderRadius:'8px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>취소</button>
                <button onClick={handleCancelSave} style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:'#ef4444', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>휴일 처리</button>
              </div>
            </div>
          )}

          {showMakeupForm && (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <input value={makeupMemo} onChange={e => setMakeupMemo(e.target.value)} placeholder="메모 (예: 5월 5일 어린이날 보강)"
                style={{ padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button onClick={() => setShowMakeupForm(false)} style={{ padding:'7px 16px', borderRadius:'8px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>취소</button>
                <button onClick={handleMakeupSave} style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:'#3b82f6', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>보강 추가</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
