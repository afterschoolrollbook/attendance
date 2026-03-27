import React, { useState, useEffect, useRef } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB, Notes } from '../lib/db.js'
import { calcSessionDates, uid, now } from '../lib/utils.js'

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

function formatDateKo(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear() % 100}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${DAYS_KO[d.getDay()]}요일`
}

function weatherIcon(code) {
  if (code === 0)  return { icon: '☀️', text: '맑음' }
  if (code <= 2)   return { icon: '🌤️', text: '구름 조금' }
  if (code <= 3)   return { icon: '☁️', text: '흐림' }
  if (code <= 49)  return { icon: '🌫️', text: '안개' }
  if (code <= 59)  return { icon: '🌦️', text: '이슬비' }
  if (code <= 69)  return { icon: '🌧️', text: '비' }
  if (code <= 79)  return { icon: '❄️', text: '눈' }
  if (code <= 82)  return { icon: '🌧️', text: '소나기' }
  return { icon: '⛈️', text: '뇌우' }
}

function useWeather() {
  const [w, setW] = useState(null)
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=37.39&longitude=126.95&current=temperature_2m,weathercode,windspeed_10m&timezone=Asia%2FSeoul')
      .then(r => r.json())
      .then(d => setW({ temp: Math.round(d.current.temperature_2m), code: d.current.weathercode, wind: Math.round(d.current.windspeed_10m) }))
      .catch(() => setW(null))
  }, [])
  return w
}

function smBtn(bg, color) {
  return { padding: '3px 8px', borderRadius: '5px', border: 'none', background: bg, color, fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }
}

function NoteItem({ note, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.content)
  const save = () => { onEdit(note.id, text); setEditing(false) }
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
      <span style={{ fontSize: '14px', marginTop: '1px' }}>📌</span>
      {editing ? (
        <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
          <input value={text} onChange={e => setText(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            style={{ flex: 1, border: '1.5px solid #f97316', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }} />
          <button onClick={save} style={smBtn('#f97316','#fff')}>저장</button>
          <button onClick={() => setEditing(false)} style={smBtn('#e5e7eb','#374151')}>취소</button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>{note.content}</span>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={smBtn('#f3f4f6','#6b7280')}>편집</button>
            <button onClick={() => onDelete(note.id)} style={smBtn('#fef2f2','#ef4444')}>삭제</button>
          </div>
        </div>
      )}
    </div>
  )
}

function MonthCalendar({ year, month, selectedDate, classDates, onSelectDate }) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = todayStr()
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
        {DAYS_KO.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, padding: '4px 0', color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = dateStr === today
          const isSel = dateStr === selectedDate
          const hasCls = classDates.has(dateStr)
          const isSun = (firstDay + day - 1) % 7 === 0
          const isSat = (firstDay + day - 1) % 7 === 6
          return (
            <button key={day} onClick={() => onSelectDate(dateStr)} style={{
              position: 'relative', padding: '6px 2px', border: 'none', borderRadius: '8px',
              background: isSel ? C.primary : isToday ? '#fff7ed' : 'transparent',
              color: isSel ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : C.text,
              fontWeight: isToday || isSel ? 700 : 400, fontSize: '13px', cursor: 'pointer', textAlign: 'center',
              outline: isToday && !isSel ? `2px solid ${C.primary}` : 'none', outlineOffset: '-2px',
              transition: 'all .15s', fontFamily: 'Noto Sans KR, sans-serif',
            }}>
              {day}
              {hasCls && <span style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', width: '5px', height: '5px', borderRadius: '50%', background: isSel ? '#fff' : C.primary, display: 'block' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DayDetail({ date, user, classes, onNav }) {
  const [notes, setNotes] = useState(() => Notes.byTeacherDate(user.id, date))
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    setNotes(Notes.byTeacherDate(user.id, date))
    setNewNote(''); setAddingNote(false)
  }, [date, user.id])

  const dayClasses = classes.filter(cls => calcSessionDates(cls).includes(date))

  const addNote = () => {
    if (!newNote.trim()) return
    Notes.insert({ id: uid(), teacherId: user.id, date, content: newNote.trim(), createdAt: now() })
    setNotes(Notes.byTeacherDate(user.id, date))
    setNewNote(''); setAddingNote(false)
  }

  const deleteNote = (id) => { Notes.delete(id); setNotes(Notes.byTeacherDate(user.id, date)) }
  const editNote = (id, content) => { Notes.update(id, { content }); setNotes(Notes.byTeacherDate(user.id, date)) }

  const schools = {}
  dayClasses.forEach(cls => { if (!schools[cls.organization]) schools[cls.organization] = []; schools[cls.organization].push(cls) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* 날짜 헤더 */}
      <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #fff7ed 0%, #fff 100%)', borderRadius: '14px', border: '1.5px solid #fed7aa' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>{formatDateKo(date)}</div>
        <div style={{ fontSize: '13px', marginTop: '4px', color: dayClasses.length ? C.primary : C.muted, fontWeight: dayClasses.length ? 600 : 400 }}>
          {dayClasses.length ? `수업 ${dayClasses.length}개` : '수업이 없는 날입니다'}
        </div>
      </div>

      {/* 학교별 수업 */}
      {Object.entries(schools).map(([school, schoolClasses]) => (
        <div key={school} style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {/* 학교 헤더 */}
          <div style={{ padding: '13px 18px', background: '#f9fafb', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏫</span>
              <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{school}</span>
              <span style={{ fontSize: '12px', color: C.muted }}>수업 장소</span>
            </div>
            <a href={`https://map.naver.com/v5/search/${encodeURIComponent(school)}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '9px', background: '#f0fdf4', border: '1.5px solid #86efac', color: '#16a34a', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              🗺️ 네비게이션
            </a>
          </div>

          {/* 수업 목록 */}
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {schoolClasses.map(cls => {
              const students = StudentsDB.confirmed(cls.id)
              const attRecords = AttendanceDB.byClassDate(cls.id, date)
              const presentCnt = attRecords.filter(a => a.status === 'present' || a.status === 'late').length
              const doneCnt = attRecords.filter(a => a.status !== 'pending').length
              const pendingCnt = students.length - doneCnt
              const sessions = calcSessionDates(cls)
              const session = sessions.indexOf(date) + 1

              return (
                <div key={cls.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: '#fff7ed', border: '1px solid #fed7aa', gap: '12px', flexWrap: 'wrap' }}>
                  {/* 수업 정보 */}
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>수업 과목 · {cls.className}</span>
                      {cls.section && (
                        <span style={{ fontSize: '12px', background: C.primary, color: '#fff', borderRadius: '6px', padding: '1px 8px', fontWeight: 600 }}>{cls.section}반</span>
                      )}
                      {session > 0 && <span style={{ fontSize: '11px', color: C.muted, background: '#f3f4f6', padding: '1px 7px', borderRadius: '5px' }}>{session}차시</span>}
                    </div>
                    {cls.time && (
                      <div style={{ fontSize: '12px', color: C.muted }}>🕐 {cls.time}</div>
                    )}
                  </div>

                  {/* 학생수 + 출석현황 + 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>{students.length}명</div>
                      <div style={{ fontSize: '11px', color: presentCnt > 0 ? C.success : C.muted }}>출석 {presentCnt}명</div>
                    </div>
                    <button onClick={() => onNav('attendance')}
                      style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '13px', transition: 'all .15s',
                        background: pendingCnt > 0 ? C.primary : C.success, color: '#fff',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <span>✅ 출석부</span>
                      {pendingCnt > 0 && <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85 }}>미처리 {pendingCnt}명</span>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* 특이사항 메모 */}
      <div style={{ background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <div style={{ padding: '13px 18px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📝</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#92400e' }}>특이사항 메모</span>
          </div>
          <button onClick={() => { setAddingNote(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            style={{ padding: '5px 12px', borderRadius: '8px', border: '1.5px solid #fbbf24', background: '#fff', color: '#b45309', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            + 추가
          </button>
        </div>
        <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notes.length === 0 && !addingNote && (
            <div style={{ fontSize: '13px', color: C.muted, textAlign: 'center', padding: '16px 0' }}>오늘의 특이사항을 기록하세요</div>
          )}
          {notes.map(note => <NoteItem key={note.id} note={note} onDelete={deleteNote} onEdit={editNote} />)}
          {addingNote && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <input ref={inputRef} value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="예: 홍길동 로봇교구 준비 / 배터리 안내"
                onKeyDown={e => { if (e.key === 'Enter') addNote(); if (e.key === 'Escape') { setAddingNote(false); setNewNote('') } }}
                style={{ flex: 1, border: '1.5px solid #f97316', borderRadius: '8px', padding: '9px 13px', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }} />
              <button onClick={addNote} style={{ padding: '9px 16px', borderRadius: '8px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>저장</button>
              <button onClick={() => { setAddingNote(false); setNewNote('') }}
                style={{ padding: '9px 13px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', color: C.muted, fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>취소</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Dashboard({ user, onNav }) {
  const today = todayStr()
  const d = new Date()
  const [calYear, setCalYear] = useState(d.getFullYear())
  const [calMonth, setCalMonth] = useState(d.getMonth())
  const [selectedDate, setSelectedDate] = useState(today)
  const weather = useWeather()

  const classes = ClassesDB.byTeacher(user.id)
  const classDates = new Set()
  classes.forEach(cls => calcSessionDates(cls).forEach(s => classDates.add(s)))

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11) } else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0) } else setCalMonth(m=>m+1) }
  const goToday = () => { const t = new Date(); setCalYear(t.getFullYear()); setCalMonth(t.getMonth()); setSelectedDate(today) }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 인사 + 날씨 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>안녕하세요, {user.name} 선생님 👋</h1>
          <div style={{ fontSize: '14px', color: C.muted, marginTop: '4px' }}>{formatDateKo(today)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 22px', background: '#fff', borderRadius: '14px', border: `1px solid ${C.border}`, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          {weather ? (
            <>
              <span style={{ fontSize: '34px' }}>{weatherIcon(weather.code).icon}</span>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: C.text }}>{weather.temp}°C</div>
                <div style={{ fontSize: '12px', color: C.muted }}>{weatherIcon(weather.code).text} · 바람 {weather.wind}km/h</div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '13px', color: C.muted }}>날씨 불러오는 중...</div>
          )}
        </div>
      </div>

      {/* 달력 + 상세 */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* 달력 */}
        <div style={{ background: '#fff', borderRadius: '16px', border: `1px solid ${C.border}`, padding: '20px', position: 'sticky', top: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button onClick={prevMonth} style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>{calYear}년 {MONTHS[calMonth]}</span>
              <button onClick={goToday} style={{ padding: '3px 10px', borderRadius: '7px', border: `1px solid ${C.primary}`, background: '#fff7ed', color: C.primary, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>오늘</button>
            </div>
            <button onClick={nextMonth} style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>

          <MonthCalendar year={calYear} month={calMonth} selectedDate={selectedDate} classDates={classDates} onSelectDate={setSelectedDate} />

          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '14px', fontSize: '11px', color: C.muted }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.primary, display: 'inline-block' }} /> 수업 있는 날
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '14px', height: '14px', borderRadius: '5px', border: `2px solid ${C.primary}`, display: 'inline-block' }} /> 오늘
            </div>
          </div>

          {/* 이달 수업 요약 */}
          <div style={{ marginTop: '14px', padding: '12px 14px', background: '#fff7ed', borderRadius: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>이달의 수업 요약</div>
            {classes.length === 0
              ? <div style={{ fontSize: '12px', color: C.muted }}>등록된 수업이 없습니다</div>
              : classes.map(cls => {
                  const monthDates = calcSessionDates(cls).filter(s => s.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`))
                  if (!monthDates.length) return null
                  return (
                    <div key={cls.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: '#374151' }}>{cls.className}{cls.section ? ' ' + cls.section + '반' : ''}</span>
                      <span style={{ color: C.primary, fontWeight: 700 }}>{monthDates.length}회</span>
                    </div>
                  )
                })
            }
          </div>
        </div>

        {/* 날짜 상세 */}
        <DayDetail date={selectedDate} user={user} classes={classes} onNav={onNav} />
      </div>
    </div>
  )
}
