import React, { useState, useEffect, useRef } from 'react'
import {
  Classes as ClassesDB, Students as StudentsDB, Attendance as AttendanceDB,
  Notes, SupplyItems, SupplyProducts, SupplyStudentProgress, SupplySessionChecks,
  RevenueFees, RevenuePayments,
  Trainings, Careers, Educations, Certificates, Awards,
  Settings,
} from '../lib/db.js'
import { dbCall } from '../lib/supabase.js'
import { calcSessionDates, sortClasses, uid, now, getSessionInfo } from '../lib/utils.js'
import { useToast } from '../hooks/useToast.js'
import { useConfirm } from '../components/Atoms.jsx'

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS  = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const C = {
  primary: '#f97316', success: '#16a34a', danger: '#ef4444',
  border: '#e5e7eb', text: '#111827', muted: '#6b7280', card: '#fff',
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatDateKo(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()%100}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${DAYS_KO[d.getDay()]}요일`
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
function useWeather(lat, lng) {
  const [w, setW] = useState(null)
  useEffect(() => {
    const la = lat || 37.39, lo = lng || 126.95
    // ✅ AbortController로 타임아웃 5초 설정 + 오류 콘솔 억제
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,weathercode,windspeed_10m&timezone=Asia%2FSeoul`,
      { signal: controller.signal }
    )
      .then(r => { if (!r.ok) throw new Error('weather fetch failed'); return r.json() })
      .then(d => {
        clearTimeout(timer)
        if (d?.current) {
          setW({ temp: Math.round(d.current.temperature_2m), code: d.current.weathercode, wind: Math.round(d.current.windspeed_10m) })
        }
      })
      .catch(() => { clearTimeout(timer); setW(null) })  // 오류는 조용히 처리
    return () => { clearTimeout(timer); controller.abort() }
  }, [lat, lng])
  return w
}
function smBtn(bg, color) {
  return { padding: '3px 8px', borderRadius: '5px', border: 'none', background: bg, color, fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }
}

// ═══════════════════════════════════════════════════════════════════
//  CARD ON/OFF 시스템
//  Settings.get/set 사용 → localStorage + Supabase 자동 싱크
//  저장 키: dashboardCards_${userId}
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
//  학교 담당자 연결 요청 팝업
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
//  학교 담당자 초대 & 업무 알림 시스템
//
//  팝업 종류:
//  1) 연결 초대   (invite)  — 수락/거절
//  2) 가입 초대   (emailed) — 확인 후 자동 연결 팝업으로 전환
//  3) 업무 알림   (notice/task) — 미완료 업무 상시 표시
//     - 공지 전달 → [회신 완료] 버튼
//     - 업무 요청 → [회신 완료] + [파일 제출] 버튼
//     - 기간 표시, 완료 전까지 계속 표시
// ═══════════════════════════════════════════════════════════════════

// 초대 및 업무 데이터 통합 훅
function useSchoolData(user) {
  const [pending,  setPending]  = useState([]) // 연결 초대 pending
  const [emailed,  setEmailed]  = useState([]) // 가입 초대 emailed
  const [tasks,    setTasks]    = useState([]) // 미완료 업무

  const load = async () => {
    if (!user?.id && !user?.email) return
    try {
      const [allInvites, allSubmits, allNotices] = await Promise.all([
        dbCall('getAll', 'schoolTeacherInvites'),
        dbCall('getAll', 'schoolNoticeSubmits'),
        dbCall('getAll', 'schoolNotices'),
      ])

      // ── 초대 처리
      const mine = (allInvites||[]).filter(
        r => r.teacherEmail?.toLowerCase() === user.email?.toLowerCase()
      )
      const emailedList = mine.filter(r => r.status === 'emailed')
      // 가입 완료 → pending 자동 승격
      if (emailedList.length > 0) {
        await Promise.all(emailedList.map(r =>
          dbCall('update', 'schoolTeacherInvites', {
            id: r.id, patch: { status: 'pending', teacherId: user.id },
          })
        ))
        const all2  = await dbCall('getAll', 'schoolTeacherInvites')
        const mine2 = (all2||[]).filter(r => r.teacherEmail?.toLowerCase() === user.email?.toLowerCase())
        setPending(mine2.filter(r => r.status === 'pending'))
        setEmailed([])
      } else {
        setPending(mine.filter(r => r.status === 'pending'))
        setEmailed([])
      }

      // ── 업무 처리 (미완료인 것만)
      const mySubmits = (allSubmits||[]).filter(s =>
        s.teacherId === user.id && s.status !== 'submitted'
      )
      const taskList = mySubmits.map(sub => {
        const notice = (allNotices||[]).find(n => n.id === sub.noticeId)
        if (!notice || notice.status === 'done') return null
        return { sub, notice }
      }).filter(Boolean)
      setTasks(taskList)

    } catch {}
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [user?.id, user?.email])

  return { pending, emailed, tasks, reload: load }
}

