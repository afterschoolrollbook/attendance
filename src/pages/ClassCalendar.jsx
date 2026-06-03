import React, { useState } from 'react'
import { createPortal } from 'react-dom'
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

// 특별 기간 타입
const SPECIAL_PERIOD_TYPES = [
  { value: 'summer_vacation',    label: '여름방학',    color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', emoji: '☀️' },
  { value: 'winter_vacation',    label: '겨울방학',    color: '#60a5fa', bg: '#eff6ff', border: '#93c5fd', emoji: '❄️' },
  { value: 'parent_observation', label: '학부모 참관', color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd', emoji: '👩‍👧' },
  { value: 'open_class',         label: '공개수업',    color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7', emoji: '🎓' },
  { value: 'exhibition',         label: '전시기간',    color: '#ec4899', bg: '#fdf2f8', border: '#f9a8d4', emoji: '🎨' },
  { value: 'etc',                label: '기타',        color: '#6b7280', bg: '#f9fafb', border: '#d1d5db', emoji: '📌' },
]
const getSpecialPeriodType = (value) => SPECIAL_PERIOD_TYPES.find(t => t.value === value) || SPECIAL_PERIOD_TYPES[SPECIAL_PERIOD_TYPES.length - 1]

function MonthCalendar({ year, month, sessionMap, cancelled, cancelledDates, makeupDates, termMap, onDateClick, applyStartAt, applyEndAt, specialPeriods }) {
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
          const REASON_LABELS = {
            public_holiday:'공휴일', national_holiday:'국경일',
            new_year:'신정', seollal:'설날', chuseok:'추석',
            independence_day:'삼일절', liberation_day:'광복절',
            national_foundation_day:'개천절', hangul_day:'한글날',
            childrens_day:'어린이날', buddha:'부처님오신날',
            memorial_day:'현충일', constitution_day:'제헌절',
            workers_day:'근로자의날', christmas:'성탄절',
            childrens_day_alt:'대체공휴일', election_day:'선거일',
            school_holiday:'학교재량휴일', teacher_absent:'강사사정',
            vacation:'방학 휴강', etc:'기타'
          }
          const reasonLabel = CANCEL_REASONS.find(r => r.value === cancelInfo?.reason)?.label || REASON_LABELS[cancelInfo?.reason] || cancelInfo?.reason
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

          // 특별 기간 포함 여부 (여러 기간 중 첫 번째 매칭)
          const spMatch = (specialPeriods || []).find(p => dateStr >= p.startDate && dateStr <= p.endDate)
          const spType  = spMatch ? getSpecialPeriodType(spMatch.type) : null
          const spBadge = spType ? (
            <div title={spMatch.label || spType.label} style={{
              fontSize:'8px', color:'#fff', background: spType.color,
              borderRadius:'3px', padding:'0 2px', marginTop:'1px',
              lineHeight:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            }}>{spType.emoji}</div>
          ) : null

          // 수동 추가 수업일 (makeupDates + type:'session')
          if (isMakeup && makeupInfo?.type === 'session') {
            return (
              <button key={day} onClick={e => onDateClick(dateStr, 'makeup', e)}
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
                {spBadge}
              </button>
            )
          }

          // 보강일 (정규 수업일 아님)
          if (isMakeup) {
            return (
              <button key={day} onClick={e => onDateClick(dateStr, 'makeup', e)}
                title={`보강 ${sessInfo?.total||''}차시: ${makeupInfo?.memo||''} — 클릭하면 삭제`}
                style={{ padding:'4px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                  background:'#eff6ff', outline:'1.5px solid #3b82f6', outlineOffset:'-1px',
                  textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color: isSun?'#ef4444': isSat?'#3b82f6':'#1d4ed8' }}>{day}</div>
                <div style={{ fontSize:'10px', color:'#3b82f6', fontWeight:700, lineHeight:1.2 }}>보강</div>
                {makeupInfo?.memo && <div style={{ fontSize:'9px', color:'#93c5fd', lineHeight:1.1 }}>{makeupInfo.memo.slice(0,4)}</div>}
                {applyDot}
                {spBadge}
              </button>
            )
          }

          // 취소된 수업일
          if (isCancelled) {
            return (
              <button key={day} onClick={e => onDateClick(dateStr, 'cancelled', e)}
                title={`취소됨: ${reasonLabel||''} — 클릭하면 복원`}
                style={{ padding:'4px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                  background:'#fef2f2', outline:'1.5px solid #fca5a5', outlineOffset:'-1px',
                  textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:'#d1d5db' }}>{day}</div>
                <div style={{ fontSize:'9px', color:'#ef4444', lineHeight:1.2 }}>{reasonLabel||'취소'}</div>
                {applyDot}
                {spBadge}
              </button>
            )
          }

          // 정규 수업일
          if (isSession) {
            const tc = getTermColor(sessInfo.termNum || 1)
            return (
              <button key={day} onClick={e => onDateClick(dateStr, 'session', e)}
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
                {spBadge}
              </button>
            )
          }

          // 일반 날짜 — 신청기간 내 날짜는 파란 배경, 특별기간은 해당 색상 배경
          return (
            <button key={day} onClick={e => onDateClick(dateStr, 'normal', e)}
              title={spMatch ? (spMatch.label || spType?.label || '') : inApply ? '신청기간' : '클릭하면 휴일 또는 보강 추가'}
              style={{ padding:'6px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                background: spType ? spType.bg : inApply ? '#eff6ff' : 'transparent',
                outline: spType ? `1px solid ${spType.border}` : inApply ? '1px solid #bfdbfe' : 'none',
                textAlign:'center', fontFamily:'Noto Sans KR, sans-serif',
                color: isSun?'#fca5a5': isSat?'#93c5fd': (spType || inApply) ? '#1d4ed8' : '#9ca3af', fontSize:'12px',
                transition:'all .12s' }}
              onMouseEnter={e => e.currentTarget.style.background= spType ? spType.border : inApply ? '#dbeafe' : '#f0fdf4'}
              onMouseLeave={e => e.currentTarget.style.background= spType ? spType.bg : inApply ? '#eff6ff' : 'transparent'}>
              {day}
              {inApply && <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:'#3b82f6', margin:'1px auto 0' }} />}
              {spBadge}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ClassCalendar({ cls, onUpdate }) {
  const [selectedDate,  setSelectedDate]  = useState(null)
  const [clickType,     setClickType]     = useState(null)  // 'normal' | 'session' | 'cancelled' | 'makeup'
  const [showNormalAction,     setShowNormalAction]     = useState(false)  // 빈 날짜 클릭
  const [showRegisteredAction, setShowRegisteredAction] = useState(false)  // 있는 날짜 클릭
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 }) // 팝업 위치
  const popupDragging = React.useRef(false)
  const popupDragStart = React.useRef({ mx:0, my:0, px:0, py:0 })

  const handlePopupMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return
    popupDragging.current = true
    popupDragStart.current = { mx: e.clientX, my: e.clientY, px: popupPos.x, py: popupPos.y }
    const onMove = (e) => {
      if (!popupDragging.current) return
      setPopupPos({ x: popupDragStart.current.px + e.clientX - popupDragStart.current.mx, y: popupDragStart.current.py + e.clientY - popupDragStart.current.my })
    }
    const onUp = () => { popupDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const [showCancel,    setShowCancel]    = useState(false)
  const [showMakeup,    setShowMakeup]    = useState(false)
  const [reason,        setReason]        = useState('public_holiday')
  const [memo,          setMemo]          = useState('')

  // 신청기간 모달
  const [showApplyPeriod, setShowApplyPeriod] = useState(false)
  const [applyStart, setApplyStart] = useState('')
  const [applyEnd,   setApplyEnd]   = useState('')

  // 특별 기간 관리
  const [showSpecialPeriods, setShowSpecialPeriods] = useState(false)
  const [newPeriodType,     setNewPeriodType]     = useState('summer_vacation')
  const [newPeriodLabel,    setNewPeriodLabel]    = useState('')
  const [newPeriodStart,    setNewPeriodStart]    = useState('')
  const [newPeriodEnd,      setNewPeriodEnd]      = useState('')
  const [newPeriodSuspend,  setNewPeriodSuspend]  = useState(true)
  const [editingPeriodIdx,  setEditingPeriodIdx]  = useState(null)
  const [editPeriod,        setEditPeriod]        = useState(null)

  const CANCEL_OPTIONS = [
    { value: 'new_year',         label: '신정 (1/1)' },
    { value: 'seollal',          label: '설날' },
    { value: 'independence_day', label: '삼일절 (3/1)' },
    { value: 'workers_day',      label: '근로자의날 (5/1)' },
    { value: 'childrens_day',    label: '어린이날 (5/5)' },
    { value: 'buddha',           label: '부처님오신날' },
    { value: 'memorial_day',     label: '현충일 (6/6)' },
    { value: 'liberation_day',   label: '광복절 (8/15)' },
    { value: 'chuseok',          label: '추석' },
    { value: 'national_foundation_day', label: '개천절 (10/3)' },
    { value: 'hangul_day',       label: '한글날 (10/9)' },
    { value: 'christmas',        label: '성탄절 (12/25)' },
    { value: 'childrens_day_alt',label: '대체공휴일' },
    { value: 'election_day',     label: '선거일' },
    { value: 'school_holiday',   label: '학교재량휴일' },
    { value: 'teacher_absent',   label: '강사사정' },
    { value: 'vacation',         label: '방학 휴강' },
    { value: 'etc',              label: '기타' },
  ]

  const hasPeriods = cls.periods?.length > 0 && cls.periods.some(p => p.startDate && p.endDate)
  if ((!hasPeriods && (!cls?.startDate || !cls?.endDate)) || !cls?.days?.length) {
    return <div style={{ color:'#9ca3af', fontSize:'14px', padding:'20px', textAlign:'center' }}>수업 기간과 요일을 먼저 설정하세요.</div>
  }

  const allSessions   = calcSessionDates(cls)
  const sessions = (cls.periods?.length > 0 && cls.periods.some(p => p.startDate && p.endDate))
    ? allSessions
    : (cls.totalSessions ? allSessions.slice(0, cls.totalSessions) : allSessions)
  const cancelled     = new Set((cls.cancelledDates || []).map(c => c.date))
  const cancelledDates = cls.cancelledDates || []
  const makeupDates   = cls.makeupDates || []

  // termSizes: periods 방식이면 각 학기/분기의 termSizes를 이어붙임
  const termSizes = cls.periods?.length > 0
    ? cls.periods.flatMap(p =>
        (p.termSizes?.length > 0)
          ? p.termSizes.slice(0, p.termCount || p.termSizes.length).map(n => Number(n) || 4)
          : Array(Number(p.termCount) || 1).fill(4)
      )
    : (cls.termSizes?.length > 0)
      ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length).map(n => Number(n) || 4)
      : [cls.termSize ? Number(cls.termSize) : 4]

  // sessionMap: 날짜 → { total: 전체차시, termNum: 텀번호, termSess: 텀내차시 }
  const sessionMap = {}
  const termMap    = {}
  let totalIdx = 1

  if (cls.periods?.length > 0) {
    cls.periods.forEach((p, pIdx) => {
      if (!p.startDate || !p.endDate) return
      const periodSessions = sessions.filter(d => d >= p.startDate && d <= p.endDate)
      const pTermSizes = (p.termSizes?.length > 0)
        ? p.termSizes.slice(0, p.termCount || p.termSizes.length).map(n => Number(n) || 4)
        : Array(Number(p.termCount) || 1).fill(4)
      const pOffset = pIdx * 3
      let cursor = 0
      pTermSizes.forEach((size, ti) => {
        const termNum = pOffset + ti + 1
        let termIdx = 1
        periodSessions.slice(cursor, cursor + size).forEach(d => {
          if (!cancelled.has(d)) {
            sessionMap[d] = { total: totalIdx++, termNum, termSess: termIdx++ }
            termMap[d] = termNum
          } else {
            termMap[d] = termNum
          }
        })
        cursor += size
      })
      if (cursor < periodSessions.length) {
        const termNum = pOffset + pTermSizes.length
        let termIdx = 1
        periodSessions.slice(cursor).forEach(d => {
          if (!cancelled.has(d)) {
            sessionMap[d] = { total: totalIdx++, termNum, termSess: termIdx++ }
          }
          termMap[d] = termNum
        })
      }
    })
  } else {
    let cursor = 0
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
    if (!cls.totalSessions && cursor < sessions.length) {
      let termIdx = 1
      sessions.slice(cursor).forEach(d => {
        if (!cancelled.has(d)) {
          sessionMap[d] = { total: totalIdx++, termNum: termSizes.length, termSess: termIdx++ }
        }
        termMap[d] = termSizes.length
      })
    }
  }
  // 방학 기간 수업일 자동 휴강 처리
  const vacationPeriods = (cls.specialPeriods || []).filter(p =>
    (p.type === 'summer_vacation' || p.type === 'winter_vacation' || p.type === 'afterschool_vacation') && p.suspend !== false
  )
  const isInVacation = (dateStr) => vacationPeriods.some(p => dateStr >= p.startDate && dateStr <= p.endDate)
  sessions.forEach(d => {
    if (isInVacation(d) && !cancelled.has(d) && !makeupDates.some(m => m.date === d)) {
      cancelled.add(d)
      if (!cancelledDates.find(c => c.date === d)) {
        cancelledDates.push({ date: d, reason: 'vacation', memo: '방학 휴강 (자동)' })
      }
    }
  })

  // 보강일
  makeupDates.forEach(m => {
    sessionMap[m.date] = { total: totalIdx++, termNum: 0, termSess: 0, isMakeup: true }
  })

  const startD = new Date((cls.periods?.[0]?.startDate || cls.startDate) + 'T00:00:00')
  const endD   = new Date((cls.periods?.[cls.periods.length-1]?.endDate || cls.endDate) + 'T00:00:00')
  const months = []
  // 2월 ~ 다음해 2월 고정 표시 (수업 시작 연도 기준)
  const baseYear = startD.getFullYear()
  let cur = new Date(baseYear, 1, 1)          // 해당 연도 2월
  const limitEnd = new Date(baseYear + 1, 2, 1) // 다음 연도 3월 (2월까지 포함)
  while (cur < limitEnd) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }

  // 신청기간 모달 열 때 기존 값 로드
  const openApplyPeriod = () => {
    setApplyStart(cls.applyStartAt ? cls.applyStartAt.slice(0,10) : '')
    setApplyEnd(  cls.applyEndAt   ? cls.applyEndAt.slice(0,10)   : '')
    setShowApplyPeriod(true)
  }
  const saveApplyPeriod = () => {
    onUpdate({ ...cls, applyStartAt: applyStart || null, applyEndAt: applyEnd || null })
    setShowApplyPeriod(false)
  }

  // 신청기간 상태 계산
  const now = new Date()
  const applyStartD = cls.applyStartAt ? new Date(cls.applyStartAt) : null
  const applyEndD   = cls.applyEndAt   ? new Date(cls.applyEndAt)   : null
  const isApplyOpen = applyStartD && applyEndD && now >= applyStartD && now <= applyEndD
  const isApplyPast = applyEndD && now > applyEndD
  const fmtDT = (iso) => {
    if (!iso) return ''
    return iso.slice(5, 10).replace('-', '/')  // MM/DD 형식
  }

  const handleDateClick = (date, type, e) => {
    setShowNormalAction(false)
    setShowRegisteredAction(false)
    setShowCancel(false)
    setShowMakeup(false)
    setSelectedDate(date)
    setClickType(type)
    // 클릭한 버튼 위치 기준으로 팝업 위치 계산
    if (e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect()
      setPopupPos({ x: rect.right + 8, y: rect.top })
    }
    if (type === 'normal') {
      setShowNormalAction(true)
    } else {
      setShowRegisteredAction(true)
    }
  }

  const handleCancelSave = () => {
    onUpdate({ ...cls, cancelledDates: [...cancelledDates, { date: selectedDate, reason, memo }] })
    setShowCancel(false)
  }

  const handleMakeupSave = () => {
    onUpdate({ ...cls, makeupDates: [...makeupDates, { date: selectedDate, memo }] })
    setShowMakeup(false)
  }

  const activeCount = sessions.filter(d => !cancelled.has(d)).length
  const makeupCount = makeupDates.length
  const cancelCount = cancelledDates.length
  const specialPeriods = cls.specialPeriods || []

  const addSpecialPeriod = () => {
    if (!newPeriodStart || !newPeriodEnd) return
    const typeInfo = getSpecialPeriodType(newPeriodType)
    const label = newPeriodType === 'etc' ? (newPeriodLabel.trim() || '기타') : typeInfo.label
    onUpdate({ ...cls, specialPeriods: [...specialPeriods, { type: newPeriodType, label, startDate: newPeriodStart, endDate: newPeriodEnd, suspend: newPeriodSuspend }] })
    setNewPeriodStart(''); setNewPeriodEnd(''); setNewPeriodLabel(''); setNewPeriodSuspend(true)
  }

  const removeSpecialPeriod = (idx) => {
    onUpdate({ ...cls, specialPeriods: specialPeriods.filter((_, i) => i !== idx) })
  }

  const startEditPeriod = (idx) => {
    setEditingPeriodIdx(idx)
    setEditPeriod({ ...specialPeriods[idx] })
  }

  const saveEditPeriod = () => {
    if (!editPeriod.startDate || !editPeriod.endDate) return
    const typeInfo = getSpecialPeriodType(editPeriod.type)
    const label = editPeriod.type === 'etc' ? (editPeriod.label?.trim() || '기타') : typeInfo.label
    const updated = specialPeriods.map((sp, i) => i === editingPeriodIdx ? { ...editPeriod, label } : sp)
    onUpdate({ ...cls, specialPeriods: updated })
    setEditingPeriodIdx(null); setEditPeriod(null)
  }

  const termSummary = termSizes.map((size, ti) => {
    const start = termSizes.slice(0,ti).reduce((a,b)=>a+b,0)
    const globalStart = start + 1
    const globalEnd   = Math.min(start + size, sessions.length)
    const termSessions = sessions.slice(start, start + size)
    const active = termSessions.filter(d => !cancelled.has(d)).length
    return { num: ti+1, active, total: size, globalStart, globalEnd }
  })
  const periodTermSummary = cls.periods?.length > 0 ? cls.periods.map((p, pIdx) => {
    if (!p.startDate || !p.endDate) return null
    const pTermSizes = (p.termSizes?.length > 0)
      ? p.termSizes.slice(0, p.termCount || p.termSizes.length).map(n => Number(n) || 4)
      : Array(Number(p.termCount) || 1).fill(4)
    const periodSessions = sessions.filter(d => d >= p.startDate && d <= p.endDate)
    const pOffset = pIdx * 3
    return {
      label: p.label,
      terms: pTermSizes.map((size, ti) => {
        const cursor = pTermSizes.slice(0,ti).reduce((a,b)=>a+b,0)
        const termSessions = periodSessions.slice(cursor, cursor + size)
        const active = termSessions.filter(d => !cancelled.has(d)).length
        return { num: pOffset + ti + 1, localNum: ti + 1, active, total: size, globalStart: cursor+1, globalEnd: cursor+size }
      })
    }
  }).filter(Boolean) : []

  // ── 유효성 검사 ────────────────────────────────────────────
  const totalConfigured = cls.totalSessions ? Number(cls.totalSessions) : sessions.length
  const termSum         = termSizes.reduce((a, b) => a + b, 0)
  const warnings = []
  if (cls.totalSessions && allSessions.length < Number(cls.totalSessions)) {
    warnings.push(`달력 날짜(${allSessions.length}회)가 설정한 전체 수업일수(${cls.totalSessions}회)보다 부족합니다. 날짜 범위를 늘리거나 수업일수를 줄이세요.`)
  }
  if (activeCount + makeupCount > totalConfigured) {
    warnings.push(`실제 수업 횟수(${activeCount + makeupCount}회)가 전체 수업일수(${totalConfigured}회)를 초과했습니다.`)
  }
  if (cls.periods?.length > 0) {
    cls.periods.forEach(p => {
      if (!p.startDate || !p.endDate) return
      const pSessions = sessions.filter(d => d >= p.startDate && d <= p.endDate)
      const pTermSizes = (p.termSizes?.length > 0)
        ? p.termSizes.slice(0, p.termCount || p.termSizes.length).map(n => Number(n) || 4)
        : Array(Number(p.termCount) || 1).fill(4)
      const pTermSum = pTermSizes.reduce((a,b) => a+b, 0)
      const pActive  = pSessions.filter(d => !cancelled.has(d)).length
      if (pTermSum !== pActive) {
        warnings.push(`${p.label} 텀별 차시 합계(${pTermSum}차시)가 실제 수업일수(${pActive}회)와 맞지 않습니다.`)
      }
    })
  } else if (termSum !== totalConfigured) {
    warnings.push(`텀별 차시 합계(${termSum}차시)가 전체 수업일수(${totalConfigured}회)와 맞지 않습니다.`)
  }

  return (
    <div>
      {/* ── 학기/분기별 기간 표시 & 편집 */}
      {(() => {
        const isSemester = cls.termType === 'semester'
        const periods = cls.periods?.length > 0 ? cls.periods : []
        const inputSt = { padding:'5px 8px', borderRadius:'7px', border:'1.5px solid #bfdbfe', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#111827' }

        const updatePeriod = (idx, patch) => {
          const next = periods.map((p, i) => i === idx ? { ...p, ...patch } : p)
          // 전체 startDate/endDate도 자동 연동
          const autoStart = next.find(p => p.startDate)?.startDate || cls.startDate
          const autoEnd   = [...next].reverse().find(p => p.endDate)?.endDate || cls.endDate
          onUpdate({ ...cls, periods: next, startDate: autoStart, endDate: autoEnd })
        }

        if (periods.length === 0) {
          // 기존 방식 (periods 없음) — 단순 날짜 수정
          return (
            <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', background:'#f8faff', border:'1.5px solid #dbeafe', borderRadius:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
              <select value={cls.termType || 'semester'} onChange={e => onUpdate({ ...cls, termType: e.target.value })}
                style={{ padding:'4px 8px', borderRadius:'7px', border:'1.5px solid #bfdbfe', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#1d4ed8', fontWeight:700, cursor:'pointer' }}>
                <option value="semester">📚 학기제</option>
                <option value="quarter">📅 분기제</option>
              </select>
              <span style={{ fontSize:'12px', color:'#6b7280' }}>수업 기간:</span>
              <input type="date" value={cls.startDate || ''} onChange={e => onUpdate({ ...cls, startDate: e.target.value })} style={inputSt} />
              <span style={{ color:'#9ca3af' }}>~</span>
              <input type="date" value={cls.endDate || ''} onChange={e => onUpdate({ ...cls, endDate: e.target.value })} style={inputSt} />
              <span style={{ fontSize:'11px', color:'#93c5fd', marginLeft:'auto' }}>← 날짜 수정 시 앞 탭과 자동 연동</span>
            </div>
          )
        }

        // periods 방식 — 학기/분기별 기간 수정
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 14px', background:'#f8faff', border:'1.5px solid #dbeafe', borderRadius:'10px' }}>
              <select value={cls.termType || 'semester'} onChange={e => onUpdate({ ...cls, termType: e.target.value })}
                style={{ padding:'4px 8px', borderRadius:'7px', border:'1.5px solid #bfdbfe', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#1d4ed8', fontWeight:700, cursor:'pointer' }}>
                <option value="semester">📚 학기제</option>
                <option value="quarter">📅 분기제</option>
              </select>
              <span style={{ fontSize:'12px', color:'#6b7280', marginLeft:'4px' }}>
                총 {periods.reduce((s,p)=>(p.termSizes||[]).slice(0,p.termCount||1).reduce((a,v)=>a+(Number(v)||0),0)+s,0)}차시
                · {periods.length}{isSemester?'학기':'분기'}
                · {periods.reduce((s,p)=>s+(p.termCount||1),0)}텀
              </span>
              <span style={{ fontSize:'11px', color:'#93c5fd', marginLeft:'auto' }}>← 기간 수정 시 달력에 자동 반영</span>
            </div>
            {periods.map((p, pIdx) => {
              const today = new Date().toISOString().slice(0,10)
              const isActive = p.startDate && p.endDate && today >= p.startDate && today <= p.endDate
              return (
              <div key={pIdx} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', background: isActive ? '#fff7ed' : '#fafafa', border:`1.5px solid ${isActive ? '#f97316' : '#e5e7eb'}`, borderRadius:'10px', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', minWidth:'70px' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color: isActive ? '#f97316' : '#6b7280' }}>{p.label}</span>
                  {isActive && <span style={{ fontSize:'10px', background:'#f97316', color:'#fff', borderRadius:'4px', padding:'1px 5px', fontWeight:700 }}>진행중</span>}
                </div>
                <input type="date" value={p.startDate || ''} onChange={e => updatePeriod(pIdx, { startDate: e.target.value })} style={inputSt} />
                <span style={{ color:'#9ca3af' }}>~</span>
                <input type="date" value={p.endDate || ''} onChange={e => updatePeriod(pIdx, { endDate: e.target.value })} style={inputSt} />
                {/* 텀 수 */}
                <div style={{ display:'flex', alignItems:'center', gap:'4px', marginLeft:'8px' }}>
                  <span style={{ fontSize:'11px', color:'#9ca3af' }}>텀:</span>
                  {[1,2,3,4,5,6].map(n => (
                    <button key={n} type="button" onClick={() => {
                      const sizes = Array.from({ length: n }, (_, i) => (p.termSizes||[])[i] || 4)
                      updatePeriod(pIdx, { termCount: n, termSizes: sizes })
                    }} style={{ width:'26px', height:'26px', borderRadius:'6px', border:`1.5px solid ${(p.termCount||1)===n?'#f97316':'#e5e7eb'}`, background:(p.termCount||1)===n?'#fff7ed':'#fff', color:(p.termCount||1)===n?'#f97316':'#374151', fontSize:'12px', fontWeight:(p.termCount||1)===n?700:400, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                      {n}
                    </button>
                  ))}
                </div>
                {/* 텀당 차시 */}
                <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                  <span style={{ fontSize:'11px', color:'#9ca3af' }}>차시:</span>
                  {Array.from({ length: p.termCount || 1 }, (_, tIdx) => (
                    <div key={tIdx} style={{ display:'flex', alignItems:'center', gap:'2px' }}>
                      <span style={{ fontSize:'10px', color:'#9ca3af' }}>{tIdx+1}텀</span>
                      <input type="number" min="1" max="30" value={(p.termSizes||[])[tIdx] || 4}
                        onChange={e => {
                          const sizes = [...(p.termSizes||[])]
                          sizes[tIdx] = Number(e.target.value) || 0
                          updatePeriod(pIdx, { termSizes: sizes })
                        }}
                        style={{ width:'44px', padding:'4px 5px', borderRadius:'6px', border:'1.5px solid #e5e7eb', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', textAlign:'center' }} />
                    </div>
                  ))}
                </div>
              </div>
            )})}
            {/* 분기 추가 버튼 */}
            {(() => {
              const allLabels = isSemester ? ['1학기','2학기','3학기'] : ['1분기','2분기','3분기','4분기']
              if (periods.length >= allLabels.length) return null
              const nextLabel = allLabels[periods.length]
              return (
                <button type="button" onClick={() => {
                  const newPeriod = { label: nextLabel, startDate: '', endDate: '', termCount: 1, termSizes: [4] }
                  onUpdate({ ...cls, periods: [...periods, newPeriod] })
                }} style={{ padding:'9px', borderRadius:'10px', border:'2px dashed #e5e7eb', background:'#fafafa', color:'#9ca3af', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600, width:'100%' }}>
                  + {nextLabel} 추가
                </button>
              )
            })()}
          </div>
        )
      })()}

      {/* 신청기간 배너 + 편집 패널 (배너 바로 아래 인라인) */}
      <div style={{ marginBottom:'12px' }}>
        {(cls.applyStartAt || cls.applyEndAt) && !showApplyPeriod && (
          <div style={{
            display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px',
            borderRadius:'10px',
            background: isApplyOpen ? '#f0fdf4' : isApplyPast ? '#f9fafb' : '#eff6ff',
            border: `1.5px solid ${isApplyOpen ? '#86efac' : isApplyPast ? '#e5e7eb' : '#93c5fd'}`,
          }}>
            <span style={{ fontSize:'16px' }}>{isApplyOpen ? '🟢' : isApplyPast ? '⚫' : '🔵'}</span>
            <div style={{ flex:1, fontSize:'13px', color: isApplyOpen ? '#15803d' : isApplyPast ? '#9ca3af' : '#1d4ed8', fontWeight:600 }}>
              {isApplyOpen ? '신청 접수 중' : isApplyPast ? '신청 종료됨' : '신청 예정'}
              <span style={{ fontWeight:400, marginLeft:'8px', fontSize:'12px' }}>
                {fmtDT(cls.applyStartAt)} ~ {fmtDT(cls.applyEndAt)}
              </span>
            </div>
            <button onClick={openApplyPeriod}
              style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #e5e7eb', background:'#fff',
                fontSize:'12px', color:'#6b7280', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              수정
            </button>
            <button onClick={() => onUpdate({ ...cls, applyStartAt: null, applyEndAt: null })}
              style={{ padding:'4px 10px', borderRadius:'6px', border:'none', background:'none',
                fontSize:'12px', color:'#d1d5db', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              ✕
            </button>
          </div>
        )}

        {/* 신청기간 설정/편집 패널 — 배너 바로 아래 인라인 */}
        {showApplyPeriod && (
          <div style={{ borderRadius:'12px', border:'1.5px solid #bfdbfe',
            background:'#eff6ff', padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <div style={{ fontSize:'14px', fontWeight:700, color:'#1d4ed8' }}>📅 신청기간 설정</div>
              <button onClick={() => setShowApplyPeriod(false)}
                style={{ background:'none', border:'none', fontSize:'18px', color:'#9ca3af', cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
              <input type="date" value={applyStart} onChange={e => setApplyStart(e.target.value)}
                style={{ padding:'5px 8px', borderRadius:'7px', border:'1.5px solid #bfdbfe',
                  fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#111827' }} />
              <span style={{ color:'#9ca3af', fontSize:'13px' }}>~</span>
              <input type="date" value={applyEnd} onChange={e => setApplyEnd(e.target.value)}
                style={{ padding:'5px 8px', borderRadius:'7px', border:'1.5px solid #bfdbfe',
                  fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#111827' }} />
              <div style={{ display:'flex', gap:'8px', marginLeft:'auto' }}>
                <Btn variant="ghost" onClick={() => setShowApplyPeriod(false)}>닫기</Btn>
                {(cls.applyStartAt || cls.applyEndAt) && (
                  <Btn variant="danger" onClick={() => { onUpdate({ ...cls, applyStartAt: null, applyEndAt: null }); setShowApplyPeriod(false) }}>삭제</Btn>
                )}
                <Btn onClick={saveApplyPeriod}>저장</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 요약 */}
      <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'16px' }}>
        {periodTermSummary.length > 0 ? periodTermSummary.map((pg, pgIdx) => (
          <div key={pgIdx} style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'12px', fontWeight:700, color:'#6b7280', minWidth:'40px' }}>{pg.label}</span>
            {pg.terms.map(t => {
              const tc = getTermColor(t.num)
              return (
                <div key={t.num} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 12px',
                  background: tc.bg, border:`1.5px solid ${tc.border}`, borderRadius:'20px' }}>
                  <span style={{ fontSize:'12px', fontWeight:700, color: tc.text }}>{t.localNum}텀</span>
                  <span style={{ fontSize:'11px', color:'#6b7280', fontWeight:600 }}>{t.active}회</span>
                  <span style={{ fontSize:'10px', color:'#d1d5db' }}>|</span>
                  <span style={{ fontSize:'10px', color:'#9ca3af' }}>{t.globalStart}~{t.globalEnd}차시</span>
                </div>
              )
            })}
          </div>
        )) : (
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
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
          </div>
        )}
        <div style={{ display:'flex', gap:'8px', fontSize:'12px', marginLeft:'4px' }}>
          <span style={{ color:'#f97316', fontWeight:600 }}>수업 {activeCount}회</span>
          {cancelCount > 0 && <span style={{ color:'#ef4444' }}>휴일 {cancelCount}회</span>}
          {makeupCount > 0 && <span style={{ color:'#3b82f6' }}>보강 {makeupCount}회</span>}
        </div>
        {!cls.applyStartAt && (
          <button onClick={openApplyPeriod}
            style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:'7px', border:'1.5px dashed #93c5fd',
              background:'#eff6ff', color:'#3b82f6', fontSize:'12px', fontWeight:600,
              cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
            📅 신청기간 설정
          </button>
        )}
        <button onClick={() => setShowSpecialPeriods(v => !v)}
          style={{ marginLeft: cls.applyStartAt ? 'auto' : '0',
            padding:'5px 12px', borderRadius:'7px',
            border: specialPeriods.length > 0 ? '1.5px solid #f9a8d4' : '1.5px dashed #f9a8d4',
            background: specialPeriods.length > 0 ? '#fdf2f8' : '#fdf2f8',
            color:'#ec4899', fontSize:'12px', fontWeight:600,
            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
          🗓️ 특별기간 {specialPeriods.length > 0 ? `(${specialPeriods.length})` : '설정'}
        </button>
      </div>

      {/* 특별 기간 관리 패널 */}
      {showSpecialPeriods && (
        <div style={{ marginBottom:'12px', borderRadius:'14px', border:'1.5px solid #f9a8d4',
          background:'#fdf2f8', padding:'16px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#be185d' }}>🗓️ 특별기간 설정</div>
            <button onClick={() => setShowSpecialPeriods(false)}
              style={{ background:'none', border:'none', fontSize:'18px', color:'#9ca3af', cursor:'pointer', lineHeight:1, padding:'0 4px' }}>✕</button>
          </div>

          {/* 기존 특별기간 목록 */}
          {specialPeriods.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'14px' }}>
              {specialPeriods.map((sp, i) => {
                const spT = getSpecialPeriodType(sp.type)
                const isEditing = editingPeriodIdx === i
                const inputSt = { padding:'5px 8px', borderRadius:'7px', border:'1.5px solid #f9a8d4', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#111827' }
                if (isEditing && editPeriod) {
                  const edT = getSpecialPeriodType(editPeriod.type)
                  return (
                    <div key={i} style={{ padding:'12px', background:'#fff', borderRadius:'10px', border:`1.5px solid ${edT.border}`, display:'flex', flexDirection:'column', gap:'10px' }}>
                      {/* 타입 선택 */}
                      <select value={editPeriod.type} onChange={e => setEditPeriod({ ...editPeriod, type: e.target.value })}
                        style={{ padding:'6px 10px', borderRadius:'8px', border:'1.5px solid #f9a8d4', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#be185d', fontWeight:700, cursor:'pointer' }}>
                        {SPECIAL_PERIOD_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                      </select>
                      {editPeriod.type === 'etc' && (
                        <input type="text" value={editPeriod.label || ''} onChange={e => setEditPeriod({ ...editPeriod, label: e.target.value })}
                          placeholder="기간 이름 입력" style={{ ...inputSt, width:'140px' }} />
                      )}
                      {/* 날짜 */}
                      <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                        <input type="date" value={editPeriod.startDate || ''} onChange={e => setEditPeriod({ ...editPeriod, startDate: e.target.value })} style={inputSt} />
                        <span style={{ color:'#9ca3af' }}>~</span>
                        <input type="date" value={editPeriod.endDate || ''} onChange={e => setEditPeriod({ ...editPeriod, endDate: e.target.value })} style={inputSt} />
                      </div>
                      {/* 휴강 여부 */}
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <span style={{ fontSize:'12px', color:'#6b7280', fontWeight:600 }}>수업 처리:</span>
                        <button onClick={() => setEditPeriod({ ...editPeriod, suspend: true })}
                          style={{ padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:700,
                            background: editPeriod.suspend !== false ? '#fef2f2' : '#f3f4f6',
                            color: editPeriod.suspend !== false ? '#ef4444' : '#9ca3af' }}>
                          🚫 휴강
                        </button>
                        <button onClick={() => setEditPeriod({ ...editPeriod, suspend: false })}
                          style={{ padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:700,
                            background: editPeriod.suspend === false ? '#f0fdf4' : '#f3f4f6',
                            color: editPeriod.suspend === false ? '#16a34a' : '#9ca3af' }}>
                          ✅ 수업 유지
                        </button>
                      </div>
                      {/* 저장/취소 */}
                      <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                        <Btn variant="ghost" onClick={() => { setEditingPeriodIdx(null); setEditPeriod(null) }}>취소</Btn>
                        <Btn onClick={saveEditPeriod} style={{ background:'#ec4899', borderColor:'#ec4899' }}>저장</Btn>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px',
                    background:'#fff', borderRadius:'10px', border:`1.5px solid ${spT.border}` }}>
                    <span style={{ fontSize:'15px' }}>{spT.emoji}</span>
                    <span style={{ fontSize:'13px', fontWeight:700, color: spT.color, minWidth:'70px' }}>{sp.label || spT.label}</span>
                    <span style={{ fontSize:'12px', color:'#9ca3af' }}>{sp.startDate?.slice(5)} ~ {sp.endDate?.slice(5)}</span>
                    <span style={{ marginLeft:'4px', fontSize:'11px', fontWeight:700, padding:'2px 7px', borderRadius:'20px',
                      background: sp.suspend === false ? '#f0fdf4' : '#fef2f2',
                      color: sp.suspend === false ? '#16a34a' : '#ef4444' }}>
                      {sp.suspend === false ? '✅ 수업유지' : '🚫 휴강'}
                    </span>
                    <button onClick={() => startEditPeriod(i)}
                      style={{ marginLeft:'auto', background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'14px', padding:'0 4px', lineHeight:1 }}>✏️</button>
                    <button onClick={() => removeSpecialPeriod(i)}
                      style={{ background:'none', border:'none', color:'#f43f5e', cursor:'pointer', fontSize:'16px', padding:'0 4px', lineHeight:1 }}>×</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* 새 특별기간 추가 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ fontSize:'12px', fontWeight:600, color:'#9ca3af' }}>새 기간 추가</div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
              <select value={newPeriodType} onChange={e => setNewPeriodType(e.target.value)}
                style={{ padding:'6px 10px', borderRadius:'8px', border:'1.5px solid #f9a8d4', fontSize:'13px',
                  fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#be185d', fontWeight:700, cursor:'pointer' }}>
                {SPECIAL_PERIOD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
                ))}
              </select>
              {newPeriodType === 'etc' && (
                <input type="text" value={newPeriodLabel} onChange={e => setNewPeriodLabel(e.target.value)}
                  placeholder="기간 이름 입력"
                  style={{ padding:'6px 10px', borderRadius:'8px', border:'1.5px solid #f9a8d4',
                    fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', width:'120px' }} />
              )}
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
              <input type="date" value={newPeriodStart} onChange={e => setNewPeriodStart(e.target.value)}
                min={cls.startDate} max={cls.endDate}
                style={{ padding:'5px 8px', borderRadius:'7px', border:'1.5px solid #f9a8d4',
                  fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#111827' }} />
              <span style={{ color:'#9ca3af', fontSize:'13px' }}>~</span>
              <input type="date" value={newPeriodEnd} onChange={e => setNewPeriodEnd(e.target.value)}
                min={newPeriodStart || cls.startDate} max={cls.endDate}
                style={{ padding:'5px 8px', borderRadius:'7px', border:'1.5px solid #f9a8d4',
                  fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', background:'#fff', color:'#111827' }} />
            </div>
            {/* 휴강 여부 선택 */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'12px', color:'#6b7280', fontWeight:600 }}>수업 처리:</span>
              <button onClick={() => setNewPeriodSuspend(true)}
                style={{ padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:700,
                  background: newPeriodSuspend ? '#fef2f2' : '#f3f4f6',
                  color: newPeriodSuspend ? '#ef4444' : '#9ca3af' }}>
                🚫 휴강
              </button>
              <button onClick={() => setNewPeriodSuspend(false)}
                style={{ padding:'5px 12px', borderRadius:'20px', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:700,
                  background: !newPeriodSuspend ? '#f0fdf4' : '#f3f4f6',
                  color: !newPeriodSuspend ? '#16a34a' : '#9ca3af' }}>
                ✅ 수업 유지
              </button>
              <Btn onClick={addSpecialPeriod} disabled={!newPeriodStart || !newPeriodEnd}
                style={{ marginLeft:'auto', background:'#ec4899', borderColor:'#ec4899' }}>추가</Btn>
            </div>
          </div>
        </div>
      )}

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
              applyStartAt={cls.applyStartAt} applyEndAt={cls.applyEndAt}
              specialPeriods={specialPeriods}
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
        {(cls.applyStartAt || cls.applyEndAt) && (
          <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:'#eff6ff',
              border:'1px solid #bfdbfe', display:'inline-block', flexShrink:0, position:'relative' }}>
              <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#3b82f6',
                position:'absolute', bottom:'2px', left:'50%', transform:'translateX(-50%)' }} />
            </span>신청기간
          </span>
        )}
        {specialPeriods.map((sp, i) => {
          const spT = getSpecialPeriodType(sp.type)
          return (
            <span key={i} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ width:'14px', height:'14px', borderRadius:'4px', background: spT.bg,
                border:`1.5px solid ${spT.border}`, display:'inline-block', flexShrink:0 }} />
              {sp.label || spT.label}
            </span>
          )
        })}
      </div>

      {/* ── 날짜 클릭 팝업 (클릭 위치 옆) ── */}
      {(showNormalAction || showRegisteredAction || showCancel || showMakeup) && createPortal(
        <>
          {/* 배경 클릭 시 닫기 */}
          <div onClick={() => { setShowNormalAction(false); setShowRegisteredAction(false); setShowCancel(false); setShowMakeup(false) }}
            style={{ position:'fixed', inset:0, zIndex:9998 }} />
          <div
            onMouseDown={handlePopupMouseDown}
            style={{
              position:'fixed',
              left: Math.min(popupPos.x, window.innerWidth - 320),
              top: Math.max(8, Math.min(popupPos.y, window.innerHeight - 400)),
              zIndex:9999, width:'300px',
              borderRadius:'14px', border:'1.5px solid #e5e7eb',
              background:'#fff', padding:'16px',
              boxShadow:'0 8px 32px rgba(0,0,0,0.15)',
              cursor:'grab', userSelect:'none',
            }}>
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
                    let updated = { ...cls }
                    if (clickType === 'cancelled') updated.cancelledDates = cancelledDates.filter(c => c.date !== selectedDate)
                    else if (clickType === 'makeup') updated.makeupDates = makeupDates.filter(m => m.date !== selectedDate)
                    onUpdate(updated); setShowRegisteredAction(false)
                  } },
                { label:'🚫 공휴일', desc:'공휴일, 선거일, 재량휴일, 강사사정 등', border:'#fca5a5', bg:'#fef2f2', hover:'#fee2e2', color:'#ef4444',
                  action: () => {
                    let updated = { ...cls }
                    if (clickType === 'makeup') updated.makeupDates = makeupDates.filter(m => m.date !== selectedDate)
                    onUpdate(updated)
                    setShowRegisteredAction(false); setReason('public_holiday'); setMemo(''); setShowCancel(true)
                  } },
                { label:'🔄 보강', desc:'이 날을 보강일로 변경', border:'#93c5fd', bg:'#eff6ff', hover:'#dbeafe', color:'#3b82f6',
                  action: () => {
                    let updated = { ...cls }
                    if (clickType === 'cancelled') updated.cancelledDates = cancelledDates.filter(c => c.date !== selectedDate)
                    if (!makeupDates.some(m => m.date === selectedDate))
                      updated.makeupDates = [...(updated.makeupDates || makeupDates), { date: selectedDate, memo: '보강' }]
                    onUpdate(updated); setShowRegisteredAction(false)
                  } },
                { label:'📚 수업일', desc:'이 날을 수업일로 변경', border:'#fed7aa', bg:'#fff7ed', hover:'#ffedd5', color:'#ea580c',
                  action: () => {
                    let updated = { ...cls }
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
        </>
      , document.body)}
    </div>
  )
}


