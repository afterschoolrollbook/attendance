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

  // ── 텀 구분 계산: termSizes 배열로 각 텀 차시 수 개별 설정
  const termSizes = cls.termSizes?.length
    ? cls.termSizes.slice(0, cls.termCount || cls.termSizes.length)
    : [cls.termSize || 4]  // 구버전 호환
  const terms = []
  let cursor = 0
  termSizes.forEach(size => {
    if (cursor < sessions.length) {
      terms.push(sessions.slice(cursor, cursor + size))
      cursor += size
    }
  })
  // 남은 차시가 있으면 마지막 텀에 추가
  if (cursor < sessions.length) {
    if (terms.length === 0) terms.push([])
    terms[terms.length - 1] = [...terms[terms.length - 1], ...sessions.slice(cursor)]
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {terms.map((termSessions, termIdx) => {
          const termStart = sessionMap[termSessions[0]]
          const termEnd   = sessionMap[termSessions[termSessions.length - 1]]
          // 텀 내 모든 날짜 (취소된 날 포함)
          const termDates = termSessions

          return (
            <div key={termIdx} style={{ border: '1.5px solid #f3f4f6', borderRadius: '14px', padding: '14px 16px', background: '#fafafa' }}>
              {/* 텀 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', background: '#f97316', borderRadius: '8px', padding: '3px 12px' }}>
                  {termIdx + 1}텀
                </span>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {termStart}차시 ~ {termEnd}차시 · {termSessions.filter(d => !cancelled.has(d)).length}회 수업
                </span>
              </div>
              {/* 날짜 카드들 - 월별로 묶어서 표시 */}
              {(() => {
                const monthGroups = {}
                termDates.forEach(d => {
                  const mk = d.slice(0, 7)
                  if (!monthGroups[mk]) monthGroups[mk] = []
                  monthGroups[mk].push(d)
                })
                return Object.keys(monthGroups).sort().map(mk => {
                  const [y, m] = mk.split('-')
                  return (
                    <div key={mk} style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>
                        {y}년 {parseInt(m)}월
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {monthGroups[mk].map(d => {
                          const isCancelled = cancelled.has(d)
                          const session = sessionMap[d]
                          const cancelInfo = (cls.cancelledDates || []).find(c => c.date === d)
                          const reasonLabel = CANCEL_REASONS.find(r => r.value === cancelInfo?.reason)?.label
                          return (
                            <button key={d} onClick={() => handleDateClick(d)}
                              title={isCancelled ? `취소됨: ${reasonLabel || ''}${cancelInfo?.memo ? ` (${cancelInfo.memo})` : ''} — 클릭하면 해제` : `${session}차시 — 클릭하면 취소`}
                              style={{ width:'68px', padding:'8px 6px', borderRadius:'10px', border:`1.5px solid ${isCancelled ? '#e5e7eb' : '#f97316'}`, background: isCancelled ? '#f9fafb' : '#fff7ed', cursor:'pointer', textAlign:'center', transition:'all .15s', fontFamily:'Noto Sans KR, sans-serif' }}>
                              <div style={{ fontSize:'11px', color: isCancelled ? '#d1d5db' : '#9ca3af', marginBottom:'3px' }}>{getDayLabel(d)}요일</div>
                              <div style={{ fontSize:'13px', fontWeight:700, color: isCancelled ? '#d1d5db' : '#111827' }}>{parseInt(d.slice(8))}일</div>
                              {session && !isCancelled && (
                                <div style={{ fontSize:'11px', color:'#f97316', marginTop:'3px', fontWeight:600 }}>{session}차시</div>
                              )}
                              {isCancelled && (
                                <div style={{ fontSize:'10px', color:'#ef4444', marginTop:'3px' }}>{reasonLabel || '취소'}</div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
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
