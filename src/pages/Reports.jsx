import React, { useState } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB } from '../lib/db.js'
import { calcSessionDates, today } from '../lib/utils.js'
import { Card, PageHeader, Tag, ProgressBar, EmptyState } from '../components/Atoms.jsx'
import { ATTENDANCE_STATUS } from '../constants/config.js'
import { AdSlot } from '../components/AdSlot.jsx'

export function Reports({ user }) {
  const [selectedClass, setSelectedClass] = useState('')

  const classes = ClassesDB.byTeacher(user.id)
  const cls = classes.find(c => c.id === selectedClass)
  const students = selectedClass ? StudentsDB.confirmed(selectedClass) : []

  const sessions = cls ? calcSessionDates(cls) : []
  const t = today()
  const pastSessions = sessions.filter(d => d <= t)

  // 학생별 출석 통계
  const studentStats = students.map(s => {
    const records = AttendanceDB.byStudentClass(s.id, selectedClass).filter(r => pastSessions.includes(r.date))
    const present = records.filter(r => r.status === 'present').length
    const absent = records.filter(r => r.status === 'absent').length
    const late = records.filter(r => r.status === 'late').length
    const early = records.filter(r => r.status === 'early').length
    const rate = pastSessions.length > 0 ? Math.round((present + late) / pastSessions.length * 100) : 0
    return { ...s, present, absent, late, early, rate, total: pastSessions.length }
  })

  // 날짜별 출석 현황
  const getAttStatus = (studentId, date) => {
    const records = AttendanceDB.byClassDate(selectedClass, date)
    return records.find(r => r.studentId === studentId)?.status || 'pending'
  }

  // 최근 10차시만 표시
  const recentSessions = pastSessions.slice(-10)

  return (
    <div style={{ padding: '28px', maxWidth: '1200px' }}>
      <PageHeader title="출석 리포트" sub="수업별 출석 현황을 확인합니다." />
      <AdSlot slotId="report_bottom" />

      {/* 수업 선택 */}
      <div style={{ marginBottom: '20px' }}>
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          style={{ padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', background: '#fff', outline: 'none', cursor: 'pointer', minWidth: '280px' }}>
          <option value="">-- 수업을 선택하세요 --</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.organization} {c.className}{c.section ? ' ' + c.section + '반' : ''}</option>
          ))}
        </select>
      </div>

      {!selectedClass ? (
        <EmptyState icon="📊" title="수업을 선택하세요" desc="리포트를 확인할 수업을 선택하세요." />
      ) : students.length === 0 ? (
        <EmptyState icon="👥" title="확정된 학생이 없습니다" desc="학생 관리에서 최종 확정 처리를 먼저 하세요." />
      ) : (
        <>
          {/* 전체 통계 카드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {[
              { label: '전체 학생', value: students.length, color: '#3b82f6' },
              { label: '진행 차시', value: `${pastSessions.length}/${sessions.length}`, color: '#f97316' },
              { label: '평균 출석률', value: `${Math.round(studentStats.reduce((a, s) => a + s.rate, 0) / (studentStats.length || 1))}%`, color: '#16a34a' },
              { label: '무결석 학생', value: studentStats.filter(s => s.absent === 0 && s.total > 0).length, color: '#8b5cf6' },
            ].map(item => (
              <Card key={item.label}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{item.label}</div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: item.color }}>{item.value}</div>
              </Card>
            ))}
          </div>

          {/* 매트릭스 테이블 */}
          {recentSessions.length > 0 && (
            <Card style={{ marginBottom: '24px', overflow: 'auto' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
                출석 현황 (최근 {recentSessions.length}차시)
              </div>
              <table style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#6b7280', minWidth: '80px', borderBottom: '1px solid #e5e7eb' }}>이름</th>
                    {recentSessions.map((d, i) => {
                      const sessionNum = sessions.indexOf(d) + 1
                      return (
                        <th key={d} style={{ padding: '8px 10px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#9ca3af', borderBottom: '1px solid #e5e7eb', minWidth: '50px' }}>
                          <div>{sessionNum}차</div>
                          <div style={{ fontSize: '11px', fontWeight: 400 }}>{d.slice(5)}</div>
                        </th>
                      )
                    })}
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>출석률</th>
                  </tr>
                </thead>
                <tbody>
                  {studentStats.map((s, i) => (
                    <tr key={s.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 12px', fontSize: '14px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6' }}>{s.name}</td>
                      {recentSessions.map(d => {
                        const status = getAttStatus(s.id, d)
                        const cfg = ATTENDANCE_STATUS[status]
                        return (
                          <td key={d} style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', fontSize: '16px', background: status !== 'pending' ? cfg.bg : undefined }}>
                            {cfg.emoji}
                          </td>
                        )
                      })}
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px' }}>
                          <ProgressBar value={s.rate} max={100} color={s.rate >= 80 ? '#16a34a' : s.rate >= 60 ? '#f59e0b' : '#ef4444'} height={6} />
                          <span style={{ fontSize: '13px', fontWeight: 700, color: s.rate >= 80 ? '#16a34a' : s.rate >= 60 ? '#f59e0b' : '#ef4444', minWidth: '36px' }}>{s.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* 학생별 상세 */}
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>학생별 상세</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
              {studentStats.map(s => (
                <Card key={s.id}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{s.name}</div>
                    <span style={{
                      fontSize: '14px', fontWeight: 700,
                      color: s.rate >= 80 ? '#16a34a' : s.rate >= 60 ? '#f59e0b' : '#ef4444',
                    }}>{s.rate}%</span>
                  </div>
                  <ProgressBar value={s.rate} max={100} color={s.rate >= 80 ? '#16a34a' : s.rate >= 60 ? '#f59e0b' : '#ef4444'} />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <Tag color="#16a34a" bg="#f0fdf4">출석 {s.present}</Tag>
                    <Tag color="#ef4444" bg="#fef2f2">결석 {s.absent}</Tag>
                    <Tag color="#f59e0b" bg="#fffbeb">지각 {s.late}</Tag>
                    <Tag color="#8b5cf6" bg="#f5f3ff">조퇴 {s.early}</Tag>
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>총 {s.total}차시 중</div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
