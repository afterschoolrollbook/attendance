import React, { useState, useEffect, useRef } from 'react'
import { Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB, Notes, SupplyItems, SupplyProducts, SupplyStudentProgress, SupplySessionChecks, SupplyProductPlans, MessageGuides, MessageCategories, TeacherProfiles, ParentMembers } from '../lib/db.js'
import { uid, now, calcSessionDates, sortClasses, getSession, getSessionInfo, fmtPhone } from '../lib/utils.js'
import { ATTENDANCE_STATUS, HOME_RETURN_TYPES } from '../constants/config.js'
import { Modal } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { sendPush, isConfigured } from '../lib/supabase.js'

// ── 웹 푸시 발송 헬퍼
function pushAttendance(student, status, extra = {}) {
  if (!isConfigured) return
  if (status === 'pending') return
  if (!student?.parentPhone) return
  const subs = ParentMembers.getPushSubscriptions(student.parentPhone)
  if (!subs.length) return
  const label = { present:'출석', absent:'결석', late:'지각', early:'조퇴' }[status] || status
  const title = `${student.name} ${label} 알림`
  const body  = extra.absentReason ? `사유: ${extra.absentReason}` : `${student.name} 학생이 ${label} 처리되었습니다.`
  subs.forEach(sub => sendPush(sub, { title, body, tag: 'attendance' }))
}

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
  const { success } = useToast()
  const raw = (phone || '').replace(/[^0-9]/g, '')
  if (!raw) return <span style={{ fontSize:'11px', color:'#9ca3af' }}>-</span>
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  const handleAction = (action) => {
    setOpen(false)
    if (!isMobile) {
      success('📱 핸드폰에서 작동합니다')
      return
    }
    if (action === 'call') window.location.href = `tel:${raw}`
    if (action === 'sms')  window.open(`sms:${raw}`)
    if (action === 'kakao') window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${raw}`)
  }

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
            <button onClick={() => handleAction('call')}  style={phoneActionBtn}>📞 전화하기</button>
            <button onClick={() => handleAction('sms')}   style={phoneActionBtn}>💬 문자 보내기</button>
            <button onClick={() => handleAction('kakao')} style={phoneActionBtn}>💛 카톡 보내기</button>
          </div>
        </>
      )}
    </div>
  )
}
const phoneActionBtn = { display:'block', width:'100%', padding:'9px 14px', background:'none', border:'none', cursor:'pointer', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', textAlign:'left', color:'#374151', borderBottom:'1px solid #f3f4f6' }

// ─── 플레이스홀더 치환
const PLACEHOLDER_LABELS = [
  ['{학생이름}', '학생 이름'],
  ['{학교명}',   '학교 이름'],
  ['{수업명}',   '수업 이름'],
  ['{선생님이름}','선생님 이름'],
  ['{선생님닉네임}','선생님 닉네임'],
  ['{날짜}',     '오늘 날짜'],
]
function replacePlaceholders(text, student, cls, user) {
  const today = new Date()
  const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`
  // 메시지 가이드 설정의 선생님 이름/닉네임 우선 사용
  const profile = user?.id ? TeacherProfiles.byTeacher(user.id) : null
  const teacherName     = profile?.name     || user?.name     || ''
  const teacherNickname = profile?.nickname || profile?.name  || user?.nickname || user?.name || ''
  const inviteLink = `${window.location.origin}/parent-invite?phone=${encodeURIComponent(student?.parentPhone||'')}&teacher=${encodeURIComponent(user?.id||'')}`
  return text
    .replace(/{학생이름}/g, student?.name || '')
    .replace(/{학교명}/g,   cls?.organization || student?.school || '')
    .replace(/{수업명}/g,   cls ? `${cls.className}${cls.section ? ' '+cls.section+'반' : ''}` : '')
    .replace(/{선생님이름}/g, teacherName)
    .replace(/{선생님닉네임}/g, teacherNickname)
    .replace(/{날짜}/g, dateStr)
    .replace(/{출결서비스링크}/g, inviteLink)
}

const GUIDE_CATS = ['출석', '결석', '지각', '하교']

