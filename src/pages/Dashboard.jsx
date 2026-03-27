import React from 'react'
import { Classes, Students, Attendance, Users } from '../lib/db.js'
import { today, calcSessionDates, fmtDate, relativeDate } from '../lib/utils.js'
import { StatCard, Card, Tag, ProgressBar, Btn } from '../components/Atoms.jsx'
import { AdSlot } from '../components/AdSlot.jsx'
import { ATTENDANCE_STATUS, STUDENT_STATUS } from '../constants/config.js'

export function Dashboard({ user, onNav }) {
  const t = today()
  const isAdmin = user.role === 'admin'

  const allClasses = isAdmin ? Classes.all() : Classes.byTeacher(user.id)
  const allStudents = isAdmin ? Students.all() : Students.byTeacher(user.id)
  const confirmedStudents = allStudents.filter(s => s.status === 'confirmed')

  // 오늘 수업 계산
  const todayClasses = allClasses.filter(cls => {
    const sessions = calcSessionDates(cls)
    return sessions.includes(t)
  })

  // 오늘 출석 통계
  const todayAttendance = Attendance.all().filter(a => a.date === t)
  const presentToday = todayAttendance.filter(a => a.status === 'present' || a.status === 'late').length

  const pendingTeachers = isAdmin ? Users.pending().length : 0

  return (
    <div style={{ padding: '28px', maxWidth: '1100px' }}>
      <AdSlot slotId="dashboard_top" />

      {/* 헤더 */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>
          안녕하세요, {user.name} 선생님! 👋
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
          {t} &nbsp;·&nbsp; 오늘도 파이팅하세요
        </p>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <StatCard label="내 수업" value={allClasses.length} icon="📚" color="#f97316" sub={`활성 수업 ${todayClasses.length}개`} />
        <StatCard label="전체 학생" value={confirmedStudents.length} icon="👥" color="#3b82f6" sub={`신청 ${allStudents.filter(s=>s.status==='applied').length}명 대기`} />
        <StatCard label="오늘 출석" value={presentToday} icon="✅" color="#16a34a" sub={`오늘 수업 ${todayClasses.length}개`} />
        {isAdmin && <StatCard label="인증 대기" value={pendingTeachers} icon="⏳" color="#ef4444" sub="승인 필요" />}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* 오늘 수업 */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>📅 오늘 수업</h2>
            <Btn size="sm" variant="ghost" onClick={() => onNav('attendance')}>출석체크</Btn>
          </div>
          {todayClasses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: '14px' }}>오늘 수업이 없습니다 🎉</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todayClasses.map(cls => {
                const students = Students.confirmed(cls.id)
                const att = Attendance.byClassDate(cls.id, t)
                const done = att.filter(a => a.status !== 'pending').length
                return (
                  <div key={cls.id} style={{ padding: '12px 14px', background: '#fff7ed', borderRadius: '10px', border: '1px solid #fed7aa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{cls.className}</span>
                        {cls.section && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>{cls.section}반</span>}
                      </div>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{cls.time || ''}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>{cls.organization} · 학생 {students.length}명</div>
                    <ProgressBar value={done} max={students.length} />
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{done}/{students.length} 처리됨</div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* 최근 수업 목록 */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>📋 내 수업 목록</h2>
            <Btn size="sm" variant="ghost" onClick={() => onNav('classes')}>전체보기</Btn>
          </div>
          {allClasses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📚</div>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}>등록된 수업이 없습니다</p>
              <Btn size="sm" onClick={() => onNav('classes')}>수업 등록하기</Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {allClasses.slice(0, 5).map(cls => {
                const studentCount = Students.confirmed(cls.id).length
                const upcoming = calcSessionDates(cls).find(d => d >= t)
                return (
                  <div key={cls.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '8px', background: '#f9fafb', cursor: 'pointer' }}
                    onClick={() => onNav('classes')}>
                    <div>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{cls.organization}</span>
                      <span style={{ fontSize: '13px', color: '#6b7280', marginLeft: '8px' }}>{cls.className}</span>
                      {cls.section && <span style={{ fontSize: '12px', color: '#9ca3af' }}> {cls.section}반</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>👥 {studentCount}명</span>
                      {upcoming && <Tag color="#f97316" bg="#fff7ed">{relativeDate(upcoming)}</Tag>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* 인증 대기 알림 (Lv.1) */}
      {user.role === 'teacher' && user.level === 1 && (
        <div style={{ marginTop: '20px', padding: '16px 20px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#92400e' }}>⚠️ 선생님 인증이 필요합니다</div>
            <div style={{ fontSize: '13px', color: '#a16207', marginTop: '3px' }}>수업안내장을 업로드하면 출석부 출력 등 고급 기능을 사용할 수 있습니다.</div>
          </div>
          <Btn size="sm" variant="outline" onClick={() => onNav('profile')}>인증하기</Btn>
        </div>
      )}
    </div>
  )
}
