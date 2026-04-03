import React, { useState, useEffect, useRef } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB, Notes, SupplyItems } from '../lib/db.js'
import { uid, now, calcSessionDates, sortClasses, getSession, getSessionInfo, fmtPhone } from '../lib/utils.js'
import { ATTENDANCE_STATUS, HOME_RETURN_TYPES } from '../constants/config.js'
import { Modal } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

// 결석 사유 (출석체크용 확장)
const ABSENT_REASONS = [
  { value: '',           label: '사유 없음' },
  { value: 'sick',       label: '질병' },
  { value: 'field_trip', label: '현장학습' },
  { value: 'exp_trip',   label: '체험학습' },
  { value: 'condolence', label: '경조사' },
  { value: 'personal',   label: '개인사유' },
  { value: 'unexcused',  label: '무단' },
  { value: 'infection',  label: '법정감염병' },
  { value: 'etc',        label: '기타' },
]

const DAYS_KO = ['일','월','화','수','목','금','토']
const MONTHS  = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function formatDateKo(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear() % 100}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${DAYS_KO[d.getDay()]}요일`
}

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
  warning: '#f59e0b',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── 달력
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button onClick={onPrevMonth} style={navBtn}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>{year}년 {MONTHS[month]}</span>
          <button onClick={onToday} style={{ padding: '2px 9px', borderRadius: '6px', border: `1px solid ${C.primary}`, background: '#fff7ed', color: C.primary, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>오늘</button>
        </div>
        <button onClick={onNextMonth} style={navBtn}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
        {DAYS_KO.map((d, i) => <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, padding: '3px 0', color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>)}
      </div>
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
          // 수업 미선택 시 모든 날짜 클릭 가능, 선택 시 수업일만 활성
          if (!isSession) return (
            <button key={day} onClick={() => onSelect(dateStr)} style={{
              padding: '6px 2px', textAlign: 'center', fontSize: '12px', border: 'none', borderRadius: '6px',
              background: isSel ? '#e5e7eb' : 'transparent',
              color: isSun ? '#fca5a5' : isSat ? '#93c5fd' : '#9ca3af',
              cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
            }}>{day}</button>
          )
          return (
            <button key={day} onClick={() => onSelect(dateStr)} style={{
              position: 'relative', padding: '7px 2px', border: 'none', borderRadius: '8px', cursor: 'pointer',
              background: isSel ? C.primary : isToday ? '#fff7ed' : isPast ? '#f9fafb' : '#f0fdf4',
              color: isSel ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : C.text,
              fontWeight: isSel || isToday ? 700 : 500, fontSize: '13px',
              outline: isToday && !isSel ? `2px solid ${C.primary}` : 'none', outlineOffset: '-2px',
              transition: 'all .12s', fontFamily: 'Noto Sans KR, sans-serif',
            }}>
              {day}
              <span style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', width: '5px', height: '5px', borderRadius: '50%', display: 'block', background: isSel ? '#fff' : isPast ? '#16a34a' : C.primary }} />
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '12px', fontSize: '11px', color: C.muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width:6,height:6,borderRadius:'50%',background:'#16a34a',display:'inline-block' }}/> 지난 수업</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width:6,height:6,borderRadius:'50%',background:C.primary,display:'inline-block' }}/> 예정 수업</span>
      </div>
    </div>
  )
}

const navBtn = { width:'28px',height:'28px',borderRadius:'7px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center' }

// ─── 전화번호 클릭 액션 (문자/전화/카톡)
function PhoneAction({ phone, children }) {
  const [open, setOpen] = useState(false)
  const raw = (phone || '').replace(/[^0-9]/g, '')
  if (!raw) return <span style={{ fontSize:'11px', color:'#9ca3af' }}>-</span>
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <span onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        style={{ fontSize:'11px', color:'#3b82f6', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:'2px' }}>
        {children}
      </span>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:999 }} />
          <div style={{ position:'absolute', top:'100%', left:0, zIndex:1000, background:'#fff', borderRadius:'10px', boxShadow:'0 4px 20px rgba(0,0,0,0.15)', border:'1px solid #e5e7eb', overflow:'hidden', minWidth:'130px', marginTop:'4px' }}>
            <button onClick={() => { window.location.href=`tel:${raw}`; setOpen(false) }}
              style={phoneActionBtn}>📞 전화하기</button>
            <button onClick={() => { window.open(`sms:${raw}`); setOpen(false) }}
              style={phoneActionBtn}>💬 문자 보내기</button>
            <button onClick={() => { window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${raw}`); setOpen(false) }}
              style={phoneActionBtn}>💛 카톡 보내기</button>
          </div>
        </>
      )}
    </div>
  )
}
const phoneActionBtn = { display:'block', width:'100%', padding:'9px 14px', background:'none', border:'none', cursor:'pointer', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', textAlign:'left', color:'#374151', borderBottom:'1px solid #f3f4f6' }

// ─── 학부모 메시지 발송
function MsgModal({ student, onClose }) {
  const { success, toastError } = useToast()
  const [text, setText] = useState('')
  const phone = student.parentPhone?.replace(/[^0-9]/g, '') || ''

  const sendSMS = () => {
    if (!phone) { toastError('학부모 전화번호가 없습니다.'); return }
    window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
    onClose()
  }
  const sendKakao = () => {
    if (!phone) { toastError('학부모 전화번호가 없습니다.'); return }
    window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${phone}&message=${encodeURIComponent(text)}`)
    onClose()
  }
  const copyText = () => {
    navigator.clipboard.writeText(text).then(() => success('메시지가 복사되었습니다.')).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta); success('복사되었습니다.')
    })
  }

  const templates = [
    `안녕하세요. ${student.name} 학부모님. 오늘 수업에 결석하셨습니다. 확인 부탁드립니다.`,
    `안녕하세요. ${student.name} 학부모님. 오늘 수업에 지각하셨습니다.`,
    `안녕하세요. ${student.name} 학부모님. 수업 관련 안내드립니다.`,
  ]

  return (
    <Modal open={true} onClose={onClose} title="📱 학부모 메시지" width={460}>
      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '14px' }}>{student.name} · {fmtPhone(student.parentPhone) || '전화번호 없음'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* 빠른 문구 */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '8px' }}>빠른 문구</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {templates.map((t, i) => (
              <button key={i} onClick={() => setText(t)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#f9fafb', textAlign: 'left', cursor: 'pointer', fontSize: '12px', color: '#374151', fontFamily: 'Noto Sans KR, sans-serif', lineHeight: 1.5 }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {/* 직접 입력 */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '6px' }}>직접 입력</div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="메시지를 입력하세요..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: `1.5px solid ${C.border}`, fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        {/* 발송 버튼 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={sendSMS} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>💬 문자 발송</button>
          <button onClick={sendKakao} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: '#fee500', color: '#3c1e1e', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>💛 카톡 발송</button>
          <button onClick={copyText} style={{ padding: '10px 14px', borderRadius: '9px', border: `1.5px solid ${C.border}`, background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>복사</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── 학생 메모 팝업 (예정 수업 행에서 사용)
function StudentMemoModal({ student, onClose, onSave }) {
  const [text, setText] = useState(student.memo || '')
  const doSave = () => {
    StudentsDB.update(student.id, { memo: text })
    onSave(text)
    onClose()
  }
  return (
    <Modal open={true} onClose={onClose} title={`📌 ${student.name} 메모`} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} autoFocus
          placeholder="메모를 입력하세요..."
          style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: `1.5px solid ${C.border}`, fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={doSave} style={{ flex: 1, padding: '10px', borderRadius: '9px', border: 'none', background: C.primary, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>저장</button>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: '9px', border: `1px solid ${C.border}`, background: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>취소</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── 예정 수업 학생 행 — StudentRow 코드 완전 동일, 출석컬럼만 예정버튼으로 교체
function FutureStudentRow({ s, idx, onMsgOpen, onStudentClick }) {
  const note = s.memo || ''
  const [showInfo, setShowInfo] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  const [memo, setMemo] = useState('')  // s.memo는 👤배지로만 표시, 여기선 별도 메모

  const handlePredictClick = () => {
    setShowInfo(true)
    setTimeout(() => setShowInfo(false), 2500)
  }

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', background: '#fff', borderLeft: '3px solid transparent', transition: 'all .12s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '30px 70px 65px 100px 190px 1fr', gap: '6px', alignItems: 'center', padding: '10px 14px' }}>

        {/* 순번 — StudentRow 동일 */}
        <span style={{ fontSize: '12px', color: C.muted, textAlign: 'center' }}>{idx+1}</span>

        {/* 학년·반·번호 — StudentRow 동일 */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted, lineHeight: 1.4 }}>
          {s.grade ? s.grade+'학년' : ''}{s.classNum ? ' '+s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}
        </div>

        {/* 이름 — StudentRow 동일 */}
        <div style={{ textAlign: 'center' }}>
          <span onClick={() => onStudentClick(s)}
            style={{ fontSize: '14px', fontWeight: 700, color: C.primary, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{s.name}</span>
          {(() => {
            const items = SupplyItems.byClassStudent(s.classIds?.[0] || '', s.id)
            if (!items.length) return null
            return items.map((item, i) => (
              <div key={i} style={{ fontSize: '10px', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '4px', padding: '1px 5px', marginTop: '2px', display: 'inline-block' }}>
                🎒 {item.name}{item.stage ? ` · ${item.stage}` : ''}
              </div>
            ))
          })()}
        </div>

        {/* 학부모 전화 — PhoneAction만 */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <PhoneAction phone={s.parentPhone}>{fmtPhone(s.parentPhone) || '-'}</PhoneAction>
        </div>

        {/* 출석컬럼만 다름: 예정 버튼 */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={handlePredictClick}
            style={{ padding: '4px 6px', borderRadius: '6px', border: '1.5px solid #93c5fd', background: '#eff6ff', color: '#3b82f6', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
            예정
          </button>
          {showInfo && (
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 2000,
              background: 'rgba(30,30,30,0.88)', color: '#fff', borderRadius: '12px', padding: '14px 24px',
              fontSize: '14px', fontWeight: 600, fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>
              🗓️ 아직 수업일이 아닙니다<br/>
              <span style={{ fontSize: '12px', fontWeight: 400, opacity: 0.8 }}>당일부터 출석체크가 가능합니다</span>
            </div>
          )}
        </div>

        {/* 특이사항·메모 — StudentRow NoteInline과 동일 구조 */}
        <div>
          {s.memo && (
            <div style={{ fontSize: '11px', color: '#92400e', background: '#fffbeb', padding: '3px 8px', borderRadius: '5px', marginBottom: '5px', display: 'inline-block' }}>👤 {s.memo}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {memo
              ? <span style={{ fontSize: '12px', color: '#374151', background: '#fffbeb', padding: '3px 9px', borderRadius: '6px', border: '1px solid #fde68a' }}>📌 {memo}</span>
              : <span style={{ fontSize: '11px', color: '#d1d5db' }}>메모 없음</span>
            }
            <button onClick={() => setMemoOpen(true)}
              style={{ fontSize: '11px', color: C.muted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {memo ? '편집' : '+ 메모'}
            </button>
            {memo && (
              <button onClick={() => { setMemo(''); StudentsDB.update(s.id, { memo: '' }) }}
                style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>삭제</button>
            )}
          </div>
        </div>
      </div>

      {memoOpen && (
        <StudentMemoModal student={{ ...s, memo }} onClose={() => setMemoOpen(false)} onSave={v => setMemo(v)} />
      )}
    </div>
  )
}

// ─── 단일 학생 출석 행
function StudentRow({ s, idx, rec, onMark, onMsgOpen, onStudentClick }) {
  const status = rec?.status || 'pending'
  const cfg = ATTENDANCE_STATUS[status]
  const isPending = status === 'pending'
  const absentReason = rec?.absentReason || ''
  const note         = rec?.note         || ''
  const setField = (field, val) => onMark(s.id, status === 'pending' ? 'present' : status, { [field]: val })
  const isAbsent = ['absent','late','early'].includes(status)
  const appendNote = (text) => setField('note', note ? note + ' / ' + text : text)

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', background: isPending ? '#fff' : cfg.bg, borderLeft: `3px solid ${isPending ? 'transparent' : cfg.color}`, transition: 'all .12s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '30px 70px 65px 100px 190px 1fr', gap: '6px', alignItems: 'center', padding: '10px 14px' }}>

        {/* 순번 */}
        <span style={{ fontSize: '12px', color: C.muted, textAlign: 'center' }}>{idx+1}</span>

        {/* 학년·반·번호 */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted, lineHeight: 1.4 }}>
          {s.grade ? s.grade+'학년' : ''}{s.classNum ? ' '+s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}
        </div>

        {/* 이름 */}
        <div style={{ textAlign: 'center' }}>
          <span onClick={() => onStudentClick(s)}
            style={{ fontSize: '14px', fontWeight: 700, color: C.primary, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{s.name}</span>
          {(() => {
            const items = SupplyItems.byClassStudent(s.classIds?.[0] || '', s.id)
            if (!items.length) return null
            return items.map((item, i) => (
              <div key={i} style={{ fontSize: '10px', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '4px', padding: '1px 5px', marginTop: '2px', display: 'inline-block' }}>
                🎒 {item.name}{item.stage ? ` · ${item.stage}` : ''}
              </div>
            ))
          })()}
        </div>

        {/* 학부모 전화 — 문자버튼 제거, PhoneAction만 */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <PhoneAction phone={s.parentPhone}>{fmtPhone(s.parentPhone) || '-'}</PhoneAction>
        </div>

        {/* 출석·지각·조퇴·결석 — 모두 동일한 텍스트 버튼 스타일 */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
          {[
            { s:'present', label:'출석', c:'#16a34a' },
            { s:'late',    label:'지각', c:'#f59e0b' },
            { s:'early',   label:'조퇴', c:'#8b5cf6' },
            { s:'absent',  label:'결석', c:'#ef4444' },
          ].map(btn => (
            <button key={btn.s} onClick={() => onMark(s.id, status === btn.s ? 'pending' : btn.s)}
              style={{ padding: '4px 6px', borderRadius: '6px', border: `1.5px solid ${status===btn.s ? btn.c : C.border}`, background: status===btn.s ? btn.c : '#fff', color: status===btn.s ? '#fff' : C.muted, fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              {btn.label}
            </button>
          ))}
        </div>

        {/* 특이사항·메모 (귀가방법 배지 포함) */}
        <div>
          {s.memo && (
            <div style={{ fontSize: '11px', color: '#92400e', background: '#fffbeb', padding: '3px 8px', borderRadius: '5px', marginBottom: '4px', display: 'inline-block' }}>👤 {s.memo}</div>
          )}
          {s.homeReturn && (
            <div style={{ fontSize: '11px', color: '#1d4ed8', background: '#eff6ff', padding: '3px 8px', borderRadius: '5px', marginBottom: '4px', display: 'inline-block', marginLeft: s.memo ? '4px' : 0 }}>🚌 {s.homeReturn}</div>
          )}
          <NoteInline note={note} onSave={v => setField('note', v)} placeholder="연락 내역 메모" />
        </div>
      </div>

      {/* 결석/지각/조퇴 시 — 사유 + 연락 내역 빠른버튼 */}
      {isAbsent && (
        <div style={{ padding: '6px 14px 10px', borderTop: `1px solid ${C.border}`, background: '#fafafa', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '3px' }}>사유</label>
            <select value={absentReason} onChange={e => setField('absentReason', e.target.value)} style={selSm}>
              {ABSENT_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: C.muted, display: 'block', marginBottom: '3px' }}>연락 내역</label>
            <div style={{ display: 'flex', gap: '5px', marginBottom: '6px' }}>
              {['📞 통화', '💬 문자', '💛 카톡'].map(method => {
                const tag = method.split(' ')[1]
                const active = note.startsWith(tag) || note.includes(' '+tag)
                return (
                  <button key={tag} onClick={() => appendNote(tag)}
                    style={{ padding: '3px 10px', borderRadius: '5px', border: `1px solid ${active ? '#6b7280' : '#d1d5db'}`, background: active ? '#f3f4f6' : '#fff', fontSize: '11px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', fontWeight: active ? 700 : 400, color: active ? '#111827' : '#6b7280' }}>
                    {method}
                  </button>
                )
              })}
            </div>
            <NoteInline note={note} onSave={v => setField('note', v)} placeholder="연락 내용 메모" />
          </div>
        </div>
      )}
    </div>
  )
}

// 인라인 메모
function NoteInline({ note, onSave, studentMemo, placeholder = '특이사항 메모' }) {
  const { success } = useToast()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(note)
  const ref = useRef()
  useEffect(() => setVal(note), [note])
  const save = () => { onSave(val); setEditing(false); success('수정이 완료되었습니다.') }
  return (
    <div>
      {studentMemo && (
        <div style={{ fontSize: '11px', color: '#92400e', background: '#fffbeb', padding: '3px 8px', borderRadius: '5px', marginBottom: '5px', display: 'inline-block' }}>👤 {studentMemo}</div>
      )}
      {editing ? (
        <div style={{ display: 'flex', gap: '5px' }}>
          <input ref={ref} value={val} onChange={e => setVal(e.target.value)} autoFocus placeholder={placeholder}
            onKeyDown={e => { if (e.key==='Enter') save(); if (e.key==='Escape') { setEditing(false); setVal(note) } }}
            style={{ flex:1, border:`1.5px solid ${C.primary}`, borderRadius:'6px', padding:'4px 9px', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          <button onClick={save} style={sm('#f97316','#fff')}>저장</button>
          <button onClick={() => { setEditing(false); setVal(note) }} style={sm('#f3f4f6','#374151')}>취소</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {note ? <span style={{ fontSize:'12px', color:'#374151', background:'#fffbeb', padding:'3px 9px', borderRadius:'6px', border:'1px solid #fde68a' }}>📌 {note}</span>
                : <span style={{ fontSize:'11px', color:'#d1d5db' }}>메모 없음</span>}
          <button onClick={() => { setEditing(true); setTimeout(() => ref.current?.focus(), 30) }}
            style={{ fontSize:'11px', color:C.muted, background:'none', border:'none', cursor:'pointer', textDecoration:'underline', fontFamily:'Noto Sans KR, sans-serif' }}>
            {note ? '편집' : '+ 메모'}
          </button>
          {note && <button onClick={() => onSave('')} style={{ fontSize:'11px', color:'#ef4444', background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>}
        </div>
      )}
    </div>
  )
}
const sm = (bg,color) => ({ padding:'4px 9px', borderRadius:'5px', border:'none', background:bg, color, fontSize:'11px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' })
const selSm = { padding:'5px 9px', borderRadius:'7px', border:`1px solid ${C.border}`, fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none', width:'100%', cursor:'pointer' }

// ─── 취소/대기 학생 행 (출석 처리 불가, 표시만)
function InactiveStudentRow({ s, idx }) {
  const statusLabel = { cancelled: '취소', waiting: '대기' }
  const statusColor = { cancelled: '#ef4444', waiting: '#f59e0b' }
  const st = s.status
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 14px', borderRadius:'10px', border:`1.5px dashed ${statusColor[st]}40`, background:`${statusColor[st]}08`, opacity:0.75 }}>
      <div style={{ fontSize:'12px', color:C.muted, minWidth:'22px', textAlign:'center', flexShrink:0 }}>{s.number||idx+1}</div>
      <div style={{ minWidth:'70px', flexShrink:0 }}>
        <div style={{ fontSize:'14px', fontWeight:700, color:'#9ca3af' }}>{s.name}</div>
        <div style={{ fontSize:'11px', color:'#d1d5db' }}>{s.grade}{s.classNum?' '+s.classNum+'반':''}</div>
      </div>
      <div style={{ fontSize:'11px', color:'#d1d5db', minWidth:'90px' }}>{fmtPhone(s.parentPhone)||'-'}</div>
      <div style={{ marginLeft:'auto' }}>
        <span style={{ padding:'3px 10px', borderRadius:'6px', fontSize:'12px', fontWeight:700, background:`${statusColor[st]}15`, color:statusColor[st], border:`1px solid ${statusColor[st]}30` }}>
          {statusLabel[st] || st}
        </span>
      </div>
    </div>
  )
}

// ─── 수업 1개 — 대시보드 카드 스타일 + 바로 아래 학생 출석 리스트
function ClassAttendanceSection({ cls, date, allStudents }) {
  const today = todayStr()
  const [tick, setTick] = useState(0)
  const [msgStudent, setMsgStudent] = useState(null)
  const [selStudent, setSelStudent] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  const isFuture = date > today
  const sessInfo = getSessionInfo(cls, date)
  const TERM_COLORS = [
    { bg:'#fff7ed', border:'#f97316', text:'#ea580c' },
    { bg:'#f0fdf4', border:'#16a34a', text:'#15803d' },
    { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
    { bg:'#fdf4ff', border:'#a855f7', text:'#7e22ce' },
  ]
  const tc = sessInfo ? TERM_COLORS[(sessInfo.termNum - 1) % TERM_COLORS.length] : null
  const startTime = cls.time || ''; const endTime = cls.timeEnd || ''

  const activeStudents = allStudents.filter(s =>
    s.classIds?.includes(cls.id) && ['applied','selected','confirmed'].includes(s.status)
  )
  const inactiveStudents = allStudents.filter(s =>
    s.classIds?.includes(cls.id) && ['cancelled','waiting'].includes(s.status)
  )
  const sorted = [...activeStudents].sort((a, b) => {
    const g = parseInt(a.grade||'0') - parseInt(b.grade||'0'); if (g) return g
    const c = parseInt(a.classNum||0) - parseInt(b.classNum||0); if (c) return c
    const n = parseInt(a.number||0) - parseInt(b.number||0); if (n) return n
    return (a.name||'').localeCompare(b.name||'','ko')
  })

  const records = isFuture ? [] : AttendanceDB.byClassDate(cls.id, date)
  const getRec  = (sid) => records.find(r => r.studentId === sid)
  const mark = (studentId, status, extra = {}) => {
    if (isFuture) return
    const existing = getRec(studentId)
    AttendanceDB.upsert({
      id: existing?.id || uid(),
      classId: cls.id, studentId, date,
      session: session || 0, status,
      note: existing?.note || '', absentReason: existing?.absentReason || '', homeReturn: existing?.homeReturn || '',
      ...extra, markedAt: now(),
    })
    setTick(t => t + 1)
  }
  const markAll = (status) => sorted.forEach(s => mark(s.id, status))

  const counts = { pending:0, present:0, absent:0, late:0, early:0 }
  if (!isFuture) sorted.forEach(s => { const st = getRec(s.id)?.status || 'pending'; counts[st]++ })
  const presentCnt = counts.present + counts.late
  const done = sorted.length - counts.pending
  const rate = sorted.length > 0 ? Math.round(presentCnt / sorted.length * 100) : 0

  return (
    <div style={{ marginBottom:'12px' }}>
      {/* 수업 카드 (대시보드 동일 스타일, 버튼 없음) */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderRadius:'10px 10px 0 0', background:'#fff7ed', border:'1px solid #fed7aa', borderBottom:'none', gap:'12px', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:'150px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'4px' }}>
            <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>수업 과목 · {cls.className}</span>
            {cls.section && <span style={{ fontSize:'12px', background:C.primary, color:'#fff', borderRadius:'6px', padding:'1px 8px', fontWeight:600 }}>{cls.section}반</span>}
            {sessInfo && (
              <>
                <span style={{ fontSize:'11px', color:C.muted, background:'#f3f4f6', padding:'1px 7px', borderRadius:'5px' }}>{sessInfo.total}차시</span>
                <span style={{ fontSize:'11px', fontWeight:700, color:tc?.text, background:tc?.bg, border:`1px solid ${tc?.border}`, padding:'1px 7px', borderRadius:'5px' }}>
                  {sessInfo.termNum}텀 {sessInfo.termSess}차시
                </span>
              </>
            )}
          </div>
          {startTime && <div style={{ fontSize:'12px', color:C.muted }}>🕐 {startTime}{endTime ? ` ~ ${endTime}` : ''}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:700, color:C.text }}>{sorted.length}명</div>
            <div style={{ fontSize:'11px', color:presentCnt>0?C.success:C.muted }}>출석 {presentCnt}명</div>
          </div>
          {!isFuture && done > 0 && (
            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {Object.entries(ATTENDANCE_STATUS).map(([k,v]) => counts[k] > 0
                ? <span key={k} style={{ padding:'3px 8px', borderRadius:'6px', background:v.bg, fontSize:'11px', fontWeight:700, color:v.color }}>{v.emoji}{counts[k]}</span>
                : null)}
            </div>
          )}
          {isFuture && <span style={{ fontSize:'12px', color:'#3b82f6', fontWeight:600, background:'#eff6ff', padding:'4px 10px', borderRadius:'6px' }}>예정</span>}
        </div>
      </div>

      {/* 학생 리스트 */}
      <div style={{ background:C.card, border:`1px solid #fed7aa`, borderTop:`1px solid ${C.border}`, borderRadius:'0 0 10px 10px', overflow:'hidden' }}>
        {/* 일괄처리 + 진행률 */}
        {!isFuture && sorted.length > 0 && (
          <div style={{ padding:'8px 14px', background:'#fafafa', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:'5px' }}>
              <button onClick={() => markAll('present')} style={{ padding:'4px 11px', borderRadius:'6px', border:'1.5px solid #86efac', background:'#f0fdf4', color:C.success, fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>전체 출석</button>
              <button onClick={() => markAll('absent')}  style={{ padding:'4px 11px', borderRadius:'6px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:C.danger,   fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>전체 결석</button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, maxWidth:'220px' }}>
              <div style={{ flex:1, height:'5px', background:'#f3f4f6', borderRadius:'999px', overflow:'hidden' }}>
                <div style={{ width:`${sorted.length?done/sorted.length*100:0}%`, height:'100%', background:C.primary, borderRadius:'999px', transition:'width .4s' }} />
              </div>
              <span style={{ fontSize:'11px', color:C.muted, whiteSpace:'nowrap' }}>{done}/{sorted.length} · {rate}%</span>
            </div>
          </div>
        )}
        {/* 컬럼 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'30px 70px 65px 100px 190px 1fr', gap:'6px', padding:'7px 14px', background:'#f3f4f6', borderBottom:`1px solid ${C.border}`, fontSize:'11px', fontWeight:700, color:C.muted, textAlign:'center' }}>
          <span>순번</span><span>학년·반·번호</span><span>이름</span><span>학부모전화</span><span>출석·지각·조퇴·결석</span><span>특이사항·메모</span>
        </div>
        {sorted.length === 0
          ? <div style={{ padding:'24px', textAlign:'center', color:C.muted, fontSize:'13px' }}>등록된 학생이 없습니다</div>
          : sorted.map((s, i) =>
              isFuture
                ? <FutureStudentRow key={s.id} s={s} idx={i} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} />
                : <StudentRow      key={s.id} s={s} idx={i} rec={getRec(s.id)} onMark={mark} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} />
            )
        }
        {inactiveStudents.length > 0 && (
          <div style={{ borderTop:'1.5px dashed #e5e7eb' }}>
            <button onClick={() => setShowInactive(v=>!v)}
              style={{ display:'flex', alignItems:'center', gap:'6px', background:'#fafafa', border:'none', cursor:'pointer', padding:'9px 14px', fontFamily:'Noto Sans KR, sans-serif', width:'100%', textAlign:'left' }}>
              <span style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af' }}>{showInactive?'▼':'▶'} 취소·대기 {inactiveStudents.length}명</span>
              <span style={{ fontSize:'11px', color:'#d1d5db' }}>(출석 처리 제외)</span>
            </button>
            {showInactive && (
              <div style={{ display:'flex', flexDirection:'column', gap:'5px', padding:'0 8px 8px' }}>
                {inactiveStudents.map((s,i) => <InactiveStudentRow key={s.id} s={s} idx={i} />)}
              </div>
            )}
          </div>
        )}
      </div>
      {msgStudent && <MsgModal student={msgStudent} onClose={() => setMsgStudent(null)} />}
      {selStudent  && <StudentDetailModal student={selStudent} onClose={() => setSelStudent(null)} />}
    </div>
  )
}

// ─── 날짜별 전체 출석 패널 (대시보드 스타일, 네비게이션 없음)
function DayAttendancePanel({ date, allClasses, allStudents, schoolClasses }) {
  const dayClasses = sortClasses(schoolClasses.filter(cls => calcSessionDates(cls).includes(date)))

  if (dayClasses.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'60px 20px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
        <div style={{ fontSize:'36px', marginBottom:'10px' }}>🗓️</div>
        <div style={{ fontSize:'15px', fontWeight:600, color:'#374151' }}>수업이 없는 날입니다</div>
        <div style={{ fontSize:'13px', marginTop:'6px' }}>달력에서 수업일(점 표시)을 선택하세요</div>
      </div>
    )
  }

  const schools = {}
  dayClasses.forEach(cls => {
    if (!schools[cls.organization]) schools[cls.organization] = []
    schools[cls.organization].push(cls)
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
      {/* 날짜 헤더 */}
      <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,#fff7ed 0%,#fff 100%)', borderRadius:'14px', border:'1.5px solid #fed7aa' }}>
        <div style={{ fontSize:'20px', fontWeight:700, color:C.text }}>{formatDateKo(date)}</div>
        <div style={{ fontSize:'13px', marginTop:'4px', color:C.primary, fontWeight:600 }}>수업 {dayClasses.length}개</div>
      </div>

      {/* 학교별 섹션 */}
      {Object.entries(schools).map(([school, classes]) => (
        <div key={school} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          {/* 학교 헤더 (네비게이션 버튼 없음) */}
          <div style={{ padding:'13px 18px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:'8px' }}>
            <span>🏫</span>
            <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{school}</span>
            <span style={{ fontSize:'12px', color:C.muted }}>수업 장소</span>
          </div>
          <div style={{ padding:'12px 16px' }}>
            {classes.map(cls => (
              <ClassAttendanceSection key={cls.id + date} cls={cls} date={date} allStudents={allStudents} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}


// ─── 통합 패널 (수강생 명단 + 수업준비메모 + 출석체크 — 모드에 따라 표시)
function UnifiedPanel({ cls, date, students, user, allClasses }) {
  const today = todayStr()
  const isSessionDate = cls ? calcSessionDates(cls).includes(date) : false
  const isFuture = date > today
  const isPast   = date < today
  const isToday  = date === today
  const showAttendance = isSessionDate && !isFuture  // 오늘 or 과거 수업일

  const [tick,         setTick]         = useState(0)
  const [msgStudent,   setMsgStudent]   = useState(null)
  const [selStudent,   setSelStudent]   = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  // 수업 준비 메모 (미래 수업일 때만 사용)
  const noteKey = cls ? date+'_'+cls.id : null
  const [notes,   setNotes]   = useState(() => noteKey ? Notes.byTeacherDate(cls.teacherId, noteKey) : [])
  const [newNote, setNewNote] = useState('')
  const [adding,  setAdding]  = useState(false)
  const inputRef = useRef()
  const addNote = () => {
    if (!newNote.trim() || !cls) return
    Notes.insert({ id: uid(), teacherId: cls.teacherId, date: noteKey, content: newNote.trim(), createdAt: now() })
    setNotes(Notes.byTeacherDate(cls.teacherId, noteKey))
    setNewNote(''); setAdding(false)
  }
  const delNote = (id) => { Notes.delete(id); setNotes(Notes.byTeacherDate(cls.teacherId, noteKey)) }

  // 출석 처리
  const records = (cls && showAttendance) ? AttendanceDB.byClassDate(cls.id, date) : []
  const getRec  = (sid) => records.find(r => r.studentId === sid)
  const session = cls ? getSession(cls, date) : null
  const mark = (studentId, status, extra = {}) => {
    if (!cls) return
    const existing = getRec(studentId)
    AttendanceDB.upsert({
      id: existing?.id || uid(),
      classId: cls.id, studentId, date,
      session: session || 0, status,
      note: existing?.note || '',
      absentReason: existing?.absentReason || '',
      homeReturn: existing?.homeReturn || '',
      ...extra, markedAt: now(),
    })
    setTick(t => t+1)
  }
  const markAll = (status) => activeStudents.forEach(s => mark(s.id, status))

  const activeStudents   = students.filter(s => ['applied','selected','confirmed'].includes(s.status))
  const inactiveStudents = students.filter(s => ['cancelled','waiting'].includes(s.status))

  const counts = { pending:0, present:0, absent:0, late:0, early:0 }
  if (showAttendance) activeStudents.forEach(s => { const st = getRec(s.id)?.status || 'pending'; counts[st]++ })
  const done = activeStudents.length - counts.pending
  const rate = activeStudents.length > 0 ? Math.round((counts.present + counts.late) / activeStudents.length * 100) : 0

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

      {/* ── 헤더 */}
      {cls && date && (
        <div style={{ padding:'14px 18px', borderRadius:'12px', border:`1.5px solid ${showAttendance ? (isPast?C.border:'#fed7aa') : '#86efac'}`, background: showAttendance ? (isPast?'#f9fafb':'linear-gradient(135deg,#fff7ed,#fff)') : 'linear-gradient(135deg,#f0fdf4,#fff)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.text, display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                <span>{date} ({DAYS_KO[new Date(date+'T00:00:00').getDay()]}요일)</span>
                {session && (() => {
                  const si = getSessionInfo(cls, date)
                  const TC = [
                    { bg:'#fff7ed', border:'#f97316', text:'#ea580c' },
                    { bg:'#f0fdf4', border:'#16a34a', text:'#15803d' },
                    { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
                    { bg:'#fdf4ff', border:'#a855f7', text:'#7e22ce' },
                  ]
                  const tc = si ? TC[(si.termNum-1) % TC.length] : null
                  return (
                    <>
                      <span style={{ fontSize:'13px', color:showAttendance?C.primary:'#16a34a', fontWeight:600 }}>{session}차시{isFuture?' 예정':''}</span>
                      {si && <span style={{ fontSize:'12px', fontWeight:700, color:tc?.text, background:tc?.bg, border:`1px solid ${tc?.border}`, padding:'1px 8px', borderRadius:'5px' }}>{si.termNum}텀 {si.termSess}차시</span>}
                    </>
                  )
                })()}
              </div>
              <div style={{ fontSize:'13px', color:C.muted, marginTop:'3px' }}>{cls.organization} · {cls.className}{cls.section?' '+cls.section+'반':''} · {activeStudents.length}명</div>
            </div>
            <span style={{ fontSize:'12px', padding:'4px 10px', borderRadius:'6px', fontWeight:600,
              background: isToday?'#f0fdf4': isPast?'#f3f4f6':'#eff6ff',
              color:       isToday?'#16a34a': isPast?C.muted:'#3b82f6' }}>
              {isToday?'오늘 수업': isPast?'지난 수업':'예정 수업'}
            </span>
          </div>
        </div>
      )}

      {/* ── 수업 준비 메모 (미래 수업일만) */}
      {cls && isFuture && isSessionDate && (
        <div style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
          <div style={{ padding:'11px 16px', background:'#fffbeb', borderBottom:'1px solid #fde68a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'13px', fontWeight:700, color:'#92400e' }}>📝 수업 준비 메모</span>
            <button onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 30) }}
              style={{ padding:'3px 10px', borderRadius:'6px', border:'1.5px solid #fbbf24', background:'#fff', color:'#b45309', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 추가</button>
          </div>
          <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:'7px' }}>
            {notes.length === 0 && !adding && <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'10px 0' }}>준비사항을 기록하세요</div>}
            {notes.map(n => (
              <div key={n.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', background:'#fffbeb', borderRadius:'7px', border:'1px solid #fde68a', fontSize:'13px', color:'#374151' }}>
                <span>📌 {n.content}</span>
                <button onClick={() => delNote(n.id)} style={{ background:'none', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>삭제</button>
              </div>
            ))}
            {adding && (
              <div style={{ display:'flex', gap:'6px' }}>
                <input ref={inputRef} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="예: 교구 준비 / 배터리 충전"
                  onKeyDown={e => { if (e.key==='Enter') addNote(); if (e.key==='Escape') { setAdding(false); setNewNote('') } }}
                  style={{ flex:1, border:`1.5px solid ${C.primary}`, borderRadius:'7px', padding:'7px 11px', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                <button onClick={addNote} style={sm('#f97316','#fff')}>저장</button>
                <button onClick={() => { setAdding(false); setNewNote('') }} style={sm('#f3f4f6','#374151')}>취소</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 출석 통계 + 일괄 버튼 (출석체크 모드만) */}
      {showAttendance && (
        <>
          <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', justifyContent:'space-between' }}>
            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
              {Object.entries(ATTENDANCE_STATUS).map(([k,v]) => (
                <div key={k} style={{ padding:'5px 10px', borderRadius:'7px', background:v.bg, border:`1px solid ${v.color}30`, fontSize:'12px', fontWeight:600, color:v.color }}>
                  {v.emoji} {v.label} {counts[k]||0}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => markAll('present')} style={actionBtn('#f0fdf4','#16a34a','#86efac')}>전체 출석</button>
              <button onClick={() => markAll('absent')}  style={actionBtn('#fef2f2','#ef4444','#fca5a5')}>전체 결석</button>
            </div>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:C.muted, marginBottom:'5px' }}>
              <span>처리 {done}/{activeStudents.length}</span>
              <span style={{ fontWeight:700, color: rate>=80?'#16a34a':C.warning }}>출석률 {rate}%</span>
            </div>
            <div style={{ height:'6px', background:'#f3f4f6', borderRadius:'999px', overflow:'hidden' }}>
              <div style={{ width:`${activeStudents.length ? done/activeStudents.length*100 : 0}%`, height:'100%', background:C.primary, borderRadius:'999px', transition:'width .4s' }} />
            </div>
          </div>
        </>
      )}

      {/* ── 학생 리스트 — 반별로 섹션 나눠서 표시 */}
      {(() => {
        // 반(section) 기준으로 그룹핑. section 없으면 단일 그룹
        const sections = [...new Set(activeStudents.map(s => {
          const sc = allClasses?.find ? allClasses.find(c => s.classIds?.includes(c.id)) : null
          return sc?.section || ''
        }))].sort()

        const ColHeader = () => (
          <div style={{ display:'grid', gridTemplateColumns:'30px 70px 65px 100px 190px 1fr', gap:'6px', padding:'8px 14px', background:'#f3f4f6', borderBottom:`1px solid ${C.border}`, fontSize:'11px', fontWeight:700, color:C.muted, textAlign:'center' }}>
            <span>순번</span>
            <span>학년·반·번호</span>
            <span>이름</span>
            <span>학부모전화</span>
            <span>출석·지각·조퇴·결석</span>
            <span>특이사항·메모</span>
          </div>
        )

        return sections.map(sec => {
          const secStudents = activeStudents.filter(s => {
            const sc = allClasses?.find ? allClasses.find(c => s.classIds?.includes(c.id)) : null
            return (sc?.section || '') === sec
          })
          return (
            <div key={sec||'all'} style={{ background:C.card, borderRadius:'12px', border:`1px solid ${C.border}`, overflow:'hidden', marginBottom:'12px' }}>
              <div style={{ padding:'10px 16px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'13px', fontWeight:700, color:C.text }}>
                  📋 {showAttendance ? '출석체크' : '수강생 명단'}{sec ? ` — ${sec}반` : ''} ({secStudents.length}명)
                </span>
                {!cls && <span style={{ fontSize:'12px', color:C.muted }}>수업을 선택하면 출석체크를 시작할 수 있습니다</span>}
              </div>
              <ColHeader />
              {secStudents.length === 0 ? (
                <div style={{ padding:'40px', textAlign:'center', color:C.muted, fontSize:'14px' }}>학생이 없습니다</div>
              ) : (
                <div>
                  {secStudents.map((s, i) => (
                    showAttendance
                      ? <StudentRow key={s.id} s={s} idx={i} rec={getRec(s.id)} onMark={mark} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} />
                      : (
                        <div key={s.id} style={{ display:'grid', gridTemplateColumns:'30px 70px 65px 100px 190px 1fr', gap:'6px', alignItems:'center', padding:'10px 14px', borderBottom: i<secStudents.length-1?`1px solid #f3f4f6`:'none', background:i%2===0?'#fff':'#fafafa', textAlign:'center' }}>
                          <span style={{ fontSize:'12px', color:C.muted }}>{i+1}</span>
                          <span style={{ fontSize:'12px', color:C.muted }}>{s.grade ? s.grade+'학년' : ''}{s.classNum ? ' '+s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}</span>
                          <span onClick={() => setSelStudent(s)} style={{ fontSize:'14px', fontWeight:700, color:C.primary, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:'2px' }}>{s.name}</span>
                          <PhoneAction phone={s.parentPhone}>{fmtPhone(s.parentPhone)||'-'}</PhoneAction>
                          <span style={{ fontSize:'12px', color:C.muted }}>-</span>
                          <span style={{ fontSize:'11px', color:'#92400e', textAlign:'left' }}>{s.memo ? '📌 '+s.memo : '-'}</span>
                        </div>
                      )
                  ))}
                </div>
              )}
              {inactiveStudents.filter(s => {
                const sc = allClasses?.find ? allClasses.find(c => s.classIds?.includes(c.id)) : null
                return (sc?.section || '') === sec
              }).length > 0 && (
                <div style={{ borderTop:`1.5px dashed #e5e7eb` }}>
                  <button onClick={() => setShowInactive(v=>!v)}
                    style={{ display:'flex', alignItems:'center', gap:'6px', background:'#fafafa', border:'none', cursor:'pointer', padding:'10px 16px', fontFamily:'Noto Sans KR, sans-serif', width:'100%', textAlign:'left' }}>
                    <span style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af' }}>
                      {showInactive ? '▼' : '▶'} 취소·대기 {inactiveStudents.length}명
                    </span>
                    <span style={{ fontSize:'11px', color:'#d1d5db' }}>(출석 처리 제외)</span>
                  </button>
                  {showInactive && (
                    <div style={{ display:'flex', flexDirection:'column', gap:'5px', padding:'0 8px 8px' }}>
                      {inactiveStudents.filter(s => {
                        const sc = allClasses?.find ? allClasses.find(c => s.classIds?.includes(c.id)) : null
                        return (sc?.section || '') === sec
                      }).map((s,i) => <InactiveStudentRow key={s.id} s={s} idx={i} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      })()}

      {msgStudent  && <MsgModal student={msgStudent} onClose={() => setMsgStudent(null)} />}
      {selStudent  && <StudentDetailModal student={selStudent} onClose={() => setSelStudent(null)} />}
    </div>
  )
}

function StudentDetailModal({ student, onClose }) {
  return (
    <Modal open={true} onClose={onClose} title={student.name} width={400}>
      {[
        ['학교', student.school || '-'],
        ['학년', student.grade ? student.grade+'학년' : '-'],
        ['학급반', student.classNum ? student.classNum+'반' : '-'],
        ['번호', student.number || '-'],
        ['학부모 전화', student.parentPhone || '-'],
        ['학생 전화', student.studentPhone || '-'],
        ['메모', student.memo || '-'],
      ].map(([label, value]) => (
        <div key={label} style={{ display:'flex', gap:'12px', padding:'9px 0', borderBottom:'1px solid #f3f4f6', fontSize:'14px' }}>
          <span style={{ color:'#9ca3af', fontWeight:600, minWidth:'90px', flexShrink:0 }}>{label}</span>
          {label.includes('전화') && value !== '-'
            ? <PhoneAction phone={value}><span style={{ color:'#3b82f6' }}>{fmtPhone(value)}</span></PhoneAction>
            : <span style={{ color:'#18181b' }}>{value}</span>
          }
        </div>
      ))}
    </Modal>
  )
}

function actionBtn(bg,color,border) {
  return { padding:'6px 12px', borderRadius:'7px', border:`1.5px solid ${border}`, background:bg, color, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }
}

export function Attendance({ user, pageParams = {} }) {
  const today = todayStr()
  const now_ = new Date()
  const allClasses = ClassesDB.byTeacher(user.id)
  const allStudents = StudentsDB.byTeacher(user.id)
  const schools = [...new Set(allClasses.map(c => c.organization).filter(Boolean))]

  const years = [...new Set(allClasses.map(c => c.startDate?.slice(0,4)).filter(Boolean))].sort()
  const currentYear = String(now_.getFullYear())
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const [selYear,    setSelYear]    = useState(() => {
    if (pageParams.classId) { const cls = allClasses.find(c=>c.id===pageParams.classId); return cls?.startDate?.slice(0,4) || currentYear }
    return currentYear
  })
  const [selSchool,  setSelSchool]  = useState(() => {
    if (pageParams.classId) { const cls = allClasses.find(c=>c.id===pageParams.classId); return cls?.organization || '' }
    return ''
  })
  const [selClassId, setSelClassId] = useState(() => pageParams.classId || '')
  const [selSection, setSelSection] = useState('')
  const [selTerm,    setSelTerm]    = useState('')
  const [selDate,    setSelDate]    = useState(() => pageParams.date || today)
  const [dateClicked, setDateClicked] = useState(false)
  const [calYear,    setCalYear]    = useState(() => { const d = pageParams.date ? new Date(pageParams.date+'T00:00:00') : now_; return d.getFullYear() })
  const [calMonth,   setCalMonth]   = useState(() => { const d = pageParams.date ? new Date(pageParams.date+'T00:00:00') : now_; return d.getMonth() })

  // 기간 필터 날짜 범위 계산
  const TERM_RANGES = {
    q1: ['-01-01', '-03-31'], q2: ['-04-01', '-06-30'],
    q3: ['-07-01', '-09-30'], q4: ['-10-01', '-12-31'],
    s1: ['-03-01', '-08-31'], s2: ['-09-01', '-02-28'],
  }
  const termInRange = (cls) => {
    if (!selTerm) return true
    // 분기제 필터(q1~q4)는 분기제 수업에만, 학기제 필터(s1~s2)는 학기제 수업에만 적용
    const isQuarter = selTerm.startsWith('q')
    const isSemester = selTerm.startsWith('s')
    if (isQuarter && cls.termType !== 'quarter') return false
    if (isSemester && cls.termType === 'quarter') return false
    const r = TERM_RANGES[selTerm]
    if (!r) return true
    const y = selTerm === 's2' ? String(Number(selYear)) : selYear
    const nextY = String(Number(selYear) + 1)
    const from = selTerm === 's2' ? y + r[0] : selYear + r[0]
    const to   = selTerm === 's2' ? nextY + r[1] : selYear + r[1]
    return (cls.startDate || '') <= to && (cls.endDate || '') >= from
  }

  // 필터 적용된 수업 목록 (년도 + 학교 + 기간)
  const schoolClasses = sortClasses(allClasses.filter(c =>
    (!selYear   || c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear)) &&
    (!selSchool || c.organization === selSchool) &&
    termInRange(c)
  ))
  const selClass = allClasses.find(c => c.id === selClassId)
  // 달력 표시용 수업일: 선택된 수업이 있으면 그 수업일만, 없으면 필터된 전체 수업일 합산
  const sessionDates = selClass
    ? calcSessionDates(selClass)
    : [...new Set(schoolClasses.flatMap(c => calcSessionDates(c)))].sort()
  // 수업 선택 시 해당 수업의 반 목록 (같은 학교+수업명 내 section 목록)
  // 같은 학교+수업명 내 반 목록 (section 기준)
  const sectionClasses = selClassId
    ? schoolClasses.filter(c => c.className === selClass?.className && c.organization === selClass?.organization)
    : []
  const sections = [...new Set(sectionClasses.map(c => c.section).filter(Boolean))]

  // 정렬: Students.jsx 와 동일하게 학교→수업→반→학년→학급반→번호→이름
  const sortStudents = (arr) => [...arr].sort((a, b) => {
    const aClass = allClasses.find(c => c.id === a.classIds?.[0])
    const bClass = allClasses.find(c => c.id === b.classIds?.[0])
    const schoolCmp = (a.school||'').localeCompare(b.school||'','ko')
    if (schoolCmp !== 0) return schoolCmp
    const classCmp = (aClass?.className||'').localeCompare(bClass?.className||'','ko')
    if (classCmp !== 0) return classCmp
    const sectionCmp = (aClass?.section||'').localeCompare(bClass?.section||'','ko')
    if (sectionCmp !== 0) return sectionCmp
    const gradeCmp = parseInt(a.grade||'0') - parseInt(b.grade||'0')
    if (gradeCmp !== 0) return gradeCmp
    const classNumCmp = parseInt(a.classNum||'0') - parseInt(b.classNum||'0')
    if (classNumCmp !== 0) return classNumCmp
    const numCmp = parseInt(a.number||'0') - parseInt(b.number||'0')
    if (numCmp !== 0) return numCmp
    return (a.name||'').localeCompare(b.name||'','ko')
  })

  // ★ 핵심: 필터 순서대로 좁혀가되 classIds 없는 학생은 학교명으로 보완 매칭
  const students = sortStudents(allStudents.filter(s => {
    const hasClassIds = s.classIds?.length > 0
    // 년도 필터
    if (selYear) {
      const yearCls = allClasses.filter(c => c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear))
      const inYear = hasClassIds
        ? yearCls.some(c => s.classIds.includes(c.id))
        : yearCls.some(c => c.organization === s.school)  // classIds 없으면 학교명으로 매칭
      if (!inYear) return false
    }
    // 기간 필터: 해당 기간에 해당하는 수업의 학생만
    if (selTerm) {
      const termCls = allClasses.filter(c => termInRange(c))
      const inTerm = hasClassIds
        ? termCls.some(c => s.classIds.includes(c.id))
        : termCls.some(c => c.organization === s.school)
      if (!inTerm) return false
    }
    // 학교 필터
    if (selSchool && s.school !== selSchool) return false
    // 수업 필터
    if (selClassId) {
      const inClass = hasClassIds
        ? s.classIds.includes(selClassId)
        : selClass?.organization === s.school  // classIds 없으면 학교명으로 매칭
      if (!inClass) return false
    }
    // 반 필터: selSection은 수업 section(A/B반), 해당 section의 수업 ID로 매칭
    if (selSection) {
      const sectionCls = sectionClasses.find(c => c.section === selSection)
      if (sectionCls) {
        const inSection = s.classIds?.includes(sectionCls.id) ||
          (!s.classIds?.length && selClass?.organization === s.school)
        if (!inSection) return false
      }
    }
    return true
  }))

  const handleSchoolChange = (school) => {
    setSelSchool(school)
    setSelClassId('')
    setDateClicked(false)
  }

  const handleSelectDate = (date) => {
    setSelDate(date)
    setDateClicked(true)
    const d = new Date(date+'T00:00:00')
    setCalYear(d.getFullYear()); setCalMonth(d.getMonth())

    // 해당 날짜의 수업 찾기 (같은 날짜 A/B반 모두 포함)
    const matched = allClasses.filter(c => calcSessionDates(c).includes(date))
    if (matched.length > 0) {
      const rep = matched[0]
      const year = rep.startDate?.slice(0,4) || String(d.getFullYear())
      setSelYear(year)
      setSelSchool(rep.organization || '')
      setSelClassId('')      // 전체 수업 — A/B반 모두 표시
      setSelSection('')

      // 기간(분기/학기) 자동 세팅
      const month = d.getMonth() + 1
      if (rep.termType === 'quarter') {
        if (month <= 3)       setSelTerm('q1')
        else if (month <= 6)  setSelTerm('q2')
        else if (month <= 9)  setSelTerm('q3')
        else                  setSelTerm('q4')
      } else {
        setSelTerm(month >= 3 && month <= 8 ? 's1' : 's2')
      }
    }
  }

  const prevMonth = () => { if (calMonth===0){setCalYear(y=>y-1);setCalMonth(11)}else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth===11){setCalYear(y=>y+1);setCalMonth(0)}else setCalMonth(m=>m+1) }
  const goToday   = () => { const d=new Date(); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); setSelDate(today) }

  const isSessionDate = sessionDates.includes(selDate)  // 달력에서 수업일 클릭 시에만 출석체크 패널
  const isPast = selDate <= today
  const monthSessions = sessionDates.filter(d => d.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`))

  return (
    <div style={{ padding:'24px', maxWidth:'1100px', display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ fontSize:'22px', fontWeight:700, color:C.text }}>출석부</div>

      {/* 필터 — 년도 / 학교 / 수업 / 반 / 기간 */}
      <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px 20px', display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          <label style={{ fontSize:'12px', fontWeight:600, color:C.muted }}>년도</label>
          <select value={selYear} onChange={e => { setSelYear(e.target.value); setSelClassId(''); setSelSection(''); setSelTerm('') }} style={selSt}>
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          <label style={{ fontSize:'12px', fontWeight:600, color:C.muted }}>학교</label>
          <select value={selSchool} onChange={e => handleSchoolChange(e.target.value)} style={selSt}>
            <option value="">전체 학교</option>
            {[...new Set(allClasses.filter(c => !selYear || c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear)).map(c => c.organization).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          <label style={{ fontSize:'12px', fontWeight:600, color:C.muted }}>수업</label>
          <select value={selClassId} onChange={e => { setSelClassId(e.target.value); setSelSection(''); setSelTerm(''); setDateClicked(false) }} style={selSt}>
            <option value="">전체 수업</option>
            {schoolClasses.map(c => <option key={c.id} value={c.id}>{c.className}{c.section?' '+c.section+'반':''}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          <label style={{ fontSize:'12px', fontWeight:600, color:C.muted }}>반</label>
          <select value={selSection} onChange={e => setSelSection(e.target.value)} style={{ ...selSt, minWidth:'110px' }} disabled={!selClassId || sections.length === 0}>
            <option value="">전체 반</option>
            {sections.map(s => <option key={s} value={s}>{s}반</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
          <label style={{ fontSize:'12px', fontWeight:600, color:C.muted }}>기간</label>
          <select value={selTerm} onChange={e => setSelTerm(e.target.value)} style={selSt}>
            <option value="">전체 기간</option>
            {/* 수업 선택 시 해당 termType만, 미선택 시 전체 표시 */}
            {(!selClass || selClass.termType === 'quarter') && (
              <optgroup label="── 분기제 ──">
                <option value="q1">1분기 (1~3월)</option>
                <option value="q2">2분기 (4~6월)</option>
                <option value="q3">3분기 (7~9월)</option>
                <option value="q4">4분기 (10~12월)</option>
              </optgroup>
            )}
            {(!selClass || selClass.termType !== 'quarter') && (
              <optgroup label="── 학기제 ──">
                <option value="s1">1학기 (3~8월)</option>
                <option value="s2">2학기 (9~2월)</option>
              </optgroup>
            )}
          </select>
        </div>
        {selClass && <div style={{ fontSize:'13px', color:C.muted, marginBottom:'4px' }}>📅 {selClass.startDate} ~ {selClass.endDate} · 총 {sessionDates.length}차시</div>}
        <div style={{ fontSize:'13px', color:C.muted, marginBottom:'4px', marginLeft:'auto' }}>
          👥 {students.filter(s => ['applied','selected','confirmed'].includes(s.status)).length}명
        </div>
      </div>

      {/* 항상 달력 + 패널 레이아웃 */}
      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'20px', alignItems:'start' }}>
        {/* 달력 */}
        <div style={{ background:C.card, borderRadius:'16px', border:`1px solid ${C.border}`, padding:'20px', position:'sticky', top:'24px' }}>
          <AttCalendar year={calYear} month={calMonth} selectedDate={selDate} sessionDates={sessionDates}
            onSelect={handleSelectDate} onPrevMonth={prevMonth} onNextMonth={nextMonth} onToday={goToday} />
          {selClassId && monthSessions.length > 0 && (
            <div style={{ marginTop:'14px', padding:'12px 14px', background:'#fff7ed', borderRadius:'10px' }}>
              <div style={{ fontSize:'12px', fontWeight:700, color:'#92400e', marginBottom:'6px' }}>이달 수업 {monthSessions.length}회</div>
              {monthSessions.slice(0,8).map(d => {
                const recs = AttendanceDB.byClassDate(selClassId, d)
                const done = recs.filter(r => r.status !== 'pending').length
                const isPast_ = d <= today
                return (
                  <div key={d} onClick={() => handleSelectDate(d)}
                    style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px', cursor:'pointer', padding:'3px 5px', borderRadius:'5px', background:selDate===d?'#fff7ed':'transparent', border:selDate===d?'1px solid #fed7aa':'1px solid transparent' }}>
                    <span style={{ color:'#374151' }}>{d.slice(5)} ({DAYS_KO[new Date(d+'T00:00:00').getDay()]})</span>
                    <span style={{ color:isPast_?(done>0?'#16a34a':C.muted):C.primary, fontWeight:600 }}>{isPast_?(done>0?`${done}명`:'미처리'):'예정'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 오른쪽 패널 */}
        <div>
          {selClassId ? (
            (!isSessionDate && dateClicked) ? (
              <div style={{ textAlign:'center', padding:'60px 20px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
                <div style={{ fontSize:'36px', marginBottom:'10px' }}>🗓️</div>
                <div style={{ fontSize:'15px', fontWeight:600, color:'#374151' }}>수업이 없는 날입니다</div>
                <div style={{ fontSize:'13px', marginTop:'6px' }}>달력에서 수업일(점 표시)을 선택하세요</div>
              </div>
            ) : (
              <UnifiedPanel cls={selClass||null} date={selDate} students={students} user={user} allClasses={allClasses} key={selDate+selClassId} />
            )
          ) : (
            <DayAttendancePanel date={selDate} allClasses={allClasses} allStudents={allStudents} schoolClasses={schoolClasses} key={selDate} />
          )}
        </div>
      </div>
    </div>
  )
}

const selSt = { padding:'8px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', color:'#111827', cursor:'pointer', outline:'none', minWidth:'160px' }
