import React, { useState, useEffect } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB } from '../lib/db.js'
import { uid, today, calcSessionDates, getSession, fmtDate } from '../lib/utils.js'
import { Btn, Card, Tag, ProgressBar, PageHeader, EmptyState } from '../components/Atoms.jsx'
import { ATTENDANCE_STATUS } from '../constants/config.js'
import { AdSlot } from '../components/AdSlot.jsx'

export function Attendance({ user }) {
  const [selectedClass, setSelectedClass] = useState('')
  const [date, setDate] = useState(today())
  const [tick, setTick] = useState(0) // 강제 리렌더

  const classes = ClassesDB.byTeacher(user.id)
  const cls = classes.find(c => c.id === selectedClass)
  const students = selectedClass ? StudentsDB.confirmed(selectedClass) : []
  const session = cls ? getSession(cls, date) : null

  // 날짜별 출석 레코드 로드
  const records = selectedClass ? AttendanceDB.byClassDate(selectedClass, date) : []
  const getStatus = (studentId) => records.find(r => r.studentId === studentId)?.status || 'pending'

  const mark = (studentId, status) => {
    AttendanceDB.upsert({
      id: uid(),
      classId: selectedClass,
      studentId,
      date,
      session: session || 0,
      status,
      markedAt: new Date().toISOString(),
    })
    setTick(t => t + 1)
  }

  const markAll = (status) => {
    students.forEach(s => mark(s.id, status))
  }

  // 통계
  const stats = {
    pending: students.filter(s => getStatus(s.id) === 'pending').length,
    present: students.filter(s => getStatus(s.id) === 'present').length,
    absent:  students.filter(s => getStatus(s.id) === 'absent').length,
    late:    students.filter(s => getStatus(s.id) === 'late').length,
    early:   students.filter(s => getStatus(s.id) === 'early').length,
  }
  const done = students.length - stats.pending
  const rate = students.length > 0 ? Math.round((stats.present + stats.late) / students.length * 100) : 0

  // 수업 가용 날짜 (달력 제한용)
  const availableDates = cls ? calcSessionDates(cls) : []
  const isValidDate = !cls || availableDates.includes(date)

  return (
    <div style={{ padding: '28px', maxWidth: '900px' }}>
      <PageHeader title="출석체크" sub="학생 출석을 빠르게 체크하세요." />

      {/* 설정 바 */}
      <Card style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>수업 선택</div>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              style={{ width: '100%', padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer' }}>
              <option value="">-- 수업을 선택하세요 --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.organization} {c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>날짜 선택</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }} />
          </div>
          {session && <Tag color="#f97316" bg="#fff7ed" size="md">{session}차시</Tag>}
          {cls && !isValidDate && <Tag color="#ef4444" bg="#fef2f2" size="md">수업 없는 날</Tag>}
        </div>
      </Card>

      {!selectedClass ? (
        <EmptyState icon="✅" title="수업을 선택하세요" desc="출석을 체크할 수업을 선택하세요." />
      ) : students.length === 0 ? (
        <EmptyState icon="👥" title="확정된 학생이 없습니다" desc="학생 관리에서 최종 확정 처리를 먼저 하세요." />
      ) : !isValidDate ? (
        <EmptyState icon="🗓️" title="이 날짜는 수업이 없습니다" desc="수업 일정에 없는 날짜입니다. 날짜를 다시 확인하세요." />
      ) : (
        <>
          {/* 통계 + 일괄 처리 */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
              {Object.entries(stats).map(([k, v]) => {
                const cfg = ATTENDANCE_STATUS[k]
                return (
                  <div key={k} style={{ padding: '6px 14px', borderRadius: '8px', background: cfg.bg, border: `1px solid ${cfg.color}30`, fontSize: '13px', fontWeight: 600, color: cfg.color }}>
                    {cfg.emoji} {cfg.label} {v}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn size="sm" variant="ghost" onClick={() => markAll('present')}>전체 출석</Btn>
              <Btn size="sm" variant="ghost" onClick={() => markAll('absent')}>전체 결석</Btn>
            </div>
          </div>

          {/* 진행률 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>
              <span>처리 진행률 ({done}/{students.length})</span>
              <span style={{ fontWeight: 700, color: '#16a34a' }}>출석률 {rate}%</span>
            </div>
            <ProgressBar value={done} max={students.length} />
          </div>

          {/* 학생 출석 버튼 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {students.map((s, i) => {
              const status = getStatus(s.id)
              const cfg = ATTENDANCE_STATUS[status]
              const isPending = status === 'pending'
              return (
                <div key={s.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: isPending ? '#fff' : cfg.bg,
                  border: `1.5px solid ${isPending ? '#e5e7eb' : cfg.color + '50'}`,
                  transition: 'all .15s',
                }}>
                  {/* 번호 */}
                  <div style={{ fontSize: '13px', color: '#9ca3af', minWidth: '24px', textAlign: 'center' }}>
                    {s.number || i + 1}
                  </div>

                  {/* 이름 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{s.name}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{s.grade} {s.classNum ? s.classNum + '반' : ''}</div>
                  </div>

                  {/* 메인 출석 버튼 */}
                  <button
                    onClick={() => mark(s.id, isPending ? 'present' : 'pending')}
                    style={{
                      width: '54px', height: '54px',
                      borderRadius: '12px',
                      border: 'none',
                      background: isPending ? '#f97316' : '#16a34a',
                      color: '#fff',
                      fontSize: '22px',
                      cursor: 'pointer',
                      transition: 'all .15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                    title={isPending ? '클릭하면 출석 처리됩니다' : '클릭하면 미처리로 되돌립니다'}
                  >
                    {isPending ? '○' : '✓'}
                  </button>

                  {/* 세부 상태 버튼 */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[
                      { s: 'absent', label: '결석', color: '#ef4444' },
                      { s: 'late', label: '지각', color: '#f59e0b' },
                      { s: 'early', label: '조퇴', color: '#8b5cf6' },
                    ].map(btn => (
                      <button key={btn.s} onClick={() => mark(s.id, status === btn.s ? 'pending' : btn.s)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '7px',
                          border: `1.5px solid ${status === btn.s ? btn.color : '#e5e7eb'}`,
                          background: status === btn.s ? btn.color : '#fff',
                          color: status === btn.s ? '#fff' : '#9ca3af',
                          fontSize: '12px', fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'Noto Sans KR, sans-serif',
                          transition: 'all .15s',
                        }}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
