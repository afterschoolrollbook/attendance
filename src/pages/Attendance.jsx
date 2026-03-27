import React, { useState, useEffect, useRef } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB, Notes } from '../lib/db.js'
import { uid, now, calcSessionDates, getSession } from '../lib/utils.js'
import { ATTENDANCE_STATUS } from '../constants/config.js'

const DAYS_KO = ['일','월','화','수','목','금','토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function todayStr() { return new Date().toISOString().slice(0, 10) }

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  warning: '#f59e0b',
}

// ─── 달력: 수업일만 강조
function AttCalendar({ year, month, selectedDate, sessionDates, onSelect, onPrevMonth, onNextMonth, onToday }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = todayStr()
  const sessionSet = new Set(sessionDates)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button onClick={onPrevMonth} style={navBtn}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{year}년 {MONTHS[month]}</span>
          <button onClick={onToday} style={{ padding: '2px 9px', borderRadius: '6px', border: `1px solid ${C.primary}`, background: '#fff7ed', color: C.primary, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>오늘</button>
        </div>
        <button onClick={onNextMonth} style={navBtn}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
        {DAYS_KO.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, padding: '3px 0', color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isSession = sessionSet.has(dateStr)
          const isToday = dateStr === today
          const isSel = dateStr === selectedDate
          const isPast = dateStr < today
          const isSun = (firstDay + day - 1) % 7 === 0
          const isSat = (firstDay + day - 1) % 7 === 6

          // 수업일 아니면 흐리게
          if (!isSession) {
            return (
              <div key={day} style={{ padding: '6px 2px', textAlign: 'center', fontSize: '12px', color: '#d1d5db', borderRadius: '6px' }}>{day}</div>
            )
          }

          return (
            <button key={day} onClick={() => onSelect(dateStr)}
              style={{
                position: 'relative', padding: '7px 2px', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                background: isSel ? C.primary : isToday ? '#fff7ed' : isPast ? '#f9fafb' : '#f0fdf4',
                color: isSel ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : C.text,
                fontWeight: isSel || isToday ? 700 : 500,
                fontSize: '13px',
                outline: isToday && !isSel ? `2px solid ${C.primary}` : 'none',
                outlineOffset: '-2px',
                transition: 'all .12s',
                fontFamily: 'Noto Sans KR, sans-serif',
              }}>
              {day}
              {/* 수업 상태 도트 */}
              <span style={{
                position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)',
                width: '5px', height: '5px', borderRadius: '50%', display: 'block',
                background: isSel ? '#fff' : isPast ? '#16a34a' : C.primary,
              }} />
            </button>
          )
        })}
      </div>

      {/* 범례 */}
      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', color: C.muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> 지난 수업
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.primary, display: 'inline-block' }} /> 예정 수업
        </span>
      </div>
    </div>
  )
}

const navBtn = { width: '28px', height: '28px', borderRadius: '7px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }

// ─── 출석 통계 바
function StatBar({ students, records }) {
  const today = todayStr()
  const counts = { present: 0, absent: 0, late: 0, early: 0, pending: 0 }
  students.forEach(s => {
    const r = records.find(r => r.studentId === s.id)
    const st = r?.status || 'pending'
    counts[st] = (counts[st] || 0) + 1
  })
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {Object.entries(ATTENDANCE_STATUS).map(([k, v]) => (
        <div key={k} style={{ padding: '5px 12px', borderRadius: '8px', background: v.bg, border: `1px solid ${v.color}30`, fontSize: '13px', fontWeight: 600, color: v.color }}>
          {v.emoji} {v.label} {counts[k] || 0}
        </div>
      ))}
    </div>
  )
}