// ─── 학부모 메시지 발송
function MsgModal({ student, cls, user, onClose }) {
  const { success, error } = useToast()
  const phone = student.parentPhone?.replace(/[^0-9]/g, '') || ''

  // contactMethod는 저장 후 즉시 반영되도록 로컬 state로 관리
  const [contactMethod, setContactMethodState] = useState(student.contactMethod || '')
  const [guideTab, setGuideTab]  = useState('결석')
  const [text, setText]          = useState('')

  // MessageGuide에 등록된 카테고리 — 모바일은 4개만 표시
  const allGuides  = MessageGuides.byTeacher(user?.id || '')
  const guideCats  = GUIDE_CATS
  const guides     = allGuides.filter(g => g.category === guideTab)

  // 연락 방법 저장 (학생 DB에 반영)
  const saveContactMethod = (method) => {
    StudentsDB.update(student.id, { contactMethod: method })
    setContactMethodState(method)
  }

  const applyGuide = (content) => setText(replacePlaceholders(content, student, cls, user))

  const sendSMS = () => {
    if (!phone) { error('학부모 전화번호가 없습니다.'); return }
    window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
    onClose()
  }
  const sendKakao = () => {
    if (!phone) { error('학부모 전화번호가 없습니다.'); return }
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

  // ── 연락 방법 미설정 → 설정 화면
  if (!contactMethod) {
    return (
      <Modal open={true} onClose={onClose} title="📱 연락 방법 설정" width={380}>
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>{student.name} 학부모</div>
          <div style={{ fontSize: '13px', color: C.muted, marginBottom: '24px' }}>어떤 방법으로 연락하시나요?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => saveContactMethod('sms')}
              style={{ padding: '15px', borderRadius: '12px', border: '2px solid #3b82f6', background: '#eff6ff', color: '#1d4ed8', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💬 문자 메시지
            </button>
            <button onClick={() => saveContactMethod('kakao')}
              style={{ padding: '15px', borderRadius: '12px', border: '2px solid #ca8a04', background: '#fefce8', color: '#3c1e1e', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💛 카카오톡
            </button>
            <button onClick={() => saveContactMethod('both')}
              style={{ padding: '15px', borderRadius: '12px', border: '2px solid #9ca3af', background: '#f9fafb', color: '#374151', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💬💛 문자 + 카카오 둘 다
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── 메시지 발송 화면
  const showSMS   = contactMethod === 'sms'   || contactMethod === 'both'
  const showKakao = contactMethod === 'kakao' || contactMethod === 'both'

  return (
    <Modal open={true} onClose={onClose} title="📱 학부모 메시지" width={500}>
      {/* 헤더: 학생명 + 연락방법 배지 + 변경 버튼 */}
      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '14px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
        <span style={{ fontWeight:600, color:C.text }}>{student.name}</span>
        <span>{fmtPhone(student.parentPhone) || '전화번호 없음'}</span>
        {contactMethod === 'kakao' && <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px', background:'#FEE500', color:'#3c1e1e' }}>💛 카톡</span>}
        {contactMethod === 'sms'   && <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px', background:'#eff6ff', color:'#1d4ed8' }}>💬 문자</span>}
        {contactMethod === 'both'  && <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'4px', background:'#f3f4f6', color:'#6b7280' }}>💬💛 둘 다</span>}
        <button onClick={() => setContactMethodState('')}
          style={{ marginLeft:'auto', fontSize:'11px', color:C.muted, background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'2px 8px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          변경
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* 1단계: 카테고리 탭 */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '8px' }}>① 카테고리 선택</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {guideCats.map(cat => (
              <button key={cat} onClick={() => { setGuideTab(cat); setText('') }}
                style={{ padding: '4px 10px', borderRadius: '12px', border: `1.5px solid ${guideTab===cat ? C.primary : C.border}`, background: guideTab===cat ? '#fff7ed' : '#fff', color: guideTab===cat ? C.primary : C.muted, fontSize: '12px', fontWeight: guideTab===cat ? 700 : 400, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: '#f9fafb', border: '1px solid #e5e7eb', fontSize: '11px', color: '#9ca3af' }}>
            💡 추첨·종강·개강 등 다른 문구는 PC 버전에서 발송해주세요.
          </div>
        </div>

        {/* 2단계: 문구 선택 */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '8px' }}>② 문구 선택</div>
          {guides.length === 0 ? (
            <div style={{ fontSize: '12px', color: C.muted, padding: '12px', background: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
              이 카테고리에 등록된 문구가 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '160px', overflowY: 'auto' }}>
              {guides.map(g => (
                <button key={g.id} onClick={() => applyGuide(g.content)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: `1.5px solid ${text === replacePlaceholders(g.content, student, cls, user) ? C.primary : C.border}`, background: text === replacePlaceholders(g.content, student, cls, user) ? '#fff7ed' : '#f9fafb', textAlign: 'left', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}
                  onMouseEnter={e => { e.currentTarget.style.background='#fff7ed'; e.currentTarget.style.borderColor=C.primary }}
                  onMouseLeave={e => { const sel = text === replacePlaceholders(g.content, student, cls, user); e.currentTarget.style.background=sel?'#fff7ed':'#f9fafb'; e.currentTarget.style.borderColor=sel?C.primary:C.border }}>
                  {g.title && <div style={{ fontSize: '11px', fontWeight: 700, color: C.primary, marginBottom: '2px' }}>{g.title}</div>}
                  <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {g.content}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3단계: 발송 내용 확인 + 직접 수정 */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: C.muted, marginBottom: '6px' }}>
            ③ {text ? '발송 내용 확인 · 수정' : '직접 입력'}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
            placeholder="위에서 문구를 선택하거나 직접 입력하세요..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: `1.5px solid ${text ? C.primary : C.border}`, fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.7 }} />
        </div>

        {/* 발송 버튼 — contactMethod에 설정된 방법만 표시 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {showSMS && (
            <button onClick={sendSMS}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #3b82f6', background: '#3b82f6', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💬 문자 발송
            </button>
          )}
          {showKakao && (
            <button onClick={sendKakao}
              style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #ca8a04', background: '#fee500', color: '#3c1e1e', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
              💛 카톡 발송
            </button>
          )}
          <button onClick={copyText}
            style={{ padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${C.border}`, background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', color: C.muted }}>
            복사
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── 출결초대 모달
function InviteModal({ student, user, onClose, onSent }) {
  const phone = student.parentPhone?.replace(/[^0-9]/g, '') || ''
  const link  = `${window.location.origin}/parent-invite?phone=${encodeURIComponent(student.parentPhone||'')}&teacher=${encodeURIComponent(user?.id||'')}`
  const defaultText = `안녕하세요 😊 ${student.name} 학생 학부모님!\n출결 현황을 실시간으로 확인하실 수 있는 출결서비스에 초대드립니다.\n아래 링크를 클릭해 가입해주세요 🙏\n${link}`
  const [text, setText] = useState(defaultText)
  const { success } = useToast()

  const send = (method) => {
    if (method === 'kakao') window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${phone}&message=${encodeURIComponent(text)}`)
    else window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
    StudentsDB.update(student.id, { parentInviteSentAt: new Date().toISOString() })
    onSent && onSent(student.id)
    success('초대 메시지가 발송되었습니다.')
    onClose()
  }
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text
      document.body.appendChild(ta); ta.select(); document.execCommand('copy')
      document.body.removeChild(ta)
    })
    success('복사되었습니다.')
  }

  return (
    <Modal open={true} onClose={onClose} title={`📨 출결초대 — ${student.name}`} width={480}>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <div style={{ fontSize:'13px', color:C.muted }}>
          아래 문구를 확인하고 발송 방법을 선택하세요.
        </div>
        <textarea
          value={text} onChange={e => setText(e.target.value)} rows={7}
          style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', resize:'vertical', outline:'none', lineHeight:1.6, boxSizing:'border-box' }}
        />
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          <button onClick={() => send('sms')}
            style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:'#3b82f6', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            💬 문자 발송
          </button>
          <button onClick={() => send('kakao')}
            style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:'#FEE500', color:'#3C1E1E', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            💛 카카오 발송
          </button>
          <button onClick={copy}
            style={{ padding:'11px 16px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            복사
          </button>
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
// ─── 진도 체크 모달 (공통 컴포넌트 — 교구/단계 변경 지원)
function ProgCheckModal({ student, initialProductId, spProds, teacherId, onClose, onSaved }) {
  const classId = student._clsId || student.classIds?.[0] || ''
  const [selProductId, setSelProductId] = React.useState(initialProductId || '')
  const [selStage, setSelStage] = React.useState(() => {
    const si = SupplyItems.byClassStudent(classId, student.id)[0]
    return si?.stage ? Number(si.stage) : 1
  })
  const [tick, setTick] = React.useState(0)

  const si = SupplyItems.byClassStudent(classId, student.id)[0]
  const product = spProds.find(p => p.id === selProductId)
  if (!si || !product) return null

  const spp = product.sessionsPerStage || 12
  const alertSess = product.alertSession || 3
  const prog = SupplyStudentProgress.byStudent(student.id, classId).find(p => p.productId === selProductId)
  const curStage = prog?.curStage || selStage || 1
  const maxShowStage = Math.max(selStage, curStage)
  const STAGES = Array.from({ length: maxShowStage }, (_, i) => i + 1)
  const maxStage = product.maxStage || 10

  const origProductId = si?.productId || ''
  const origStage = si?.stage ? Number(si.stage) : 1
  const isChanged = selProductId !== origProductId || selStage !== origStage

  // 다음 진도 state
  const [nextProductId, setNextProductId] = React.useState(prog?.nextProductId || '')
  const [nextStage, setNextStage] = React.useState(prog?.nextStage || 1)
  const [nextSaved, setNextSaved] = React.useState(false)
  const nextProduct = spProds.find(p => p.id === nextProductId)
  const nextMaxStage = nextProduct?.maxStage || 10
  const origNextProductId = prog?.nextProductId || ''
  const origNextStage = prog?.nextStage || 1
  const isNextChanged = nextProductId !== origNextProductId || Number(nextStage) !== Number(origNextStage)

  const handleProductChange = (newId) => {
    setSelProductId(newId)
    setSelStage(1)
  }

  const handleApply = () => {
    if (!si) return
    SupplyItems.upsert({ ...si, productId: selProductId, stage: selStage })
    onSaved && onSaved()
    setTick(t => t + 1)
  }

  const handleSaveNext = () => {
    if (!nextProductId) return
    const base = prog || { id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId: selProductId, curStage: selStage, curSession: 1, createdAt: now() }
    SupplyStudentProgress.upsert({ ...base, nextProductId, nextStage: Number(nextStage), updatedAt: now() })
    setNextSaved(true)
    setTimeout(() => setNextSaved(false), 2000)
    onSaved && onSaved()
  }

  const toggleCheck = (productId, stage, sessionNo) => {
    const existing = SupplySessionChecks.byProductStudent(productId, student.id, classId).find(c => c.stage===stage && c.sessionNo===sessionNo)
    if (existing) SupplySessionChecks.delete(existing.id)
    else SupplySessionChecks.upsert({ id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId, stage, sessionNo, checkedAt: now(), createdAt: now() })
    const allChks = SupplySessionChecks.byProductStudent(productId, student.id, classId).filter(c => c.stage===stage)
    const maxSess = allChks.length > 0 ? Math.max(...allChks.map(c => c.sessionNo)) : 1
    SupplyStudentProgress.upsert({ id: uid(), teacherId: teacherId||'', studentId: student.id, classId, productId, curStage: stage, curSession: maxSess, updatedAt: now(), createdAt: now() })
    onSaved && onSaved()
    setTick(t => t + 1)
  }

  return (
    <Modal open={true} onClose={onClose} title={`📊 ${student.name} 진도 체크`} width={600}>
      <div style={{ padding:'16px 24px', overflowY:'auto', maxHeight:'65vh' }}>
        {/* 교구 시리즈 / 단계 변경 */}
        <div style={{ padding:'12px 14px', background:'#f9fafb', borderRadius:'10px', marginBottom:'16px' }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:'10px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'160px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>교구 시리즈</label>
              <select value={selProductId} onChange={e => handleProductChange(e.target.value)}
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {spProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', minWidth:'90px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>단계</label>
              <select value={selStage} onChange={e => setSelStage(Number(e.target.value))}
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {Array.from({ length: maxStage }, (_, i) => i+1).map(s => (
                  <option key={s} value={s}>{s}단계</option>
                ))}
              </select>
            </div>
            {isChanged && (
              <button onClick={handleApply}
                style={{ padding:'8px 18px', borderRadius:'8px', border:'none', background:'#f97316', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                ✓ 적용
              </button>
            )}
          </div>
          <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'8px' }}>
            🤖 {product.name} · {selStage}단계 배정 · 단계당 {spp}차시 기준
          </div>
        </div>
        {/* 이전 단계 완료 표시 */}
        {selStage > 1 && (
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'10px' }}>
            {Array.from({ length: selStage - 1 }, (_, i) => i + 1).map(s => (
              <div key={s} style={{ padding:'6px 12px', borderRadius:'8px', background:'#f0fdf4', border:'1px solid #86efac', fontSize:'12px', fontWeight:600, color:'#16a34a' }}>
                ✅ {s}단계 완료
              </div>
            ))}
          </div>
        )}
        {/* 현재 단계 진도 목록 */}
        {(() => {
          const stage = selStage
          const stagePlans = SupplyProductPlans.byProductStage(selProductId, stage).sort((a,b) => a.sessionNo-b.sessionNo)
          const sessions = stagePlans.length > 0 ? stagePlans
            : Array.from({ length: spp }, (_, i) => ({ id:`d_${stage}_${i+1}`, stage, sessionNo:i+1, dummy:true }))
          const stageChecks = SupplySessionChecks.byProductStudent(selProductId, student.id, classId).filter(c => c.stage===stage)
          const checkedNos = new Set(stageChecks.map(c => c.sessionNo))
          const cnt = stageChecks.length
          const isDone = cnt >= spp
          const actualSessions = sessions.length > 0 ? sessions.length : spp
          const isAlert = cnt >= (actualSessions - alertSess) && !isDone
          return (
            <div style={{ border:`1px solid ${isDone?'#86efac':isAlert?'#fde68a':'#e5e7eb'}`, borderRadius:'10px', overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background:isDone?'#f0fdf4':isAlert?'#fffbeb':'#f9fafb', display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'13px', fontWeight:700, color:isDone?'#16a34a':isAlert?'#f59e0b':'#111827' }}>{stage}단계</span>
                <span style={{ fontSize:'12px', color:'#6b7280' }}>{cnt}/{spp}차시</span>
                {isDone && (() => {
                  const np = nextProductId ? spProds.find(p => p.id === nextProductId) : null
                  return np
                    ? <span style={{ fontSize:'11px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>✅ 완료 → {np.name} {nextStage}단계 준비</span>
                    : <span style={{ fontSize:'11px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #86efac', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>✅ 완료</span>
                })()}
                {isAlert && !isDone && (() => {
                  const np = nextProductId ? spProds.find(p => p.id === nextProductId) : null
                  const alertLabel = np
                    ? `${np.name} ${nextStage}단계 준비 필요`
                    : `${product.name} ${selStage + 1}단계 준비 필요`
                  return <span style={{ fontSize:'11px', background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a', borderRadius:'4px', padding:'0 6px', fontWeight:700 }}>⚠️ {alertLabel}</span>
                })()}
              </div>
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'4px' }}>
                {sessions.map(sess => {
                  const isChk = checkedNos.has(sess.sessionNo)
                  return (
                    <div key={sess.id} onClick={() => toggleCheck(selProductId, stage, sess.sessionNo)}
                      style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 10px', borderRadius:'7px', background:isChk?'#f0fdf4':'#fff', border:`1px solid ${isChk?'#86efac':'#e5e7eb'}`, cursor:'pointer', transition:'all .12s' }}>
                      <div style={{ width:'20px', height:'20px', borderRadius:'50%', border:`2px solid ${isChk?'#16a34a':'#e5e7eb'}`, background:isChk?'#16a34a':'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {isChk && <span style={{ color:'#fff', fontSize:'12px', fontWeight:700 }}>✓</span>}
                      </div>
                      <span style={{ fontSize:'13px', fontWeight:isChk?600:400, color:isChk?'#16a34a':'#111827' }}>
                        {sess.sessionNo}차시{!sess.dummy && sess.title ? ` · ${sess.title}` : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </div>
      {/* 다음 진도 준비 */}
      <div style={{ padding:'14px 24px', borderTop:'1px solid #e5e7eb', background:'#fafafa' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', marginBottom:'10px' }}>📌 다음 진도 준비</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:'10px', flexWrap:'wrap' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px', flex:1, minWidth:'150px' }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>다음 교구</label>
            <select value={nextProductId} onChange={e => { setNextProductId(e.target.value); setNextStage(1) }}
              style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
              <option value="">선택 안함</option>
              {spProds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {nextProductId && (
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', minWidth:'90px' }}>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280' }}>단계</label>
              <select value={nextStage} onChange={e => setNextStage(Number(e.target.value))}
                style={{ padding:'7px 10px', borderRadius:'8px', border:'1.5px solid #e5e7eb', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', cursor:'pointer', outline:'none' }}>
                {Array.from({ length: nextMaxStage }, (_, i) => i+1).map(s => (
                  <option key={s} value={s}>{s}단계</option>
                ))}
              </select>
            </div>
          )}
          <button onClick={handleSaveNext} disabled={!nextProductId || (!isNextChanged && !nextSaved)}
            style={{ padding:'8px 16px', borderRadius:'8px', border:'none', background: nextSaved ? '#16a34a' : (nextProductId && isNextChanged ? '#f97316' : '#e5e7eb'), color: (nextProductId && isNextChanged) || nextSaved ? '#fff' : '#9ca3af', fontSize:'13px', fontWeight:700, cursor: nextProductId && isNextChanged ? 'pointer' : 'default', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', transition:'all .2s' }}>
            {nextSaved ? '✅ 저장됨' : '저장'}
          </button>
        </div>
        {nextProduct && (
          <div style={{ marginTop:'8px', fontSize:'12px', color:'#6b7280' }}>
            → {nextProduct.name} {nextStage}단계로 이어집니다
          </div>
        )}
      </div>
      <div style={{ padding:'12px 24px', borderTop:'1px solid #e5e7eb', display:'flex', gap:'8px' }}>
        <button onClick={onClose}
          style={{ flex:1, padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
          닫기
        </button>
      </div>
    </Modal>
  )
}

function FutureStudentRow({ s, idx, onMsgOpen, onStudentClick, classId, onProgOpen, spProds, user }) {
  const note = s.memo || ''
  const [showInfo, setShowInfo] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  const [memo, setMemo] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSent, setInviteSent] = useState(!!s.parentInviteSentAt)

  const handlePredictClick = () => {
    setShowInfo(true)
    setTimeout(() => setShowInfo(false), 2500)
  }

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', background: '#fff', borderLeft: '3px solid transparent', transition: 'all .12s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '35px 90px 90px 130px 220px 110px 90px 1fr', gap: '6px', alignItems: 'center', padding: '10px 14px' }}>

        {/* 순번 */}
        <span style={{ fontSize: '12px', color: C.muted, textAlign: 'center' }}>{idx+1}</span>

        {/* 학년·반·번호 */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted, lineHeight: 1.4 }}>
          {s.grade ? s.grade+'학년' : ''}{s.classNum ? ' '+s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}
        </div>

        {/* 이름 */}
        <div style={{ textAlign: 'center' }}>
          {(() => {
            const _cid2 = classId || s.classIds?.[0] || ''
            const _si2 = SupplyItems.byClassStudent(_cid2, s.id)[0]
            if (!_si2?.productId) return null
            const _prod2 = (spProds||[]).find(p => p.id === _si2.productId)
            const _prog2 = SupplyStudentProgress.byStudent(s.id, _cid2).find(p => p.productId === _si2.productId)
            const _cs2 = _prog2?.curStage || _si2.stage || 1
            const _spp2 = _prod2?.sessionsPerStage || 12
            const _chk2 = SupplySessionChecks.byProductStudent(_si2.productId, s.id, _cid2).filter(c => c.stage === _cs2).length
            const _plans2 = SupplyProductPlans.byProductStage(_si2.productId, _cs2)
            const _actual2 = _plans2.length > 0 ? _plans2.length : _spp2
            const _alert2 = _prod2?.alertSession || 3
            const _done2 = _chk2 >= _actual2
            const _near2 = _chk2 >= (_actual2 - _alert2) && !_done2
            if (!_done2 && !_near2) return null
            const _np2 = _prog2?.nextProductId ? (spProds||[]).find(p => p.id === _prog2.nextProductId) : null
            const _lbl2 = _done2
              ? (_np2 ? `${_np2.name} ${_prog2.nextStage || 1}단계 준비` : `${_prod2?.name} ${_cs2+1}단계 준비`)
              : (_np2 ? `${_np2.name} ${_prog2.nextStage || 1}단계 준비 필요` : `${_prod2?.name} ${_cs2+1}단계 준비 필요`)
            return (
              <div style={{ marginBottom: '4px', fontSize: '10px', fontWeight: 700, color: '#ef4444', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap', display: 'inline-block', cursor: 'pointer' }}
                onClick={() => onProgOpen && onProgOpen(s, _si2.productId)}>
                ⚠️ {_lbl2}
              </div>
            )
          })()}
          <span onClick={() => onStudentClick(s)}
            style={{ fontSize: '14px', fontWeight: 700, color: C.primary, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{s.name}</span>
          {(s.remark || (s.student_careers?.length > 0) || s.status === 'cancel_before' || s.status === 'cancel_after' || (s.relations||[]).length > 0) && (
            <div style={{ display:'flex', flexDirection:'column', gap:'2px', marginTop:'3px', alignItems:'center' }}>
              {s.remark && <span style={{ fontSize:'10px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 5px', fontWeight:600 }}>{s.remark}</span>}
              {(s.student_careers?.length > 0) && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:s.student_careers.length<=1?'#eff6ff':'#f0fdf4', border:`1px solid ${s.student_careers.length<=1?'#bfdbfe':'#86efac'}`, color:s.student_careers.length<=1?'#1d4ed8':'#15803d' }}>{s.student_careers.length<=1?'신규':'기존'}</span>}
              {(s.status==='cancel_before'||s.status==='cancel_after') && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626' }}>{s.status==='cancel_after'?'개강후취소':'개강전취소'}{s.cancel_info?.date&&(()=>{const [y,m,day]=s.cancel_info.date.split('-');return `-${y.slice(2)}.${parseInt(m)}.${parseInt(day)}`})()}</span>}
              {(s.relations||[]).map((r,ri)=><span key={ri} style={{ fontSize:'10px', fontWeight:600, padding:'1px 5px', borderRadius:'4px', background:r.type==='쌍둥이'?'#fdf4ff':r.type==='형제'?'#eff6ff':r.type==='남매'?'#f0fdf4':'#fff7ed', border:`1px solid ${r.type==='쌍둥이'?'#e9d5ff':r.type==='형제'?'#bfdbfe':r.type==='남매'?'#86efac':'#fed7aa'}`, color:r.type==='쌍둥이'?'#7e22ce':r.type==='형제'?'#1d4ed8':r.type==='남매'?'#15803d':'#c2410c' }}>{r.type}{r.with?` · ${r.with}`:''}</span>)}
            </div>
          )}
        </div>

        {/* 학부모 전화 */}
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

        {/* 진도 */}
        {(() => {
          const _cid = classId || s.classIds?.[0] || ''
          const si = SupplyItems.byClassStudent(_cid, s.id)[0]
          if (!si?.productId) return <span style={{ fontSize:'11px', color:'#d1d5db', textAlign:'center' }}>-</span>
          const prod = (spProds||[]).find(p => p.id === si.productId)
          const prog = SupplyStudentProgress.byStudent(s.id, _cid).find(p => p.productId === si.productId)
          const curStage = prog?.curStage || si.stage || 1
          const spp = prod?.sessionsPerStage || 12
          const chk = SupplySessionChecks.byProductStudent(si.productId, s.id, _cid).filter(c => c.stage === curStage).length
          const pct = Math.min(Math.round(chk/spp*100),100)
          const stagePlans = SupplyProductPlans.byProductStage(si.productId, curStage)
          const actualSess = stagePlans.length > 0 ? stagePlans.length : spp
          const alertSess = prod?.alertSession || 3
          const isDone = chk >= actualSess
          const isAlert = chk >= (actualSess - alertSess) && !isDone
          const nextProd = prog?.nextProductId ? spProds.find(p => p.id === prog.nextProductId) : null
          const alertLabel = isDone
            ? (nextProd ? `${nextProd.name} ${prog.nextStage || 1}단계 준비` : `${prod?.name} ${curStage+1}단계 준비`)
            : (nextProd ? `${nextProd.name} ${prog.nextStage || 1}단계 준비 필요` : `${prod?.name} ${curStage+1}단계 준비 필요`)
          return (
            <div onClick={() => onProgOpen && onProgOpen(s, si.productId)}
              style={{ fontSize:'11px', cursor:'pointer', padding:'4px 6px', borderRadius:'6px', transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div style={{ fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>{prod?.name||si.name||''}</div>
              <div style={{ color:'#6b7280', marginTop:'1px' }}>{curStage}단계 {chk}/{spp}차시</div>
              <div style={{ height:'3px', background:'#e5e7eb', borderRadius:'2px', marginTop:'3px', width:'70px' }}>
                <div style={{ height:'100%', borderRadius:'2px', width:`${pct}%`, background:pct>=100?'#16a34a':pct>=80?'#f59e0b':'#f97316' }} />
              </div>
            </div>
          )
        })()}

        {/* 출결초대 */}
        <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
          {s.parentPhone ? (
            <button onClick={() => setInviteOpen(true)}
              style={{ padding:'4px 8px', borderRadius:'7px', border:`1.5px solid ${inviteSent?'#86efac':'#a78bfa'}`, background:inviteSent?'#f0fdf4':'#f5f3ff', color:inviteSent?'#16a34a':'#7c3aed', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
              {inviteSent ? '✅발송됨' : '📨초대'}
            </button>
          ) : <span style={{ fontSize:'11px', color:'#d1d5db' }}>-</span>}
          <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'4px',
            background: s.parentJoined ? '#f0fdf4' : '#f9fafb',
            border: `1px solid ${s.parentJoined ? '#86efac' : '#e5e7eb'}`,
            color: s.parentJoined ? '#16a34a' : '#9ca3af' }}>
            {s.parentJoined ? '출결 ON' : '출결 OFF'}
          </span>
          {inviteOpen && <InviteModal student={s} user={user} onClose={() => setInviteOpen(false)} onSent={() => setInviteSent(true)} />}
        </div>

        {/* 특이사항·메모 */}
        <div>
          {s.memo && (
            <div style={{ fontSize: '11px', color: '#92400e', background: '#fffbeb', padding: '3px 8px', borderRadius: '5px', marginBottom: '5px', display: 'inline-block' }}>👤 {s.memo}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {memo
              ? <span style={{ fontSize: '12px', color: '#374151', background: '#fffbeb', padding: '3px 9px', borderRadius: '6px', border: '1px solid #fde68a' }}>📌 {memo}</span>
              : <span style={{ fontSize: '11px', color: '#d1d5db' }}>메모 없음</span>
            }
            <div style={{ display:'flex', gap:'6px' }}>
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
      </div>

      {memoOpen && (
        <StudentMemoModal student={{ ...s, memo }} onClose={() => setMemoOpen(false)} onSave={v => setMemo(v)} />
      )}
      {scOpen && _si?.productId && (
        <SupplyCheckModal
          studentName={s.name} alertLabel={_supplyLabel}
          studentId={s.id} classId={_cid} productId={_si.productId}
          teacherId={user?.id || ''}
          onClose={() => setScOpen(false)}
          onDelivered={() => setScLocalDelivered(true)}
        />
      )}
    </div>
  )
}

// ─── 단일 학생 출석 행
function StudentRow({ s, idx, rec, onMark, onMsgOpen, onStudentClick, onProgOpen, classId, spItems, spProds, spProg, spChecks, user }) {
  const status = rec?.status || 'pending'
  const cfg = ATTENDANCE_STATUS[status]
  const isPending = status === 'pending'
  const absentReason = rec?.absentReason || ''
  const note         = rec?.note         || ''
  const setField = (field, val) => onMark(s.id, status === 'pending' ? 'present' : status, { [field]: val })
  const isAbsent = ['absent','late','early'].includes(status)
  const appendNote = (text) => setField('note', note ? note + ' / ' + text : text)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSent, setInviteSent] = useState(!!s.parentInviteSentAt)

  // ── 교구 준비 알림 사전 계산 (이름 위 뱃지용)
  const _cid = classId || s.classIds?.[0] || ''
  const _si = spItems.find(i => i.studentId === s.id && i.classId === _cid)
  const _prod = _si?.productId ? spProds.find(p => p.id === _si.productId) : null
  const _prog = _si?.productId ? spProg.find(p => p.studentId === s.id && p.productId === _si.productId) : null
  const _curStage = _prog?.curStage || _si?.stage || 1
  const _spp = _prod?.sessionsPerStage || 12
  const _chk = _si?.productId ? spChecks.filter(c => c.studentId === s.id && c.productId === _si.productId && c.stage === _curStage).length : 0
  const _stagePlans = _si?.productId ? SupplyProductPlans.byProductStage(_si.productId, _curStage) : []
  const _actualSess = _stagePlans.length > 0 ? _stagePlans.length : _spp
  const _alertSess = _prod?.alertSession || 3
  const _supplyDone = _si?.productId ? _chk >= _actualSess : false
  const _supplyAlert = _si?.productId ? (_chk >= (_actualSess - _alertSess) && !_supplyDone) : false
  const _nextProd = _prog?.nextProductId ? spProds.find(p => p.id === _prog.nextProductId) : null
  const _supplyLabel = _supplyDone
    ? (_nextProd ? `${_nextProd.name} ${_prog.nextStage || 1}단계 준비` : `${_prod?.name} ${_curStage+1}단계 준비`)
    : (_nextProd ? `${_nextProd.name} ${_prog.nextStage || 1}단계 준비 필요` : `${_prod?.name} ${_curStage+1}단계 준비 필요`)
  const [scOpen, setScOpen] = useState(false)
  const [scLocalDelivered, setScLocalDelivered] = useState(false)
  const showSupplyBadge = (_supplyDone || _supplyAlert) && !_prog?.supplyDelivered && !scLocalDelivered

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6', background: isPending ? '#fff' : cfg.bg, borderLeft: `3px solid ${isPending ? 'transparent' : cfg.color}`, transition: 'all .12s' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '35px 90px 90px 130px 220px 110px 90px 1fr', gap: '6px', alignItems: 'center', padding: '10px 14px' }}>

        {/* 순번 */}
        <span style={{ fontSize: '12px', color: C.muted, textAlign: 'center' }}>{idx+1}</span>

        {/* 학년·반·번호 */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted, lineHeight: 1.4 }}>
          {s.grade ? s.grade+'학년' : ''}{s.classNum ? ' '+s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}
        </div>

        {/* 이름 */}
        <div style={{ textAlign: 'center' }}>
          {showSupplyBadge && (
            <div
              onClick={() => setScOpen(true)}
              style={{ marginBottom: '4px', fontSize: '10px', fontWeight: 700, color: '#ef4444', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap', display: 'inline-block', cursor: 'pointer' }}>
              ⚠️ {_supplyLabel}
            </div>
          )}
          <span onClick={() => onStudentClick(s)}
            style={{ fontSize: '14px', fontWeight: 700, color: C.primary, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}>{s.name}</span>
          {(s.remark || (s.student_careers?.length > 0) || s.status === 'cancel_before' || s.status === 'cancel_after' || (s.relations||[]).length > 0) && (
            <div style={{ display:'flex', flexDirection:'column', gap:'2px', marginTop:'3px', alignItems:'center' }}>
              {s.remark && <span style={{ fontSize:'10px', background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:'4px', padding:'1px 5px', fontWeight:600 }}>{s.remark}</span>}
              {(s.student_careers?.length > 0) && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:s.student_careers.length<=1?'#eff6ff':'#f0fdf4', border:`1px solid ${s.student_careers.length<=1?'#bfdbfe':'#86efac'}`, color:s.student_careers.length<=1?'#1d4ed8':'#15803d' }}>{s.student_careers.length<=1?'신규':'기존'}</span>}
              {(s.status==='cancel_before'||s.status==='cancel_after') && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:'#fef2f2', border:'1px solid #fca5a5', color:'#dc2626' }}>{s.status==='cancel_after'?'개강후취소':'개강전취소'}{s.cancel_info?.date&&(()=>{const [y,m,day]=s.cancel_info.date.split('-');return `-${y.slice(2)}.${parseInt(m)}.${parseInt(day)}`})()}</span>}
              {(s.relations||[]).map((r,ri)=><span key={ri} style={{ fontSize:'10px', fontWeight:600, padding:'1px 5px', borderRadius:'4px', background:r.type==='쌍둥이'?'#fdf4ff':r.type==='형제'?'#eff6ff':r.type==='남매'?'#f0fdf4':'#fff7ed', border:`1px solid ${r.type==='쌍둥이'?'#e9d5ff':r.type==='형제'?'#bfdbfe':r.type==='남매'?'#86efac':'#fed7aa'}`, color:r.type==='쌍둥이'?'#7e22ce':r.type==='형제'?'#1d4ed8':r.type==='남매'?'#15803d':'#c2410c' }}>{r.type}{r.with?` · ${r.with}`:''}</span>)}
            </div>
          )}
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

        {/* 진도 */}
        {(() => {
          const si = spItems.find(i => i.studentId === s.id && i.classId === (classId || s.classIds?.[0] || ''))
          if (!si?.productId) return <span style={{ fontSize:'11px', color:'#d1d5db', textAlign:'center' }}>-</span>
          const prod = spProds.find(p => p.id === si.productId)
          const prog = spProg.find(p => p.studentId === s.id && p.productId === si.productId)
          const curStage = prog?.curStage || si.stage || 1
          const spp = prod?.sessionsPerStage || 12
          const chk = spChecks.filter(c => c.studentId === s.id && c.productId === si.productId && c.stage === curStage).length
          const pct = Math.min(Math.round(chk/spp*100),100)
          const stagePlans = SupplyProductPlans.byProductStage(si.productId, curStage)
          const actualSess = stagePlans.length > 0 ? stagePlans.length : spp
          const alertSess = prod?.alertSession || 3
          const isDone = chk >= actualSess
          const isAlert = chk >= (actualSess - alertSess) && !isDone
          const nextProd = prog?.nextProductId ? spProds.find(p => p.id === prog.nextProductId) : null
          const alertLabel = isDone
            ? (nextProd ? `${nextProd.name} ${prog.nextStage || 1}단계 준비` : `${prod?.name} ${curStage+1}단계 준비`)
            : (nextProd ? `${nextProd.name} ${prog.nextStage || 1}단계 준비 필요` : `${prod?.name} ${curStage+1}단계 준비 필요`)
          return (
            <div onClick={() => onProgOpen && onProgOpen(s, si.productId)}
              style={{ fontSize:'11px', cursor:'pointer', padding:'4px 6px', borderRadius:'6px', transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background='#f0fdf4'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div style={{ fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>{prod?.name||si.name||''}</div>
              <div style={{ color:'#6b7280', marginTop:'1px' }}>{curStage}단계 {chk}/{spp}차시</div>
              <div style={{ height:'3px', background:'#e5e7eb', borderRadius:'2px', marginTop:'3px', width:'70px' }}>
                <div style={{ height:'100%', borderRadius:'2px', width:`${pct}%`, background:pct>=100?'#16a34a':pct>=80?'#f59e0b':'#f97316' }} />
              </div>
            </div>
          )
        })()}

        {/* 출결초대 */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', textAlign:'center' }}>
          {s.parentPhone ? (
            <button onClick={() => setInviteOpen(true)}
              style={{ padding:'4px 8px', borderRadius:'7px', border:`1.5px solid ${inviteSent?'#86efac':'#a78bfa'}`, background:inviteSent?'#f0fdf4':'#f5f3ff', color:inviteSent?'#16a34a':'#7c3aed', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
              {inviteSent ? '✅발송됨' : '📨초대'}
            </button>
          ) : <span style={{ fontSize:'11px', color:'#d1d5db' }}>-</span>}
          <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'4px',
            background: s.parentJoined ? '#f0fdf4' : '#f9fafb',
            border: `1px solid ${s.parentJoined ? '#86efac' : '#e5e7eb'}`,
            color: s.parentJoined ? '#16a34a' : '#9ca3af' }}>
            {s.parentJoined ? '출결 ON' : '출결 OFF'}
          </span>
          {inviteOpen && <InviteModal student={s} user={user} onClose={() => setInviteOpen(false)} onSent={() => setInviteSent(true)} />}
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

// ─── 교구 준비/지급 체크 모달 (출석부용)
function SupplyCheckModal({ studentName, alertLabel, studentId, classId, productId, teacherId, onClose, onDelivered }) {
  const [tick, setTick] = useState(0)
  const prog = SupplyStudentProgress.byStudent(studentId, classId).find(p => p.productId === productId)
  const supplyReady     = prog?.supplyReady     || false
  const supplyDelivered = prog?.supplyDelivered || false

  const upsertProg = (patch) => {
    const base = prog || { id: uid(), teacherId, studentId, classId, productId, createdAt: now() }
    SupplyStudentProgress.upsert({ ...base, ...patch, updatedAt: now() })
    setTick(t => t + 1)
  }
  const toggleReady = () => upsertProg({ supplyReady: !supplyReady, supplyDelivered })
  const toggleDelivered = () => {
    upsertProg({ supplyReady, supplyDelivered: !supplyDelivered })
    if (!supplyDelivered) { onDelivered && onDelivered(); onClose() }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'16px', padding:'24px', maxWidth:'320px', width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom:'6px', fontSize:'10px', fontWeight:700, color:'#ef4444', background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'4px', padding:'3px 8px', display:'inline-block' }}>
          ⚠️ {alertLabel}
        </div>
        <div style={{ fontSize:'16px', fontWeight:700, color:'#111827', marginBottom:'20px' }}>{studentName}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'24px' }}>
          {[
            { checked: supplyReady,     label:'교구 준비 완료', toggle: toggleReady,     color:'#f59e0b', bg:'#fffbeb', border:'#fde68a' },
            { checked: supplyDelivered, label:'교구 지급 완료', toggle: toggleDelivered,  color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
          ].map((item, i) => (
            <label key={i} onClick={item.toggle}
              style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 16px', borderRadius:'10px', border:`1.5px solid ${item.checked ? item.border : '#e5e7eb'}`, background: item.checked ? item.bg : '#f9fafb', cursor:'pointer', transition:'all .15s' }}>
              <div style={{ width:'20px', height:'20px', borderRadius:'5px', border:`2px solid ${item.checked ? item.color : '#d1d5db'}`, background: item.checked ? item.color : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {item.checked && <span style={{ color:'#fff', fontSize:'13px', fontWeight:700, lineHeight:1 }}>✓</span>}
              </div>
              <span style={{ fontSize:'14px', fontWeight: item.checked ? 700 : 500, color: item.checked ? item.color : '#374151' }}>{item.label}</span>
            </label>
          ))}
        </div>
        <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'16px', textAlign:'center' }}>지급 완료 체크 시 알림이 자동으로 사라집니다</div>
        <button onClick={onClose}
          style={{ width:'100%', padding:'11px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
          닫기
        </button>
      </div>
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
function ClassAttendanceSection({ cls, date, allStudents, user }) {
  const today = todayStr()
  const [tick, setTick] = useState(0)
  const [msgStudent, setMsgStudent] = useState(null)
  const [selStudent, setSelStudent] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  const [progStudent,   setProgStudent]   = useState(null)
  const [progProductId, setProgProductId] = useState('')
  const [progTick,      setProgTick]      = useState(0)
  const [spItems,  setSpItems]  = useState(() => SupplyItems.byTeacher(cls.teacherId||''))
  const [spProds,  setSpProds]  = useState(() => SupplyProducts.byTeacher(cls.teacherId||''))
  const [spProg,   setSpProg]   = useState(() => SupplyStudentProgress.byTeacher(cls.teacherId||''))
  const [spChecks, setSpChecks] = useState(() => SupplySessionChecks.byTeacher(cls.teacherId||''))

  useEffect(() => {
    setSpItems(SupplyItems.byTeacher(cls.teacherId||''))
    setSpProds(SupplyProducts.byTeacher(cls.teacherId||''))
    setSpProg(SupplyStudentProgress.byTeacher(cls.teacherId||''))
    setSpChecks(SupplySessionChecks.byTeacher(cls.teacherId||''))
  }, [progTick])

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
      session: sessInfo?.session || 0, status,
      note: existing?.note || '', absentReason: existing?.absentReason || '', homeReturn: existing?.homeReturn || '',
      ...extra, markedAt: now(),
    })
    setTick(t => t + 1)
    pushAttendance(sorted.find(s => s.id === studentId), status, extra)
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
        <div style={{ display:'grid', gridTemplateColumns:'35px 90px 90px 130px 220px 110px 90px 1fr', gap:'6px', padding:'7px 14px', background:'#f3f4f6', borderBottom:`1px solid ${C.border}`, fontSize:'11px', fontWeight:700, color:C.muted, textAlign:'center' }}>
          <span>순번</span><span>학년·반·번호</span><span>이름</span><span>학부모전화</span><span>출석·지각·조퇴·결석</span><span>진도</span><span>출결초대</span><span>특이사항·메모</span>
        </div>
        {sorted.length === 0
          ? <div style={{ padding:'24px', textAlign:'center', color:C.muted, fontSize:'13px' }}>등록된 학생이 없습니다</div>
          : sorted.map((s, i) =>
              isFuture
                ? <FutureStudentRow key={s.id} s={s} idx={i} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} classId={cls.id} onProgOpen={(stu, pid) => { setProgStudent({...stu, _clsId: cls.id}); setProgProductId(pid) }} spProds={spProds} user={user} />
                : <StudentRow      key={s.id} s={s} idx={i} rec={getRec(s.id)} onMark={mark} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} onProgOpen={(stu, pid) => { setProgStudent({...stu, _clsId: cls.id}); setProgProductId(pid) }} classId={cls.id} spItems={spItems} spProds={spProds} spProg={spProg} spChecks={spChecks} user={user} />
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
      {msgStudent && <MsgModal student={msgStudent} cls={cls} user={user} onClose={() => setMsgStudent(null)} />}
      {selStudent  && <StudentDetailModal student={selStudent} onClose={() => setSelStudent(null)} />}
      {progStudent && (() => {
        const si = SupplyItems.byClassStudent(progStudent._clsId || progStudent.classIds?.[0]||'', progStudent.id)[0]
        if (!si?.productId) return null
        return (
          <ProgCheckModal
            student={progStudent}
            initialProductId={progProductId}
            spProds={spProds}
            teacherId={cls.teacherId||''}
            onClose={() => setProgStudent(null)}
            onSaved={() => { setSpItems(SupplyItems.byTeacher(cls.teacherId||'')); setProgTick(t => t+1) }}
          />
        )
      })()}
    </div>
  )
}

// ─── 날짜별 전체 출석 패널 (대시보드 스타일, 네비게이션 없음)
function DayAttendancePanel({ date, allClasses, allStudents, schoolClasses, user }) {
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
              <ClassAttendanceSection key={cls.id + date} cls={cls} date={date} allStudents={allStudents} user={user} />
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
  const [progStudent,  setProgStudent]  = useState(null)
  const [progProductId,setProgProductId]= useState('')
  const [progTick,     setProgTick]     = useState(0)
  const [spItems,  setSpItems]  = useState(() => cls ? SupplyItems.byTeacher(cls.teacherId||'') : [])
  const [spProds,  setSpProds]  = useState(() => cls ? SupplyProducts.byTeacher(cls.teacherId||'') : [])
  const [spProg,   setSpProg]   = useState(() => cls ? SupplyStudentProgress.byTeacher(cls.teacherId||'') : [])
  const [spChecks, setSpChecks] = useState(() => cls ? SupplySessionChecks.byTeacher(cls.teacherId||'') : [])

  useEffect(() => {
    if (!cls) return
    setSpItems(SupplyItems.byTeacher(cls.teacherId||''))
    setSpProds(SupplyProducts.byTeacher(cls.teacherId||''))
    setSpProg(SupplyStudentProgress.byTeacher(cls.teacherId||''))
    setSpChecks(SupplySessionChecks.byTeacher(cls.teacherId||''))
  }, [progTick])

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
    pushAttendance(activeStudents.find(s => s.id === studentId), status, extra)
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
          <div style={{ display:'grid', gridTemplateColumns:'35px 90px 90px 130px 220px 110px 90px 1fr', gap:'6px', padding:'8px 14px', background:'#f3f4f6', borderBottom:`1px solid ${C.border}`, fontSize:'11px', fontWeight:700, color:C.muted, textAlign:'center' }}>
            <span>순번</span>
            <span>학년·반·번호</span>
            <span>이름</span>
            <span>학부모전화</span>
            <span>출석·지각·조퇴·결석</span>
            <span>진도</span>
            <span>출결초대</span>
            <span>특이사항·메모</span>
          </div>
        )

        return sections.map(sec => {
          const secStudents = activeStudents.filter(s => {
            const sc = allClasses?.find ? allClasses.find(c => s.classIds?.includes(c.id)) : null
            return (sc?.section || '') === sec
          }).sort((a, b) => {
            const g = parseInt(a.grade||'0') - parseInt(b.grade||'0'); if (g) return g
            const c = parseInt(a.classNum||'0') - parseInt(b.classNum||'0'); if (c) return c
            const n = parseInt(a.number||'0') - parseInt(b.number||'0'); if (n) return n
            return (a.name||'').localeCompare(b.name||'','ko')
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
                      ? <StudentRow key={s.id} s={s} idx={i} rec={getRec(s.id)} onMark={mark} onMsgOpen={setMsgStudent} onStudentClick={setSelStudent} onProgOpen={(stu, pid) => { setProgStudent({...stu, _clsId: cls?.id}); setProgProductId(pid) }} classId={cls?.id} spItems={spItems} spProds={spProds} spProg={spProg} spChecks={spChecks} user={user} />
                      : (
                        <div key={s.id} style={{ display:'grid', gridTemplateColumns:'35px 90px 90px 130px 220px 110px 90px 1fr', gap:'6px', alignItems:'center', padding:'10px 14px', borderBottom: i<secStudents.length-1?`1px solid #f3f4f6`:'none', background:i%2===0?'#fff':'#fafafa', textAlign:'center' }}>
                          <span style={{ fontSize:'12px', color:C.muted }}>{i+1}</span>
                          <span style={{ fontSize:'12px', color:C.muted }}>{s.grade ? s.grade+'학년' : ''}{s.classNum ? ' '+s.classNum+'반' : ''}{s.number ? ' '+s.number+'번' : ''}</span>
                          <span onClick={() => setSelStudent(s)} style={{ fontSize:'14px', fontWeight:700, color:C.primary, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:'2px' }}>{s.name}</span>
                          <PhoneAction phone={s.parentPhone}>{fmtPhone(s.parentPhone)||'-'}</PhoneAction>
                          <span style={{ fontSize:'12px', color:C.muted }}>-</span>
                          <span style={{ fontSize:'12px', color:C.muted }}>-</span>
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

      {msgStudent  && <MsgModal student={msgStudent} cls={cls} user={user} onClose={() => setMsgStudent(null)} />}
      {selStudent  && <StudentDetailModal student={selStudent} onClose={() => setSelStudent(null)} />}
      {progStudent && (() => {
        const si = SupplyItems.byClassStudent(progStudent._clsId || progStudent.classIds?.[0]||'', progStudent.id)[0]
        if (!si?.productId) return null
        return (
          <ProgCheckModal
            student={progStudent}
            initialProductId={progProductId}
            spProds={spProds}
            teacherId={cls?.teacherId||''}
            onClose={() => setProgStudent(null)}
            onSaved={() => { setSpItems(SupplyItems.byTeacher(cls?.teacherId||'')); setProgTick(t => t+1) }}
          />
        )
      })()}
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

// ═══════════════════════════════════════════════════════════════════
//  MOBILE ATTENDANCE  (768px 이하 전용)
// ═══════════════════════════════════════════════════════════════════

function MobileStudentCard({ s, rec, onMark, onMsgOpen, onProgOpen, isFuture, spItem, spProg, spChecks, onInviteSent, user }) {
  const status   = rec?.status || 'pending'
  const statusMap = {
    present: { label:'출석', color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
    late:    { label:'지각', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
    leave:   { label:'조퇴', color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
    absent:  { label:'결석', color:'#ef4444', bg:'#fef2f2', border:'#fca5a5' },
    pending: { label:'미처리', color:'#9ca3af', bg:'#f9fafb', border:'#e5e7eb' },
  }
  const cur = statusMap[status] || statusMap.pending

  // 진도 미리보기
  const hasProgress = spItem?.productId
  const prog = hasProgress ? spProg?.find(p => p.studentId === s.id && p.productId === spItem.productId) : null
  const checks = hasProgress ? (spChecks||[]).filter(c => c.studentId === s.id && c.productId === spItem.productId) : []
  const curStage = prog?.curStage || spItem?.stage || 1
  const checkedInStage = checks.filter(c => c.stage === curStage).length

  // 사유/메모 모달
  const [reasonModal, setReasonModal] = useState(null) // 클릭된 status
  const [reasonVal, setReasonVal]     = useState('')
  const [noteVal, setNoteVal]         = useState('')

  const handleMark = (key) => {
    if (status === key) { onMark(s.id, 'pending'); return }
    if (['late','leave','absent'].includes(key)) {
      setReasonVal(rec?.absentReason || '')
      setNoteVal(rec?.note || '')
      setReasonModal(key)
    } else {
      onMark(s.id, key)
    }
  }
  const confirmReason = () => {
    onMark(s.id, reasonModal, { absentReason: reasonVal, note: noteVal })
    setReasonModal(null)
  }

  // 출결초대 모달
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSent, setInviteSent] = useState(!!s.parentInviteSentAt)

  return (
    <div style={{
      background: '#fff', borderRadius: '14px',
      border: `1.5px solid ${status !== 'pending' ? cur.border : '#e5e7eb'}`,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* 학생 정보 */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 한줄: 학년반 이름 👨‍👩‍👧 전화번호 출석상태 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {(s.grade || s.classNum) && (
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>
                {s.grade ? `${s.grade}학년` : ''}{s.classNum ? `${s.classNum}반` : ''}
              </span>
            )}
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>{s.name}</span>
            {s.parentPhone && (
              <>
                <span style={{ fontSize: '13px' }}>👨‍👩‍👧</span>
                <a href={`tel:${s.parentPhone.replace(/[^0-9]/g,'')}`}
                  style={{ color: '#3b82f6', textDecoration: 'underline', textUnderlineOffset: '2px', fontSize: '15px', fontWeight: 600 }}>
                  {fmtPhone(s.parentPhone)}
                </a>
                <button onClick={() => setInviteOpen(true)}
                  style={{ padding:'2px 8px', borderRadius:'6px', border:`1.5px solid ${inviteSent?'#86efac':'#a78bfa'}`, background: inviteSent ? '#f0fdf4' : '#fff', color: inviteSent ? '#16a34a' : '#7c3aed', fontSize:'11px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                  {inviteSent ? '✅출결' : '출결초대'}
                </button>
                {inviteOpen && <InviteModal student={s} user={user} onClose={() => setInviteOpen(false)} onSent={() => { setInviteSent(true); onInviteSent && onInviteSent(s.id) }} />}
              </>
            )}
            {status !== 'pending' && (
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: cur.bg, color: cur.color, border: `1px solid ${cur.border}` }}>
                {cur.label}
              </span>
            )}
            <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 6px', borderRadius:'4px',
              background: s.parentJoined ? '#f0fdf4' : '#f9fafb',
              border: `1px solid ${s.parentJoined ? '#86efac' : '#e5e7eb'}`,
              color: s.parentJoined ? '#16a34a' : '#9ca3af' }}>
              {s.parentJoined ? '출결 ON' : '출결 OFF'}
            </span>
          </div>
        </div>
        {/* 메시지 버튼 + 연락방법 */}
        {s.parentPhone && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button onClick={() => onMsgOpen(s)}
              style={{
                width: '44px', height: '44px', borderRadius: '10px', fontSize: '20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: s.contactMethod ? '1.5px solid #86efac' : '1.5px solid #fca5a5',
                background: s.contactMethod ? '#f0fdf4' : '#fef2f2',
              }}>
              💬
            </button>
            <span style={{ fontSize: '10px', fontWeight: 700, color: s.contactMethod ? '#16a34a' : '#ef4444' }}>
              {s.contactMethod === 'kakao' ? '💛카톡'
                : s.contactMethod === 'sms' ? '💬문자'
                : s.contactMethod === 'both' ? '💬💛'
                : '📵미설정'}
            </span>
          </div>
        )}
      </div>

      {/* 출석 버튼 */}
      {isFuture ? (
        <div style={{ padding: '10px 14px', background: '#f9fafb', borderTop: '1px solid #f3f4f6', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
          🗓️ 수업 예정일입니다
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: hasProgress ? 'repeat(5, 1fr)' : 'repeat(4, 1fr)', borderTop: '1px solid #f3f4f6' }}>
          {[
            { key:'present', label:'출석', emoji:'✅', color:'#16a34a', bg:'#f0fdf4', active:'#dcfce7' },
            { key:'late',    label:'지각', emoji:'⏰', color:'#d97706', bg:'#fffbeb', active:'#fef9c3' },
            { key:'leave',   label:'조퇴', emoji:'🚶', color:'#7c3aed', bg:'#f5f3ff', active:'#ede9fe' },
            { key:'absent',  label:'결석', emoji:'❌', color:'#ef4444', bg:'#fef2f2', active:'#fee2e2' },
          ].map((btn, i) => (
            <button key={btn.key} onClick={() => handleMark(btn.key)}
              style={{
                padding: '12px 4px', border: 'none',
                borderRight: '1px solid #f3f4f6',
                background: status === btn.key ? btn.active : '#fff',
                cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                transition: 'background .1s',
              }}>
              <span style={{ fontSize: '20px' }}>{btn.emoji}</span>
              <span style={{ fontSize: '11px', fontWeight: status===btn.key ? 700 : 400, color: status===btn.key ? btn.color : '#9ca3af' }}>{btn.label}</span>
            </button>
          ))}
          {hasProgress && (
            <button onClick={() => onProgOpen && onProgOpen(s, spItem.productId)}
              style={{
                padding: '12px 4px', border: 'none',
                background: '#f0fdf4', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              }}>
              <span style={{ fontSize: '20px' }}>📊</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>{curStage}단계/{checkedInStage}차시</span>
            </button>
          )}
        </div>
      )}
      {/* 사유/메모 모달 */}
      {reasonModal && (
        <Modal open={true} onClose={() => setReasonModal(null)}
          title={reasonModal === 'late' ? '⏰ 지각 사유' : reasonModal === 'leave' ? '🚶 조퇴 사유' : '❌ 결석 사유'}>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280', display:'block', marginBottom:'6px' }}>사유</label>
              <select value={reasonVal} onChange={e => setReasonVal(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', outline:'none' }}>
                {[
                  { value:'',           label:'사유 없음' },
                  { value:'sick',       label:'질병' },
                  { value:'field_trip', label:'현장학습' },
                  { value:'exp_trip',   label:'체험학습' },
                  { value:'condolence', label:'경조사' },
                  { value:'personal',   label:'개인사유' },
                  { value:'other',      label:'기타' },
                ].map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:'#6b7280', display:'block', marginBottom:'6px' }}>연락 내역</label>
              <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                {['📞 통화', '💬 문자', '💛 카톡'].map(method => {
                  const tag = method.split(' ')[1]
                  const active = noteVal.includes(tag)
                  return (
                    <button key={tag} onClick={() => setNoteVal(v => v ? (v.includes(tag) ? v : v + ' / ' + tag) : tag)}
                      style={{ flex:1, padding:'8px', borderRadius:'8px', border:`1.5px solid ${active?'#6b7280':'#e5e7eb'}`, background:active?'#f3f4f6':'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:active?700:400 }}>
                      {method}
                    </button>
                  )
                })}
              </div>
              <input value={noteVal} onChange={e => setNoteVal(e.target.value)}
                placeholder="메모 입력 (선택)"
                style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setReasonModal(null)}
                style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1.5px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
                취소
              </button>
              <button onClick={confirmReason}
                style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:'#f97316', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                확인
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── 일괄 메시지 발송 모달
function BulkMsgModal({ students, cls, user, statusFilter, onClose }) {
  const { success, error } = useToast()
  const label     = statusFilter === 'present' ? '출석' : '결석'
  const guides    = MessageGuides.byTeacher(user?.id || '').filter(g => g.category === label)
  const [text, setText]   = useState(guides[0] ? replacePlaceholders(guides[0].content, null, cls, user) : '')
  const [guideIdx, setGuideIdx] = useState(0)
  const [sentIds, setSentIds]   = useState(new Set())

  const filtered = students.filter(s => {
    const st = statusFilter
    return st === 'present'
      ? ['present','late'].includes(s._status)
      : s._status === 'absent'
  })

  const applyGuide = (g) => setText(replacePlaceholders(g.content, null, cls, user))

  const sendOne = (s) => {
    const phone = s.parentPhone?.replace(/[^0-9]/g, '')
    if (!phone) { error(`${s.name}: 전화번호 없음`); return }
    const msg = text.replace(/{학생이름}/g, s.name)
    const method = s.contactMethod || ''
    if (method === 'kakao') {
      window.open(`kakaoplus://plusfriend/talk/sendmessage?to=${phone}&message=${encodeURIComponent(msg)}`)
    } else {
      window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`)
    }
    setSentIds(prev => new Set([...prev, s.id]))
  }

  return (
    <Modal open={true} onClose={onClose} title={`📢 ${label} 일괄 안내`} width={520}>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

        {/* 문구 선택 */}
        {guides.length > 0 && (
          <div>
            <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'6px' }}>📋 문구 선택</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'120px', overflowY:'auto' }}>
              {guides.map((g, i) => (
                <button key={g.id} onClick={() => { setGuideIdx(i); applyGuide(g) }}
                  style={{ padding:'8px 12px', borderRadius:'8px', border:`1.5px solid ${guideIdx===i?C.primary:C.border}`, background:guideIdx===i?'#fff7ed':'#f9fafb', textAlign:'left', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:C.primary }}>{g.title||g.category}</div>
                  <div style={{ fontSize:'11px', color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.content.slice(0,50)}...</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 발송 내용 */}
        <div>
          <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'6px' }}>발송 내용 ({'{학생이름}'} 자동 치환)</div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4}
            style={{ width:'100%', padding:'10px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', resize:'vertical', outline:'none', boxSizing:'border-box', lineHeight:1.7 }} />
        </div>

        {/* 발송 대상 목록 */}
        <div>
          <div style={{ fontSize:'12px', fontWeight:600, color:C.muted, marginBottom:'6px' }}>발송 대상 {filtered.length}명</div>
          {filtered.length === 0
            ? <div style={{ fontSize:'13px', color:C.muted, padding:'12px', background:'#f9fafb', borderRadius:'8px', textAlign:'center' }}>{label} 처리된 학생이 없습니다</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'200px', overflowY:'auto' }}>
                {filtered.map(s => {
                  const sent = sentIds.has(s.id)
                  const method = s.contactMethod
                  return (
                    <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', borderRadius:'9px', border:`1px solid ${sent?'#86efac':C.border}`, background:sent?'#f0fdf4':'#fff' }}>
                      <div>
                        <span style={{ fontSize:'13px', fontWeight:600, color:'#111827' }}>{s.name}</span>
                        <span style={{ fontSize:'11px', color:C.muted, marginLeft:'8px' }}>{fmtPhone(s.parentPhone)||'전화번호 없음'}</span>
                        {method === 'kakao' && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:'#FEE500', color:'#3c1e1e', marginLeft:'6px' }}>💛카톡</span>}
                        {method === 'sms'   && <span style={{ fontSize:'10px', fontWeight:700, padding:'1px 5px', borderRadius:'4px', background:'#eff6ff', color:'#3b82f6', marginLeft:'6px' }}>💬문자</span>}
                      </div>
                      <button onClick={() => sendOne(s)} disabled={!s.parentPhone}
                        style={{ padding:'5px 12px', borderRadius:'7px', border:'none', background:sent?'#16a34a':'#f97316', color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', opacity:s.parentPhone?1:0.4 }}>
                        {sent ? '✓ 발송됨' : '발송'}
                      </button>
                    </div>
                  )
                })}
              </div>
          }
        </div>

        <button onClick={onClose}
          style={{ padding:'10px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
          닫기
        </button>
      </div>
    </Modal>
  )
}

function MobileAttendance({ user, pageParams = {} }) {
  const today    = todayStr()
  const allClasses  = ClassesDB.byTeacher(user.id)
  const allStudents = StudentsDB.byTeacher(user.id)

  const [selDate,   setSelDate]   = useState(() => pageParams.date || today)
  const [selClassId, setSelClassId] = useState(() => pageParams.classId || '')
  const [calOpen,   setCalOpen]   = useState(false)
  const [tick,      setTick]      = useState(0)
  const [msgStudent,   setMsgStudent]   = useState(null)
  const [bulkModal,    setBulkModal]    = useState(null) // 'present' | 'absent' | null
  const [progStudent,  setProgStudent]  = useState(null)
  const [progProductId,setProgProductId]= useState(null)
  const [progTick,     setProgTick]     = useState(0)

  const d = new Date(selDate + 'T00:00:00')
  const [calYear,  setCalYear]  = useState(d.getFullYear())
  const [calMonth, setCalMonth] = useState(d.getMonth())

  // 선택 날짜의 수업 목록 — section 기준 정렬 (A반 왼쪽, B반 오른쪽)
  const dayClasses = allClasses
    .filter(cls => calcSessionDates(cls).includes(selDate))
    .sort((a, b) => (a.section||'').localeCompare(b.section||'', 'ko'))

  // 수업 미선택 시 첫 번째 자동 선택
  useEffect(() => {
    if (!selClassId && dayClasses.length > 0) setSelClassId(dayClasses[0].id)
  }, [selDate])

  const selClass  = allClasses.find(c => c.id === selClassId)
  const isFuture  = selDate > today

  // 달력 점 표시용 날짜
  const classDates = [...new Set(allClasses.flatMap(c => calcSessionDates(c)))]

  // 진도 관련 데이터
  const spItems  = selClass ? SupplyItems.byClass(selClass.id) : []
  const spProds  = SupplyProducts.byTeacher(user.id)
  const spProg   = SupplyStudentProgress.byTeacher(user.id)
  const spChecks = SupplySessionChecks.byTeacher ? SupplySessionChecks.byTeacher(user.id) : []

  const students = selClass
    ? [...allStudents.filter(s => s.classIds?.includes(selClass.id) && ['applied','selected','confirmed'].includes(s.status))]
        .sort((a,b) => {
          const g = parseInt(a.grade||0)-parseInt(b.grade||0); if(g) return g
          const c = parseInt(a.classNum||0)-parseInt(b.classNum||0); if(c) return c
          const n = parseInt(a.number||0)-parseInt(b.number||0); if(n) return n
          return (a.name||'').localeCompare(b.name||'','ko')
        })
    : []

  const records  = isFuture ? [] : AttendanceDB.byClassDate(selClass?.id||'', selDate)
  const getRec   = (sid) => records.find(r => r.studentId === sid)
  const mark = (studentId, status, extra = {}) => {
    if (!selClass || isFuture) return
    const existing = getRec(studentId)
    const session  = getSession ? getSession(selClass, selDate) : 0
    AttendanceDB.upsert({
      id: existing?.id || uid(), classId: selClass.id, studentId,
      date: selDate, session: session||0, status,
      note: existing?.note||'', absentReason: existing?.absentReason||'',
      homeReturn: existing?.homeReturn||'', markedAt: now(),
      ...extra,
    })
    setTick(t => t+1)
    pushAttendance(students.find(s => s.id === studentId), status, extra)
  }
  const markAll = (status) => students.forEach(s => mark(s.id, status))

  const doneCnt    = students.filter(s => (getRec(s.id)?.status||'pending') !== 'pending').length
  const presentCnt = students.filter(s => ['present','late'].includes(getRec(s.id)?.status||'')).length

  const prevMonth = () => { if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11)}else setCalMonth(m=>m-1) }
  const nextMonth = () => { if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0)}else setCalMonth(m=>m+1) }

  const handleSelectDate = (date) => {
    setSelDate(date)
    setCalOpen(false)
    const dc = allClasses.filter(c => calcSessionDates(c).includes(date))
    setSelClassId(dc.length > 0 ? dc[0].id : '')
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* 날짜 헤더 + 달력 토글 */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <button onClick={() => setCalOpen(v => !v)}
          style={{ width: '100%', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Noto Sans KR, sans-serif' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              📅 {selDate === today ? '오늘 · ' : ''}{formatDateKo(selDate)}
            </div>
            {dayClasses.length > 0
              ? <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{dayClasses.length}개 수업</div>
              : <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>수업 없는 날</div>
            }
          </div>
          <span style={{ fontSize: '20px', color: '#9ca3af' }}>{calOpen ? '▲' : '▼'}</span>
        </button>

        {/* 달력 접기/펼치기 */}
        {calOpen && (
          <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 10px' }}>
              <button onClick={prevMonth} style={{ width:'32px',height:'32px',borderRadius:'8px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'18px' }}>‹</button>
              <div style={{ display:'flex',alignItems:'center',gap:'8px' }}>
                <span style={{ fontSize:'15px',fontWeight:700,color:'#111827' }}>{calYear}년 {MONTHS[calMonth]}</span>
                <button onClick={() => handleSelectDate(today)} style={{ padding:'2px 8px',borderRadius:'6px',border:'1px solid #f97316',background:'#fff7ed',color:'#f97316',fontSize:'11px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>오늘</button>
              </div>
              <button onClick={nextMonth} style={{ width:'32px',height:'32px',borderRadius:'8px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'18px' }}>›</button>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:'4px' }}>
              {DAYS_KO.map((d,i)=><div key={d} style={{ textAlign:'center',fontSize:'11px',fontWeight:600,padding:'3px 0',color:i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>)}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px' }}>
              {(() => {
                const firstDay = new Date(calYear,calMonth,1).getDay()
                const dim = new Date(calYear,calMonth+1,0).getDate()
                const classSet = new Set(classDates)
                const cells = []
                for(let i=0;i<firstDay;i++) cells.push(null)
                for(let d=1;d<=dim;d++) cells.push(d)
                return cells.map((day,idx) => {
                  if(!day) return <div key={`e${idx}`}/>
                  const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const isClass=classSet.has(ds), isToday=ds===today, isSel=ds===selDate
                  const isSun=(firstDay+day-1)%7===0, isSat=(firstDay+day-1)%7===6
                  return (
                    <button key={day} onClick={()=>handleSelectDate(ds)} style={{
                      position:'relative',padding:'8px 2px',border:'none',borderRadius:'8px',cursor:'pointer',
                      background:isSel?'#f97316':isToday?'#fff7ed':isClass?'#f0fdf4':'transparent',
                      color:isSel?'#fff':isSun?'#ef4444':isSat?'#3b82f6':'#111827',
                      fontWeight:isSel||isToday?700:400,fontSize:'14px',
                      outline:isToday&&!isSel?'2px solid #f97316':'none',outlineOffset:'-2px',
                      fontFamily:'Noto Sans KR, sans-serif',
                    }}>
                      {day}
                      {isClass&&<span style={{ position:'absolute',bottom:'2px',left:'50%',transform:'translateX(-50%)',width:'4px',height:'4px',borderRadius:'50%',background:isSel?'#fff':'#f97316',display:'block' }}/>}
                    </button>
                  )
                })
              })()}
            </div>
          </div>
        )}
      </div>

      {/* 수업 탭 (A반/B반 등) */}
      {dayClasses.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
          {dayClasses.map(cls => (
            <button key={cls.id} onClick={() => setSelClassId(cls.id)}
              style={{
                padding: '8px 16px', borderRadius: '10px', border: '1.5px solid',
                borderColor: selClassId===cls.id ? '#f97316' : '#e5e7eb',
                background: selClassId===cls.id ? '#fff7ed' : '#fff',
                color: selClassId===cls.id ? '#f97316' : '#6b7280',
                fontSize: '13px', fontWeight: selClassId===cls.id ? 700 : 400,
                cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
              {cls.className}{cls.section ? ` ${cls.section}반` : ''}
            </button>
          ))}
        </div>
      )}

      {/* 수업 없는 날 */}
      {dayClasses.length === 0 && (
        <div style={{ textAlign:'center', padding:'40px 20px', background:'#fff', borderRadius:'14px', color:'#9ca3af' }}>
          <div style={{ fontSize:'32px', marginBottom:'8px' }}>🗓️</div>
          <div style={{ fontSize:'14px', fontWeight:600, color:'#6b7280' }}>수업이 없는 날입니다</div>
          <div style={{ fontSize:'12px', marginTop:'4px' }}>위 달력에서 수업일을 선택하세요</div>
        </div>
      )}

      {/* 선택된 수업 헤더 + 일괄처리 */}
      {selClass && (
        <>
          <div style={{ background: '#fff7ed', borderRadius: '14px', border: '1px solid #fed7aa', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                  {selClass.className}{selClass.section ? ` ${selClass.section}반` : ''}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
                  {selClass.organization && <span>{selClass.organization} · </span>}
                  {selClass.time && <span>🕐 {selClass.time}{selClass.timeEnd ? ` ~ ${selClass.timeEnd}` : ''}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: doneCnt===students.length&&students.length>0 ? '#16a34a' : '#f97316' }}>
                  {presentCnt}<span style={{ fontSize:'13px',color:'#9ca3af' }}>/{students.length}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{doneCnt}/{students.length} 처리</div>
              </div>
            </div>
            {/* 진행률 바 */}
            {!isFuture && students.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ height: '6px', background: '#f3f4f6', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${students.length ? doneCnt/students.length*100 : 0}%`, height: '100%', background: '#f97316', borderRadius: '999px', transition: 'width .3s' }} />
                </div>
              </div>
            )}
            {/* 일괄처리 + 일괄보내기 버튼 */}
            {!isFuture && students.length > 0 && (
              <div style={{ display: 'flex', flexDirection:'column', gap:'8px', marginTop: '10px' }}>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => markAll('present')}
                    style={{ flex:1,padding:'9px',borderRadius:'9px',border:'1.5px solid #86efac',background:'#f0fdf4',color:'#16a34a',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>
                    ✅ 전체 출석
                  </button>
                  <button onClick={() => markAll('absent')}
                    style={{ flex:1,padding:'9px',borderRadius:'9px',border:'1.5px solid #fca5a5',background:'#fef2f2',color:'#ef4444',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>
                    ❌ 전체 결석
                  </button>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => setBulkModal('present')}
                    style={{ flex:1,padding:'9px',borderRadius:'9px',border:'1.5px solid #86efac',background:'#fff',color:'#16a34a',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>
                    💬 출석 일괄 안내
                  </button>
                  <button onClick={() => setBulkModal('absent')}
                    style={{ flex:1,padding:'9px',borderRadius:'9px',border:'1.5px solid #fca5a5',background:'#fff',color:'#ef4444',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'Noto Sans KR, sans-serif' }}>
                    💬 결석 일괄 안내
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 학생 카드 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {students.length === 0
              ? <div style={{ textAlign:'center',padding:'32px',background:'#fff',borderRadius:'14px',color:'#9ca3af',fontSize:'14px' }}>등록된 학생이 없습니다</div>
              : students.map(s => (
                  <MobileStudentCard key={s.id+tick+progTick} s={s} rec={getRec(s.id)} onMark={mark} onMsgOpen={setMsgStudent} isFuture={isFuture}
                    onProgOpen={(stu, pid) => { setProgStudent({...stu, _clsId: selClass.id}); setProgProductId(pid) }}
                    spItem={spItems.find(si => si.studentId === s.id && si.classId === selClass?.id)}
                    spProg={spProg} spChecks={spChecks} user={user} />
                ))
            }
          </div>
        </>
      )}

      {/* 메시지 모달 */}
      {msgStudent && <MsgModal student={msgStudent} cls={selClass} user={user} onClose={() => setMsgStudent(null)} />}

      {/* 진도 체크 모달 */}
      {progStudent && progProductId && (() => {
        const si = SupplyItems.byClassStudent(progStudent._clsId || '', progStudent.id)[0]
        if (!si?.productId) return null
        return (
          <ProgCheckModal
            student={progStudent}
            initialProductId={progProductId}
            spProds={spProds}
            teacherId={selClass?.teacherId||''}
            onClose={() => setProgStudent(null)}
            onSaved={() => setProgTick(t => t+1)}
          />
        )
      })()}

      {/* 일괄 메시지 모달 */}
      {bulkModal && (
        <BulkMsgModal
          students={students.map(s => ({ ...s, _status: getRec(s.id)?.status || 'pending' }))}
          cls={selClass} user={user}
          statusFilter={bulkModal}
          onClose={() => setBulkModal(null)}
        />
      )}
    </div>
  )
}

export function Attendance({ user, pageParams = {} }) {
  const isMobile = window.innerWidth <= 768
  if (isMobile) return <MobileAttendance user={user} pageParams={pageParams} />
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
  const [selDay,     setSelDay]     = useState('')  // 요일 필터 ('월','화','수','목','금','토','일')
  const [activeMode, setActiveMode] = useState('class') // 'class' | 'day' — 두 모드 완전 분리
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

  // 필터 적용된 수업 목록
  // - 수업 검색 모드: 년도 + 학교 + 수업 + 기간 적용
  // - 요일 검색 모드: 년도 + 요일만 적용 (학교 필터 완전 분리)
  const schoolClasses = sortClasses(allClasses.filter(c => {
    if (selYear && !c.startDate?.startsWith(selYear) && !c.endDate?.startsWith(selYear)) return false
    if (activeMode === 'class') {
      if (selSchool && c.organization !== selSchool) return false
      if (selDay && !(c.days||[]).includes(selDay)) return false
      if (!termInRange(c)) return false
    } else {
      // 요일 모드: 학교/기간 필터 무시, 요일만 적용
      if (selDay && !(c.days||[]).includes(selDay)) return false
    }
    return true
  }))
  const selClass = allClasses.find(c => c.id === selClassId)
  // 달력 표시용 수업일: 선택된 수업이 있으면 그 수업일만, 없으면 필터된 전체 수업일 합산
  const sessionDates = selClass
    ? calcSessionDates(selClass)
    : [...new Set(schoolClasses.flatMap(c => calcSessionDates(c)))].sort()

  // 달력 점 전용: 연도만 적용 (요일 필터 무관 — 달력은 항상 전체 수업일 표시)
  const calendarDates = selClass
    ? calcSessionDates(selClass)
    : [...new Set(
        allClasses
          .filter(c =>
            (!selYear || c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear))
          )
          .flatMap(c => calcSessionDates(c))
      )].sort()
  // 수업 선택 시 해당 수업의 반 목록 (같은 학교+수업명 내 section 목록)
  // 같은 학교+수업명 내 반 목록 (section 기준)
  const sectionClasses = selClassId
    ? schoolClasses.filter(c => c.className === selClass?.className && c.organization === selClass?.organization)
    : []
  const sections = [...new Set(sectionClasses.map(c => c.section).filter(Boolean))]

  // 정렬: Students.jsx 와 동일하게 학교→수업→반→학년→학급반→번호→이름
  const sortStudents = (arr) => [...arr].sort((a, b) => {
    const DAY_ORDER = ['월','화','수','목','금','토','일']
    const aClass = allClasses.find(c => c.id === a.classIds?.[0])
    const bClass = allClasses.find(c => c.id === b.classIds?.[0])
    const aOrg = (a.classIds?.length ? allClasses.find(c => c.id === a.classIds[0])?.organization : null) || a.school || ''
    const bOrg = (b.classIds?.length ? allClasses.find(c => c.id === b.classIds[0])?.organization : null) || b.school || ''
    const schoolCmp = aOrg.localeCompare(bOrg,'ko')
    if (schoolCmp !== 0) return schoolCmp
    const aDay = DAY_ORDER.indexOf(aClass?.days?.[0] ?? '')
    const bDay = DAY_ORDER.indexOf(bClass?.days?.[0] ?? '')
    const dayCmp = (aDay === -1 ? 99 : aDay) - (bDay === -1 ? 99 : bDay)
    if (dayCmp !== 0) return dayCmp
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

  // ★ 핵심: 모드에 따라 필터 적용 분리
  // - 수업 검색 모드: 년도 + 기간 + 학교 + 수업 + 반 + 요일 모두 적용
  // - 요일 검색 모드: 년도 + 요일만 적용 (학교/기간 필터 완전 무시)
  const students = sortStudents(allStudents.filter(s => {
    const hasClassIds = s.classIds?.length > 0
    // 년도 필터 (공통)
    if (selYear) {
      const yearCls = allClasses.filter(c => c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear))
      const inYear = hasClassIds
        ? yearCls.some(c => s.classIds.includes(c.id))
        : yearCls.some(c => c.organization === s.school)
      if (!inYear) return false
    }
    if (activeMode === 'class') {
      // 기간 필터
      if (selTerm) {
        const termCls = allClasses.filter(c => termInRange(c))
        const inTerm = hasClassIds
          ? termCls.some(c => s.classIds.includes(c.id))
          : termCls.some(c => c.organization === s.school)
        if (!inTerm) return false
      }
      // 학교 필터
      if (selSchool) {
        const actualSchool = hasClassIds
          ? (s.classIds.map(cid => allClasses.find(c => c.id === cid)?.organization).filter(Boolean)[0] || s.school || '')
          : s.school || ''
        if (actualSchool !== selSchool) return false
      }
      // 수업 필터
      if (selClassId) {
        const inClass = hasClassIds
          ? s.classIds.includes(selClassId)
          : selClass?.organization === s.school
        if (!inClass) return false
      }
      // 반 필터
      if (selSection) {
        const sectionCls = sectionClasses.find(c => c.section === selSection)
        if (sectionCls) {
          const inSection = s.classIds?.includes(sectionCls.id) ||
            (!s.classIds?.length && selClass?.organization === s.school)
          if (!inSection) return false
        }
      }
    } else {
      // 요일 검색 모드: 요일 필터만 (학교/기간 무시)
      if (selDay) {
        const inDay = hasClassIds
          ? s.classIds.some(cid => (allClasses.find(c => c.id === cid)?.days || []).includes(selDay))
          : false
        if (!inDay) return false
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
    <div style={{ padding:'24px', maxWidth:'1400px', width:'100%', display:'flex', flexDirection:'column', gap:'20px' }}>
      <div style={{ fontSize:'22px', fontWeight:700, color:C.text }}>출석부</div>

      {/* 필터 카드 — 두 검색 모드 */}
      <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>

        {/* ── 모드 A: 수업 검색 (달력과 세트) ── */}
        <div style={{
          padding:'14px 20px',
          borderLeft: activeMode === 'class' ? `4px solid ${C.primary}` : '4px solid transparent',
          background: activeMode === 'class' ? 'linear-gradient(90deg,#fff7ed 0%,#fff 60%)' : '#fafafa',
          transition:'all .2s',
        }}>
          {/* 모드 레이블 */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
            <button onClick={() => { setActiveMode('class'); setSelDay(''); setDateClicked(false) }}
              style={{
                width:'20px', height:'20px', borderRadius:'50%', flexShrink:0, border:'none', cursor:'pointer',
                background: activeMode === 'class' ? C.primary : '#e5e7eb',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'11px', fontWeight:700, color:'#fff',
                boxShadow: activeMode === 'class' ? `0 0 0 3px #fed7aa` : 'none',
                transition:'all .2s', padding:0,
              }}>✓</button>
            <span style={{ fontSize:'12px', fontWeight:700, color: activeMode === 'class' ? C.primary : '#9ca3af', cursor:'pointer' }}
              onClick={() => { setActiveMode('class'); setSelDay(''); setDateClicked(false) }}>
              수업 검색
            </span>
            <span style={{ fontSize:'11px', color: activeMode === 'class' ? '#92400e' : '#d1d5db', background: activeMode === 'class' ? '#fff7ed' : 'transparent', padding:'1px 8px', borderRadius:'10px', border: activeMode === 'class' ? '1px solid #fde68a' : '1px solid transparent' }}>
              📅 달력과 함께 사용
            </span>
            <div style={{ marginLeft:'auto', fontSize:'14px', fontWeight:700, color:C.primary }}>
              👥 {students.filter(s => ['applied','selected','confirmed'].includes(s.status)).length}명
            </div>
          </div>
          {/* 필터 드롭다운 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr 1fr 1fr', gap:'10px', alignItems:'end', opacity: activeMode === 'day' ? 0.45 : 1, transition:'opacity .2s', pointerEvents: activeMode === 'day' ? 'none' : 'auto' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>년도</label>
              <select value={selYear} onChange={e => { setSelYear(e.target.value); setSelClassId(''); setSelSection(''); setSelTerm(''); setActiveMode('class'); setSelDay('') }} style={{ ...selSt, width:'100%' }}>
                {years.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>학교</label>
              <select value={selSchool} onChange={e => { handleSchoolChange(e.target.value); setActiveMode('class'); setSelDay('') }} style={{ ...selSt, width:'100%' }}>
                <option value="">전체 학교</option>
                {[...new Set(allClasses.filter(c => !selYear || c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear)).map(c => c.organization).filter(Boolean))].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>수업</label>
              <select value={selClassId} onChange={e => { setSelClassId(e.target.value); setSelSection(''); setSelTerm(''); setDateClicked(false); setActiveMode('class'); setSelDay('') }} style={{ ...selSt, width:'100%' }}>
                <option value="">전체 수업</option>
                {schoolClasses.map(c => <option key={c.id} value={c.id}>{c.className}{c.section?' '+c.section+'반':''}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>반</label>
              <select value={selSection} onChange={e => setSelSection(e.target.value)} style={{ ...selSt, width:'100%' }} disabled={!selClassId || sections.length === 0}>
                <option value="">전체 반</option>
                {sections.map(s => <option key={s} value={s}>{s}반</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <label style={{ fontSize:'11px', fontWeight:600, color:C.muted }}>기간</label>
              <select value={selTerm} onChange={e => setSelTerm(e.target.value)} style={{ ...selSt, width:'100%' }}>
                <option value="">전체 기간</option>
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
          </div>
          {selClass && <div style={{ marginTop:'6px', fontSize:'11px', color:C.muted }}>📅 {selClass.startDate?.slice(5)} ~ {selClass.endDate?.slice(5)} · {sessionDates.length}차시</div>}
        </div>

        {/* 구분선 */}
        <div style={{ height:'1px', background: activeMode === 'day' ? `linear-gradient(90deg,${C.primary}40,#e5e7eb)` : '#e5e7eb' }} />

        {/* ── 모드 B: 요일 검색 ── */}
        <div style={{
          padding:'12px 20px',
          borderLeft: activeMode === 'day' ? `4px solid ${C.primary}` : '4px solid transparent',
          background: activeMode === 'day' ? 'linear-gradient(90deg,#fff7ed 0%,#fff 60%)' : '#fff',
          transition:'all .2s',
        }}>
          {/* 모드 레이블 */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
            <button onClick={() => { setActiveMode('day'); setSelClassId(''); setSelSection(''); setDateClicked(false) }}
              style={{
                width:'20px', height:'20px', borderRadius:'50%', flexShrink:0, border:'none', cursor:'pointer',
                background: activeMode === 'day' ? C.primary : '#e5e7eb',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'11px', fontWeight:700, color:'#fff',
                boxShadow: activeMode === 'day' ? `0 0 0 3px #fed7aa` : 'none',
                transition:'all .2s', padding:0,
              }}>✓</button>
            <span style={{ fontSize:'12px', fontWeight:700, color: activeMode === 'day' ? C.primary : '#9ca3af', cursor:'pointer' }}
              onClick={() => { setActiveMode('day'); setSelClassId(''); setSelSection(''); setDateClicked(false) }}>
              요일 검색
            </span>
            {activeMode === 'day' && selDay && (
              <span style={{ fontSize:'11px', color:'#92400e', background:'#fff7ed', padding:'1px 8px', borderRadius:'10px', border:'1px solid #fde68a' }}>
                {selDay}요일 선택됨
              </span>
            )}
            {activeMode === 'day' && selDay && (
              <button onClick={() => setSelDay('')}
                style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:'10px', border:`1px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                ✕ 초기화
              </button>
            )}
          </div>
          {/* 요일 버튼들 — 학교 필터와 완전 독립, 년도만 반영 */}
          <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
            {['월','화','수','목','금','토','일'].map(day => {
              // 요일 카운트: 학교/기간 필터 완전 무시, 년도만 적용
              const dayCount = allClasses.filter(c =>
                (c.days||[]).includes(day) &&
                (!selYear || c.startDate?.startsWith(selYear) || c.endDate?.startsWith(selYear))
              ).length
              const isActive = activeMode === 'day' && selDay === day
              return (
                <button key={day} onClick={() => {
                  setActiveMode('day')
                  setSelDay(selDay === day ? '' : day)
                  setSelClassId('')
                  setSelSection('')
                  setDateClicked(false)
                }}
                  style={{
                    padding:'6px 14px', borderRadius:'20px', cursor:'pointer', transition:'all .15s',
                    border: isActive ? `2px solid ${C.primary}` : dayCount>0 ? `1.5px solid #e5e7eb` : '1.5px solid #f3f4f6',
                    background: isActive ? C.primary : dayCount>0 ? '#fff' : '#fafafa',
                    color: isActive ? '#fff' : dayCount>0 ? C.text : '#d1d5db',
                    fontSize:'13px', fontWeight: isActive ? 700 : 500,
                    fontFamily:'Noto Sans KR, sans-serif',
                    opacity: dayCount===0 ? 0.4 : 1,
                    boxShadow: isActive ? `0 2px 8px ${C.primary}40` : 'none',
                  }}>
                  {isActive ? '✓ ' : ''}{day}{dayCount > 0 ? ` (${dayCount})` : ''}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 항상 달력 + 패널 레이아웃 */}
      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:'20px', alignItems:'start' }}>
        {/* 달력 */}
        <div style={{ background:C.card, borderRadius:'16px', border:`1px solid ${C.border}`, padding:'20px', position:'sticky', top:'24px' }}>
          <AttCalendar year={calYear} month={calMonth} selectedDate={selDate} sessionDates={calendarDates}
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
        <div style={{ minWidth:0, overflowX:'auto' }}>
          {/* 요일 모드: 요일 선택 시 학생 목록 표시 */}
          {activeMode === 'day' && selDay && !dateClicked ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {/* 수업 요약 카드 */}
              <div style={{ padding:'16px 20px', background:'linear-gradient(135deg,#fff7ed 0%,#fff 100%)', borderRadius:'14px', border:'1.5px solid #fed7aa' }}>
                <div style={{ fontSize:'18px', fontWeight:700, color:C.text, marginBottom:'12px' }}>{selDay}요일 수업 {schoolClasses.length}개</div>
                <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                  {schoolClasses.map(cls => {
                    const cnt = allStudents.filter(s => s.classIds?.includes(cls.id) && ['applied','selected','confirmed'].includes(s.status)).length
                    return (
                      <div key={cls.id} style={{ padding:'10px 16px', borderRadius:'10px', background:'#fff', border:`1.5px solid ${C.border}`, minWidth:'160px' }}>
                        <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{cls.className}{cls.section ? ` ${cls.section}반` : ''}</div>
                        <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>🏫 {cls.organization}</div>
                        <div style={{ fontSize:'13px', fontWeight:700, color:C.primary, marginTop:'4px' }}>👥 {cnt}명</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 수업별 학생 목록 — ClassAttendanceSection 재활용 */}
              {schoolClasses.length === 0 ? (
                <div style={{ textAlign:'center', padding:'60px 20px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, color:C.muted }}>
                  <div style={{ fontSize:'36px', marginBottom:'10px' }}>📭</div>
                  <div style={{ fontSize:'15px', fontWeight:600, color:'#374151' }}>{selDay}요일 수업이 없습니다</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {schoolClasses.map(cls => {
                    const clsStudents = students
                      .filter(s => s.classIds?.includes(cls.id) && ['applied','selected','confirmed'].includes(s.status))
                    return (
                      <div key={cls.id} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
                        <div style={{ padding:'12px 18px', background:'#f9fafb', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>🏫 {cls.organization} · {cls.className}{cls.section ? ` ${cls.section}반` : ''}</span>
                          <span style={{ fontSize:'13px', fontWeight:700, color:C.primary }}>👥 {clsStudents.length}명</span>
                        </div>
                        {clsStudents.length === 0 ? (
                          <div style={{ padding:'14px 18px', fontSize:'13px', color:C.muted }}>등록된 학생이 없습니다</div>
                        ) : (
                          <table style={{ width:'100%', borderCollapse:'collapse' }}>
                            <thead>
                              <tr style={{ background:'#f9fafb' }}>
                                {['순번', '학년 / 반 / 번호', '이름', '학부모 전화'].map(h => (
                                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:'12px', fontWeight:600, color:'#6b7280', whiteSpace:'nowrap', borderBottom:`1px solid ${C.border}` }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {clsStudents.map((s, i) => (
                                <tr key={s.id} style={{ borderBottom:`1px solid #f3f4f6`, background: i%2===0?'#fff':'#fafafa' }}>
                                  <td style={{ padding:'11px 14px', fontSize:'13px', color:'#9ca3af', textAlign:'center', whiteSpace:'nowrap' }}>{i+1}</td>
                                  <td style={{ padding:'11px 14px', fontSize:'13px', color:'#374151', whiteSpace:'nowrap' }}>
                                    <span>{s.grade ? s.grade+'학년' : '-'}</span>
                                    {s.classNum && <span style={{ marginLeft:'4px', padding:'1px 7px', borderRadius:'5px', background:'#f0fdf4', color:'#16a34a', fontWeight:600, fontSize:'12px' }}>{s.classNum}반</span>}
                                    {s.number && <span style={{ marginLeft:'4px', color:'#9ca3af', fontSize:'12px' }}>{s.number}번</span>}
                                  </td>
                                  <td style={{ padding:'11px 14px', fontSize:'14px', fontWeight:700, color:'#111827' }}>{s.name}</td>
                                  <td style={{ padding:'11px 14px', fontSize:'13px', color:'#6b7280' }}>{s.parentPhone || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : selClassId ? (
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
            <DayAttendancePanel date={selDate} allClasses={allClasses} allStudents={allStudents} schoolClasses={schoolClasses} user={user} key={selDate} />
          )}
        </div>
      </div>
    </div>
  )
}

const selSt = { padding:'8px 12px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', background:'#fff', color:'#111827', cursor:'pointer', outline:'none', minWidth:'180px' }
