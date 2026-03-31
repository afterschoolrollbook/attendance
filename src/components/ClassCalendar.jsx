import React, { useState } from 'react'
import { calcSessionDates, getDayLabel } from '../lib/utils.js'
import { CANCEL_REASONS } from '../constants/config.js'
import { Modal, Select, Input, Btn } from './Atoms.jsx'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

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
          const session  = sessionMap[dateStr]
          const isCancelled = cancelled.has(dateStr)
          const isMakeup    = makeupSet.has(dateStr)
          const isSession   = !!session
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
                title={`보강일: ${makeupInfo?.memo||''} — 클릭하면 삭제`}
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
            return (
              <button key={day} onClick={() => onDateClick(dateStr, 'session')}
                title={`${session}차시 — 클릭하면 취소`}
                style={{ padding:'4px 2px', borderRadius:'8px', border:'none', cursor:'pointer',
                  background:'#fff7ed', outline:'1.5px solid #f97316', outlineOffset:'-1px',
                  textAlign:'center', fontFamily:'Noto Sans KR, sans-serif', transition:'all .12s' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color: isSun?'#ef4444': isSat?'#3b82f6':'#111827' }}>{day}</div>
                <div style={{ fontSize:'10px', color:'#f97316', fontWeight:700, lineHeight:1.2 }}>{session}차</div>
                {termNum && (
                  <div style={{ fontSize:'9px', color:'#fff', background:'#f97316', borderRadius:'4px',
                    padding:'0 3px', marginTop:'1px', lineHeight:'14px' }}>{termNum}텀</div>
                )}
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
  const [showCancel,    setShowCancel]    = useState(false)
  const [showMakeup,    setShowMakeup]    = useState(false)
  const [reason,        setReason]        = useState('public_holiday')
  const [memo,          setMemo]          = useState('')

  if (!cls?.startDate || !cls?.endDate || !cls?.days?.length) {
    return <div style={{ color:'#9ca3af', fontSize:'14px', padding:'20px', textAlign:'center' }}>수업 기간과 요일을 먼저 설정하세요.</div>
  }

  const sessions      = calcSessionDates(cls)
  const cancelled     = new Set((cls.cancelledDates || []).map(c => c.date))
  const cancelledDates = cls.cancelledDates || []
  const makeupDates   = cls.makeupDates || []

  // 보강 차시는 취소된 차시 이후 번호 부여
  const sessionMap = {}
  let si = 1
  sessions.forEach(d => {
    if (!cancelled.has(d)) sessionMap[d] = si++
  })
  // 보강일도 차시 부여
  makeupDates.forEach(m => { sessionMap[m.date] = si++ })

  const termSizes = cls.termSizes?.length
    ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length)
    : [cls.termSize || 4]

  const termMap = {}
  let cursor = 0
  termSizes.forEach((size, ti) => {
    sessions.slice(cursor, cursor + size).forEach(d => { termMap[d] = ti + 1 })
    cursor += size
  })
  if (cursor < sessions.length) sessions.slice(cursor).forEach(d => { termMap[d] = termSizes.length })

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
      // 수업일 → 취소 모달
      setReason('public_holiday'); setMemo('')
      setShowCancel(true)
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
    const termSessions = sessions.slice(start, start + size)
    return { num: ti+1, active: termSessions.filter(d=>!cancelled.has(d)).length, total: termSessions.length }
  })

  return (
    <div>
      {/* 요약 */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px', alignItems:'center' }}>
        {termSummary.map(t => (
          <div key={t.num} style={{ display:'flex', alignItems:'center', gap:'5px', padding:'4px 10px',
            background:'#fff7ed', border:'1.5px solid #f97316', borderRadius:'20px' }}>
            <span style={{ fontSize:'12px', fontWeight:700, color:'#ea580c' }}>{t.num}텀</span>
            <span style={{ fontSize:'11px', color:'#9ca3af' }}>{t.active}/{t.total}차시</span>
          </div>
        ))}
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
      <div style={{ display:'flex', gap:'14px', marginTop:'12px', fontSize:'11px', color:'#9ca3af', flexWrap:'wrap' }}>
        {[
          { bg:'#fff7ed', border:'#f97316', label:'수업일 (클릭→취소)' },
          { bg:'#fef2f2', border:'#fca5a5', label:'휴일 (클릭→복원)' },
          { bg:'#eff6ff', border:'#3b82f6', label:'보강일 (클릭→삭제)' },
          { bg:'transparent', border:'none', label:'일반날 (클릭→보강추가)', color:'#9ca3af' },
        ].map(item => (
          <span key={item.label} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ width:'14px', height:'14px', borderRadius:'4px', background:item.bg,
              border:`1.5px solid ${item.border}`, display:'inline-block', flexShrink:0 }} />
            {item.label}
          </span>
        ))}
      </div>

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
