import React, { useState } from 'react'
import { calcSessionDates, getDayLabel } from '../lib/utils.js'
import { CANCEL_REASONS } from '../constants/config.js'
import { Modal, Select, Input, Btn } from './Atoms.jsx'

export function ClassCalendar({ cls, onUpdate }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState('public_holiday')
  const [memo, setMemo] = useState('')

  if (!cls?.startDate || !cls?.endDate || !cls?.days?.length) {
    return <div style={{ color: '#9ca3af', fontSize: '14px', padding: '20px', textAlign: 'center' }}>수업 기간과 요일을 먼저 설정하세요.</div>
  }

  const sessions = calcSessionDates(cls)
  const cancelled = new Set((cls.cancelledDates || []).map(c => c.date))

  // 달 별로 그룹핑
  const monthMap = {}
  sessions.forEach(d => {
    const m = d.slice(0, 7)
    if (!monthMap[m]) monthMap[m] = []
    monthMap[m].push(d)
  })

  // 취소된 날짜도 달에 포함
  ;(cls.cancelledDates || []).forEach(c => {
    const m = c.date.slice(0, 7)
    if (!monthMap[m]) monthMap[m] = []
    if (!monthMap[m].includes(c.date)) monthMap[m].push(c.date)
  })

  const months = Object.keys(monthMap).sort()
  let sessionCounter = 0

  const handleDateClick = (date) => {
    setSelectedDate(date)
    if (cancelled.has(date)) {
      // 취소 해제
      const updated = (cls.cancelledDates || []).filter(c => c.date !== date)
      onUpdate({ ...cls, cancelledDates: updated })
    } else {
      setReason('public_holiday')
      setMemo('')
      setShowModal(true)
    }
  }

  const handleCancel = () => {
    const updated = [...(cls.cancelledDates || []), { date: selectedDate, reason, memo }]
    onUpdate({ ...cls, cancelledDates: updated })
    setShowModal(false)
  }

  // 세션 카운터 초기화 후 다시 계산
  const sessionMap = {}
  let idx = 1
  sessions.forEach(d => { sessionMap[d] = idx++ })

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {months.map(month => {
          const [y, m] = month.split('-')
          const daysInMonth = monthMap[month].sort()

          return (
            <div key={month}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>
                {y}년 {parseInt(m)}월
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {daysInMonth.map(d => {
                  const isCancelled = cancelled.has(d)
                  const session = sessionMap[d]
                  const cancelInfo = (cls.cancelledDates || []).find(c => c.date === d)
                  const reasonLabel = CANCEL_REASONS.find(r => r.value === cancelInfo?.reason)?.label

                  return (
                    <button
                      key={d}
                      onClick={() => handleDateClick(d)}
                      title={isCancelled ? `취소됨: ${reasonLabel || ''}${cancelInfo?.memo ? ` (${cancelInfo.memo})` : ''} — 클릭하면 해제` : `${session}차시 — 클릭하면 해제`}
                      style={{
                        width: '68px',
                        padding: '8px 6px',
                        borderRadius: '10px',
                        border: `1.5px solid ${isCancelled ? '#e5e7eb' : '#f97316'}`,
                        background: isCancelled ? '#f9fafb' : '#fff7ed',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all .15s',
                        fontFamily: 'Noto Sans KR, sans-serif',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: isCancelled ? '#d1d5db' : '#9ca3af', marginBottom: '3px' }}>
                        {getDayLabel(d)}요일
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: isCancelled ? '#d1d5db' : '#111827' }}>
                        {parseInt(d.slice(8))}일
                      </div>
                      {session && !isCancelled && (
                        <div style={{ fontSize: '11px', color: '#f97316', marginTop: '3px', fontWeight: 600 }}>
                          {session}차시
                        </div>
                      )}
                      {isCancelled && (
                        <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '3px' }}>
                          {reasonLabel || '취소'}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
        * 날짜를 클릭하면 해당 수업일을 취소/복원할 수 있습니다.
      </div>

      {/* 취소 모달 */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="수업 취소" width={400}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '14px', color: '#374151' }}>
            <strong>{selectedDate}</strong> ({selectedDate && getDayLabel(selectedDate)}요일) 수업을 취소하시겠습니까?
          </div>
          <Select
            label="취소 사유"
            value={reason}
            onChange={setReason}
            options={CANCEL_REASONS}
          />
          {reason === 'etc' && (
            <Input label="직접 입력" value={memo} onChange={setMemo} placeholder="취소 사유를 입력하세요" />
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setShowModal(false)}>취소</Btn>
            <Btn variant="danger" onClick={handleCancel}>취소 처리</Btn>
          </div>
        </div>
      </Modal>
    </div>
  )
}
