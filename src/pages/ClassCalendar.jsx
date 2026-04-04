import React, { useState } from 'react'
import { calcSessionDates, getDayLabel } from '../lib/utils.js'
import { CANCEL_REASONS } from '../constants/config.js'
import { Modal, Select, Input, Btn } from './Atoms.jsx'

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

function MonthCalendar({ year, month, sessionMap, cancelled, cancelledDates, makeupDates, termMap, onDateClick }) {
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= lastDate; d++) cells.push(d)
  const makeupSet = new Set(makeupDates.map(m => m.date))

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
              </button>
            )
          }

          // 일반 날짜 (클릭 → 보강 추가)
          return (
            <button key={day} onClick={() => onDateClick(dateStr, 'normal')}
              title="클릭하면 보강일로 추가"
              style={{ padding:'6px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                background:'transparent', textAlign:'center', fontFamily:'Noto Sans KR, sans-serif',
                color: isSun?'#fca5a5': isSat?'#93c5fd':'#9ca3af', fontSize:'12px',
                transition:'all .12s' }}
              onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ClassCalendar({ cls, onUpdate }) {
  const [selectedDate,  setSelectedDate]  = useState(null)
  const [clickType,     setClickType]     = useState(null)
  const [showSessionAction, setShowSessionAction] = useState(false)  // 수업일 클릭 액션 선택
  const [showCancel,    setShowCancel]    = useState(false)
  const [showMakeup,    setShowMakeup]    = useState(false)
  const [reason,        setReason]        = useState('public_holiday')
  const [memo,          setMemo]          = useState('')

  if (!cls?.startDate || !cls?.endDate || !cls?.days?.length) {
    return <div style={{ color:'#9ca3af', fontSize:'14px', padding:'20px', textAlign:'center' }}>수업 기간과 요일을 먼저 설정하세요.</div>
  }

  const allSessions   = calcSessionDates(cls)
  // totalSessions 설정 시 해당 수만큼만 표시 (초과분 달력에서 제외)
  const sessions      = cls.totalSessions ? allSessions.slice(0, cls.totalSessions) : allSessions
  const cancelled     = new Set((cls.cancelledDates || []).map(c => c.date))
  const cancelledDates = cls.cancelledDates || []
  const makeupDates   = cls.makeupDates || []

  // 보강 차시는 취소된 차시 이후 번호 부여
  const termSizes = (cls.termSizes?.length > 0)
    ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length).map(n => Number(n) || 4)
    : [cls.termSize ? Number(cls.termSize) : 4]

  // sessionMap: 날짜 → { total: 전체차시, termNum: 텀번호, termSess: 텀내차시 }
  const sessionMap = {}
  const termMap    = {}
  let totalIdx = 1
  let cursor   = 0
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
  // 남은 차시 — totalSessions 미설정 시에만 처리
  if (!cls.totalSessions && cursor < sessions.length) {
    let termIdx = 1
    sessions.slice(cursor).forEach(d => {
      if (!cancelled.has(d)) {
        sessionMap[d] = { total: totalIdx++, termNum: termSizes.length, termSess: termIdx++ }
      }
      termMap[d] = termSizes.length
    })
  }
  // 보강일
  makeupDates.forEach(m => {
    sessionMap[m.date] = { total: totalIdx++, termNum: 0, termSess: 0, isMakeup: true }
  })

  const startD = new Date(cls.startDate + 'T00:00:00')
  const endD   = new Date(cls.endDate   + 'T00:00:00')
  const months = []
  let cur = new Date(startD.getFullYear(), startD.getMonth(), 1)
  while (cur <= endD) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }

  const handleDateClick = (date, type) => {
    setSelectedDate(date)
    setClickType(type)
    if (type === 'cancelled') {
      // 취소 복원
      onUpdate({ ...cls, cancelledDates: cancelledDates.filter(c => c.date !== date) })
    } else if (type === 'makeup') {
      // 보강 삭제
      onUpdate({ ...cls, makeupDates: makeupDates.filter(m => m.date !== date) })
    } else if (type === 'session') {
      // 수업일 → 액션 선택 모달
      setReason('public_holiday'); setMemo('')
      setShowSessionAction(true)
    } else if (type === 'normal') {
      // 일반날 → 보강 추가 모달
      setMemo('')
      setShowMakeup(true)
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

  const termSummary = termSizes.map((size, ti) => {
    const start = termSizes.slice(0,ti).reduce((a,b)=>a+b,0)
    const globalStart = start + 1
    const globalEnd   = Math.min(start + size, sessions.length)
    const termSessions = sessions.slice(start, start + size)
    const active = termSessions.filter(d => !cancelled.has(d)).length
    return { num: ti+1, active, total: size, globalStart, globalEnd }
  })

  return (
    <div>
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
      </div>

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
      </div>

      {/* 수업일 액션 선택 모달 */}
      <Modal open={showSessionAction} onClose={() => setShowSessionAction(false)} title="수업일 처리" width={380}>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ fontSize:'14px', color:'#374151', marginBottom:'4px' }}>
            <strong>{selectedDate}</strong> ({selectedDate && getDayLabel(selectedDate)}요일) 수업을 어떻게 처리할까요?
          </div>
          <button onClick={() => { setShowSessionAction(false); setShowCancel(true) }}
            style={{ padding:'14px 16px', borderRadius:'12px', border:'1.5px solid #fca5a5', background:'#fef2f2',
              cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}
            onMouseEnter={e => e.currentTarget.style.background='#fee2e2'}
            onMouseLeave={e => e.currentTarget.style.background='#fef2f2'}>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#ef4444', marginBottom:'3px' }}>🚫 휴일 처리</div>
            <div style={{ fontSize:'12px', color:'#9ca3af' }}>공휴일, 재량휴일, 강사사정 등으로 수업 취소</div>
          </button>
          <button onClick={() => {
            // 수업일을 보강일로 전환: cancelledDates에 추가 + makeupDates에 추가
            const newCancelled = [...cancelledDates, { date: selectedDate, reason: 'etc', memo: '보강으로 전환' }]
            const newMakeup    = [...makeupDates, { date: selectedDate, memo: '보강' }]
            onUpdate({ ...cls, cancelledDates: newCancelled, makeupDates: newMakeup })
            setShowSessionAction(false)
          }}
            style={{ padding:'14px 16px', borderRadius:'12px', border:'1.5px solid #93c5fd', background:'#eff6ff',
              cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}
            onMouseEnter={e => e.currentTarget.style.background='#dbeafe'}
            onMouseLeave={e => e.currentTarget.style.background='#eff6ff'}>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#3b82f6', marginBottom:'3px' }}>🔄 보강으로 변경</div>
            <div style={{ fontSize:'12px', color:'#9ca3af' }}>이 날을 보강일로 전환 (파란색으로 표시)</div>
          </button>
          <Btn variant="ghost" onClick={() => setShowSessionAction(false)}>닫기</Btn>
        </div>
      </Modal>

      {/* 취소 모달 */}
      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="휴일 처리" width={400}>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ fontSize:'14px', color:'#374151' }}>
            <strong>{selectedDate}</strong> ({selectedDate && getDayLabel(selectedDate)}요일) 수업을 휴일 처리하시겠습니까?
          </div>
          <Select label="사유" value={reason} onChange={setReason} options={CANCEL_REASONS} />
          {reason === 'etc' && (
            <Input label="직접 입력" value={memo} onChange={setMemo} placeholder="사유를 입력하세요" />
          )}
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowCancel(false)}>닫기</Btn>
            <Btn variant="danger" onClick={handleCancelSave}>휴일 처리</Btn>
          </div>
        </div>
      </Modal>

      {/* 보강 모달 */}
      <Modal open={showMakeup} onClose={() => setShowMakeup(false)} title="보강일 추가" width={400}>
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ fontSize:'14px', color:'#374151' }}>
            <strong>{selectedDate}</strong> ({selectedDate && getDayLabel(selectedDate)}요일)을 보강일로 추가합니다.
          </div>
          <Input label="메모 (선택)" value={memo} onChange={setMemo} placeholder="예: 5월 5일 어린이날 보강" />
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowMakeup(false)}>닫기</Btn>
            <Btn onClick={handleMakeupSave}>보강 추가</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