// ─── 과거/오늘 → 출석체크 패널
function AttendancePanel({ cls, date, students, user }) {
  const [tick, setTick] = useState(0)
  const today = todayStr()
  const isPast = date < today

  const records = AttendanceDB.byClassDate(cls.id, date)
  const session = getSession(cls, date)

  const getStatus = (sid) => records.find(r => r.studentId === sid)?.status || 'pending'
  const getNote = (sid) => records.find(r => r.studentId === sid)?.note || ''

  const mark = (studentId, status) => {
    const existing = records.find(r => r.studentId === studentId)
    AttendanceDB.upsert({
      id: existing?.id || uid(),
      classId: cls.id, studentId, date,
      session: session || 0, status,
      note: existing?.note || '',
      markedAt: now(),
    })
    setTick(t => t + 1)
  }

  const setNote = (studentId, note) => {
    const existing = records.find(r => r.studentId === studentId)
    if (existing) {
      AttendanceDB.upsert({ ...existing, note, markedAt: now() })
    } else {
      AttendanceDB.upsert({ id: uid(), classId: cls.id, studentId, date, session: session || 0, status: 'pending', note, markedAt: now() })
    }
    setTick(t => t + 1)
  }

  const markAll = (status) => {
    students.forEach(s => mark(s.id, status))
  }

  const done = students.filter(s => getStatus(s.id) !== 'pending').length
  const rate = students.length > 0 ? Math.round(students.filter(s => ['present','late'].includes(getStatus(s.id))).length / students.length * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 헤더 */}
      <div style={{ padding: '14px 18px', background: isPast ? '#f9fafb' : 'linear-gradient(135deg,#fff7ed,#fff)', borderRadius: '12px', border: `1.5px solid ${isPast ? C.border : '#fed7aa'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
              {date} ({DAYS_KO[new Date(date+'T00:00:00').getDay()]}요일)
              {session ? <span style={{ marginLeft: '10px', fontSize: '13px', color: C.primary, fontWeight: 600 }}>{session}차시</span> : null}
            </div>
            <div style={{ fontSize: '13px', color: C.muted, marginTop: '3px' }}>
              {cls.organization} · {cls.className}{cls.section ? ' '+cls.section+'반' : ''} · {students.length}명
            </div>
          </div>
          {isPast
            ? <span style={{ fontSize: '12px', background: '#f3f4f6', color: C.muted, padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>지난 수업</span>
            : <span style={{ fontSize: '12px', background: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>오늘 수업</span>
          }
        </div>
      </div>

      {/* 통계 + 일괄 */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <StatBar students={students} records={records} />
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => markAll('present')} style={actionBtn('#f0fdf4','#16a34a','#86efac')}>전체 출석</button>
          <button onClick={() => markAll('absent')} style={actionBtn('#fef2f2','#ef4444','#fca5a5')}>전체 결석</button>
        </div>
      </div>

      {/* 진행률 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: C.muted, marginBottom: '5px' }}>
          <span>처리 {done}/{students.length}</span>
          <span style={{ fontWeight: 700, color: rate >= 80 ? '#16a34a' : C.warning }}>출석률 {rate}%</span>
        </div>
        <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ width: `${students.length ? done/students.length*100 : 0}%`, height: '100%', background: C.primary, borderRadius: '999px', transition: 'width .4s' }} />
        </div>
      </div>

      {/* 학생 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {students.map((s, i) => {
          const status = getStatus(s.id)
          const note = getNote(s.id)
          const cfg = ATTENDANCE_STATUS[status]
          const isPending = status === 'pending'

          return (
            <div key={s.id} style={{
              borderRadius: '12px', border: `1.5px solid ${isPending ? C.border : cfg.color+'50'}`,
              background: isPending ? '#fff' : cfg.bg, overflow: 'hidden',
              transition: 'all .15s',
            }}>
              {/* 메인 행 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px' }}>
                {/* 번호 */}
                <div style={{ fontSize: '12px', color: C.muted, minWidth: '22px', textAlign: 'center' }}>{s.number || i+1}</div>

                {/* 이름 + 학년반 */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: C.muted }}>{s.grade}{s.classNum ? ' '+s.classNum+'반' : ''}</div>
                </div>

                {/* 메인 출석 버튼 */}
                <button onClick={() => mark(s.id, isPending ? 'present' : 'pending')}
                  style={{
                    width: '50px', height: '50px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                    background: isPending ? C.primary : '#16a34a',
                    color: '#fff', fontSize: '20px', flexShrink: 0, transition: 'all .15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {isPending ? '○' : '✓'}
                </button>

                {/* 세부 버튼 */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[
                    { s: 'absent', label: '결석', c: '#ef4444' },
                    { s: 'late',   label: '지각', c: '#f59e0b' },
                    { s: 'early',  label: '조퇴', c: '#8b5cf6' },
                  ].map(btn => (
                    <button key={btn.s} onClick={() => mark(s.id, status === btn.s ? 'pending' : btn.s)}
                      style={{
                        padding: '5px 9px', borderRadius: '7px', border: `1.5px solid ${status===btn.s ? btn.c : C.border}`,
                        background: status===btn.s ? btn.c : '#fff', color: status===btn.s ? '#fff' : C.muted,
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all .12s',
                      }}>{btn.label}</button>
                  ))}
                </div>
              </div>

              {/* 메모 행 */}
              <NoteRow note={note} onSave={(v) => setNote(s.id, v)} studentMemo={s.memo} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 인라인 메모 행
function NoteRow({ note, onSave, studentMemo }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(note)
  const ref = useRef()

  useEffect(() => { setVal(note) }, [note])

  const save = () => { onSave(val); setEditing(false) }

  return (
    <div style={{ padding: '0 14px 10px', paddingLeft: '46px' }}>
      {/* 학생 기본 메모 표시 */}
      {studentMemo && (
        <div style={{ fontSize: '11px', color: '#92400e', background: '#fffbeb', padding: '3px 8px', borderRadius: '5px', marginBottom: '5px', display: 'inline-block' }}>
          👤 {studentMemo}
        </div>
      )}

      {/* 오늘 출석 메모 */}
      {editing ? (
        <div style={{ display: 'flex', gap: '5px' }}>
          <input ref={ref} value={val} onChange={e => setVal(e.target.value)} autoFocus placeholder="출석 특이사항 메모"
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setVal(note) } }}
            style={{ flex: 1, border: `1.5px solid ${C.primary}`, borderRadius: '6px', padding: '4px 9px', fontSize: '12px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }} />
          <button onClick={save} style={smBtn('#f97316','#fff')}>저장</button>
          <button onClick={() => { setEditing(false); setVal(note) }} style={smBtn('#f3f4f6','#374151')}>취소</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {note
            ? <span style={{ fontSize: '12px', color: '#374151', background: '#fffbeb', padding: '3px 9px', borderRadius: '6px', border: '1px solid #fde68a' }}>📌 {note}</span>
            : <span style={{ fontSize: '11px', color: '#d1d5db' }}>메모 없음</span>
          }
          <button onClick={() => { setEditing(true); setTimeout(() => ref.current?.focus(), 30) }}
            style={{ fontSize: '11px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Noto Sans KR, sans-serif' }}>
            {note ? '편집' : '+ 메모'}
          </button>
          {note && <button onClick={() => { onSave('') }} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>삭제</button>}
        </div>
      )}
    </div>
  )
}

// ─── 미래 수업 → 명단 패널
function RosterPanel({ cls, date, students }) {
  const session = getSession(cls, date)
  const d = new Date(date + 'T00:00:00')
  const dayLabel = DAYS_KO[d.getDay()]

  // 수업 레벨 메모
  const [notes, setNotes] = useState(() => Notes.byTeacherDate(cls.teacherId, date + '_' + cls.id))
  const [newNote, setNewNote] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef()

  const addNote = () => {
    if (!newNote.trim()) return
    Notes.insert({ id: uid(), teacherId: cls.teacherId, date: date + '_' + cls.id, content: newNote.trim(), createdAt: now() })
    setNotes(Notes.byTeacherDate(cls.teacherId, date + '_' + cls.id))
    setNewNote(''); setAdding(false)
  }

  const delNote = (id) => { Notes.delete(id); setNotes(Notes.byTeacherDate(cls.teacherId, date + '_' + cls.id)) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 헤더 */}
      <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg,#f0fdf4,#fff)', borderRadius: '12px', border: '1.5px solid #86efac' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>
          {date} ({dayLabel}요일)
          {session ? <span style={{ marginLeft: '10px', fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>{session}차시 예정</span> : null}
        </div>
        <div style={{ fontSize: '13px', color: C.muted, marginTop: '3px' }}>
          {cls.organization} · {cls.className}{cls.section ? ' '+cls.section+'반' : ''} · 수강생 {students.length}명
        </div>
      </div>

      {/* 수업 준비 메모 */}
      <div style={{ background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>📝 수업 준비 메모</span>
          <button onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 30) }}
            style={{ padding: '3px 10px', borderRadius: '6px', border: '1.5px solid #fbbf24', background: '#fff', color: '#b45309', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>+ 추가</button>
        </div>
        <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {notes.length === 0 && !adding && (
            <div style={{ fontSize: '13px', color: C.muted, textAlign: 'center', padding: '12px 0' }}>수업 준비사항을 기록하세요</div>
          )}
          {notes.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#fffbeb', borderRadius: '7px', border: '1px solid #fde68a', fontSize: '13px', color: '#374151' }}>
              <span>📌 {n.content}</span>
              <button onClick={() => delNote(n.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>×</button>
            </div>
          ))}
          {adding && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input ref={inputRef} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="예: 교구 준비 / 배터리 충전"
                onKeyDown={e => { if (e.key === 'Enter') addNote(); if (e.key === 'Escape') { setAdding(false); setNewNote('') } }}
                style={{ flex: 1, border: `1.5px solid ${C.primary}`, borderRadius: '7px', padding: '7px 11px', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }} />
              <button onClick={addNote} style={smBtn('#f97316','#fff')}>저장</button>
              <button onClick={() => { setAdding(false); setNewNote('') }} style={smBtn('#f3f4f6','#374151')}>취소</button>
            </div>
          )}
        </div>
      </div>

      {/* 명단 */}
      <div style={{ background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '11px 16px', background: '#f9fafb', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>📋 수강생 명단 ({students.length}명)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {students.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: i < students.length-1 ? `1px solid #f3f4f6` : 'none', background: i%2===0?'#fff':'#fafafa' }}>
              <div style={{ fontSize: '12px', color: C.muted, minWidth: '22px', textAlign: 'center' }}>{s.number || i+1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: C.muted }}>{s.grade}{s.classNum ? ' '+s.classNum+'반' : ''}</div>
              </div>
              {s.memo && (
                <div style={{ fontSize: '11px', color: '#92400e', background: '#fffbeb', padding: '3px 8px', borderRadius: '5px', border: '1px solid #fde68a', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  👤 {s.memo}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function smBtn(bg, color) {
  return { padding: '5px 10px', borderRadius: '6px', border: 'none', background: bg, color, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }
}
function actionBtn(bg, color, border) {
  return { padding: '6px 14px', borderRadius: '8px', border: `1.5px solid ${border}`, background: bg, color, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }
}

// ─── 메인 출석체크 페이지
export function Attendance({ user, pageParams = {} }) {
  const today = todayStr()
  const now_ = new Date()

  const allClasses = ClassesDB.byTeacher(user.id)

  // 학교 목록
  const schools = [...new Set(allClasses.map(c => c.organization).filter(Boolean))]

  // ── 선택 상태 (pageParams로 초기화)
  const [selSchool, setSelSchool] = useState(() => {
    if (pageParams.classId) {
      const cls = allClasses.find(c => c.id === pageParams.classId)
      return cls?.organization || (schools[0] || '')
    }
    return schools[0] || ''
  })

  const [selClassId, setSelClassId] = useState(() => pageParams.classId || '')

  const [selDate, setSelDate] = useState(() => pageParams.date || today)

  const [calYear, setCalYear] = useState(() => {
    const d = pageParams.date ? new Date(pageParams.date + 'T00:00:00') : now_
    return d.getFullYear()
  })
  const [calMonth, setCalMonth] = useState(() => {
    const d = pageParams.date ? new Date(pageParams.date + 'T00:00:00') : now_
    return d.getMonth()
  })

  // 선택된 학교의 수업 목록
  const schoolClasses = allClasses.filter(c => !selSchool || c.organization === selSchool)

  // 선택된 수업
  const selClass = allClasses.find(c => c.id === selClassId)

  // 선택된 수업의 세션 날짜
  const sessionDates = selClass ? calcSessionDates(selClass) : []

  // 학교 변경 시 첫 수업 자동 선택
  const handleSchoolChange = (school) => {
    setSelSchool(school)
    const first = allClasses.find(c => c.organization === school)
    setSelClassId(first?.id || '')
    setSelDate(today)
  }

  // 날짜 선택 시 달력 월도 맞춤
  const handleSelectDate = (date) => {
    setSelDate(date)
    const d = new Date(date + 'T00:00:00')
    setCalYear(d.getFullYear())
    setCalMonth(d.getMonth())
  }

  const prevMonth = () => { if (calMonth===0){setCalYear(y=>y-1);setCalMonth(11)}else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth===11){setCalYear(y=>y+1);setCalMonth(0)}else setCalMonth(m=>m+1) }
  const goToday = () => { const d=new Date(); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); setSelDate(today) }

  // 확정 학생
  const students = selClassId ? StudentsDB.confirmed(selClassId) : []

  // 선택 날짜가 수업일인지
  const isSessionDate = sessionDates.includes(selDate)
  const isPast = selDate <= today

  // 이달 수업 요약
  const monthSessions = sessionDates.filter(d => d.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`))

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>출석체크</div>

      {/* 수업 선택 바 */}
      <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, padding: '16px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* 학교 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted }}>학교</label>
          <select value={selSchool} onChange={e => handleSchoolChange(e.target.value)} style={selSt}>
            <option value="">전체</option>
            {schools.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* 수업 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: C.muted }}>수업</label>
          <select value={selClassId} onChange={e => { setSelClassId(e.target.value); setSelDate(today) }} style={selSt}>
            <option value="">-- 선택 --</option>
            {schoolClasses.map(c => (
              <option key={c.id} value={c.id}>{c.className}{c.section ? ' '+c.section+'반' : ''}</option>
            ))}
          </select>
        </div>

        {selClass && (
          <div style={{ fontSize: '13px', color: C.muted, marginBottom: '4px' }}>
            📅 {selClass.startDate} ~ {selClass.endDate} &nbsp;·&nbsp; 총 {sessionDates.length}차시
          </div>
        )}
      </div>

      {!selClassId ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: C.muted }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>✅</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>학교와 수업을 선택하세요</div>
        </div>
      ) : (
        /* 달력 + 출석 패널 */
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

          {/* ── 달력 */}
          <div style={{ background: C.card, borderRadius: '16px', border: `1px solid ${C.border}`, padding: '20px', position: 'sticky', top: '24px' }}>
            <AttCalendar
              year={calYear} month={calMonth}
              selectedDate={selDate}
              sessionDates={sessionDates}
              onSelect={handleSelectDate}
              onPrevMonth={prevMonth} onNextMonth={nextMonth} onToday={goToday}
            />

            {/* 이달 수업 요약 */}
            <div style={{ marginTop: '14px', padding: '12px 14px', background: '#fff7ed', borderRadius: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>이달 수업 {monthSessions.length}회</div>
              {monthSessions.slice(0, 6).map((d, i) => {
                const recs = AttendanceDB.byClassDate(selClassId, d)
                const done = recs.filter(r => r.status !== 'pending').length
                const isPast_ = d <= today
                return (
                  <div key={d} onClick={() => handleSelectDate(d)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '4px', cursor: 'pointer', padding: '3px 5px', borderRadius: '5px', background: selDate === d ? '#fff7ed' : 'transparent', border: selDate === d ? `1px solid #fed7aa` : '1px solid transparent' }}>
                    <span style={{ color: '#374151' }}>{d.slice(5)} ({DAYS_KO[new Date(d+'T00:00:00').getDay()]})</span>
                    <span style={{ color: isPast_ ? (done > 0 ? '#16a34a' : C.muted) : C.primary, fontWeight: 600 }}>
                      {isPast_ ? (done > 0 ? `${done}명` : '미처리') : '예정'}
                    </span>
                  </div>
                )
              })}
              {monthSessions.length > 6 && <div style={{ fontSize: '11px', color: C.muted, textAlign: 'center' }}>외 {monthSessions.length-6}개</div>}
            </div>
          </div>

          {/* ── 오른쪽 패널 */}
          <div>
            {!isSessionDate ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, color: C.muted }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🗓️</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>수업이 없는 날입니다</div>
                <div style={{ fontSize: '13px', marginTop: '6px' }}>달력에서 수업일(점 표시된 날)을 선택하세요</div>
              </div>
            ) : students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, color: C.muted }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>👥</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>확정된 학생이 없습니다</div>
                <div style={{ fontSize: '13px', marginTop: '6px' }}>학생 관리에서 최종 확정 처리를 먼저 하세요</div>
              </div>
            ) : isPast ? (
              <AttendancePanel cls={selClass} date={selDate} students={students} user={user} key={selDate+selClassId} />
            ) : (
              <RosterPanel cls={selClass} date={selDate} students={students} key={selDate+selClassId} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const selSt = {
  padding: '8px 12px', borderRadius: '9px', border: '1.5px solid #e5e7eb',
  fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif',
  background: '#fff', color: '#111827', cursor: 'pointer', outline: 'none', minWidth: '160px',
}