// ── 연결 초대 팝업 (파란색)
function ConnectInvitePopup({ invites, user, reload }) {
  const [current, setCurrent] = useState(0)
  const { success } = useToast()
  if (!invites.length) return null
  const inv = invites[current]; if (!inv) return null

  const handleAccept = async () => {
    try {
      await dbCall('update', 'schoolTeacherInvites', {
        id: inv.id, patch: { status:'accepted', acceptedAt:now(), teacherId:user.id },
      })
      // 학교 담당자가 등록한 기존 레코드 찾기 (subject, days 등 보존)
      const allTeachers = await dbCall('getAll', 'schoolAdminTeachers')
      const existing = (allTeachers||[]).find(t =>
        t.adminId === inv.adminId &&
        t.email?.toLowerCase() === user.email?.toLowerCase() &&
        t.active !== false
      )
      if (existing) {
        // 기존 레코드에 teacherId + linkedAt만 업데이트
        await dbCall('update', 'schoolAdminTeachers', {
          id: existing.id, patch: { teacherId: user.id, teacherName: user.name, linkedAt: now() }
        })
      } else {
        // 없으면 새로 생성 (fallback)
        await dbCall('upsert', 'schoolAdminTeachers', {
          data: { id:uid(), adminId:inv.adminId, teacherId:user.id, teacherName:user.name, schoolName:inv.schoolName, active:true, linkedAt:now(), createdAt:now() }
        })
      }
      // 연결된 업무 있으면 replied 처리
      if (inv.noticeId) {
        try {
          const all = await dbCall('getAll', 'schoolNoticeSubmits')
          const sub = (all||[]).find(s => s.noticeId===inv.noticeId && s.teacherId===user.id)
          if (sub?.status === 'pending')
            await dbCall('update', 'schoolNoticeSubmits', { id:sub.id, patch:{status:'replied', repliedAt:now()} })
        } catch {}
      }
      success(`${inv.schoolName} 담당자와 연동되었습니다! 🎉`)
      await reload()
      setCurrent(c => Math.max(0, c-1))
    } catch {}
  }

  const handleDecline = async () => {
    try {
      await dbCall('update', 'schoolTeacherInvites', { id:inv.id, patch:{status:'declined', declinedAt:now()} })
      await reload(); setCurrent(c => Math.max(0, c-1))
    } catch {}
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:'20px', width:'400px', maxWidth:'92vw', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', overflow:'hidden', animation:'slideUp .25s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#1e3a5f,#2d5a8e)', padding:'22px 24px 18px' }}>
          <div style={{ fontSize:'11px', color:'#93c5fd', fontWeight:700, letterSpacing:'1px', marginBottom:'6px' }}>🔗 연결 초대</div>
          <div style={{ fontSize:'18px', fontWeight:800, color:'#fff', lineHeight:1.35 }}>{inv.schoolName}<br/>담당자가 연결을 요청했습니다</div>
          {invites.length>1 && <div style={{ fontSize:'11px', color:'#7ba7d4', marginTop:'8px' }}>{current+1}/{invites.length}개</div>}
        </div>
        <div style={{ padding:'20px 24px' }}>
          <div style={{ background:'#f0f9ff', borderRadius:'12px', padding:'14px 16px', marginBottom:'18px', border:'1px solid #bae6fd', fontSize:'13px', color:'#374151', lineHeight:1.8 }}>
            <div>🏫 <strong>{inv.schoolName}</strong></div>
            {inv.adminName && <div>👤 담당자: <strong>{inv.adminName}</strong></div>}
            <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'6px' }}>수락하면 해당 담당자의 공지·업무 요청을 받아볼 수 있습니다.</div>
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button onClick={handleDecline} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontWeight:600, fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>거절</button>
            <button onClick={handleAccept} style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#1e3a5f,#3b82f6)', color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', boxShadow:'0 4px 14px rgba(59,130,246,0.3)' }}>✅ 수락하기</button>
          </div>
          {invites.length>1 && (
            <div style={{ display:'flex', justifyContent:'center', gap:'6px', marginTop:'12px' }}>
              {invites.map((_,i) => <div key={i} onClick={()=>setCurrent(i)} style={{ width:'8px', height:'8px', borderRadius:'50%', background:i===current?'#3b82f6':'#d1d5db', cursor:'pointer' }} />)}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

// ── 가입 초대 팝업 (주황색)
function SignupInvitePopup({ invites, reload }) {
  const [dismissed, setDismissed] = useState(false)
  if (!invites.length || dismissed) return null
  const inv = invites[0]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:'20px', width:'400px', maxWidth:'92vw', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', overflow:'hidden', animation:'slideUp .25s ease' }}>
        <div style={{ background:'linear-gradient(135deg,#c2410c,#f97316)', padding:'22px 24px 18px' }}>
          <div style={{ fontSize:'11px', color:'#fed7aa', fontWeight:700, letterSpacing:'1px', marginBottom:'6px' }}>📋 서비스 가입 초대</div>
          <div style={{ fontSize:'18px', fontWeight:800, color:'#fff', lineHeight:1.35 }}>{inv.schoolName}<br/>담당자가 초대했습니다</div>
        </div>
        <div style={{ padding:'20px 24px' }}>
          <div style={{ background:'#fff7ed', borderRadius:'12px', padding:'14px 16px', marginBottom:'18px', border:'1px solid #fed7aa', fontSize:'13px', color:'#374151', lineHeight:1.8 }}>
            <div>🏫 <strong>{inv.schoolName}</strong></div>
            {inv.adminName && <div>👤 담당자: <strong>{inv.adminName}</strong></div>}
            <div style={{ fontSize:'12px', color:'#9a3412', fontWeight:600, marginTop:'6px' }}>✅ 가입이 완료되었습니다!<br/><span style={{ fontWeight:400, color:'#6b7280' }}>잠시 후 연결 초대장이 자동으로 표시됩니다.</span></div>
          </div>
          <button onClick={()=>{ setDismissed(true); reload() }} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'none', background:'linear-gradient(135deg,#c2410c,#f97316)', color:'#fff', fontWeight:700, fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>확인</button>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

// ── 업무 알림 패널 (대시보드 상단 고정 — 미완료 업무 상시 표시)
// ── 연결된 학교 목록 + 연결 끊기
function SchoolConnectionPanel({ user, onNav }) {
  const [connections, setConnections] = useState([])
  const [modal,       setModal]       = useState(null)  // { conn, info, calendars, subjects }
  const [modalTab,    setModalTab]    = useState('info')

  const [myClasses,   setMyClasses]   = useState([])
  const { success, error } = useToast()
  const confirm = useConfirm()

  const load = async () => {
    if (!user?.id) return
    try {
      const all = await dbCall('getAll', 'schoolAdminTeachers')
      const mine = (all||[]).filter(t => t.teacherId === user.id && t.active !== false)
      // subject/days 없는 레코드는 같은 adminId + email로 매칭해서 보완
      const enriched = mine.map(conn => {
        if (conn.subject || conn.days) return conn
        const matched = (all||[]).find(t =>
          t.adminId === conn.adminId &&
          t.email?.toLowerCase() === user.email?.toLowerCase()
        )
        return matched ? { ...conn, subject: matched.subject, days: matched.days } : conn
      })
      setConnections(enriched)
      setMyClasses(ClassesDB.byTeacher(user.id))
    } catch {}
  }

  useEffect(() => { load() }, [user?.id])

  if (connections.length === 0) return null

  const openModal = async (conn) => {
    setModalTab('info')
    setModal({ conn, info: null, calendars: [] })
    try {
      const [allInfo, allCals] = await Promise.all([
        dbCall('getAll', 'schoolInfo').catch(()=>[]),
        dbCall('getAll', 'schoolCalendar').catch(()=>[]),
      ])
      const info      = (allInfo||[]).find(r => r.adminId === conn.adminId) || null
      const calendars = (allCals||[]).filter(c => c.adminId === conn.adminId)
      setModal({ conn, info, calendars })
    } catch {}
  }

  const handleDisconnect = (conn) => {
    confirm(`⚠️ "${conn.schoolName}" 학교와의 연결을 끊으시겠습니까?`, async () => {
      try {
        await dbCall('update', 'schoolAdminTeachers', { id: conn.id, patch: { active: false } })
        const allInvites = await dbCall('getAll', 'schoolTeacherInvites')
        const myInvite = (allInvites||[]).find(i => i.teacherId === user.id && i.adminId === conn.adminId && i.status === 'accepted')
        if (myInvite) await dbCall('update', 'schoolTeacherInvites', { id: myInvite.id, patch: { status: 'declined' } })
        success(`${conn.schoolName} 학교와의 연결을 끊었습니다.`)
        setModal(null); load()
      } catch { error('처리 중 오류가 발생했습니다.') }
    })
  }


  // findMyClass — 1순위: sourceCalendarId, 2순위: 학교명+요일, 3순위: 학교명만
  const findMyClass = (cal) => {
    // 1. sourceCalendarId 정확 매칭
    const byId = myClasses.find(c => c.sourceCalendarId === cal.id)
    if (byId) return byId

    const schoolName = modal?.conn?.schoolName || cal.schoolName || ''
    const connDay    = modal?.conn?.days || ''        // '목요일' or '목'
    const dayChar    = connDay.replace('요일','').trim()  // → '목'

    // 2. 학교명 + 요일 매칭 (myClass.days = ['목'] 형식)
    if (schoolName && dayChar) {
      const byNameDay = myClasses.find(c => {
        const orgMatch = (c.organization||'').includes(schoolName) || schoolName.includes(c.organization||'__')
        const dayMatch = (c.days||[]).map(d => d.replace('요일','').trim()).includes(dayChar)
        return orgMatch && dayMatch
      })
      if (byNameDay) return byNameDay
    }

    // 3. 학교명만 매칭 (fallback)
    if (schoolName) {
      return myClasses.find(c =>
        (c.organization||'').includes(schoolName) || schoolName.includes(c.organization||'__')
      ) || null
    }

    return null
  }

  const DOC_LABELS = { guide:'안내장', attend:'출석부 양식', yearPlan:'연간 지도안', lessonPlan:'차시별 지도안', etc:'기타 서류' }
  const DOC_ICONS  = { guide:'📄', attend:'📋', yearPlan:'📅', lessonPlan:'📝', etc:'📎' }

  return (
    <>
      {/* ── 연결된 학교 카드 목록 */}
      <div style={{ marginBottom:'12px' }}>
        <div style={{ fontSize:'13px', fontWeight:700, color:'#1e3a5f', marginBottom:'8px' }}>🏫 연결된 학교</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {connections.map(conn => (
            <div key={conn.id} style={{ background:'#fff', borderRadius:'12px', padding:'12px 16px', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#111827' }}>🏫 {conn.schoolName}</div>
                <div style={{ fontSize:'11px', color:'#6b7280', marginTop:'3px', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {conn.subject && <span style={{ fontWeight:600, color:'#f97316' }}>📚 {conn.subject}</span>}
                  {conn.days    && <span style={{ fontWeight:600, color:'#3b82f6' }}>📆 {conn.days}요일</span>}
                  {conn.linkedAt && <span>연결일 {conn.linkedAt.slice(0,10)}</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => openModal(conn)} style={{
                  padding:'6px 14px', borderRadius:'8px', border:'1px solid #bfdbfe',
                  background:'#eff6ff', color:'#1d4ed8', fontSize:'12px', fontWeight:700,
                  cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap',
                }}>정보 보러가기</button>
                <button onClick={() => handleDisconnect(conn)} style={{
                  padding:'6px 12px', borderRadius:'8px', border:'1px solid #fca5a5',
                  background:'#fef2f2', color:'#ef4444', fontSize:'12px', fontWeight:700,
                  cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap',
                }}>연결 끊기</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 정보 모달 */}
      {modal && (
        <div style={{ position:'fixed', inset:0, zIndex:4000, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
          onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div style={{ background:'#fff', borderRadius:'20px', width:'100%', maxWidth:'640px', maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>

            {/* 모달 헤더 */}
            <div style={{ padding:'18px 22px 0', background:'linear-gradient(135deg,#1e3a5f,#2d5a8e)', borderRadius:'20px 20px 0 0' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px' }}>
                <div>
                  <div style={{ fontSize:'17px', fontWeight:800, color:'#fff' }}>🏫 {modal.conn.schoolName}</div>
                  <div style={{ fontSize:'12px', color:'#93c5fd', marginTop:'4px', display:'flex', gap:'10px' }}>
                    {modal.conn.subject && <span>📚 {modal.conn.subject}</span>}
                    {modal.conn.days    && <span>📆 {modal.conn.days}요일</span>}
                  </div>
                </div>
                <button onClick={() => setModal(null)}
                  style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', width:'30px', height:'30px', borderRadius:'50%', fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
              </div>
              {/* 탭 */}
              <div style={{ display:'flex', gap:'0' }}>
                {[['info','🏫 학교 정보'],['docs','📁 서류'],['calendar','📅 연간 일정']].map(([key,label]) => (
                  <button key={key} onClick={() => setModalTab(key)} style={{
                    padding:'9px 18px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:700,
                    fontFamily:'Noto Sans KR, sans-serif', background:'transparent',
                    color: modalTab===key ? '#fff' : 'rgba(255,255,255,0.55)',
                    borderBottom: modalTab===key ? '2px solid #fff' : '2px solid transparent',
                    transition:'all .15s',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {/* 모달 본문 */}
            <div style={{ flex:1, overflowY:'auto', padding:'20px 22px' }}>

              {/* ── 탭1: 학교 정보 */}
              {modalTab === 'info' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {modal.info ? (
                    <>
                      {[
                        ['📞 교무실', modal.info.officePhone],
                        ['📱 방과후 담당', modal.info.afterPhone],
                        ['📍 주소', [modal.info.address, modal.info.addressDetail].filter(Boolean).join(' ')],
                        ['🌐 홈페이지', modal.info.homepage],
                      ].map(([label, value]) => value ? (
                        <div key={label} style={{ display:'flex', gap:'12px', padding:'12px 14px', background:'#f8fafc', borderRadius:'10px', border:'1px solid #e5e7eb' }}>
                          <span style={{ fontSize:'13px', fontWeight:700, color:'#6b7280', width:'100px', flexShrink:0 }}>{label}</span>
                          {label === '🌐 홈페이지'
                            ? <a href={value} target="_blank" rel="noopener noreferrer" style={{ fontSize:'13px', color:'#3b82f6', fontWeight:500 }}>{value}</a>
                            : <span style={{ fontSize:'13px', color:'#111827', fontWeight:500 }}>{value}</span>
                          }
                        </div>
                      ) : null)}
                    </>
                  ) : (
                    <div style={{ textAlign:'center', padding:'30px', color:'#9ca3af', fontSize:'13px' }}>
                      📭 학교 담당자가 아직 정보를 등록하지 않았습니다
                    </div>
                  )}
                </div>
              )}

              {/* ── 탭2: 서류 */}
              {modalTab === 'docs' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {modal.info?.docs && Object.keys(modal.info.docs).length > 0
                    ? Object.entries(modal.info.docs).map(([key, files]) =>
                        Array.isArray(files) && files.length > 0 ? (
                          <div key={key} style={{ borderRadius:'10px', border:'1px solid #e5e7eb', overflow:'hidden' }}>
                            <div style={{ padding:'9px 14px', background:'#f8fafc', borderBottom:'1px solid #e5e7eb', fontSize:'12px', fontWeight:700, color:'#374151' }}>
                              {DOC_ICONS[key]||'📎'} {DOC_LABELS[key]||key}
                            </div>
                            {files.map((f, fi) => (
                              <div key={fi} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderBottom: fi<files.length-1?'1px solid #f3f4f6':'none' }}>
                                <span style={{ fontSize:'18px' }}>{f.data?.startsWith('data:image')?'🖼':f.name?.endsWith('.pdf')?'📕':'📄'}</span>
                                <span style={{ flex:1, fontSize:'13px', color:'#111827', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                                {f.size && <span style={{ fontSize:'11px', color:'#9ca3af' }}>{(f.size/1024).toFixed(0)}KB</span>}
                                <a href={f.data} download={f.name} style={{ padding:'5px 14px', borderRadius:'7px', border:'1px solid #3b82f6', background:'#eff6ff', color:'#1d4ed8', fontSize:'12px', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>⬇ 다운로드</a>
                              </div>
                            ))}
                          </div>
                        ) : null
                      )
                    : (
                      <div style={{ textAlign:'center', padding:'30px', color:'#9ca3af', fontSize:'13px' }}>
                        📭 등록된 서류가 없습니다
                      </div>
                    )
                  }
                </div>
              )}

              {/* ── 탭3: 연간 일정 */}
              {modalTab === 'calendar' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {modal.calendars.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'30px', color:'#9ca3af', fontSize:'13px' }}>
                      📭 등록된 연간 일정이 없습니다
                    </div>
                  ) : modal.calendars.map(cal => {
                    const myClass    = findMyClass(cal)
                    const calDays    = cal.days || []
                    const myDay      = modal.conn.days
                    const isMyDay    = myDay && calDays.some(d => myDay.includes(d))

                    return (
                      <div key={cal.id} style={{ borderRadius:'12px', border:`1.5px solid ${myClass?'#86efac':isMyDay?'#fed7aa':'#e5e7eb'}`, overflow:'hidden', background: myClass?'#f0fdf4':isMyDay?'#fffbeb':'#fff' }}>
                        {/* 일정 헤더 */}
                        <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px' }}>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                              <span style={{ fontSize:'14px', fontWeight:700, color:'#111827' }}>{cal.title || '(제목 없음)'}</span>
                              {myClass && <span style={{ fontSize:'10px', fontWeight:700, color:'#16a34a', background:'#dcfce7', padding:'1px 6px', borderRadius:'4px' }}>✅ 내 수업에 있음</span>}
                            </div>
                            <div style={{ fontSize:'11px', color:'#6b7280', display:'flex', gap:'8px', flexWrap:'wrap' }}>
                              {cal.startDate && <span>📅 {cal.startDate.slice(5)} ~ {cal.endDate?.slice(5)||'?'}</span>}
                              {cal.termType  && <span style={{ color:'#6366f1', fontWeight:600 }}>{cal.termType==='semester'?'학기제':cal.termType==='quarter'?'분기제':cal.termType}</span>}
                              {(()=>{
                                const qtc = cal.quarterTermCounts
                                if (!qtc || !qtc.length) return null
                                if (cal.termType==='semester') {
                                  const s1 = qtc[0], s2 = qtc[1]
                                  if (!s1 && !s2) return null
                                  return <span>{s1 ? `1학기 ${s1}텀` : ''}{s1&&s2 ? ' / ' : ''}{s2 ? `2학기 ${s2}텀` : ''}</span>
                                }
                                const total = qtc.slice(0, cal.quarters||4).reduce((a,b)=>a+b, 0)
                                return total ? <span>총 {total}텀</span> : null
                              })()}
                              {(cal.cancelledDates||[]).length > 0 && <span>🚫 휴일 {cal.cancelledDates.length}일</span>}
                            </div>
                          </div>
                          {myClass && (
                            <button onClick={() => { setModal(null); if(onNav) onNav('classes') }}
                              style={{ padding:'6px 14px', borderRadius:'8px', border:'1px solid #86efac', background:'#f0fdf4', color:'#16a34a', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                              📋 내 수업 보기 →
                            </button>
                          )}
                        </div>
                        {/* 미니 달력 — 내 요일 차시만 */}
                        <CalendarMiniPreview cal={cal} myDay={modal.conn.days} />
                        {/* 내 수업과 비교 */}
                        {myClass && <ComparePanel cal={cal} myClass={myClass} myDay={modal.conn.days} />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  )
}

// ── SchoolCalendar와 동일한 차시 계산 로직
function schoolBuildSessionMap({ allSessionDates, termBoundaries, quarterTermCounts, flatTermSessions }) {
  const sessionMap = {}
  const termMap    = {}
  let globalTermIdx = 0
  const fmt2 = (y,m,d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const getDow2 = (str) => new Date(str+'T00:00:00').getDay()

  termBoundaries.forEach((boundary, qIdx) => {
    const quarterNum   = qIdx + 1
    const quarterLabel = boundary.label
    const numTerms     = quarterTermCounts[qIdx] || 1
    const termDates    = allSessionDates.filter(d => d >= boundary.start && d <= boundary.end)
    const dayCounters  = {}

    termDates.forEach(d => {
      const dow = getDow2(d)
      if (!dayCounters[dow]) dayCounters[dow] = { total:0, localTermIdx:0, inTermSess:0, globalTermIdx }
      const dc = dayCounters[dow]
      if (dc.localTermIdx >= numTerms) return
      const spt = flatTermSessions[dc.globalTermIdx] || 4
      dc.total++; dc.inTermSess++
      sessionMap[d] = {
        quarterNum, quarterLabel,
        dayTotal:      dc.total,
        localTermIdx:  dc.localTermIdx,
        globalTermIdx: dc.globalTermIdx,
        inTermSess:    dc.inTermSess,
        sessionsPerTerm: spt,
      }
      termMap[d] = quarterNum
      if (dc.inTermSess >= spt) { dc.inTermSess=0; dc.localTermIdx++; dc.globalTermIdx++ }
    })
    globalTermIdx += numTerms
  })
  return { sessionMap, termMap }
}

// 연간 일정 미니 미리보기 — SchoolCalendar와 동일 로직, 내 요일 필터
function CalendarMiniPreview({ cal, myDay }) {
  const [open, setOpen] = useState(true)
  if (!cal.startDate || !cal.endDate) return null

  const DAY_KO     = ['일','월','화','수','목','금','토']
  const dayNameToNum2 = {'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6}
  const fmt2   = (y,m,d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const addDays2 = (str,n) => { const d=new Date(str+'T00:00:00'); d.setDate(d.getDate()+n); return fmt2(d.getFullYear(),d.getMonth()+1,d.getDate()) }
  const getDow2  = (str) => new Date(str+'T00:00:00').getDay()

  // 내 요일 문자 ('목요일' → '목')
  const myDayChar = myDay ? myDay.replace('요일','').trim() : null
  const myDayNum  = myDayChar ? dayNameToNum2[myDayChar] : null

  const termType = cal.termType || 'semester'
  const year     = cal.year || parseInt(cal.startDate?.slice(0,4)) || new Date().getFullYear()

  // 방학
  const sumStart = cal.sumStart||null, sumEnd = cal.sumEnd||null
  const winStart = cal.winStart||null, winEnd = cal.winEnd||null
  const vacationSet = new Set()
  if(sumStart&&sumEnd){let d=new Date(sumStart+'T00:00:00'),e=new Date(sumEnd+'T00:00:00');while(d<=e){vacationSet.add(fmt2(d.getFullYear(),d.getMonth()+1,d.getDate()));d.setDate(d.getDate()+1)}}
  if(winStart&&winEnd){let d=new Date(winStart+'T00:00:00'),e=new Date(winEnd+'T00:00:00');while(d<=e){vacationSet.add(fmt2(d.getFullYear(),d.getMonth()+1,d.getDate()));d.setDate(d.getDate()+1)}}

  // 취소일
  const cancelledSet = new Set((cal.cancelledDates||[]).map(c=>c.date))

  // 전체 수업 요일 번호
  const dayNums = (cal.days||[]).map(d=>dayNameToNum2[d]).filter(n=>n!==undefined)

  // 수업 날짜 (3월~다음해 2월, 취소일/방학 제외)
  const marchStart = fmt2(year,3,1)
  const nextFebEnd = fmt2(year+1,2,28)
  const getDatesInRange2 = (s,e,nums) => {
    const res=[]; if(!s||!e||!nums.length) return res
    const cur=new Date(s+'T00:00:00'),end=new Date(e+'T00:00:00')
    while(cur<=end){ if(nums.includes(cur.getDay())) res.push(fmt2(cur.getFullYear(),cur.getMonth()+1,cur.getDate())); cur.setDate(cur.getDate()+1) }
    return res
  }
  const allSessionDates = dayNums.length>0
    ? getDatesInRange2(marchStart,nextFebEnd,dayNums).filter(d=>!cancelledSet.has(d)&&!vacationSet.has(d))
    : []

  // termBoundaries
  let termBoundaries = []
  const quarters = cal.quarters || 4
  if (termType==='semester') {
    const sem1EndFinal = cal.sem1End || fmt2(year,8,31)
    const sem2Start    = cal.sumEnd  ? addDays2(cal.sumEnd,1) : fmt2(year,9,1)
    const sem2EndFinal = cal.sem2End || fmt2(year+1,2,28)
    termBoundaries = [
      { start:marchStart,  end:sem1EndFinal, label:'1학기' },
      { start:sem2Start,   end:sem2EndFinal, label:'2학기' },
    ]
  } else {
    const defEnds = [fmt2(year,5,31),fmt2(year,8,31),fmt2(year,11,30),fmt2(year+1,2,28)]
    const qEnds   = cal.qEnds || []
    let prevEnd   = fmt2(year,2,28)
    for(let i=0;i<quarters;i++){
      const qEnd = qEnds[i] || defEnds[i] || fmt2(year+1,2,28)
      termBoundaries.push({start:addDays2(prevEnd,1), end:qEnd, label:`${i+1}분기`})
      prevEnd = qEnd
    }
  }

  const numPeriods        = termType==='semester' ? 2 : quarters
  const quarterTermCounts = Array.from({length:numPeriods},(_,i)=>(cal.quarterTermCounts||[])[i]||3)
  const defaultSessions   = cal.defaultSessions || 4
  const termSessionMap    = cal.termSessionMap   || {}
  const getTS = (qIdx,tIdx) => termSessionMap[`q${qIdx}t${tIdx}`] ?? defaultSessions
  const flatTermSessions  = []
  quarterTermCounts.forEach((tCount,qIdx)=>{ for(let t=0;t<tCount;t++) flatTermSessions.push(getTS(qIdx,t)) })

  const { sessionMap } = schoolBuildSessionMap({ allSessionDates, termBoundaries, quarterTermCounts, flatTermSessions })

  // 텀별 색상 (SchoolCalendar QUARTER_COLORS와 동일)
  const QCOLORS = [
    {border:'#f97316',text:'#ea580c',bg:'#fff7ed'},
    {border:'#16a34a',text:'#15803d',bg:'#f0fdf4'},
    {border:'#3b82f6',text:'#1d4ed8',bg:'#eff6ff'},
    {border:'#a855f7',text:'#7e22ce',bg:'#fdf4ff'},
  ]
  const DAY_THEME2 = {
    1:{bg:'#fff7ed',text:'#c2410c',badge1:'#f97316',badge2:'#c2410c'},
    2:{bg:'#fefce8',text:'#a16207',badge1:'#eab308',badge2:'#a16207'},
    3:{bg:'#f0fdf4',text:'#15803d',badge1:'#22c55e',badge2:'#15803d'},
    4:{bg:'#eff6ff',text:'#1d4ed8',badge1:'#3b82f6',badge2:'#1d4ed8'},
    5:{bg:'#fdf4ff',text:'#7e22ce',badge1:'#a855f7',badge2:'#7e22ce'},
    6:{bg:'#fff1f2',text:'#be123c',badge1:'#f43f5e',badge2:'#be123c'},
    0:{bg:'#f3f4f6',text:'#6b7280',badge1:'#9ca3af',badge2:'#6b7280'},
  }
  const getQC  = (n) => QCOLORS[(n-1)%QCOLORS.length]||QCOLORS[0]
  const getDT  = (dow) => DAY_THEME2[dow]||DAY_THEME2[1]
  const getBadge = (gIdx,dow) => { const t=getDT(dow); return gIdx%2===0?t.badge1:t.badge2 }

  // 내 요일 차시 수
  const myCount = myDayNum!=null
    ? Object.entries(sessionMap).filter(([d])=>getDow2(d)===myDayNum).length
    : Object.keys(sessionMap).length

  // 달력 월 목록 (3월~다음해 2월)
  const months = [
    ...Array.from({length:10},(_,i)=>({year,     month:i+2})),
    ...Array.from({length:2}, (_,i)=>({year:year+1, month:i})),
  ]

  // 신청기간
  const regPeriods = cal.regPeriods || []

  const pad = n => String(n).padStart(2,'0')

  return (
    <div style={{ padding:'10px 16px', display:'flex', flexDirection:'column', gap:'6px' }}>
      {/* 방학 기간 */}
      <div style={{ padding:'8px 12px',background:'#fef9c3',borderRadius:'8px',border:'1px solid #fde68a',fontSize:'12px',color:'#92400e',display:'flex',flexDirection:'column',gap:'3px' }}>
        <span style={{ fontWeight:700 }}>☀️ 방학 기간</span>
        {sumStart
          ? <span>여름방학: {sumStart} ~ {sumEnd||'?'}</span>
          : <span style={{ color:'#b45309' }}>여름방학: 학교 문의</span>
        }
        {winStart
          ? <span>겨울방학: {winStart} ~ {winEnd||'?'}</span>
          : <span style={{ color:'#b45309' }}>겨울방학: 학교 문의</span>
        }
      </div>
      {/* 신청기간 */}
      <div style={{ display:'flex',flexDirection:'column',gap:'4px' }}>
        {termBoundaries.map((b,i)=>{
          const r = regPeriods[i]
          return (
            <div key={i} style={{ padding:'8px 12px',background:'#eff6ff',borderRadius:'8px',border:'1px solid #bfdbfe',fontSize:'12px',color:'#1d4ed8' }}>
              📝 <strong>{b.label}</strong> 신청기간:{' '}
              {r?.start
                ? <span>{r.start} ~ {r.end||'?'}</span>
                : <span style={{ color:'#6b7280' }}>학교 문의</span>
              }
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 학교 달력 vs 내 수업 좌우 비교 패널
function ComparePanel({ cal, myClass, myDay }) {

  const DAY_KO        = ['일','월','화','수','목','금','토']
  const dayNameToNum3 = {'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6}
  const fmt3     = (y,m,d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const getDow3  = (str) => new Date(str+'T00:00:00').getDay()
  const pad3     = n => String(n).padStart(2,'0')

  const myDayChar   = myDay ? myDay.replace('요일','').trim() : null
  const myDayNumRaw = myDayChar ? dayNameToNum3[myDayChar] : null
  const myDayNum    = myDayNumRaw != null ? myDayNumRaw
    : (myClass.days?.length===1 ? dayNameToNum3[myClass.days[0]] : null)

  // ── 학교 달력 수업일 (내 요일만)
  const schoolCancelledSet = new Set((cal.cancelledDates||[]).map(c=>c.date))
  const vacSet = new Set()
  const addVac3 = (s,e) => { if(!s||!e) return; let d=new Date(s+'T00:00:00'),en=new Date(e+'T00:00:00'); while(d<=en){ vacSet.add(fmt3(d.getFullYear(),d.getMonth()+1,d.getDate())); d.setDate(d.getDate()+1) } }
  addVac3(cal.sumStart,cal.sumEnd); addVac3(cal.winStart,cal.winEnd)

  const year3      = cal.year || parseInt(cal.startDate?.slice(0,4)) || new Date().getFullYear()
  const marchStart3 = fmt3(year3,3,1)
  const nextFebEnd3 = fmt3(year3+1,2,28)
  const dayNums3    = (cal.days||[]).map(d=>dayNameToNum3[d]).filter(n=>n!==undefined)

  const getRangeDates = (s,e,nums) => {
    const res=[]; if(!s||!e||!nums.length) return res
    const cur=new Date(s+'T00:00:00'),end=new Date(e+'T00:00:00')
    while(cur<=end){ if(nums.includes(cur.getDay())) res.push(fmt3(cur.getFullYear(),cur.getMonth()+1,cur.getDate())); cur.setDate(cur.getDate()+1) }
    return res
  }

  const schoolAllDates = getRangeDates(marchStart3,nextFebEnd3,dayNums3).filter(d=>!schoolCancelledSet.has(d)&&!vacSet.has(d))
  const schoolDates    = myDayNum!=null ? schoolAllDates.filter(d=>getDow3(d)===myDayNum) : schoolAllDates

  // ── 내 수업 수업일 (내 요일만)
  const myAllDates     = calcSessionDates(myClass)
  const myCancelledSet = new Set((myClass.cancelledDates||[]).map(c=>c.date))
  const mySessionDates = myAllDates.filter(d=>!myCancelledSet.has(d))
  const myDates        = myDayNum!=null ? mySessionDates.filter(d=>getDow3(d)===myDayNum) : mySessionDates

  const schoolSet = new Set(schoolDates)
  const mySet     = new Set(myDates)

  // ── sessionMap 계산 (학교 달력 차시 라벨용)
  const termType3   = cal.termType || 'semester'
  const quarters3   = cal.quarters || 4
  const addDays3    = (str,n) => { const d=new Date(str+'T00:00:00'); d.setDate(d.getDate()+n); return fmt3(d.getFullYear(),d.getMonth()+1,d.getDate()) }
  const sumStart3   = cal.sumStart||null, sumEnd3 = cal.sumEnd||null
  const winStart3   = cal.winStart||null, winEnd3 = cal.winEnd||null
  const marchStart3b = fmt3(year3,3,1)
  let termBoundaries3 = []
  if (termType3==='semester') {
    const sem1End3 = cal.sem1End || fmt3(year3,8,31)
    const sem2Start3 = sumEnd3 ? addDays3(sumEnd3,1) : fmt3(year3,9,1)
    const sem2End3 = cal.sem2End || fmt3(year3+1,2,28)
    termBoundaries3 = [
      { start:marchStart3b, end:sem1End3, label:'1학기' },
      { start:sem2Start3,   end:sem2End3, label:'2학기' },
    ]
  } else {
    const defEnds3 = [fmt3(year3,5,31),fmt3(year3,8,31),fmt3(year3,11,30),fmt3(year3+1,2,28)]
    const qEnds3   = cal.qEnds || []
    let prevEnd3   = fmt3(year3,2,28)
    for(let i=0;i<quarters3;i++){
      const qEnd3 = qEnds3[i] || defEnds3[i] || fmt3(year3+1,2,28)
      termBoundaries3.push({ start:addDays3(prevEnd3,1), end:qEnd3, label:`${i+1}분기` })
      prevEnd3 = qEnd3
    }
  }
  const numPeriods3       = termType3==='semester' ? 2 : quarters3
  const quarterTermCounts3 = Array.from({length:numPeriods3},(_,i)=>(cal.quarterTermCounts||[])[i]||3)
  const defaultSessions3   = cal.defaultSessions || 4
  const termSessionMap3    = cal.termSessionMap   || {}
  const getTS3 = (qIdx,tIdx) => termSessionMap3[`q${qIdx}t${tIdx}`] ?? defaultSessions3
  const flatTermSessions3  = []
  quarterTermCounts3.forEach((tCount,qIdx)=>{ for(let t=0;t<tCount;t++) flatTermSessions3.push(getTS3(qIdx,t)) })
  const { sessionMap: schoolSessionMap } = schoolBuildSessionMap({
    allSessionDates: schoolAllDates,
    termBoundaries: termBoundaries3,
    quarterTermCounts: quarterTermCounts3,
    flatTermSessions: flatTermSessions3,
  })

  // ── 내 수업 sessionMap — ClassCalendar.jsx와 동일한 로직
  const myTermSizes = (myClass.termSizes?.length > 0)
    ? myClass.termSizes.slice(0, myClass.termCount || myClass.termSizes.length).map(n => Number(n) || 4)
    : [myClass.termSize ? Number(myClass.termSize) : 4]
  const mySessionMap = {}
  const myTermMap    = {}
  let totalIdx = 1
  let cursor   = 0
  const myAllSessionsForMap = calcSessionDates(myClass)
  const mySessionsForMap    = myClass.totalSessions
    ? myAllSessionsForMap.slice(0, myClass.totalSessions)
    : myAllSessionsForMap
  myTermSizes.forEach((size, ti) => {
    let termIdx = 1
    mySessionsForMap.slice(cursor, cursor + size).forEach(d => {
      if (!myCancelledSet.has(d)) {
        mySessionMap[d] = { total: totalIdx++, termNum: ti+1, termSess: termIdx++ }
        myTermMap[d] = ti + 1
      } else {
        myTermMap[d] = ti + 1
      }
    })
    cursor += size
  })
  if (!myClass.totalSessions && cursor < mySessionsForMap.length) {
    let termIdx = 1
    mySessionsForMap.slice(cursor).forEach(d => {
      if (!myCancelledSet.has(d)) {
        mySessionMap[d] = { total: totalIdx++, termNum: myTermSizes.length, termSess: termIdx++ }
      }
      myTermMap[d] = myTermSizes.length
    })
  }
  ;(myClass.makeupDates||[]).forEach(m => {
    mySessionMap[m.date] = { total: totalIdx++, termNum: 0, termSess: 0, isMakeup: true }
  })

  // 비교 상태
  const missing         = schoolDates.filter(d=>!mySet.has(d))         // 학교O 내X
  const extra           = myDates.filter(d=>!schoolSet.has(d))         // 학교X 내O
  const schoolHolidays  = (cal.cancelledDates||[]).filter(c=>myDayNum==null||getDow3(c.date)===myDayNum)
  const myHolidayMissed = schoolHolidays.filter(c=>!myCancelledSet.has(c.date)&&mySet.has(c.date))
  const isOk = missing.length===0 && extra.length===0 && myHolidayMissed.length===0

  // 월 목록 — 학교 달력 전체 기간 기준 (1,2학기 모두 표시)
  const rangeStart = cal.startDate || myClass.startDate
  const rangeEnd   = cal.endDate   || myClass.endDate
  if (!rangeStart || !rangeEnd) return null
  const months = []
  let cur = new Date(parseInt(rangeStart.slice(0,4)), parseInt(rangeStart.slice(5,7))-1, 1)
  const endM = new Date(parseInt(rangeEnd.slice(0,4)), parseInt(rangeEnd.slice(5,7))-1, 1)
  while(cur <= endM) {
    months.push({ year:cur.getFullYear(), month:cur.getMonth() })
    cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1)
  }

  // 월별 달력 셀 렌더 (좌=학교, 우=내수업)
  const renderMiniMonth = (year, month, dateSet, cancelSet, isSchool) => {
    const firstDay = new Date(year,month,1).getDay()
    const lastDate = new Date(year,month+1,0).getDate()
    const cells    = []
    for(let i=0;i<firstDay;i++) cells.push(null)
    for(let d=1;d<=lastDate;d++) cells.push(d)

    return cells.map((d,idx) => {
      if(!d) return <div key={'e'+idx}/>
      const ds   = `${year}-${pad3(month+1)}-${pad3(d)}`
      const dow  = getDow3(ds)

      const isSession   = dateSet.has(ds)
      const isCancelled = cancelSet.has(ds)
      const isMissing   = isSchool && missing.includes(ds)
      const isExtra     = !isSchool && extra.includes(ds)
      const isHolMissed = !isSchool && myHolidayMissed.some(c=>c.date===ds)
      const isSun=dow===0, isSat=dow===6
      const isMyDay     = myDayNum==null || dow===myDayNum

      // 학교 달력 셀
      if(isSchool) {
        if(isCancelled && isMyDay) return (
          <div key={d} style={{ padding:'2px',borderRadius:'5px',textAlign:'center',background:'#fef2f2',border:'1px solid #fca5a5' }}>
            <div style={{ fontSize:'10px',color:'#d1d5db',fontWeight:500 }}>{d}</div>
            <div style={{ fontSize:'8px',color:'#ef4444' }}>휴일</div>
          </div>
        )
        if(isSession) {
          const sessInfo = schoolSessionMap[ds]
          const localTermNum = sessInfo ? sessInfo.localTermIdx + 1 : null
          return (
            <div key={d} style={{ padding:'2px',borderRadius:'5px',textAlign:'center',background: isMissing?'#fef2f2':'#fff7ed',border:`1px solid ${isMissing?'#fca5a5':'#f97316'}` }}>
              <div style={{ fontSize:'10px',fontWeight:700,color: isSun?'#ef4444':isSat?'#3b82f6':'#111827' }}>{d}</div>
              {sessInfo && <div style={{ fontSize:'7px',color:'#c2410c',fontWeight:700,lineHeight:1.3 }}>{sessInfo.quarterLabel} {localTermNum}텀 {sessInfo.inTermSess}차</div>}
              {isMissing && <div style={{ fontSize:'7px',color:'#ef4444',fontWeight:700 }}>내수업없음</div>}
            </div>
          )
        }
        return <div key={d} style={{ padding:'3px',textAlign:'center' }}><div style={{ fontSize:'10px',color: isSun?'#ef4444':isSat?'#3b82f6':'#111827' }}>{d}</div></div>
      }

      // 내 수업 셀
      if(isCancelled && isMyDay) return (
        <div key={d} style={{ padding:'2px',borderRadius:'5px',textAlign:'center',background:'#fef2f2',border:'1px solid #fca5a5' }}>
          <div style={{ fontSize:'10px',color:'#d1d5db',fontWeight:500 }}>{d}</div>
          <div style={{ fontSize:'8px',color:'#ef4444' }}>휴일</div>
        </div>
      )
      if(isHolMissed) return (
        <div key={d} style={{ padding:'2px',borderRadius:'5px',textAlign:'center',background:'#fffbeb',border:'1px solid #fde68a' }}>
          <div style={{ fontSize:'10px',fontWeight:700,color:'#111827' }}>{d}</div>
          <div style={{ fontSize:'7px',color:'#d97706',fontWeight:700 }}>휴일미반영</div>
        </div>
      )
      if(isSession) {
        const mySess = mySessionMap[ds]
        const semLabel = termBoundaries3.find(b => ds >= b.start && ds <= b.end)?.label || ''
        return (
          <div key={d} style={{ padding:'2px',borderRadius:'5px',textAlign:'center',background: isExtra?'#fffbeb':'#eff6ff',border:`1px solid ${isExtra?'#fde68a':'#3b82f6'}` }}>
            <div style={{ fontSize:'10px',fontWeight:700,color: isSun?'#ef4444':isSat?'#3b82f6':'#111827' }}>{d}</div>
            {mySess && <div style={{ fontSize:'7px',color:'#1d4ed8',fontWeight:700,lineHeight:1.3 }}>{semLabel}{semLabel?' ':''}{mySess.termNum}텀 {mySess.termSess}차</div>}
            {isExtra && <div style={{ fontSize:'7px',color:'#d97706',fontWeight:700 }}>학교없음</div>}
          </div>
        )
      }
      return <div key={d} style={{ padding:'3px',textAlign:'center' }}><div style={{ fontSize:'10px',color: isSun?'#ef4444':isSat?'#3b82f6':'#111827' }}>{d}</div></div>
    })
  }

  return (
    <div style={{ borderTop:'1px solid #f3f4f6', padding:'10px 16px', background:'#fafafa' }}>
      {/* 상태 요약 헤더 */}
      <div style={{ fontSize:'12px', fontWeight:700, color:isOk?'#16a34a':'#ef4444', marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px' }}>
        {isOk
          ? `✅ 내 ${myDayChar||''}요일 수업 일정 일치`
          : `⚠️ 차이 발견 (누락 ${missing.length}일 / 초과 ${extra.length}일${myHolidayMissed.length?` / 휴일미반영 ${myHolidayMissed.length}일`:''})`}
      </div>

      <div style={{ marginTop:'0' }}>
          {/* 범례 */}
          <div style={{ display:'flex',gap:'10px',flexWrap:'wrap',fontSize:'11px',marginBottom:'10px',padding:'6px 10px',background:'#fff',borderRadius:'8px',border:'1px solid #e5e7eb' }}>
            <span style={{ fontWeight:700,color:'#374151' }}>범례</span>
            <span style={{ display:'flex',alignItems:'center',gap:'3px' }}><span style={{ width:'10px',height:'10px',background:'#fff7ed',border:'1px solid #f97316',borderRadius:'2px',display:'inline-block' }}/>학교 수업일</span>
            <span style={{ display:'flex',alignItems:'center',gap:'3px' }}><span style={{ width:'10px',height:'10px',background:'#eff6ff',border:'1px solid #3b82f6',borderRadius:'2px',display:'inline-block' }}/>내 수업일</span>
            <span style={{ display:'flex',alignItems:'center',gap:'3px' }}><span style={{ width:'10px',height:'10px',background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'2px',display:'inline-block' }}/>누락/휴일</span>
            <span style={{ display:'flex',alignItems:'center',gap:'3px' }}><span style={{ width:'10px',height:'10px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'2px',display:'inline-block' }}/>초과/휴일미반영</span>
          </div>

          {/* 차시 요약 */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px' }}>
            <div style={{ padding:'8px 12px',borderRadius:'8px',background:'#fff7ed',border:'1px solid #f97316',textAlign:'center' }}>
              <div style={{ fontSize:'11px',color:'#ea580c',fontWeight:700,marginBottom:'2px' }}>🏫 학교 달력</div>
              <div style={{ fontSize:'16px',fontWeight:800,color:'#ea580c' }}>{schoolDates.length}차시</div>
            </div>
            <div style={{ padding:'8px 12px',borderRadius:'8px',background: isOk?'#eff6ff':'#fef2f2',border:`1px solid ${isOk?'#3b82f6':'#fca5a5'}`,textAlign:'center' }}>
              <div style={{ fontSize:'11px',color: isOk?'#1d4ed8':'#ef4444',fontWeight:700,marginBottom:'2px' }}>👩‍🏫 내 수업</div>
              <div style={{ fontSize:'16px',fontWeight:800,color: isOk?'#1d4ed8':'#ef4444' }}>{myDates.length}차시 {!isOk && myDates.length!==schoolDates.length && <span style={{ fontSize:'12px' }}>({myDates.length-schoolDates.length>0?'+':''}{myDates.length-schoolDates.length})</span>}</div>
            </div>
          </div>

          {/* 좌우 달력 비교 */}
          {months.map(({year:y,month:m})=>{
            const monthStr = `${y}-${pad3(m+1)}`
            // 이 달에 수업/휴일 날짜가 하나라도 있으면 표시
            const hasDates = [...Array(new Date(y,m+1,0).getDate())].some((_,i)=>{
              const ds = `${monthStr}-${pad3(i+1)}`
              return schoolSet.has(ds)||mySet.has(ds)||schoolCancelledSet.has(ds)||myCancelledSet.has(ds)
            })
            if(!hasDates) return null

            const firstDay = new Date(y,m,1).getDay()
            const lastDate = new Date(y,m+1,0).getDate()

            return (
              <div key={`${y}-${m}`} style={{ marginBottom:'16px' }}>
                <div style={{ fontSize:'12px',fontWeight:700,color:'#374151',marginBottom:'6px',textAlign:'center' }}>{y}년 {m+1}월</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px' }}>
                  {/* 학교 달력 */}
                  <div style={{ background:'#fff',borderRadius:'8px',padding:'8px',border:'1px solid #fed7aa' }}>
                    <div style={{ fontSize:'11px',fontWeight:700,color:'#ea580c',textAlign:'center',marginBottom:'5px' }}>🏫 학교</div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'1px',marginBottom:'3px' }}>
                      {DAY_KO.map((d,i)=>(<div key={d} style={{ textAlign:'center',fontSize:'8px',color:i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>))}
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'1px' }}>
                      {renderMiniMonth(y,m,schoolSet,schoolCancelledSet,true)}
                    </div>
                  </div>
                  {/* 내 수업 달력 */}
                  <div style={{ background:'#fff',borderRadius:'8px',padding:'8px',border:`1px solid ${isOk?'#bfdbfe':'#fca5a5'}` }}>
                    <div style={{ fontSize:'11px',fontWeight:700,color: isOk?'#1d4ed8':'#ef4444',textAlign:'center',marginBottom:'5px' }}>👩‍🏫 내 수업</div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'1px',marginBottom:'3px' }}>
                      {DAY_KO.map((d,i)=>(<div key={d} style={{ textAlign:'center',fontSize:'8px',color:i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>))}
                    </div>
                    <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'1px' }}>
                      {renderMiniMonth(y,m,mySet,myCancelledSet,false)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {isOk && (
            <div style={{ padding:'10px 14px',borderRadius:'10px',background:'#f0fdf4',border:'1px solid #86efac',fontSize:'12px',color:'#16a34a',fontWeight:600,textAlign:'center' }}>
              ✅ 학교 달력과 내 수업 일정이 완전히 일치합니다!
            </div>
          )}
        </div>
    </div>
  )
}

// ── 학교 연간 달력 조회 & 내 수업과 비교

function SchoolTaskPanel({ user }) {
  const [tasks,    setTasks]    = useState([])
  const [expanded, setExpanded] = useState(null)  // 파일 제출 열린 항목
  const [fileData, setFileData] = useState({})    // { subId: { name, data } }
  const { success, error } = useToast()

  const load = async () => {
    if (!user?.id) return
    try {
      const [allSubmits, allNotices] = await Promise.all([
        dbCall('getAll', 'schoolNoticeSubmits'),
        dbCall('getAll', 'schoolNotices'),
      ])
      const mine = (allSubmits||[]).filter(s => s.teacherId === user.id && s.status !== 'submitted')
      const list = mine.map(sub => {
        const notice = (allNotices||[]).find(n => n.id === sub.noticeId)
        if (!notice || notice.status === 'done') return null
        return { sub, notice }
      }).filter(Boolean)
      setTasks(list)
    } catch {}
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [user?.id])

  if (tasks.length === 0) return null

  const handleReply = async (sub, notice) => {
    try {
      await dbCall('update', 'schoolNoticeSubmits', {
        id: sub.id, patch: { status:'replied', repliedAt:now() }
      })
      success(`✅ "${notice.title}" 회신 완료 처리했습니다!`)
      load()
    } catch { error('처리 중 오류가 발생했습니다.') }
  }

  const handleFileChange = (subId, e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setFileData(prev => ({ ...prev, [subId]:{ name:file.name, data:ev.target.result } }))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSubmit = async (sub, notice) => {
    const f = fileData[sub.id]
    if (!f) { error('파일을 선택해주세요.'); return }
    try {
      await dbCall('update', 'schoolNoticeSubmits', {
        id: sub.id,
        patch: { status:'submitted', submittedAt:now(), fileUrl:f.data, fileName:f.name }
      })
      success(`✅ "${notice.title}" 제출 완료했습니다!`)
      setFileData(prev => { const n={...prev}; delete n[sub.id]; return n })
      setExpanded(null)
      load()
    } catch { error('제출 중 오류가 발생했습니다.') }
  }

  const today = new Date().toISOString().slice(0,10)

  return (
    <div style={{ marginBottom:'16px' }}>
      {/* 패널 헤더 */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
        <span style={{ fontSize:'14px', fontWeight:700, color:'#1e3a5f' }}>🏫 학교 업무 알림</span>
        <span style={{ fontSize:'11px', fontWeight:700, color:'#ef4444', background:'#fef2f2', padding:'2px 8px', borderRadius:'999px' }}>미완료 {tasks.length}건</span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {tasks.map(({ sub, notice }) => {
          const isTask      = notice.type === 'task'
          const isReplied   = sub.status === 'replied'
          const isOverdue   = notice.dueDate && notice.dueDate < today
          const isExpanded  = expanded === sub.id
          const myFile      = fileData[sub.id]

          return (
            <div key={sub.id} style={{
              background:'#fff', borderRadius:'14px',
              border:`2px solid ${isOverdue?'#fca5a5':isReplied?'#fcd34d':'#bfdbfe'}`,
              overflow:'hidden',
              boxShadow:'0 2px 8px rgba(0,0,0,0.06)',
            }}>
              {/* 업무 정보 */}
              <div style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'10px' }}>
                  <div style={{ flex:1 }}>
                    {/* 상태 뱃지 + 제목 */}
                    <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap', marginBottom:'5px' }}>
                      <span style={{ fontSize:'11px', fontWeight:700,
                        color: isReplied?'#d97706':'#3b82f6',
                        background: isReplied?'#fffbeb':'#eff6ff',
                        padding:'2px 8px', borderRadius:'999px' }}>
                        {isReplied ? '✉️ 회신완료' : '⏳ 미확인'}
                      </span>
                      <span style={{ fontSize:'11px', fontWeight:700,
                        color: isTask?'#d97706':'#6b7280',
                        background: isTask?'#fff7ed':'#f3f4f6',
                        padding:'2px 8px', borderRadius:'999px' }}>
                        {isTask ? '📎 업무 요청' : '📋 공지 전달'}
                      </span>
                      {isOverdue && <span style={{ fontSize:'11px', fontWeight:700, color:'#ef4444', background:'#fef2f2', padding:'2px 8px', borderRadius:'999px' }}>⚠️ 마감초과</span>}
                    </div>
                    <div style={{ fontSize:'14px', fontWeight:700, color:'#111827' }}>{notice.title}</div>
                    <div style={{ display:'flex', gap:'12px', marginTop:'4px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'12px', color:'#6b7280' }}>🏫 {notice.schoolName}</span>
                      {notice.startDate && <span style={{ fontSize:'12px', color:'#6b7280' }}>📅 {notice.startDate}{notice.endDate?` ~ ${notice.endDate}`:''}</span>}
                      {notice.dueDate   && <span style={{ fontSize:'12px', color:isOverdue?'#ef4444':'#6b7280' }}>⏰ 마감 {notice.dueDate}</span>}
                    </div>
                    {notice.content && <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'4px', lineHeight:1.5 }}>{notice.content}</div>}
                  </div>

                  {/* 액션 버튼 */}
                  <div style={{ display:'flex', gap:'6px', flexShrink:0, flexDirection:'column', alignItems:'flex-end' }}>
                    {/* 공지 전달 — 회신완료 버튼 */}
                    {!isReplied && (
                      <button onClick={() => handleReply(sub, notice)} style={{
                        padding:'7px 14px', borderRadius:'8px', border:'none', cursor:'pointer',
                        background:'#3b82f6', color:'#fff', fontSize:'12px', fontWeight:700,
                        fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap',
                      }}>✉️ 회신 완료</button>
                    )}
                    {/* 업무 요청 — 파일 제출 버튼 */}
                    {isTask && (
                      <button onClick={() => setExpanded(isExpanded ? null : sub.id)} style={{
                        padding:'7px 14px', borderRadius:'8px', border:`1.5px solid ${isReplied?'#3b82f6':'#e5e7eb'}`, cursor:'pointer',
                        background: isReplied?'#eff6ff':'#f8fafc',
                        color: isReplied?'#3b82f6':'#6b7280',
                        fontSize:'12px', fontWeight:700,
                        fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap',
                      }}>📎 파일 제출</button>
                    )}
                  </div>
                </div>
              </div>

              {/* 파일 제출 영역 (확장) */}
              {isExpanded && isTask && (
                <div style={{ borderTop:'1px solid #e5e7eb', padding:'12px 16px', background:'#f8fafc' }}>
                  <div style={{ fontSize:'12px', color:'#6b7280', marginBottom:'8px' }}>제출할 파일을 선택하세요</div>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                    <label style={{ padding:'7px 14px', borderRadius:'8px', border:'1.5px solid #e5e7eb', background:'#fff', fontSize:'12px', cursor:'pointer', color:'#6b7280', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                      📎 파일 선택
                      <input type="file" style={{ display:'none' }} onChange={e => handleFileChange(sub.id, e)} />
                    </label>
                    {myFile && <span style={{ fontSize:'12px', color:'#3b82f6', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{myFile.name}</span>}
                    {myFile && (
                      <button onClick={() => handleSubmit(sub, notice)} style={{
                        padding:'7px 18px', borderRadius:'8px', border:'none', cursor:'pointer',
                        background:'#16a34a', color:'#fff', fontSize:'12px', fontWeight:700,
                        fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap',
                      }}>📤 제출 완료</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 통합 래퍼
function SchoolConnectPopup({ user }) {
  const { pending, emailed, reload } = useSchoolData(user)
  if (pending.length > 0) return <ConnectInvitePopup invites={pending} user={user} reload={reload} />
  if (emailed.length > 0) return <SignupInvitePopup invites={emailed} reload={reload} />
  return null
}

export const DASHBOARD_CARDS = [
  { id: 'calendar',     label: '달력 & 출석부',  icon: '📅', desc: '수업 달력 및 날짜별 출결 현황',  navKey: 'classes'      },
  { id: 'supply',       label: '교구 관리',       icon: '🎒', desc: '이번 주 교구 준비 알림',         navKey: 'supply'       },
  { id: 'revenue',      label: '수익 관리',       icon: '💰', desc: '진행 중인 텀의 수납 현황',       navKey: 'revenue'      },
  { id: 'training',     label: '연수 관리',       icon: '📚', desc: '이수 필요 연수 알림',            navKey: 'training'     },
  { id: 'certificate',  label: '자격증 관리',     icon: '🏆', desc: '최근 자격증 목록',              navKey: 'certificate'  },
  { id: 'career',       label: '학력 및 이력',    icon: '📋', desc: '최근 학력·경력 이력',           navKey: 'career'       },
  { id: 'award',        label: '수상 경력',       icon: '🥇', desc: '최근 수상 내역',                navKey: 'award'        },
  { id: 'announcement', label: '공고 관리',       icon: '📢', desc: '실시간 채용·모집 공고',         navKey: 'announcement' },
]

const DEFAULT_CARDS = Object.fromEntries(DASHBOARD_CARDS.map(c => [c.id, true]))

function useCardSettings(userId) {
  const sKey = `dashboardCards_${userId}`
  const load = () => ({ ...DEFAULT_CARDS, ...(Settings.get(sKey) || {}) })
  const [settings, setSettings] = useState(load)

  const save = (next) => {
    Settings.set(sKey, next)  // localStorage + Supabase 자동 싱크
    setSettings(next)
  }

  return {
    settings,
    hideCard:   (id)    => save({ ...settings, [id]: false }),
    toggleCard: (id, v) => save({ ...settings, [id]: v }),
    resetAll:   ()      => save({ ...DEFAULT_CARDS }),
  }
}


// ─────────────────────────────────────────────────────────────────
//  내정보 페이지에서 사용하는 컴포넌트
//  import { DashboardCardSettings } from './Dashboard'
//  <DashboardCardSettings userId={user.id} />
// ─────────────────────────────────────────────────────────────────
export function DashboardCardSettings({ userId, settings: extSettings, onToggle, onResetAll }) {
  const own      = useCardSettings(userId)
  const settings   = extSettings  ?? own.settings
  const toggleCard = onToggle     ?? own.toggleCard
  const resetAll   = onResetAll   ?? own.resetAll

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>대시보드 카드 설정</div>
          <div style={{ fontSize: '12px', color: C.muted, marginTop: '3px' }}>
            대시보드에서 ✕로 숨긴 카드를 여기서 다시 켤 수 있어요.
          </div>
        </div>
        <button
          onClick={resetAll}
          style={{ fontSize: '12px', color: C.muted, background: 'none', border: `1px solid ${C.border}`, borderRadius: '7px', padding: '4px 12px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', whiteSpace: 'nowrap', marginLeft: '12px' }}
        >전체 켜기</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {DASHBOARD_CARDS.map(card => {
          const on = settings[card.id]
          return (
            <div
              key={card.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: on ? '#fff' : '#f9fafb', borderRadius: '10px', border: `1px solid ${C.border}`, gap: '12px', transition: 'all .15s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, opacity: on ? 1 : 0.45 }}>
                <span style={{ fontSize: '20px' }}>{card.icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{card.label}</div>
                  <div style={{ fontSize: '11px', color: C.muted }}>{card.desc}</div>
                </div>
              </div>
              <button
                onClick={() => toggleCard(card.id, !on)}
                style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: on ? C.primary : '#d1d5db', position: 'relative', transition: 'background .2s', flexShrink: 0 }}
                aria-label={on ? '끄기' : '켜기'}
              >
                <span style={{ position: 'absolute', top: '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', left: on ? '22px' : '2px', transition: 'left .2s', display: 'block' }} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  요약 카드 공통 wrapper
// ═══════════════════════════════════════════════════════════════════

function SummaryCard({ id, icon, label, navKey, onHide, onNav, children, mobile }) {
  return (
    <div style={{ background: C.card, borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
      <div
        onClick={() => !mobile && navKey && onNav(navKey)}
        style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: (!mobile && navKey) ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{icon}</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{label}</span>
          {navKey && !mobile && <span style={{ fontSize: '11px', color: C.primary, fontWeight: 600 }}>바로가기 →</span>}
          {navKey && mobile  && <span style={{ fontSize: '11px', color: C.muted, fontWeight: 500 }}>💻 PC에서 관리하세요</span>}
        </div>
        {!mobile && (
          <button
            onClick={e => { e.stopPropagation(); onHide(id) }}
            title="카드 숨기기 (내정보 또는 ⚙️에서 다시 켤 수 있어요)"
            style={{ width: '22px', height: '22px', borderRadius: '50%', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '12px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >✕</button>
        )}
      </div>
      <div style={{ padding: '12px 16px', flex: 1 }}>{children}</div>
    </div>
  )
}

function Empty({ msg = '데이터가 없습니다' }) {
  return <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>{msg}</div>
}

function ListRow({ left, sub, badge, badgeColor = '#1d4ed8', badgeBg = '#eff6ff', badgeBorder = '#bfdbfe' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#f9fafb', borderRadius: '8px', border: `1px solid ${C.border}`, gap: '8px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{left}</div>
        {sub && <div style={{ fontSize: '11px', color: C.muted, marginTop: '1px' }}>{sub}</div>}
      </div>
      {badge && (
        <span style={{ fontSize: '11px', fontWeight: 700, color: badgeColor, background: badgeBg, border: `1px solid ${badgeBorder}`, borderRadius: '5px', padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {badge}
        </span>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  개별 요약 카드
// ═══════════════════════════════════════════════════════════════════

// ── 💰 수익 관리
// 텀별 그룹 → 요일 · 학교명 · 금액 · 상태(미수/마감/진행중/예정)
function RevenueCard({ user, onHide, onNav, mobile }) {
  const today    = todayStr()
  const classes  = ClassesDB.byTeacher(user.id)
  const fees     = RevenueFees.byTeacher(user.id)
  const payments = RevenuePayments.byTeacher(user.id)

  // 텀별 맵 구성
  const termMap = new Map()  // termNum → [{...}]

  classes.forEach(cls => {
    const allSessions = calcSessionDates(cls)
    if (!allSessions.length) return
    const confirmed = StudentsDB.confirmed(cls.id)
    if (!confirmed.length) return

    const fee       = fees.find(f => f.classId === cls.id)
    const classPmts = payments.filter(p => p.classId === cls.id)
    const paidSids  = new Set(classPmts.map(p => p.studentId))
    const unpaidCount = confirmed.filter(s => !paidSids.has(s.id)).length

    // 요일 레이블 (cls.day 숫자 또는 cls.days 배열 첫번째)
    const dayIdx   = cls.day ?? cls.days?.[0] ?? null
    const dayLabel = dayIdx != null ? DAYS_KO[dayIdx] : ''

    // 이 수업이 속한 텀들 추출
    const seenTerms = new Set()
    allSessions.forEach(date => {
      const info = getSessionInfo(cls, date)
      if (!info || seenTerms.has(info.termNum)) return
      seenTerms.add(info.termNum)

      // 해당 텀의 세션만 필터
      const termSessions  = allSessions.filter(d => getSessionInfo(cls, d)?.termNum === info.termNum)
      const pastSessions  = termSessions.filter(d => d < today)
      const futureSessions = termSessions.filter(d => d >= today)

      let rowStatus
      if (futureSessions.length === 0)     rowStatus = unpaidCount > 0 ? 'unpaid' : 'closed'
      else if (pastSessions.length === 0)  rowStatus = 'upcoming'
      else                                 rowStatus = 'active'

      if (!termMap.has(info.termNum)) termMap.set(info.termNum, [])
      termMap.get(info.termNum).push({
        key: `${cls.id}-${info.termNum}`,
        cls, dayLabel, rowStatus,
        feePerStudent: fee?.amount ?? null,
        unpaidCount,
        totalCount: confirmed.length,
      })
    })
  })

  const sortedTerms = [...termMap.entries()].sort((a, b) => a[0] - b[0])

  const activeTermNums = [...termMap.entries()]
    .filter(([, rows]) => rows.some(r => r.rowStatus === 'active'))
    .map(([t]) => t)
  const currentTermNum = activeTermNums.length > 0 ? Math.max(...activeTermNums) : 0

  // 모든 행을 flat하게 — 텀 헤더 없이 행 하나에 모든 정보
  const visibleRows = sortedTerms.flatMap(([termNum, rows]) => {
    const filtered = rows.filter(r => !(r.rowStatus === 'closed' && r.unpaidCount === 0))
    const hasUnpaid = filtered.some(r => r.rowStatus === 'unpaid')
    if (filtered.length === 0) return []
    if (!hasUnpaid && termNum < currentTermNum) return []
    if (!hasUnpaid && termNum > currentTermNum + 1) return []
    return filtered.map(r => ({ ...r, termNum }))
  }).sort((a, b) => {
    const score = r => ({ unpaid:0, active:1, upcoming:2, closed:3 }[r.rowStatus] ?? 9)
    return score(a) - score(b)
  })

  return (
    <SummaryCard id="revenue" icon="💰" label="수익 관리" navKey="revenue" onHide={onHide} onNav={onNav} mobile={mobile}>
      {visibleRows.length === 0
        ? <Empty msg="등록된 수업이 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {visibleRows.map(({ key, cls, dayLabel, rowStatus, feePerStudent, unpaidCount, totalCount, termNum }) => {
              const totalUnpaid = feePerStudent != null ? feePerStudent * unpaidCount : null
              const totalFee    = feePerStudent != null ? feePerStudent * totalCount  : null

              // 금액+납부 상태 뱃지
              let amtText, amtColor, amtBg, amtBorder
              if (rowStatus === 'unpaid') {
                amtText = totalUnpaid != null ? `${totalUnpaid.toLocaleString()}원 미수` : '미수'
                amtColor = C.danger; amtBg = '#fef2f2'; amtBorder = '#fca5a5'
              } else if (rowStatus === 'active') {
                amtText = totalFee != null ? `${totalFee.toLocaleString()}원` : '-'
                amtColor = C.success; amtBg = '#f0fdf4'; amtBorder = '#86efac'
              } else {
                // upcoming
                amtText = totalFee != null ? `${totalFee.toLocaleString()}원` : '-'
                amtColor = '#6b7280'; amtBg = '#f3f4f6'; amtBorder = '#e5e7eb'
              }

              // 텀 상태 뱃지
              const termStatusMap = { unpaid:'마감', closed:'마감', active:'진행중', upcoming:'예정' }
              const termBgMap     = { unpaid:'#fef2f2', closed:'#f0fdf4', active:'#f0fdf4', upcoming:'#f3f4f6' }
              const termColorMap  = { unpaid:C.danger, closed:C.success, active:C.success, upcoming:'#6b7280' }
              const termBorderMap = { unpaid:'#fca5a5', closed:'#86efac', active:'#86efac', upcoming:'#e5e7eb' }

              // 학교명/과목·반
              const classLabel = [cls.className, cls.section ? cls.section + '반' : ''].filter(Boolean).join(' ')
              const nameLabel  = cls.organization + (classLabel ? ' / ' + classLabel : '')

              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 10px', background: '#f9fafb', borderRadius: '8px', border: `1px solid ${C.border}` }}>
                  {/* 요일 */}
                  {dayLabel && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: dayLabel==='일'?'#ef4444':dayLabel==='토'?'#3b82f6':C.muted, minWidth: '14px', flexShrink: 0 }}>{dayLabel}</span>
                  )}
                  {/* 학교명/과목·반 */}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameLabel}</span>
                  {/* 금액+납부 상태 */}
                  <span style={{ fontSize: '11px', fontWeight: 700, color: amtColor, background: amtBg, border: `1px solid ${amtBorder}`, borderRadius: '5px', padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>{amtText}</span>
                  {/* N텀 상태 */}
                  <span style={{ fontSize: '11px', fontWeight: 700, color: termColorMap[rowStatus], background: termBgMap[rowStatus], border: `1px solid ${termBorderMap[rowStatus]}`, borderRadius: '5px', padding: '2px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>{termNum}텀 {termStatusMap[rowStatus]}</span>
                </div>
              )
            })}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 📚 연수 관리
// Trainings 테이블 — 이수 필요 목록 + 26년도 완료 연수 5개
function TrainingCard({ user, onHide, onNav, mobile }) {
  const all     = Trainings.byTeacher(user.id)
  const pending = all
    .filter(t => !t.completedAt && t.status !== 'done')
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))

  const done2026 = all
    .filter(t => (t.completedAt && t.completedAt.startsWith('2026')) || (t.status === 'done' && t.completedAt?.startsWith('2026')))
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
    .slice(0, 5)

  return (
    <SummaryCard id="training" icon="📚" label="연수 관리" navKey="training" onHide={onHide} onNav={onNav} mobile={mobile}>
      {all.length === 0
        ? <Empty msg="등록된 연수가 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* 이수 필요 */}
            {pending.length === 0
              ? <div style={{ fontSize: '13px', color: C.success, textAlign: 'center', padding: '8px 0' }}>✅ 이수해야 할 연수가 없습니다</div>
              : pending.slice(0, 5).map((t, i) => (
                <ListRow
                  key={t.id || i}
                  left={t.title || t.name}
                  sub={[t.organization, t.deadline ? `마감 ${t.deadline}` : ''].filter(Boolean).join(' · ')}
                  badge="이수 필요"
                  badgeColor={C.primary}
                  badgeBg="#fff7ed"
                  badgeBorder="#fed7aa"
                />
              ))
            }
            {pending.length > 5 && <div style={{ fontSize: '11px', color: C.muted, textAlign: 'center' }}>외 {pending.length - 5}건 더 있어요</div>}

            {/* 26년도 완료 연수 */}
            {done2026.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: C.muted, marginTop: '6px', paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
                  2026년 완료 연수
                </div>
                {done2026.map((t, i) => (
                  <ListRow
                    key={t.id || i}
                    left={t.title || t.name}
                    sub={[t.organization, t.completedAt ? `완료 ${t.completedAt}` : ''].filter(Boolean).join(' · ')}
                    badge="완료"
                    badgeColor={C.success}
                    badgeBg="#f0fdf4"
                    badgeBorder="#86efac"
                  />
                ))}
              </>
            )}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 🏆 자격증 관리
// Certificates 테이블 — 취득일 역순 최근 5개
function CertificateCard({ user, onHide, onNav, mobile }) {
  const items = Certificates.byTeacher(user.id)
    .sort((a, b) => (b.date || b.issuedAt || '').localeCompare(a.date || a.issuedAt || ''))
    .slice(0, 5)

  return (
    <SummaryCard id="certificate" icon="🏆" label="자격증 관리" navKey="certificate" onHide={onHide} onNav={onNav} mobile={mobile}>
      {items.length === 0
        ? <Empty msg="등록된 자격증이 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map((c, i) => (
              <ListRow
                key={c.id || i}
                left={c.name || c.title}
                sub={[c.issuer || c.organization, c.date || c.issuedAt].filter(Boolean).join(' · ')}
                badge="자격증"
                badgeColor="#1d4ed8"
                badgeBg="#eff6ff"
                badgeBorder="#bfdbfe"
              />
            ))}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 📋 학력 및 이력
// Careers + Educations 합쳐서 최근 5개
function CareerCard({ user, onHide, onNav, mobile }) {
  const items = [
    ...Careers.byTeacher(user.id).map(r    => ({ ...r, _type: '경력' })),
    ...Educations.byTeacher(user.id).map(r => ({ ...r, _type: '학력' })),
  ]
    .sort((a, b) => (b.startDate || b.date || '').localeCompare(a.startDate || a.date || ''))
    .slice(0, 5)

  return (
    <SummaryCard id="career" icon="📋" label="학력 및 이력" navKey="career" onHide={onHide} onNav={onNav} mobile={mobile}>
      {items.length === 0
        ? <Empty msg="등록된 학력·이력이 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map((c, i) => {
              if (c._type === '학력') {
                const period = c.admissionDate
                  ? `${c.admissionDate} ~ ${c.status === '재학중' ? '재학중' : (c.graduationDate || '현재')}`
                  : ''
                return (
                  <ListRow key={c.id || i}
                    left={c.schoolName || ''}
                    sub={[c.major, period].filter(Boolean).join(' · ')}
                    badge="학력" badgeColor="#1d4ed8" badgeBg="#eff6ff" badgeBorder="#bfdbfe" />
                )
              }
              const daysLabel = (c.days && c.days.length > 0) ? c.days.join('') : ''
              const leftText  = [daysLabel, c.orgName].filter(Boolean).join(' ')
              const period    = c.startDate
                ? `${c.startDate} ~ ${c.isCurrent || !c.endDate ? '현재' : c.endDate}`
                : ''
              return (
                <ListRow key={c.id || i}
                  left={leftText}
                  sub={[c.subject, c.role, period].filter(Boolean).join(' · ')}
                  badge="경력" badgeColor="#15803d" badgeBg="#f0fdf4" badgeBorder="#86efac" />
              )
            })}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 🥇 수상 경력
// Awards 테이블 — 수상일 역순 최근 5개
function AwardCard({ user, onHide, onNav, mobile }) {
  const items = Awards.byTeacher(user.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5)

  return (
    <SummaryCard id="award" icon="🥇" label="수상 경력" navKey="award" onHide={onHide} onNav={onNav} mobile={mobile}>
      {items.length === 0
        ? <Empty msg="등록된 수상 경력이 없습니다" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {items.map((a, i) => (
              <ListRow
                key={a.id || i}
                left={a.title || a.name}
                sub={[a.organization || a.issuer, a.date].filter(Boolean).join(' · ')}
                badge="수상"
                badgeColor="#a16207"
                badgeBg="#fefce8"
                badgeBorder="#fde047"
              />
            ))}
          </div>
        )
      }
    </SummaryCard>
  )
}

// ── 📢 공고 관리
// JobSubs(구독 설정)는 공고관리 페이지에서 관리, 여기선 바로가기만
function AnnouncementCard({ user, onHide, onNav, mobile }) {
  return (
    <SummaryCard id="announcement" icon="📢" label="공고 관리" navKey="announcement" onHide={onHide} onNav={onNav} mobile={mobile}>
      <div style={{ textAlign: 'center', padding: '14px 0' }}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📢</div>
        <div style={{ fontSize: '13px', color: C.muted }}>채용·모집 공고를 확인하세요</div>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>공고관리 페이지에서 실시간 목록을 볼 수 있어요</div>
        <button
          onClick={() => onNav('announcement')}
          style={{ marginTop: '12px', padding: '7px 18px', borderRadius: '8px', border: `1.5px solid ${C.primary}`, background: '#fff7ed', color: C.primary, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}
        >공고 보러 가기</button>
      </div>
    </SummaryCard>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  기존 컴포넌트 (변경 없음)
// ═══════════════════════════════════════════════════════════════════

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
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today       = todayStr()
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
          const isSel   = dateStr === selectedDate
          const hasCls  = classDates.has(dateStr)
          const isSun   = (firstDay + day - 1) % 7 === 0
          const isSat   = (firstDay + day - 1) % 7 === 6
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
  const today = todayStr()
  const isToday = date === today
  const [notes, setNotes]           = useState(() => Notes.byTeacherDate(user.id, date))
  const [newNote, setNewNote]       = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const inputRef = useRef()
  const { success } = useToast()

  const [spItems,  setSpItems]  = useState([])
  const [spProds,  setSpProds]  = useState([])
  const [spProg,   setSpProg]   = useState([])
  const [spChecks, setSpChecks] = useState([])

  useEffect(() => {
    setNotes(Notes.byTeacherDate(user.id, date))
    setNewNote(''); setAddingNote(false)
    try { setSpItems(SupplyItems.byTeacher(user.id)) }              catch {}
    try { setSpProds(SupplyProducts.byTeacher(user.id)) }          catch {}
    try { setSpProg(SupplyStudentProgress.byTeacher(user.id)) }    catch {}
    try { setSpChecks(SupplySessionChecks.byTeacher(user.id)) }    catch {}
  }, [date, user.id])

  const dayClasses = sortClasses(classes.filter(cls => calcSessionDates(cls).includes(date)))

  const addNote    = () => {
    if (!newNote.trim()) return
    Notes.insert({ id: uid(), teacherId: user.id, date, content: newNote.trim(), createdAt: now() })
    setNotes(Notes.byTeacherDate(user.id, date))
    setNewNote(''); setAddingNote(false)
    success('등록이 완료되었습니다.')
  }
  const deleteNote = (id) => { Notes.delete(id); setNotes(Notes.byTeacherDate(user.id, date)) }
  const editNote   = (id, content) => { Notes.update(id, { content }); setNotes(Notes.byTeacherDate(user.id, date)); success('수정이 완료되었습니다.') }

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

          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {schoolClasses.map(cls => {
              const students = StudentsDB.confirmed(cls.id).sort((a, b) => {
                const g = parseInt(a.grade||'0') - parseInt(b.grade||'0'); if (g !== 0) return g
                const c = parseInt(a.classNum||'0') - parseInt(b.classNum||'0'); if (c !== 0) return c
                const n = parseInt(a.number||'0') - parseInt(b.number||'0'); if (n !== 0) return n
                return (a.name||'').localeCompare(b.name||'', 'ko')
              })
              const attRecords = AttendanceDB.byClassDate(cls.id, date)
              const presentCnt = attRecords.filter(a => a.status === 'present' || a.status === 'late').length
              const doneCnt    = attRecords.filter(a => a.status !== 'pending').length
              const pendingCnt = students.length - doneCnt
              const sessInfo   = getSessionInfo(cls, date)
              const TERM_COLORS = [
                { bg:'#fff7ed', border:'#f97316', text:'#ea580c' },
                { bg:'#f0fdf4', border:'#16a34a', text:'#15803d' },
                { bg:'#eff6ff', border:'#3b82f6', text:'#1d4ed8' },
                { bg:'#fdf4ff', border:'#a855f7', text:'#7e22ce' },
              ]
              const tc        = sessInfo ? TERM_COLORS[(sessInfo.termNum-1) % TERM_COLORS.length] : null
              const startTime = cls.time || ''
              const endTime   = cls.timeEnd || ''

              return (
                <div key={cls.id} style={{ borderRadius: '10px', border: '1px solid #fed7aa', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#fff7ed', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>수업 과목 · {cls.className}</span>
                        {cls.section && <span style={{ fontSize: '12px', background: C.primary, color: '#fff', borderRadius: '6px', padding: '1px 8px', fontWeight: 600 }}>{cls.section}반</span>}
                        {sessInfo && (
                          <>
                            <span style={{ fontSize: '11px', color: C.muted, background: '#f3f4f6', padding: '1px 7px', borderRadius: '5px' }}>{sessInfo.total}차시</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: tc?.text, background: tc?.bg, border: `1px solid ${tc?.border}`, padding: '1px 7px', borderRadius: '5px' }}>
                              {sessInfo.termNum}텀 {sessInfo.termSess}차시
                            </span>
                          </>
                        )}
                      </div>
                      {startTime && <div style={{ fontSize: '12px', color: C.muted }}>🕐 {startTime}{endTime ? ` ~ ${endTime}` : ''}</div>}
                      {(() => {
                        const supplyData = SupplyItems.byClass(cls.id)
                        if (!supplyData.length) return null
                        const set    = supplyData.filter(item => item.name)
                        const notSet = students.filter(s => !supplyData.find(item => item.studentId === s.id && item.name))
                        return (
                          <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {set.length > 0    && <span style={{ fontSize: '11px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: '5px', padding: '1px 8px' }}>🎒 교구 {set.length}명 설정</span>}
                            {notSet.length > 0 && <span style={{ fontSize: '11px', background: '#fef2f2', color: C.danger, border: '1px solid #fca5a5', borderRadius: '5px', padding: '1px 8px' }}>⚠️ 미설정 {notSet.length}명</span>}
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: doneCnt === students.length && students.length > 0 ? C.success : C.text }}>
                        {presentCnt}/{students.length}명 출석
                      </div>
                      {pendingCnt > 0 && <span style={{ fontSize: '11px', color: C.muted }}>미처리 {pendingCnt}명</span>}
                      <button onClick={() => onNav('attendance', { classId: cls.id, date })} style={{ ...smBtn(C.primary, '#fff'), padding: '5px 12px', fontSize: '12px', borderRadius: '7px' }}>
                        출석 체크
                      </button>
                    </div>
                  </div>

                  {(() => {
                    if (!students.length) return <div style={{ padding: '12px 14px', fontSize: '13px', color: C.muted }}>등록된 학생이 없습니다</div>
                    const isFutureDate = date > today
                    const isPastOrToday = date <= today
                    const S = {
                      present: { label: '출석', color: '#16a34a', bg: '#f0fdf4' },
                      late:    { label: '지각', color: '#d97706', bg: '#fffbeb' },
                      leave:   { label: '조퇴', color: '#7c3aed', bg: '#f5f3ff' },
                      absent:  { label: '결석', color: '#ef4444', bg: '#fef2f2' },
                    }

                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                            {['순번','학년·반·번호','이름','학부모전화','출석·지각·조퇴·결석','진도','특이사항·메모'].map(h => (
                              <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap', borderBottom: '1px solid #f3f4f6' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((stu, idx) => {
                            const ar  = attRecords.find(a => a.studentId === stu.id)
                            const ac  = S[ar?.status] || { label: '', color: '#9ca3af', bg: 'transparent' }
                            const si  = spItems.find(i => i.studentId === stu.id && i.classId === cls.id)
                            const sp  = si?.productId ? spProds.find(p => p.id === si.productId) : null
                            const sg  = si?.productId ? spProg.find(p => p.studentId === stu.id && p.productId === si.productId) : null
                            const st  = sg?.curStage || si?.stage || 1
                            const spp = sp?.sessionsPerStage || 12
                            const chk = si?.productId ? spChecks.filter(c => c.studentId === stu.id && c.productId === si.productId && c.stage === st).length : 0
                            const pct = si ? Math.min(Math.round(chk/spp*100), 100) : 0
                            const hb  = stu.remark || (stu.student_careers?.length > 0) || stu.status === 'cancel_before' || stu.status === 'cancel_after' || (stu.relations||[]).length > 0
                            return (
                              <tr key={stu.id} style={{ borderBottom: '1px solid #f3f4f6', background: idx%2===0 ? '#fff' : '#fafafa' }}>
                                <td style={{ padding: '8px 12px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
                                  {stu.applyOrder ? <span style={{ fontWeight: 700, color: '#f97316' }}>{stu.applyOrder}</span> : idx+1}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '12px', color: '#374151', whiteSpace: 'nowrap' }}>
                                  {stu.grade ? stu.grade+'학년' : '-'}
                                  {stu.classNum && <span style={{ marginLeft: '3px', padding: '1px 5px', borderRadius: '4px', background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: '11px' }}>{stu.classNum}반</span>}
                                  {stu.number  && <span style={{ marginLeft: '3px', color: '#9ca3af', fontSize: '11px' }}>{stu.number}번</span>}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                                  <div>{stu.name}</div>
                                  {hb && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '3px' }}>
                                      {stu.remark && <span style={{ fontSize: '10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 5px', fontWeight: 600 }}>{stu.remark}</span>}
                                      {(stu.student_careers?.length > 0) && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: stu.student_careers.length<=1?'#eff6ff':'#f0fdf4', border: `1px solid ${stu.student_careers.length<=1?'#bfdbfe':'#86efac'}`, color: stu.student_careers.length<=1?'#1d4ed8':'#15803d' }}>{stu.student_careers.length<=1?'신규':'기존'}</span>}
                                      {(stu.status==='cancel_before'||stu.status==='cancel_after') && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>{stu.status==='cancel_after'?'개강후취소':'개강전취소'}{stu.cancel_info?.date&&(()=>{const [y,m,day]=stu.cancel_info.date.split('-');return `-${y.slice(2)}.${parseInt(m)}.${parseInt(day)}`})()}</span>}
                                      {(stu.relations||[]).map((r,ri)=><span key={ri} style={{ fontSize:'10px',fontWeight:600,padding:'1px 5px',borderRadius:'4px',background:r.type==='쌍둥이'?'#fdf4ff':r.type==='형제'?'#eff6ff':r.type==='남매'?'#f0fdf4':'#fff7ed',border:`1px solid ${r.type==='쌍둥이'?'#e9d5ff':r.type==='형제'?'#bfdbfe':r.type==='남매'?'#86efac':'#fed7aa'}`,color:r.type==='쌍둥이'?'#7e22ce':r.type==='형제'?'#1d4ed8':r.type==='남매'?'#15803d':'#c2410c' }}>{r.type}{r.with?` · ${r.with}`:''}</span>)}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '8px 12px', fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{stu.parentPhone||'-'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  {isFutureDate ? (
                                    <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'5px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#dc2626', whiteSpace:'nowrap' }}>
                                      📅 아직 수업일이 아닙니다
                                    </span>
                                  ) : !ar ? (
                                    <span
                                      onClick={() => onNav('attendance', { classId: cls.id, date })}
                                      style={{ display:'inline-flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'5px', border:'1.5px solid #16a34a', background:'#f0fdf4', color:'#16a34a', cursor:'pointer', whiteSpace:'nowrap' }}
                                    >
                                      ✅ 출석체크 해주세요 →
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: ac.bg, color: ac.color, border: `1px solid ${ac.color}40` }}>{ac.label}</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                  {si ? (
                                    <div style={{ fontSize: '11px' }}>
                                      <div style={{ fontWeight: 600, color: '#374151' }}>{sp?.name||si.name||''}</div>
                                      <div style={{ color: '#6b7280', marginTop: '1px' }}>{st}단계 {chk}/{spp}차시</div>
                                      <div style={{ height: '3px', background: '#e5e7eb', borderRadius: '2px', marginTop: '3px', width: '70px' }}>
                                        <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: pct>=100?'#16a34a':pct>=80?'#f59e0b':'#f97316' }} />
                                      </div>
                                    </div>
                                  ) : <span style={{ fontSize: '11px', color: '#d1d5db' }}>-</span>}
                                </td>
                                <td style={{ padding: '8px 12px', maxWidth: '150px' }}>
                                  {ar?.note
                                    ? <span style={{ fontSize: '11px', color: '#374151', background: '#fffbeb', padding: '2px 6px', borderRadius: '5px', border: '1px solid #fde68a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ar.note}</span>
                                    : <span style={{ fontSize: '11px', color: '#d1d5db' }}>-</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )
                  })()}

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

// ═══════════════════════════════════════════════════════════════════
//  MOBILE DASHBOARD  (768px 이하 전용)
// ═══════════════════════════════════════════════════════════════════

function MobileCalendar({ year, month, selectedDate, classDates, onSelect, onPrev, onNext, onToday }) {
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today       = todayStr()
  const classSet    = new Set(classDates)
  const cells       = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      {/* 월 네비 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={onPrev} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '18px' }}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{year}년 {MONTHS[month]}</span>
          <button onClick={onToday} style={{ padding: '2px 10px', borderRadius: '6px', border: '1px solid #f97316', background: '#fff7ed', color: '#f97316', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>오늘</button>
        </div>
        <button onClick={onNext} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '18px' }}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '4px' }}>
        {DAYS_KO.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, padding: '3px 0', color: i===0?'#ef4444':i===6?'#3b82f6':'#9ca3af' }}>{d}</div>
        ))}
      </div>

      {/* 날짜 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />
          const ds      = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isClass = classSet.has(ds)
          const isToday = ds === today
          const isSel   = ds === selectedDate
          const isSun   = (firstDay + day - 1) % 7 === 0
          const isSat   = (firstDay + day - 1) % 7 === 6
          return (
            <button key={day} onClick={() => onSelect(ds)} style={{
              position: 'relative', padding: '8px 2px', border: 'none', borderRadius: '8px', cursor: 'pointer',
              background: isSel ? '#f97316' : isToday ? '#fff7ed' : isClass ? '#f0fdf4' : 'transparent',
              color: isSel ? '#fff' : isSun ? '#ef4444' : isSat ? '#3b82f6' : '#111827',
              fontWeight: isSel || isToday ? 700 : 400, fontSize: '14px',
              outline: isToday && !isSel ? '2px solid #f97316' : 'none', outlineOffset: '-2px',
              fontFamily: 'Noto Sans KR, sans-serif',
            }}>
              {day}
              {isClass && (
                <span style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: isSel ? '#fff' : '#f97316', display: 'block' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* 범례 */}
      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '14px', fontSize: '11px', color: '#6b7280' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width:6,height:6,borderRadius:'50%',background:'#f97316',display:'inline-block' }}/> 수업 있는 날</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width:12,height:12,borderRadius:'4px',border:'2px solid #f97316',display:'inline-block' }}/> 오늘</span>
      </div>
    </div>
  )
}

function MobileDashboard({ user, onNav }) {
  const today = todayStr()
  const d     = new Date()
  const [calYear,  setCalYear]  = useState(d.getFullYear())
  const [calMonth, setCalMonth] = useState(d.getMonth())
  const [selDate,  setSelDate]  = useState(today)

  const classes    = sortClasses(ClassesDB.byTeacher(user.id))
  const classDates = [...new Set(classes.flatMap(cls => calcSessionDates(cls)))]
  const todayClasses = classes.filter(cls => calcSessionDates(cls).includes(selDate))

  const prevMonth = () => { if (calMonth===0){setCalYear(y=>y-1);setCalMonth(11)}else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth===11){setCalYear(y=>y+1);setCalMonth(0)}else setCalMonth(m=>m+1) }
  const goToday   = () => { const t=new Date(); setCalYear(t.getFullYear()); setCalMonth(t.getMonth()); setSelDate(today) }

  const name = (user.displayNameMode === 'nickname' && user.nickname) ? user.nickname : user.name
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches

  // 날씨 — PC와 동일한 저장 키 사용 (공유)
  const locKey = `weatherLocation_${user.id}`
  const [weatherLoc, setWeatherLoc] = useState(() => Settings.get(locKey) || { lat:37.39, lng:126.95, name:'군포시' })
  const weather = useWeather(weatherLoc.lat, weatherLoc.lng)
  const [locModal,    setLocModal]    = useState(false)
  const [locSearch,   setLocSearch]   = useState('')
  const [locResults,  setLocResults]  = useState([])
  const [locSearching,setLocSearching]= useState(false)
  const searchLocation = async (q) => {
    if (!q.trim()) return
    setLocSearching(true)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=ko`, { signal: controller.signal })
      clearTimeout(timer)
      const data = await res.json()
      setLocResults(data.results || [])
    } catch { setLocResults([]) }
    setLocSearching(false)
  }
  const selectLocation = (r) => {
    const loc = { lat: r.latitude, lng: r.longitude, name: r.name + (r.admin1 ? ` (${r.admin1})` : '') }
    Settings.set(locKey, loc)
    setWeatherLoc(loc)
    setLocModal(false); setLocSearch(''); setLocResults([])
  }
  const [showInstallGuide, setShowInstallGuide] = useState(false)

  const handleAddShortcut = () => {
    // 안드로이드 크롬 - PWA 설치 프롬프트가 있으면 사용
    if (window._installPrompt) {
      window._installPrompt.prompt()
      return
    }
    // 그 외 - 안내 모달
    setShowInstallGuide(true)
  }
  const noop = () => {}  // 모바일에서 카드 숨기기 비활성

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── 학교 담당자 연결 요청 팝업 ── */}
      <SchoolConnectPopup user={user} />

      {/* ── 학교 업무 알림 (미완료 상시 표시) ── */}
      <SchoolConnectionPanel user={user} onNav={onNav} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>안녕하세요, {name} 선생님 👋</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '3px' }}>{formatDateKo(today)}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
          {/* 날씨 */}
          <div onClick={() => { setLocModal(true); setLocSearch(''); setLocResults([]) }}
            style={{ display:'flex', alignItems:'center', gap:'4px', padding:'6px 10px', borderRadius:'10px', background:'#f9fafb', border:'1px solid #e5e7eb', cursor:'pointer' }}>
            {weather ? (
              <>
                <span style={{ fontSize:'18px' }}>{weatherIcon(weather.code).icon}</span>
                <div>
                  <div style={{ fontSize:'13px', fontWeight:700, color:'#111827', lineHeight:1.2 }}>{weather.temp}°C</div>
                  <div style={{ fontSize:'10px', color:'#9ca3af', lineHeight:1.2 }}>{weatherLoc.name}</div>
                </div>
              </>
            ) : (
              <div style={{ fontSize:'11px', color:'#9ca3af' }}>📍 {weatherLoc.name}</div>
            )}
          </div>
          {/* 바로가기 */}
          {!isStandalone && (
            <button onClick={handleAddShortcut}
              style={{ padding:'8px 14px', borderRadius:'10px', border:'1.5px solid #f97316', background:'#fff7ed', color:'#f97316', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
              📲 바로가기
            </button>
          )}
        </div>
      </div>

      {/* 날씨 지역 변경 모달 */}
      {locModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setLocModal(false)}>
          <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'24px', width:'100%', maxWidth:'480px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'16px', fontWeight:700, color:'#111827', marginBottom:'4px' }}>📍 날씨 지역 설정</div>
            <div style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'16px' }}>현재: {weatherLoc.name}</div>
            <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
              <input value={locSearch} onChange={e => setLocSearch(e.target.value)}
                onKeyDown={e => e.key==='Enter' && searchLocation(locSearch)}
                placeholder="도시명 검색 (예: 서울, 수원, 군포)"
                style={{ flex:1, padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
              <button onClick={() => searchLocation(locSearch)}
                style={{ padding:'11px 18px', borderRadius:'10px', border:'none', background:'#f97316', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                검색
              </button>
            </div>
            {locSearching && <div style={{ fontSize:'13px', color:'#9ca3af', textAlign:'center', padding:'12px' }}>검색 중...</div>}
            {locResults.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'240px', overflowY:'auto' }}>
                {locResults.map((r, i) => (
                  <button key={i} onClick={() => selectLocation(r)}
                    style={{ padding:'10px 14px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'#f9fafb', cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif' }}>
                    <div style={{ fontSize:'14px', fontWeight:600, color:'#111827' }}>{r.name}</div>
                    <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'2px' }}>
                      {[r.admin1, r.country].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!locSearching && locResults.length === 0 && locSearch && (
              <div style={{ fontSize:'13px', color:'#9ca3af', textAlign:'center', padding:'12px' }}>검색 결과가 없습니다</div>
            )}
            <button onClick={() => setLocModal(false)}
              style={{ marginTop:'16px', width:'100%', padding:'13px', borderRadius:'10px', border:'1px solid #e5e7eb', background:'#fff', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#6b7280', fontWeight:600 }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 바탕화면 바로가기 안내 모달 */}
      {showInstallGuide && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={() => setShowInstallGuide(false)}>
          <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'24px', width:'100%', maxWidth:'480px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'16px', fontWeight:700, color:'#111827', marginBottom:'16px' }}>📲 바탕화면 바로가기 추가</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ padding:'14px 16px', borderRadius:'12px', background:'#fff7ed', border:'1.5px solid #fed7aa' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'6px' }}>🤖 안드로이드</div>
                <div style={{ fontSize:'13px', color:'#374151', lineHeight:1.9 }}>
                  크롬 우측 상단 <strong>⋮</strong> → <strong>홈 화면에 추가</strong>
                </div>
              </div>
              <div style={{ padding:'14px 16px', borderRadius:'12px', background:'#f9fafb', border:'1px solid #e5e7eb' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#111827', marginBottom:'6px' }}>🍎 아이폰</div>
                <div style={{ fontSize:'13px', color:'#374151', lineHeight:1.9 }}>
                  Safari 하단 <strong>공유 □↑</strong> → <strong>홈 화면에 추가</strong>
                </div>
              </div>
            </div>
            <button onClick={() => setShowInstallGuide(false)}
              style={{ marginTop:'16px', width:'100%', padding:'14px', borderRadius:'10px', border:'none', background:'#f97316', color:'#fff', fontSize:'15px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              확인
            </button>
          </div>
        </div>
      )}

      {/* 달력 */}
      <MobileCalendar
        year={calYear} month={calMonth} selectedDate={selDate} classDates={classDates}
        onSelect={setSelDate} onPrev={prevMonth} onNext={nextMonth} onToday={goToday}
      />

      {/* 달력 아래 배너 — 선택 날짜 요약 + 학교별 네비게이션 */}
      <div style={{ background:'#fff7ed', borderRadius:'14px', border:'1px solid #fed7aa', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'10px' }}>
        {/* 날짜 + 수업 수 */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'15px', fontWeight:700, color:'#111827' }}>
              {selDate === today ? `${formatDateKo(selDate)}` : formatDateKo(selDate)}
            </div>
            <div style={{ fontSize:'12px', color: todayClasses.length > 0 ? '#f97316' : '#9ca3af', marginTop:'2px', fontWeight:600 }}>
              {todayClasses.length > 0 ? `수업 ${todayClasses.length}개` : '수업 없는 날'}
            </div>
          </div>
        </div>
        {/* 학교별 네비게이션 */}
        {[...new Set(todayClasses.map(c => c.organization).filter(Boolean))].map(school => (
          <div key={school} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:'8px', borderTop:'1px solid #fed7aa' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <span style={{ fontSize:'16px' }}>🏫</span>
              <span style={{ fontSize:'14px', fontWeight:700, color:'#111827' }}>{school}</span>
              <span style={{ fontSize:'11px', color:'#9ca3af' }}>수업 장소</span>
            </div>
            <a href={`https://map.naver.com/v5/search/${encodeURIComponent(school)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'10px 18px', borderRadius:'11px', background:'#f0fdf4', border:'2px solid #86efac', color:'#16a34a', fontSize:'14px', fontWeight:700, textDecoration:'none' }}>
              🗺️ 네비게이션
            </a>
          </div>
        ))}
      </div>

      {/* 오늘 수업 목록 */}
      <div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#374151', marginBottom: '10px' }}>
          {selDate === today ? '📅 오늘 수업' : `📅 ${selDate.slice(5).replace('-','월 ')}일 수업`}
        </div>

        {todayClasses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', background: '#fff', borderRadius: '14px', color: '#9ca3af' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗓️</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#6b7280' }}>수업이 없는 날입니다</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>달력에서 수업일을 선택하세요</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {todayClasses.map(cls => {
              const students   = StudentsDB.confirmed(cls.id)
              const attRecords = AttendanceDB.byClassDate(cls.id, selDate)
              const doneCnt    = attRecords.filter(a => a.status !== 'pending').length
              const presentCnt = attRecords.filter(a => a.status === 'present' || a.status === 'late').length
              const allDone    = doneCnt === students.length && students.length > 0
              return (
                <div key={cls.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ padding: '14px 16px', background: allDone ? '#f0fdf4' : '#fff7ed', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap:'10px' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        {/* 한줄: 수업명(반) / 학교 / 시간 */}
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'15px', fontWeight:700, color:'#111827' }}>
                            {cls.className}{cls.section ? ` ${cls.section}반` : ''}
                          </span>
                          {cls.organization && <>
                            <span style={{ color:'#d1d5db' }}>·</span>
                            <span style={{ fontSize:'13px', color:'#6b7280' }}>{cls.organization}</span>
                          </>}
                          {cls.time && <>
                            <span style={{ color:'#d1d5db' }}>·</span>
                            <span style={{ fontSize:'13px', color:'#6b7280' }}>🕐 {cls.time}{cls.timeEnd ? `~${cls.timeEnd}` : ''}</span>
                          </>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink:0 }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: allDone ? '#16a34a' : '#f97316' }}>
                          {presentCnt}<span style={{ fontSize: '13px', color: '#9ca3af' }}>/{students.length}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: allDone ? '#16a34a' : '#9ca3af', marginTop: '1px' }}>
                          {allDone ? '✅ 완료' : `미처리 ${students.length - doneCnt}명`}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => onNav('attendance', { classId: cls.id, date: selDate })}
                    style={{ width: '100%', padding: '14px', border: 'none', cursor: 'pointer', background: allDone ? '#f0fdf4' : '#fff', color: allDone ? '#16a34a' : '#f97316', fontSize: '15px', fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    {allDone ? '✅ 출석 완료 — 다시 확인' : '✅ 출석 체크하기 →'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 구분선 + PC 관리 안내 */}
      <div style={{ borderTop: '1.5px dashed #e5e7eb', paddingTop: '16px' }}>
        <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginBottom: '14px', background: '#f9fafb', borderRadius: '10px', padding: '10px', border: '1px solid #f3f4f6' }}>
          💻 아래 항목들은 PC에서 관리하세요
        </div>

        {/* 수익관리 */}
        <div style={{ marginBottom: '12px' }}>
          <RevenueCard user={user} onHide={noop} onNav={onNav} mobile={true} />
        </div>

        {/* 교구 준비 알림 */}
        {(() => {
          const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate()+7)
          const weekEndStr = weekEnd.toISOString().slice(0,10)
          const alerts = classes.flatMap(cls => {
            const upcoming = calcSessionDates(cls).filter(d => d >= today && d <= weekEndStr)
            if (!upcoming.length) return []
            const confirmed = StudentsDB.confirmed(cls.id)
            if (!confirmed.length) return []
            const supplyData = SupplyItems.byClass(cls.id)
            const notSet = confirmed.filter(s => !supplyData.find(item => item.studentId === s.id && item.name))
            return notSet.length > 0 ? [{ cls, nextDate: upcoming[0], notSetCount: notSet.length, total: confirmed.length }] : []
          })
          if (!alerts.length) return null
          return (
            <div style={{ background: '#fef2f2', borderRadius: '14px', border: '1.5px solid #fca5a5', padding: '14px 16px', marginBottom: '12px', cursor: 'pointer' }}
              onClick={() => onNav('supplies')}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444', marginBottom: '8px' }}>⚠️ 교구 준비 필요 — 이번주 수업</div>
              {alerts.map(({ cls, nextDate, notSetCount, total }) => (
                <div key={cls.id} style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
                  {cls.organization} · {cls.className}{cls.section?' '+cls.section+'반':''} · {nextDate} · 미설정 {notSetCount}/{total}명
                </div>
              ))}
            </div>
          )
        })()}

        {/* 공고 관리 */}
        <div style={{ marginBottom: '12px' }}>
          <AnnouncementCard user={user} onHide={noop} onNav={onNav} mobile={true} />
        </div>

        {/* 연수 관리 */}
        <div style={{ marginBottom: '12px' }}>
          <TrainingCard user={user} onHide={noop} onNav={onNav} mobile={true} />
        </div>

        {/* 자격증 관리 */}
        <div style={{ marginBottom: '12px' }}>
          <CertificateCard user={user} onHide={noop} onNav={onNav} mobile={true} />
        </div>

        {/* 학력 및 이력 */}
        <div style={{ marginBottom: '12px' }}>
          <CareerCard user={user} onHide={noop} onNav={onNav} mobile={true} />
        </div>

        {/* 수상 경력 */}
        <div style={{ marginBottom: '12px' }}>
          <AwardCard user={user} onHide={noop} onNav={onNav} mobile={true} />
        </div>
      </div>

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
//  DASHBOARD  메인 export
// ═══════════════════════════════════════════════════════════════════

export function Dashboard({ user, onNav }) {
  const isMobile = window.innerWidth <= 768
  if (isMobile) return <MobileDashboard user={user} onNav={onNav} />
  const { settings, hideCard, toggleCard, resetAll } = useCardSettings(user.id)
  const [showSettings,    setShowSettings]    = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches

  const handleAddShortcut = () => {
    if (window._installPrompt) {
      window._installPrompt.prompt()
      return
    }
    setShowInstallGuide(true)
  }

  const today = todayStr()
  const d     = new Date()
  const [calYear,      setCalYear]      = useState(d.getFullYear())
  const [calMonth,     setCalMonth]     = useState(d.getMonth())
  const [selectedDate, setSelectedDate] = useState(today)
  // 날씨 지역 설정 - Settings로 Supabase 자동 싱크
  const locKey = `weatherLocation_${user.id}`
  const [weatherLoc, setWeatherLoc] = useState(() => Settings.get(locKey) || { lat:37.39, lng:126.95, name:'군포시' })
  const [locModal, setLocModal]     = useState(false)
  const [locSearch, setLocSearch]   = useState('')
  const [locResults, setLocResults] = useState([])
  const [locSearching, setLocSearching] = useState(false)

  const searchLocation = async (q) => {
    if (!q.trim()) return
    setLocSearching(true)
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=ko`, { signal: controller.signal })
      clearTimeout(timer)
      const data = await res.json()
      setLocResults(data.results || [])
    } catch { setLocResults([]) }
    setLocSearching(false)
  }

  const selectLocation = (r) => {
    const loc = { lat: r.latitude, lng: r.longitude, name: r.name + (r.admin1 ? ` (${r.admin1})` : '') }
    Settings.set(locKey, loc)
    setWeatherLoc(loc)
    setLocModal(false)
    setLocSearch('')
    setLocResults([])
  }

  const weather = useWeather(weatherLoc.lat, weatherLoc.lng)

  const classes    = sortClasses(ClassesDB.byTeacher(user.id))
  const classDates = new Set()
  classes.forEach(cls => calcSessionDates(cls).forEach(s => classDates.add(s)))

  const weekEnd    = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)
  const supplyAlerts = classes.flatMap(cls => {
    const upcoming   = calcSessionDates(cls).filter(d => d >= today && d <= weekEndStr)
    if (!upcoming.length) return []
    const confirmed  = StudentsDB.confirmed(cls.id)
    if (!confirmed.length) return []
    const supplyData = SupplyItems.byClass(cls.id)
    const notSet     = confirmed.filter(s => !supplyData.find(item => item.studentId === s.id && item.name))
    return notSet.length > 0 ? [{ cls, nextDate: upcoming[0], notSetCount: notSet.length, total: confirmed.length }] : []
  }).sort((a, b) => {
    const dayOrder = d => (new Date(d + 'T00:00:00').getDay() + 6) % 7
    const dayCmp = dayOrder(a.nextDate) - dayOrder(b.nextDate)
    if (dayCmp !== 0) return dayCmp
    const secCmp = (a.cls.section || '').localeCompare(b.cls.section || '', 'ko')
    if (secCmp !== 0) return secCmp
    return (a.cls.time || '').localeCompare(b.cls.time || '')
  })

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11) } else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0)  } else setCalMonth(m=>m+1) }
  const goToday   = () => { const t = new Date(); setCalYear(t.getFullYear()); setCalMonth(t.getMonth()); setSelectedDate(today) }

  const hiddenCount = Object.values(settings).filter(v => !v).length

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── 학교 담당자 연결 요청 팝업 ── */}
      <SchoolConnectPopup user={user} />

      {/* ── 학교 업무 알림 (미완료 상시 표시) ── */}
      <SchoolConnectionPanel user={user} onNav={onNav} />
      <SchoolTaskPanel user={user} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>
            안녕하세요, {(user.displayNameMode === 'nickname' && user.nickname) ? user.nickname : user.name} 선생님 👋
          </h1>
          <div style={{ fontSize: '14px', color: C.muted, marginTop: '4px' }}>{formatDateKo(today)}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 날씨 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 22px', background: '#fff', borderRadius: '14px', border: `1px solid ${C.border}`, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            {weather ? (
              <>
                <span style={{ fontSize: '34px' }}>{weatherIcon(weather.code).icon}</span>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: C.text }}>{weather.temp}°C</div>
                  <div style={{ fontSize: '12px', color: C.muted }}>{weatherIcon(weather.code).text} · 바람 {weather.wind}km/h</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'2px' }}>
                    <span style={{ fontSize: '11px', color: C.muted }}>📍 {weatherLoc.name}</span>
                    <button onClick={() => { setLocModal(true); setLocSearch(''); setLocResults([]) }}
                      style={{ fontSize:'11px', color:C.primary, background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', padding:'0', fontWeight:600 }}>
                      변경
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div style={{ fontSize: '13px', color: C.muted }}>날씨 불러오는 중...</div>
                <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'4px' }}>
                  <span style={{ fontSize: '11px', color: C.muted }}>📍 {weatherLoc.name}</span>
                  <button onClick={() => { setLocModal(true); setLocSearch(''); setLocResults([]) }}
                    style={{ fontSize:'11px', color:C.primary, background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', padding:'0', fontWeight:600 }}>
                    변경
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* ⚙️ 카드 설정 버튼 */}
          <button
            onClick={() => setShowSettings(true)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '12px', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: C.muted, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', fontFamily: 'Noto Sans KR, sans-serif' }}
          >
            ⚙️ 카드 설정
            {hiddenCount > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px', borderRadius: '50%', background: C.primary, color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{hiddenCount}</span>
            )}
          </button>
          {/* 바탕화면 바로가기 */}
          {!isStandalone && (
            <button onClick={handleAddShortcut}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '12px', border: `1.5px solid ${C.primary}`, background: '#fff7ed', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: C.primary, fontFamily: 'Noto Sans KR, sans-serif' }}>
              📲 바탕화면 바로가기
            </button>
          )}
        </div>
      </div>

      {/* ── 카드 설정 모달 ── */}
      {showSettings && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 16px 40px', overflowY: 'auto' }}
          onClick={() => setShowSettings(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, color: C.text }}>⚙️ 대시보드 카드 설정</div>
              <button onClick={() => setShowSettings(false)} style={{ width: '30px', height: '30px', borderRadius: '50%', border: `1px solid ${C.border}`, background: '#f9fafb', cursor: 'pointer', fontSize: '16px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            {/* props 전달 → Dashboard 상태와 즉시 동기화 */}
            <DashboardCardSettings userId={user.id} settings={settings} onToggle={toggleCard} onResetAll={resetAll} />
          </div>
        </div>
      )}

      {/* ── 바탕화면 바로가기 안내 모달 ── */}
      {showInstallGuide && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
          onClick={() => setShowInstallGuide(false)}>
          <div style={{ background:'#fff', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'400px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'17px', fontWeight:700, color:C.text, marginBottom:'20px' }}>📲 바탕화면 바로가기 추가</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ padding:'14px 16px', borderRadius:'12px', background:'#fff7ed', border:'1.5px solid #fed7aa' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:'#92400e', marginBottom:'6px' }}>🤖 안드로이드</div>
                <div style={{ fontSize:'13px', color:'#374151', lineHeight:1.9 }}>
                  크롬 우측 상단 <strong>⋮</strong> → <strong>홈 화면에 추가</strong>
                </div>
              </div>
              <div style={{ padding:'14px 16px', borderRadius:'12px', background:'#f9fafb', border:'1px solid #e5e7eb' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'6px' }}>🍎 아이폰</div>
                <div style={{ fontSize:'13px', color:'#374151', lineHeight:1.9 }}>
                  Safari 하단 <strong>공유 □↑</strong> → <strong>홈 화면에 추가</strong>
                </div>
              </div>
              <div style={{ padding:'14px 16px', borderRadius:'12px', background:'#f9fafb', border:'1px solid #e5e7eb' }}>
                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'6px' }}>🖥️ PC</div>
                <div style={{ fontSize:'13px', color:'#374151', lineHeight:1.9 }}>
                  주소창 우측 <strong>★</strong> → 북마크 추가<br/>
                  또는 주소창 우측 <strong>⊕</strong> → 앱 설치
                </div>
              </div>
            </div>
            <button onClick={() => setShowInstallGuide(false)}
              style={{ marginTop:'20px', width:'100%', padding:'13px', borderRadius:'10px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              확인
            </button>
          </div>
        </div>
      )}
      {settings.supply && supplyAlerts.length > 0 && (
        <div style={{ background: '#fef2f2', borderRadius: '12px', border: '1.5px solid #fca5a5', padding: '14px 18px', position: 'relative' }}>
          <button
            onClick={() => hideCard('supply')}
            title="카드 숨기기"
            style={{ position: 'absolute', top: '10px', right: '12px', width: '22px', height: '22px', borderRadius: '50%', border: '1px solid #fca5a5', background: '#fff', cursor: 'pointer', fontSize: '11px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
          <div onClick={() => onNav('supply')} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: C.danger }}>교구 준비 필요 — 이번주 수업</span>
              <span style={{ fontSize: '11px', color: C.primary, fontWeight: 600 }}>바로가기 →</span>
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
        </div>
      )}

      {/* ── 달력 + 출석부 ── */}
      {settings.calendar && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => hideCard('calendar')}
            title="카드 숨기기"
            style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, width: '22px', height: '22px', borderRadius: '50%', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontSize: '11px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>

          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>
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

              {/* 이달 수업 요약 — 클릭 시 수업관리로 이동 */}
              <div
                onClick={() => onNav('classes')}
                style={{ marginTop: '14px', padding: '12px 14px', background: '#fff7ed', borderRadius: '10px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>이달의 수업 요약 →</div>
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

            <DayDetail date={selectedDate} user={user} classes={classes} onNav={onNav} />
          </div>
        </div>
      )}

      {/* ── 요약 카드 고정 레이아웃
            수익관리(col1 전체) | 공고·연수·자격증(col2) | 학력이력·수상경력(col3)
      ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'start' }}>

        {/* col 1 : 수익관리 (3행 전체 차지) */}
        {settings.revenue && (
          <div style={{ gridColumn: '1', gridRow: '1 / 4' }}>
            <RevenueCard user={user} onHide={hideCard} onNav={onNav} />
          </div>
        )}

        {/* col 2, row 1 : 공고관리 */}
        {settings.announcement && (
          <div style={{ gridColumn: '2', gridRow: '1' }}>
            <AnnouncementCard user={user} onHide={hideCard} onNav={onNav} />
          </div>
        )}

        {/* col 3, row 1 : 학력 및 이력 */}
        {settings.career && (
          <div style={{ gridColumn: '3', gridRow: '1' }}>
            <CareerCard user={user} onHide={hideCard} onNav={onNav} />
          </div>
        )}

        {/* col 2, row 2 : 연수관리 */}
        {settings.training && (
          <div style={{ gridColumn: '2', gridRow: '2' }}>
            <TrainingCard user={user} onHide={hideCard} onNav={onNav} />
          </div>
        )}

        {/* col 3, row 2 : 수상경력 */}
        {settings.award && (
          <div style={{ gridColumn: '3', gridRow: '2' }}>
            <AwardCard user={user} onHide={hideCard} onNav={onNav} />
          </div>
        )}

        {/* col 2, row 3 : 자격증관리 */}
        {settings.certificate && (
          <div style={{ gridColumn: '2', gridRow: '3' }}>
            <CertificateCard user={user} onHide={hideCard} onNav={onNav} />
          </div>
        )}

      </div>

      {/* 날씨 지역 설정 모달 */}
      {locModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setLocModal(false)}>
          <div style={{ background:'#fff', borderRadius:'18px', padding:'28px', width:'420px', maxWidth:'90vw', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'16px' }}>📍 날씨 지역 설정</div>
            <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
              <input
                value={locSearch}
                onChange={e => setLocSearch(e.target.value)}
                onKeyDown={e => e.key==='Enter' && searchLocation(locSearch)}
                placeholder="도시명 검색 (예: 서울, 수원, 군포)"
                style={{ flex:1, padding:'10px 14px', borderRadius:'10px', border:`1.5px solid ${C.border}`, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }}
              />
              <button onClick={() => searchLocation(locSearch)}
                style={{ padding:'10px 18px', borderRadius:'10px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                검색
              </button>
            </div>
            {locSearching && <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'12px' }}>검색 중...</div>}
            {locResults.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'280px', overflowY:'auto' }}>
                {locResults.map((r, i) => (
                  <button key={i} onClick={() => selectLocation(r)}
                    style={{ padding:'10px 14px', borderRadius:'10px', border:`1px solid ${C.border}`, background:'#f9fafb', cursor:'pointer', textAlign:'left', fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s' }}
                    onMouseEnter={e => e.currentTarget.style.background='#fff7ed'}
                    onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}>
                    <div style={{ fontSize:'14px', fontWeight:600, color:C.text }}>{r.name}</div>
                    <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
                      {[r.admin1, r.admin2, r.country].filter(Boolean).join(' · ')} · {r.latitude?.toFixed(2)}, {r.longitude?.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!locSearching && locResults.length === 0 && locSearch && (
              <div style={{ fontSize:'13px', color:C.muted, textAlign:'center', padding:'12px' }}>검색 결과가 없습니다</div>
            )}
            <div style={{ marginTop:'16px', fontSize:'12px', color:C.muted }}>
              현재 지역: <strong>{weatherLoc.name}</strong>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'16px' }}>
              <button onClick={() => setLocModal(false)}
                style={{ padding:'9px 20px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 숨겨진 카드 안내 */}
      {hiddenCount > 0 && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: C.muted, padding: '4px 0' }}>
          카드 {hiddenCount}개가 숨겨져 있어요.{' '}
          <button
            onClick={() => setShowSettings(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: C.primary, fontWeight: 700, fontFamily: 'Noto Sans KR, sans-serif', textDecoration: 'underline' }}
          >⚙️ 카드 설정</button>에서 다시 켤 수 있어요.
        </div>
      )}
    </div>
  )
}
