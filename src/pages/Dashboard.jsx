import React, { useState, useEffect, useRef } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB, Notes, SupplyItems, SupplyProducts, SupplyStudentProgress, SupplySessionChecks } from '../lib/db.js'
import { calcSessionDates, sortClasses, uid, now, getSessionInfo } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
}

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

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
  const { success } = useToast()

  const [supplyItems,    setSupplyItems]    = useState([])
  const [supplyProducts, setSupplyProducts] = useState([])
  const [supplyProgress, setSupplyProgress] = useState([])
  const [supplyChecks,   setSupplyChecks]   = useState([])

  useEffect(() => {
    setNotes(Notes.byTeacherDate(user.id, date))
    setNewNote(''); setAddingNote(false)
    setSupplyItems(SupplyItems.byTeacher(user.id))
    setSupplyProducts(SupplyProducts.byTeacher(user.id))
    setSupplyProgress(SupplyStudentProgress.byTeacher(user.id))
    setSupplyChecks(SupplySessionChecks.byTeacher(user.id))
  }, [date, user.id])

  const dayClasses = sortClasses(classes.filter(cls => calcSessionDates(cls).includes(date)))

  const addNote = () => {
    if (!newNote.trim()) return
    Notes.insert({ id: uid(), teacherId: user.id, date, content: newNote.trim(), createdAt: now() })
    setNotes(Notes.byTeacherDate(user.id, date))
    setNewNote(''); setAddingNote(false)
    success('등록이 완료되었습니다.')
  }

  const deleteNote = (id) => { Notes.delete(id); setNotes(Notes.byTeacherDate(user.id, date)) }
  const editNote = (id, content) => { Notes.update(id, { content }); setNotes(Notes.byTeacherDate(user.id, date)); success('수정이 완료되었습니다.') }

  const schools = {}
  dayClasses.forEach(cls => { if (!schools[cls.organization]) schools[cls.organization] = []; schools[cls.organization].push(cls) })
  Object.keys(schools).forEach(k => { schools[k] = sortClasses(schools[k]) })

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
              const sessInfo = getSessionInfo(cls, date)
              const TERM_COLORS = [
                { bg:'#fff7ed', border:'#f97316', text:'#ea580c' },
                { bg:'#f0fdf4', border:'#16a34a', text:'#15803d' },
                { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
                { bg:'#fdf4ff', border:'#a855f7', text:'#7e22ce' },
              ]
              const tc = sessInfo ? (TERM_COLORS[(sessInfo.termNum-1) % TERM_COLORS.length]) : null
              const startTime = cls.time || ''; const endTime = cls.timeEnd || ''

              // 진도 헬퍼 — classId 기준으로 정확하게 필터
              const getProgress = (studentId) => {
                const item = supplyItems.find(i => i.studentId === studentId && i.classId === cls.id)
                if (!item?.productId) return null
                const prod = supplyProducts.find(p => p.id === item.productId)
                const prog = supplyProgress.find(p => p.studentId === studentId && p.productId === item.productId)
                const curStage = prog?.curStage || item.stage || 1
                const spp = prod?.sessionsPerStage || 12
                const checked = supplyChecks.filter(c => c.studentId === studentId && c.productId === item.productId && c.stage === curStage).length
                const pct = Math.min(Math.round(checked / spp * 100), 100)
                return { name: prod?.name || item.name || '', curStage, checked, spp, pct }
              }


              const ATT_CFG = {
                present: { label:'출석', color:'#16a34a', bg:'#f0fdf4' },
                late:    { label:'지각', color:'#d97706', bg:'#fffbeb' },
                leave:   { label:'조퇴', color:'#7c3aed', bg:'#f5f3ff' },
                absent:  { label:'결석', color:'#dc2626', bg:'#fef2f2' },
                pending: { label:'미처리', color:'#9ca3af', bg:'#f9fafb' },
              }

              return (
                <div key={cls.id} style={{ borderRadius: '10px', border: '1px solid #fed7aa', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#fff7ed', gap: '12px', flexWrap: 'wrap' }}>
                  {/* 수업 정보 */}
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>수업 과목 · {cls.className}</span>
                      {cls.section && (
                        <span style={{ fontSize: '12px', background: C.primary, color: '#fff', borderRadius: '6px', padding: '1px 8px', fontWeight: 600 }}>{cls.section}반</span>
                      )}
                      {sessInfo && (
                        <>
                          <span style={{ fontSize: '11px', color: C.muted, background: '#f3f4f6', padding: '1px 7px', borderRadius: '5px' }}>{sessInfo.total}차시</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: tc?.text, background: tc?.bg, border: `1px solid ${tc?.border}`, padding: '1px 7px', borderRadius: '5px' }}>
                            {sessInfo.termNum}텀 {sessInfo.termSess}차시
                          </span>
                        </>
                      )}
                    </div>
                    {startTime && (
                      <div style={{ fontSize: '12px', color: C.muted }}>🕐 {startTime}{endTime ? ` ~ ${endTime}` : ''}</div>
                    )}
                    {/* 교구 현황 */}
                    {(() => {
                      const supplyData = SupplyItems.byClass(cls.id)
                      if (!supplyData.length) return null
                      const set = supplyData.filter(item => item.name)
                      const notSet = students.filter(s => !supplyData.find(item => item.studentId === s.id && item.name))
                      return (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {set.length > 0 && (
                            <span style={{ fontSize: '11px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: '5px', padding: '1px 8px' }}>
                              🎒 교구 {set.length}명 설정
                            </span>
                          )}
                          {notSet.length > 0 && (
                            <span style={{ fontSize: '11px', background: '#fef2f2', color: C.danger, border: '1px solid #fca5a5', borderRadius: '5px', padding: '1px 8px' }}>
                              ⚠️ 미설정 {notSet.length}명
                            </span>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* 학생수 + 출석현황 + 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>{students.length}명</div>
                      <div style={{ fontSize: '11px', color: presentCnt > 0 ? C.success : C.muted }}>출석 {presentCnt}명</div>
                    </div>
                    <button onClick={() => onNav('attendance', { classId: cls.id, date })}
                      style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: 700, fontSize: '13px', transition: 'all .15s',
                        background: pendingCnt > 0 ? C.primary : C.success, color: '#fff',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <span>✅ 출석부</span>
                      {pendingCnt > 0 && <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85 }}>미처리 {pendingCnt}명</span>}
                    </button>
                  </div>
                </div>

                {/* 학생별 출석 + 진도 테이블 */}
                {students.length > 0 && (
                  <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff' }}>
                    <thead>
                      <tr style={{ background:'#f9fafb', borderTop:'1px solid #f3f4f6' }}>
                        {['순번','학년·반·번호','이름','학부모전화','출석·지각·조퇴·결석','진도','특이사항·메모'].map(h => (
                          <th key={h} style={{ padding:'7px 12px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#9ca3af', whiteSpace:'nowrap', borderBottom:'1px solid #f3f4f6' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((stu, idx) => {
                        const attRec = attRecords.find(a => a.studentId === stu.id)
                        const attStatus = attRec?.status || 'pending'
                        const attCfg = ATT_CFG[attStatus] || ATT_CFG.pending
                        const prog = getProgress(stu.id)
                        const hasBadges = stu.remark || (stu.student_careers?.length > 0) || stu.status === 'cancel_before' || stu.status === 'cancel_after' || (stu.relations||[]).length > 0
                        return (
                          <tr key={stu.id} style={{ borderBottom:'1px solid #f3f4f6', background: idx%2===0?'#fff':'#fafafa' }}>
                            <td style={{ padding:'9px 12px', fontSize:'12px', color:'#9ca3af', textAlign:'center', whiteSpace:'nowrap' }}>
                              {stu.applyOrder ? <span style={{ fontWeight:700, color:'#f97316' }}>{stu.applyOrder}</span> : <span>{idx+1}</span>}
                            </td>
                            <td style={{ padding:'9px 12px', fontSize:'12px', color:'#374151', whiteSpace:'nowrap' }}>
                              {stu.grade ? stu.grade+'학년' : '-'}
                              {stu.classNum && <span style={{ marginLeft:'3px', padding:'1px 5px', borderRadius:'4px', background:'#f0fdf4', color:'#16a34a', fontWeight:600, fontSize:'11px' }}>{stu.classNum}반</span>}
                              {stu.number && <span style={{ marginLeft:'3px', color:'#9ca3af', fontSize:'11px' }}>{stu.number}번</span>}
                            </td>
                            <td style={{ padding:'9px 12px', fontSize:'13px', fontWeight:700, color:'#111827' }}>
                              <div>{stu.name}</div>
                              {hasBadges && (
                                <div style={{ display:'flex', gap:'3px', flexWrap:'wrap', marginTop:'4px' }}>
                                  {stu.remark && <span style={{ fontSize:'10px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 5px', fontWeight:600 }}>{stu.remark}</span>}
                                  {(stu.student_careers?.length > 0) && (
                                    <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px',
                                      background: stu.student_careers.length<=1?'#eff6ff':'#f0fdf4',
                                      border: `1px solid ${stu.student_careers.length<=1?'#bfdbfe':'#86efac'}`,
                                      color: stu.student_careers.length<=1?'#1d4ed8':'#15803d' }}>
                                      {stu.student_careers.length<=1?'신규':'기존'}
                                    </span>
                                  )}
                                  {(stu.status==='cancel_before'||stu.status==='cancel_after') && (
                                    <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626' }}>
                                      {stu.status==='cancel_after'?'개강후 취소':'개강전 취소'}
                                    </span>
                                  )}
                                  {(stu.relations||[]).map((r,ri) => (
                                    <span key={ri} style={{ fontSize:'10px', fontWeight:600, padding:'1px 5px', borderRadius:'4px',
                                      background: r.type==='쌍둥이'?'#fdf4ff':r.type==='형제'?'#eff6ff':r.type==='남매'?'#f0fdf4':'#fff7ed',
                                      border: `1px solid ${r.type==='쌍둥이'?'#e9d5ff':r.type==='형제'?'#bfdbfe':r.type==='남매'?'#86efac':'#fed7aa'}`,
                                      color: r.type==='쌍둥이'?'#7e22ce':r.type==='형제'?'#1d4ed8':r.type==='남매'?'#15803d':'#c2410c' }}>
                                      {r.type}{r.with?` · ${r.with}`:''}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td style={{ padding:'9px 12px', fontSize:'12px', color:'#6b7280', whiteSpace:'nowrap' }}>
                              {stu.parentPhone ? stu.parentPhone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') : '-'}
                            </td>
                            <td style={{ padding:'9px 12px', whiteSpace:'nowrap' }}>
                              <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'5px',
                                background:attCfg.bg, color:attCfg.color, border:`1px solid ${attCfg.color}40` }}>
                                {attCfg.label}
                              </span>
                            </td>
                            <td style={{ padding:'9px 12px', whiteSpace:'nowrap' }}>
                              {prog ? (
                                <div style={{ fontSize:'11px', minWidth:'70px' }}>
                                  <div style={{ fontWeight:600, color:'#374151' }}>{prog.name}</div>
                                  <div style={{ color:'#6b7280', marginTop:'1px' }}>{prog.curStage}단계 {prog.checked}/{prog.spp}차시</div>
                                  <div style={{ height:'3px', background:'#e5e7eb', borderRadius:'2px', marginTop:'3px', width:'70px' }}>
                                    <div style={{ height:'100%', borderRadius:'2px', width:`${prog.pct}%`,
                                      background: prog.pct>=100?'#16a34a':prog.pct>=80?'#f59e0b':'#f97316' }} />
                                  </div>
                                </div>
                              ) : <span style={{ fontSize:'11px', color:'#d1d5db' }}>-</span>}
                            </td>
                            <td style={{ padding:'9px 12px', maxWidth:'160px' }}>
                              {attRec?.note
                                ? <span style={{ fontSize:'11px', color:'#374151', background:'#fffbeb', padding:'2px 6px', borderRadius:'5px', border:'1px solid #fde68a', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📌 {attRec.note}</span>
                                : <span style={{ fontSize:'11px', color:'#d1d5db' }}>-</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
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

  const classes = sortClasses(ClassesDB.byTeacher(user.id))
  const classDates = new Set()
  // calcSessionDates가 makeupDates 포함 → 보강일도 달력에 표시
  classes.forEach(cls => calcSessionDates(cls).forEach(s => classDates.add(s)))

  // 교구 준비 알림 — 이번주 수업 기준 미설정 학생 있는 수업
  const todayDate = new Date()
  const weekEnd = new Date(todayDate); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0,10)
  const supplyAlerts = classes.flatMap(cls => {
    const upcoming = calcSessionDates(cls).filter(d => d >= today && d <= weekEndStr)
    if (!upcoming.length) return []
    const confirmed = StudentsDB.confirmed(cls.id)
    if (!confirmed.length) return []
    const supplyData = SupplyItems.byClass(cls.id)
    const notSet = confirmed.filter(s => !supplyData.find(item => item.studentId === s.id && item.name))
    return notSet.length > 0 ? [{ cls, nextDate: upcoming[0], notSetCount: notSet.length, total: confirmed.length }] : []
  })

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11) } else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0) } else setCalMonth(m=>m+1) }
  const goToday = () => { const t = new Date(); setCalYear(t.getFullYear()); setCalMonth(t.getMonth()); setSelectedDate(today) }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* 인사 + 날씨 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>안녕하세요, {(user.displayNameMode === 'nickname' && user.nickname) ? user.nickname : user.name} 선생님 👋</h1>
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

      {/* 교구 준비 알림 */}
      {supplyAlerts.length > 0 && (
        <div style={{ background: '#fef2f2', borderRadius: '12px', border: '1.5px solid #fca5a5', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: C.danger }}>교구 준비 필요 — 이번주 수업</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {supplyAlerts.map(({ cls, nextDate, notSetCount, total }) => (
              <div key={cls.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #fca5a5', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '13px', color: C.text }}>
                  <span style={{ fontWeight: 700 }}>{cls.organization}</span>
                  <span style={{ color: C.muted }}> · {cls.className}{cls.section ? ' ' + cls.section + '반' : ''}</span>
                  <span style={{ fontSize: '12px', color: C.muted, marginLeft: '6px' }}>📅 {nextDate}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: C.danger, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '2px 8px', whiteSpace: 'nowrap' }}>
                  🎒 교구 미설정 {notSetCount}/{total}명
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
