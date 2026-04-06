import React, { useState, useEffect, useRef } from 'react'
import { Students as StudentsDB, Users, ParentMembers, TeacherParentLinks, Classes as ClassesDB } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
// ✅ ParentServiceManage의 설정을 공유해서 선생님이 수정한 약관·문구가 여기에도 반영됩니다
import { loadParentServiceConfig, DEFAULT_CONFIG } from './ParentServiceManage.jsx'

function fmtPhone(p) {
  if (!p) return ''
  const n = p.replace(/[^0-9]/g, '')
  if (n.length === 11) return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`
  if (n.length === 10) return `${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`
  return p
}

const C = {
  primary: '#f97316', text: '#111827', muted: '#6b7280',
  border: '#e5e7eb', success: '#16a34a', card: '#fff',
}

// ── 출결 알림 팝업 (화면 가운데 커다랗게)
function AttPopup({ record, studentName, onClose }) {
  if (!record) return null
  const statusMap = {
    present: { label:'출석', color:'#16a34a', bg:'#f0fdf4', big:'🎉' },
    late:    { label:'지각', color:'#d97706', bg:'#fffbeb', big:'🕐' },
    early:   { label:'조퇴', color:'#7c3aed', bg:'#f5f3ff', big:'🚶' },
    absent:  { label:'결석', color:'#ef4444', bg:'#fef2f2', big:'😢' },
  }
  const st = statusMap[record.status] || statusMap.present
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'24px', animation:'fadeIn .2s ease',
    }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes popIn  { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
      `}</style>
      <div style={{
        background:st.bg, border:`3px solid ${st.color}`,
        borderRadius:'28px', padding:'40px 32px',
        maxWidth:'320px', width:'100%', textAlign:'center',
        animation:'popIn .28s cubic-bezier(.34,1.56,.64,1)',
        boxShadow:'0 24px 64px rgba(0,0,0,0.28)',
      }}>
        <div style={{ fontSize:'80px', lineHeight:1, marginBottom:'18px' }}>{st.big}</div>
        <div style={{ fontSize:'30px', fontWeight:900, color:st.color, marginBottom:'8px' }}>
          {studentName} {st.label}!
        </div>
        <div style={{ fontSize:'14px', color:C.muted, marginBottom:'6px' }}>{record.date}</div>
        {record.absentReason && (
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'4px' }}>사유: {record.absentReason}</div>
        )}
        {record.homeReturn && (
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'4px' }}>귀가: {record.homeReturn}</div>
        )}
        {record.note && (
          <div style={{ fontSize:'13px', background:'rgba(0,0,0,0.06)', borderRadius:'10px',
            padding:'10px 14px', margin:'10px 0', color:C.text, lineHeight:1.6 }}>
            💬 {record.note}
          </div>
        )}
        <button onClick={onClose} style={{
          marginTop:'12px', padding:'15px', width:'100%',
          borderRadius:'14px', border:'none',
          background:st.color, color:'#fff',
          fontSize:'18px', fontWeight:700,
          cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
        }}>확인</button>
      </div>
    </div>
  )
}

// ── 수업 달력
function ClassCalendar({ cls }) {
  const [viewMonth, setViewMonth] = useState(() => {
    const t = new Date()
    return { y: t.getFullYear(), m: t.getMonth() }
  })
  if (!cls?.startDate || !cls?.endDate) return null

  const dayMap  = { '일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6 }
  const classDays = new Set((cls.days || []).map(d => dayMap[d]))
  const cancelSet = new Set((cls.cancelledDates || []).map(c => c.date))

  const sessionSet = new Set()
  const start = new Date(cls.startDate), end = new Date(cls.endDate)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    if (classDays.has(d.getDay())) {
      const ds = d.toISOString().slice(0,10)
      if (!cancelSet.has(ds)) sessionSet.add(ds)
    }
  }

  const { y, m } = viewMonth
  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m+1, 0).getDate()
  const today = new Date().toISOString().slice(0,10)
  const cells = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]
  const dow = ['일','월','화','수','목','금','토']

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
        <button onClick={()=>setViewMonth(p=>{const d=new Date(p.y,p.m-1,1);return{y:d.getFullYear(),m:d.getMonth()}})}
          style={{ background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:C.muted,padding:'0 6px' }}>‹</button>
        <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{y}년 {m+1}월</span>
        <button onClick={()=>setViewMonth(p=>{const d=new Date(p.y,p.m+1,1);return{y:d.getFullYear(),m:d.getMonth()}})}
          style={{ background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:C.muted,padding:'0 6px' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'4px' }}>
        {dow.map((d,i)=>(
          <div key={d} style={{ textAlign:'center', fontSize:'11px', fontWeight:700,
            color:i===0?'#ef4444':i===6?'#3b82f6':C.muted }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
        {cells.map((d,i)=>{
          if (!d) return <div key={i}/>
          const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
          const isClass = sessionSet.has(ds)
          const isCancelled = cancelSet.has(ds)
          const isToday = ds===today
          const isPast  = ds<today
          const col = i%7
          let bg='transparent', color=col===0?'#ef4444':col===6?'#3b82f6':C.text, fw=400
          if (isToday)                   { bg='#18181b'; color='#fff'; fw=700 }
          else if (isClass && isPast)    { bg='#dcfce7'; color='#15803d'; fw=600 }
          else if (isClass && !isPast)   { bg='#fff7ed'; color='#c2410c'; fw=600 }
          if (isCancelled)               { bg='#f3f4f6'; color='#9ca3af'; fw=400 }
          return (
            <div key={i} style={{ height:'30px', display:'flex', alignItems:'center', justifyContent:'center',
              borderRadius:'8px', background:bg, fontSize:'12px', fontWeight:fw, color, position:'relative' }}>
              {d}
              {isCancelled && <span style={{ position:'absolute',top:'1px',right:'2px',fontSize:'7px',color:'#9ca3af' }}>휴</span>}
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex', gap:'12px', marginTop:'10px', flexWrap:'wrap' }}>
        {[{bg:'#dcfce7',color:'#15803d',label:'수업완료'},{bg:'#fff7ed',color:'#c2410c',label:'예정수업'},{bg:'#f3f4f6',color:'#9ca3af',label:'휴강'}].map(l=>(
          <div key={l.label} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <div style={{ width:'12px', height:'12px', borderRadius:'3px', background:l.bg }}/>
            <span style={{ fontSize:'10px', color:C.muted }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 서비스 탈퇴 섹션
function WithdrawSection({ phone, teacher }) {
  const [open, setOpen]       = useState(false)
  const [step, setStep]       = useState('confirm') // confirm | countdown | done
  const [count, setCount]     = useState(3)
  const timerRef              = useRef(null)

  const handleConfirm = () => {
    // 실제 종료 처리
    try {
      const member = ParentMembers.findByPhone(phone)
      if (member) {
        ParentMembers.update(member.id, {
          appJoined: false,
          withdrawnAt: new Date().toISOString(),
          withdrawReason: 'parent_request',
        })
      }
      try {
        const links = JSON.parse(localStorage.getItem('asa_teacherParentLinks') || '[]')
        const updated = links.map(l =>
          l.parentMemberId === member?.id && l.status === 'active'
            ? { ...l, status: 'ended', endedAt: new Date().toISOString(), endReason: 'parent_withdraw' }
            : l
        )
        localStorage.setItem('asa_teacherParentLinks', JSON.stringify(updated))
      } catch {}
    } catch {}

    // 3초 카운트다운 시작
    setStep('countdown')
    setCount(3)
    let c = 3
    timerRef.current = setInterval(() => {
      c -= 1
      setCount(c)
      if (c <= 0) {
        clearInterval(timerRef.current)
        setStep('done')
      }
    }, 1000)
  }

  // 언마운트 시 타이머 정리
  useEffect(() => () => clearInterval(timerRef.current), [])

  if (step === 'done') return (
    <div style={{ background:'#f9fafb', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'24px', textAlign:'center' }}>
      <div style={{ fontSize:'36px', marginBottom:'10px' }}>👋</div>
      <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'6px' }}>출결서비스가 종료되었습니다</div>
      <div style={{ fontSize:'13px', color:C.muted, lineHeight:1.9 }}>
        다시 출결서비스를 원하시면 언제든<br/>
        선생님께 문자나 톡 보내시면 됩니다 😊
      </div>
    </div>
  )

  return (
    <div style={{ background:'#f9fafb', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:'13px', fontWeight:700, color:C.muted }}>⚙️ 서비스 관리</div>
          <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'2px' }}>출결 알림 수신을 중단하려면 종료하세요</div>
        </div>
        <button onClick={()=>{ setOpen(o=>!o); setStep('confirm') }}
          style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${C.border}`, background:'#fff',
            color:C.muted, fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          {open ? '닫기' : '출결서비스 종료'}
        </button>
      </div>

      {open && step === 'confirm' && (
        <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:`1px solid ${C.border}`, display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ background:'#fff7ed', borderRadius:'10px', border:'1px solid #fed7aa', padding:'14px 16px' }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#c2410c', marginBottom:'6px' }}>📢 안내</div>
            <div style={{ fontSize:'13px', color:'#92400e', lineHeight:1.9 }}>
              다시 출결서비스를 원하시면 언제든<br/>
              선생님께 문자나 톡 보내시면 됩니다.
            </div>
          </div>
          <div style={{ background:'#fef2f2', borderRadius:'10px', border:'1px solid #fecaca', padding:'14px 16px' }}>
            <div style={{ fontSize:'13px', color:'#991b1b', lineHeight:1.9 }}>
              정말 출결서비스를 종료하실 예정이신가요?<br/>
              <strong>확인</strong>을 클릭하시면 3초 후 창이 닫힙니다.
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={()=>setOpen(false)}
              style={{ flex:1, padding:'12px', borderRadius:'10px', border:`1px solid ${C.border}`, background:'#fff',
                color:C.muted, fontSize:'14px', fontWeight:600, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              취소
            </button>
            <button onClick={handleConfirm}
              style={{ flex:1, padding:'12px', borderRadius:'10px', border:'none', background:'#ef4444',
                color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              확인
            </button>
          </div>
        </div>
      )}

      {open && step === 'countdown' && (
        <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:`1px solid ${C.border}`, textAlign:'center', padding:'20px 0 8px' }}>
          <div style={{ fontSize:'48px', fontWeight:900, color:'#ef4444', lineHeight:1 }}>{count}</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'8px' }}>잠시 후 창이 닫힙니다...</div>
        </div>
      )}
    </div>
  )
}

// ── 학부모 홈
export function ParentHome({ students: studentsProp, teacher: teacherProp, phone, teacherId, memberRecord }) {
  // ParentLogin에서 진입 시: teacherId + memberRecord로 students/teacher 자동 조회
  const resolvedTeacher  = teacherProp  || (teacherId ? Users.find(teacherId) : null)
  const resolvedStudents = studentsProp || (teacherId && phone
    ? StudentsDB.byTeacher(teacherId).filter(s =>
        s.parentPhone?.replace(/[^0-9]/g,'') === phone.replace(/[^0-9]/g,'')
      )
    : []
  )
  const students = resolvedStudents
  const teacher  = resolvedTeacher
  const [attData, setAttData]         = useState({})
  const [classes, setClasses]         = useState([])
  const [attPopup, setAttPopup]       = useState(null)
  const [expandedCls, setExpandedCls] = useState(null)
  const [imgModal, setImgModal]       = useState(null)
  const [seenKeys, setSeenKeys]       = useState(()=>{
    try { return new Set(JSON.parse(localStorage.getItem('asa_parent_seen')||'[]')) } catch { return new Set() }
  })

  // 선생님이 설정한 탈퇴 문구 로드
  const cfg = loadParentServiceConfig()

  const statusMap = {
    present: { label:'출석', color:'#16a34a', bg:'#f0fdf4', emoji:'✅' },
    late:    { label:'지각', color:'#d97706', bg:'#fffbeb', emoji:'🕐' },
    early:   { label:'조퇴', color:'#7c3aed', bg:'#f5f3ff', emoji:'🚶' },
    absent:  { label:'결석', color:'#ef4444', bg:'#fef2f2', emoji:'❌' },
    pending: { label:'미처리', color:'#9ca3af', bg:'#f9fafb', emoji:'⬜' },
  }

  useEffect(()=>{
    const data = {}
    students.forEach(s=>{
      try {
        const keys = Object.keys(localStorage).filter(k=>k.startsWith('attendance_'))
        const recs = keys.flatMap(k=>{ try{return JSON.parse(localStorage.getItem(k))||[]}catch{return[]} })
          .filter(r=>r.studentId===s.id)
        recs.sort((a,b)=>(b.date||'').localeCompare(a.date||''))
        data[s.id] = recs.slice(0,30)
      } catch{}
    })
    setAttData(data)

    for (const s of students) {
      const keys = Object.keys(localStorage).filter(k=>k.startsWith('attendance_'))
      const recs = keys.flatMap(k=>{ try{return JSON.parse(localStorage.getItem(k))||[]}catch{return[]} })
        .filter(r=>r.studentId===s.id && r.status!=='pending')
      if (!recs.length) continue
      recs.sort((a,b)=>(b.markedAt||b.date||'').localeCompare(a.markedAt||a.date||''))
      const latest = recs[0]
      const key = `${s.id}_${latest.date}_${latest.status}`
      if (!seenKeys.has(key)) { setAttPopup({ record:latest, studentName:s.name }); break }
    }

    if (teacher?.id) {
      const cls = ClassesDB.byTeacher(teacher.id)
      const sids = new Set(students.flatMap(s=>s.classIds||[]))
      const filtered = cls.filter(c=>sids.has(c.id))
      setClasses(filtered)
      if (filtered.length > 0) setExpandedCls(filtered[0].id)
    }
  },[])

  const closePopup = () => {
    if (attPopup) {
      const s = students.find(s=>s.name===attPopup.studentName)
      const key = `${s?.id}_${attPopup.record.date}_${attPopup.record.status}`
      const next = new Set([...seenKeys, key])
      setSeenKeys(next)
      localStorage.setItem('asa_parent_seen', JSON.stringify([...next]))
    }
    setAttPopup(null)
  }

  const fmtDays = (days=[]) => days.join('·')
  const fmtTime = (t) => t || ''

  return (
    <div style={{ minHeight:'100vh', background:'#f4f5f7', fontFamily:'Noto Sans KR, sans-serif', paddingBottom:'32px' }}>
      {attPopup && <AttPopup record={attPopup.record} studentName={attPopup.studentName} onClose={closePopup}/>}

      {imgModal && (
        <div onClick={()=>setImgModal(null)} style={{
          position:'fixed', inset:0, zIndex:9998, background:'rgba(0,0,0,0.85)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
        }}>
          <img src={imgModal} style={{ maxWidth:'100%', maxHeight:'90vh', borderRadius:'12px' }} alt="수업 이미지"/>
        </div>
      )}

      <div style={{ background:'#18181b', padding:'16px 20px', display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{ fontSize:'22px' }}>📋</span>
        <span style={{ fontSize:'16px', fontWeight:700, color:'#fff' }}>방과후 출석부</span>
        <span style={{ fontSize:'12px', color:'#a1a1aa', marginLeft:'auto' }}>학부모 페이지</span>
      </div>

      <div style={{ padding:'20px 16px', maxWidth:'480px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'16px' }}>

        <div style={{ background:'#fff7ed', borderRadius:'14px', border:'1px solid #fed7aa', padding:'16px 18px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>안녕하세요! 👋</div>
          <div style={{ fontSize:'13px', color:C.muted }}>{teacher?.nickname||teacher?.name} 선생님 반 학부모님</div>
          <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>📱 {fmtPhone(phone)}</div>

          {teacher?.phone && (
            <div style={{ marginTop:'12px', paddingTop:'12px', borderTop:'1px solid #fed7aa' }}>
              <div style={{ fontSize:'11px', fontWeight:700, color:'#9a3412', marginBottom:'6px' }}>🚨 선생님 긴급연락처</div>
              <a href={`tel:${teacher.phone}`} style={{
                display:'flex', alignItems:'center', gap:'8px',
                padding:'10px 12px', borderRadius:'10px', background:'#fff',
                border:'1px solid #fed7aa', textDecoration:'none',
              }}>
                <span style={{ fontSize:'18px' }}>📞</span>
                <div>
                  <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{fmtPhone(teacher.phone)}</div>
                  <div style={{ fontSize:'11px', color:C.muted }}>{teacher.nickname||teacher.name} 선생님</div>
                </div>
                <span style={{ marginLeft:'auto', fontSize:'12px', color:C.primary, fontWeight:600 }}>전화</span>
              </a>
            </div>
          )}
        </div>

        {classes.map(cls => (
          <div key={cls.id} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
            <div
              onClick={()=>setExpandedCls(expandedCls===cls.id ? null : cls.id)}
              style={{ padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'linear-gradient(135deg,#f0fdf4,#fff)', borderBottom: expandedCls===cls.id?`1px solid ${C.border}`:'none' }}>
              <div>
                <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>
                  📚 {cls.className}{cls.section ? ` (${cls.section}반)` : ''}
                </div>
                <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>
                  {cls.organization} · {fmtDays(cls.days)} {fmtTime(cls.time)}
                </div>
              </div>
              <span style={{ fontSize:'18px', color:C.muted, transform: expandedCls===cls.id?'rotate(180deg)':'none', transition:'transform .2s' }}>⌄</span>
            </div>

            {expandedCls===cls.id && (
              <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:'14px' }}>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  {[
                    { icon:'🏫', label:'학교', val: cls.organization || '-' },
                    { icon:'📍', label:'수업 장소', val: cls.classLocation || cls.class_location || '-' },
                    { icon:'⏰', label:'수업 시간', val: cls.time ? `${fmtDays(cls.days)} ${cls.time}${cls.timeEnd ? ' ~ '+cls.timeEnd : ''}` : fmtDays(cls.days) || '-' },
                    { icon:'📅', label:'수업 기간', val: cls.startDate && cls.endDate ? `${cls.startDate} ~ ${cls.endDate}` : '-' },
                    { icon:'📋', label:'운영 방식', val: cls.termType==='semester'?'학기제':'분기제' },
                  ].map(item=>(
                    <div key={item.label} style={{ padding:'10px 12px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:'10px', color:C.muted, marginBottom:'3px' }}>{item.icon} {item.label}</div>
                      <div style={{ fontSize:'12px', fontWeight:600, color:C.text }}>{item.val}</div>
                    </div>
                  ))}
                </div>

                {(cls.officePhone || cls.office_phone || cls.schoolAddress || cls.school_address) && (
                  <div style={{ padding:'12px 14px', background:'#eff6ff', borderRadius:'10px', border:'1px solid #bfdbfe' }}>
                    <div style={{ fontSize:'11px', fontWeight:700, color:'#1d4ed8', marginBottom:'8px' }}>🏫 학교 정보</div>
                    {(cls.officePhone || cls.office_phone) && (
                      <a href={`tel:${cls.officePhone || cls.office_phone}`} style={{ display:'flex', alignItems:'center', gap:'6px', textDecoration:'none', marginBottom:'4px' }}>
                        <span style={{ fontSize:'13px' }}>📞</span>
                        <span style={{ fontSize:'13px', fontWeight:600, color:'#1d4ed8' }}>교무실: {fmtPhone(cls.officePhone || cls.office_phone)}</span>
                      </a>
                    )}
                    {(cls.schoolAddress || cls.school_address) && (
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <span style={{ fontSize:'13px' }}>📍</span>
                        <span style={{ fontSize:'12px', color:'#374151' }}>{cls.schoolAddress || cls.school_address}</span>
                      </div>
                    )}
                  </div>
                )}

                {cls.description && (
                  <div style={{ padding:'12px 14px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, marginBottom:'6px' }}>📝 수업 안내</div>
                    <div style={{ fontSize:'13px', color:C.text, lineHeight:1.7, whiteSpace:'pre-wrap' }}>{cls.description}</div>
                  </div>
                )}

                <div style={{ padding:'12px 14px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, marginBottom:'10px' }}>📅 수업 달력</div>
                  <ClassCalendar cls={cls}/>
                </div>

                <div>
                  <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>🖼️ 수업 홍보물</div>
                  {(cls.promotionImgs?.length > 0 || cls.promotionImg) ? (
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      {(cls.promotionImgs || (cls.promotionImg ? [cls.promotionImg] : [])).map((img,i)=>(
                        <img key={i} src={img} onClick={()=>setImgModal(img)}
                          style={{ width:'100px', height:'100px', objectFit:'cover', borderRadius:'10px',
                            border:`1px solid ${C.border}`, cursor:'pointer' }}
                          alt={`홍보물 ${i+1}`}/>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding:'14px', borderRadius:'10px', border:`1.5px dashed ${C.border}`,
                      textAlign:'center', fontSize:'12px', color:'#9ca3af' }}>홍보물</div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize:'11px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>📄 수업 안내장</div>
                  {cls.noticeFiles?.length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      {cls.noticeFiles.map((f, i) => (
                        f.fileType === 'application/pdf' ? (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                            style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 12px',
                              borderRadius:'10px', background:'#fef2f2', border:'1px solid #fecaca', textDecoration:'none' }}>
                            <span style={{ fontSize:'20px' }}>📋</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'13px', fontWeight:600, color:'#991b1b' }}>{f.name || `안내장 ${i+1}`}</div>
                              <div style={{ fontSize:'11px', color:C.muted }}>PDF — 탭하여 열기</div>
                            </div>
                            <span style={{ fontSize:'12px', color:'#ef4444' }}>열기 →</span>
                          </a>
                        ) : (
                          <img key={i} src={f.url} onClick={()=>setImgModal(f.url)}
                            style={{ width:'100%', borderRadius:'10px', border:`1px solid ${C.border}`,
                              cursor:'pointer', maxHeight:'200px', objectFit:'cover' }}
                            alt={f.name || `안내장 ${i+1}`}/>
                        )
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding:'14px', borderRadius:'10px', border:`1.5px dashed ${C.border}`,
                      textAlign:'center', fontSize:'12px', color:'#9ca3af' }}>안내장</div>
                  )}
                </div>

              </div>
            )}
          </div>
        ))}

        {students.map(s => {
          const recs    = attData[s.id] || []
          const total   = recs.length
          const present = recs.filter(r=>r.status==='present'||r.status==='late').length
          const absent  = recs.filter(r=>r.status==='absent').length
          const rate    = total>0 ? Math.round(present/total*100) : 0
          const recent  = recs.slice(0,10)

          return (
            <div key={s.id} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
              <div style={{ padding:'14px 16px', background:'linear-gradient(135deg,#fff7ed,#fff)', borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <span style={{ fontSize:'18px', fontWeight:700, color:C.text }}>{s.name}</span>
                    <span style={{ fontSize:'13px', color:C.muted, marginLeft:'8px' }}>
                      {s.grade?`${s.grade}학년`:''}{s.classNum?` ${s.classNum}반`:''}
                    </span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'22px', fontWeight:700, color:rate>=80?C.success:C.primary }}>{rate}%</div>
                    <div style={{ fontSize:'11px', color:C.muted }}>출석률</div>
                  </div>
                </div>
                <div style={{ marginTop:'10px', height:'6px', background:'#f3f4f6', borderRadius:'999px', overflow:'hidden' }}>
                  <div style={{ width:`${rate}%`, height:'100%', background:rate>=80?C.success:C.primary, borderRadius:'999px', transition:'width .4s' }}/>
                </div>
                <div style={{ display:'flex', gap:'16px', marginTop:'10px' }}>
                  {[{label:'출석',val:present,color:C.success},{label:'결석',val:absent,color:'#ef4444'},{label:'전체',val:total,color:C.muted}].map(item=>(
                    <div key={item.label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'16px', fontWeight:700, color:item.color }}>{item.val}</div>
                      <div style={{ fontSize:'11px', color:C.muted }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding:'12px 16px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>최근 출결 기록</div>
                {recent.length===0 ? (
                  <div style={{ fontSize:'13px', color:'#9ca3af', textAlign:'center', padding:'12px 0' }}>출결 기록이 없습니다</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                    {recent.map((r,i)=>{
                      const st = statusMap[r.status]||statusMap.pending
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'7px 10px', borderRadius:'8px', background:st.bg }}>
                          <span style={{ fontSize:'13px', color:C.muted }}>{r.date}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            {r.absentReason && <span style={{ fontSize:'11px', color:C.muted }}>({r.absentReason})</span>}
                            <span style={{ fontSize:'12px', fontWeight:700, color:st.color }}>{st.emoji} {st.label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', opacity:0.5 }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'4px' }}>📢 수업 공지</div>
          <div style={{ fontSize:'13px', color:C.muted }}>추후 구현 예정입니다</div>
        </div>
        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', opacity:0.5 }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'4px' }}>🎉 행사·이벤트</div>
          <div style={{ fontSize:'13px', color:C.muted }}>추후 구현 예정입니다</div>
        </div>

        <WithdrawSection phone={phone} teacher={teacher} />

      </div>
    </div>
  )
}

// ── 메인
export function ParentInvite() {
  const params    = new URLSearchParams(window.location.search)
  const phone     = decodeURIComponent(params.get('phone') || '')
  const teacherId = params.get('teacher') || ''

  const [step, setStep]         = useState('loading')
  const [teacher, setTeacher]   = useState(null)
  const [students, setStudents] = useState([])
  const [agree1, setAgree1]     = useState(false)
  const [agree2, setAgree2]     = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [termsModal, setTermsModal] = useState(null)
  const installPromptRef = useRef(null)

  // ✅ 선생님이 ParentServiceManage에서 저장한 약관·문구 로드
  const [cfg, setCfg] = useState(loadParentServiceConfig)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); installPromptRef.current = e }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (!phone || !teacherId) { setStep('error'); return }
    const t = Users.find(teacherId)
    if (!t) { setStep('error'); return }
    setTeacher(t)
    const matched = StudentsDB.byTeacher(teacherId).filter(s =>
      s.parentPhone?.replace(/[^0-9]/g,'') === phone.replace(/[^0-9]/g,'')
    )
    setStudents(matched)

    const already = ParentMembers.findByPhone(phone)
    if (already?.appJoined) {
      setStep('done')
    } else {
      setStep('info')
    }
  }, [])

  const handleJoin = () => {
    if (!agree1 || !agree2) return

    // 첫 번째 학생 기준으로 수업 정보 조회
    const s0   = students[0]
    const cls0 = s0?.classIds?.[0]
      ? ClassesDB.byTeacher(teacherId).find(c => c.id === s0.classIds[0])
      : null

    ParentMembers.join(phone, {
      marketingAgree:  agreeMarketing,
      invitedByTeacher: teacherId,
      studentName:  s0?.name || '',
      grade:        s0?.grade ? `${s0.grade}학년${s0.classNum ? ` ${s0.classNum}반` : ''}` : '',
      schoolName:   cls0?.organization || '',
      subjectName:  cls0?.className    || '',
      teacherName:  teacher?.nickname  || teacher?.name  || '',
      teacherPhone: teacher?.phone     || '',
    })

    students.forEach(s => {
      StudentsDB.update(s.id, { parentJoined:true, parentInviteSentAt: s.parentInviteSentAt||now() })
      try { TeacherParentLinks.link(teacherId, s, s.classIds?.[0]||'') } catch {}
    })
    setStep('done')
    if (installPromptRef.current) setTimeout(()=>setShowInstallBanner(true), 600)
  }

  if (step==='loading') return (
    <div style={wrap}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>📋</div>
      <div style={{ fontSize:'15px', color:C.muted }}>정보를 불러오는 중...</div>
    </div>
  )

  if (step==='error') return (
    <div style={wrap}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>😢</div>
      <div style={{ fontSize:'17px', fontWeight:700, color:C.text, marginBottom:'8px' }}>유효하지 않은 초대링크입니다</div>
      <div style={{ fontSize:'14px', color:C.muted }}>선생님께 다시 요청해주세요.</div>
    </div>
  )

  if (step==='done') return (
    <>
      <ParentHome students={students} teacher={teacher} phone={phone}/>
      {showInstallBanner && (
        <div style={{
          position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
          width:'calc(100% - 40px)', maxWidth:'420px',
          background:'#18181b', borderRadius:'16px',
          padding:'16px 18px', zIndex:9999,
          boxShadow:'0 8px 32px rgba(0,0,0,0.28)',
          display:'flex', alignItems:'center', gap:'12px',
          animation:'slideUp .35s ease',
        }}>
          <style>{`@keyframes slideUp { from{opacity:0;transform:translateX(-50%) translateY(20px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }`}</style>
          <span style={{ fontSize:'28px' }}>📲</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#fff', marginBottom:'2px' }}>홈 화면에 추가하기</div>
            <div style={{ fontSize:'11px', color:'#a1a1aa' }}>앱처럼 바로 출결 확인할 수 있어요</div>
          </div>
          <button onClick={()=>{installPromptRef.current?.prompt();installPromptRef.current?.userChoice.then(()=>{installPromptRef.current=null});setShowInstallBanner(false)}}
            style={{ padding:'8px 14px', borderRadius:'10px', border:'none', background:'#f97316', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>추가</button>
          <button onClick={()=>setShowInstallBanner(false)}
            style={{ background:'none', border:'none', color:'#71717a', fontSize:'18px', cursor:'pointer', padding:'0 2px', lineHeight:1 }}>✕</button>
        </div>
      )}
    </>
  )

  if (step==='agree') return (
    <div style={{ ...wrap, justifyContent:'flex-start', paddingTop:'40px' }}>
      <div style={{ fontSize:'32px', marginBottom:'8px' }}>📋</div>
      <div style={{ fontSize:'18px', fontWeight:700, color:C.text, marginBottom:'4px' }}>약관 동의</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px' }}>서비스 이용을 위해 아래 약관에 동의해주세요</div>
      <div style={{ width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'12px' }}>

        <div style={{ background:'#fffbeb', borderRadius:'12px', border:'1.5px solid #fde68a', padding:'14px 16px' }}>
          <div style={{ fontSize:'12px', fontWeight:700, color:'#92400e', marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
            <span>📌</span> 서비스 이용 전 꼭 확인하세요
          </div>
          <div style={{ fontSize:'13px', color:'#78350f', lineHeight:1.9 }}>
            {cfg.inviteNotice.replace(/{선생님}/g, teacher?.nickname||teacher?.name||'선생님')}
          </div>
          <div style={{ marginTop:'10px', padding:'10px 12px', background:'#fef3c7', borderRadius:'10px', border:'1px solid #fde68a', display:'flex', flexDirection:'column', gap:'4px' }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#b45309' }}>🏫 {cfg.schoolNotice}</div>
            <div style={{ fontSize:'12px', color:'#92400e' }}>• {cfg.notAgreeNotice}</div>
            <div style={{ fontSize:'12px', color:'#92400e' }}>• 가입 후 언제든지 서비스 탈퇴가 가능합니다.</div>
          </div>
        </div>

        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', borderRadius:'12px', border:`2px solid ${agree1&&agree2?C.primary:C.border}`, background:agree1&&agree2?'#fff7ed':C.card, cursor:'pointer' }}>
          <input type="checkbox" checked={agree1&&agree2&&agreeMarketing} onChange={e=>{setAgree1(e.target.checked);setAgree2(e.target.checked);setAgreeMarketing(e.target.checked)}}
            style={{ width:'18px', height:'18px', accentColor:C.primary }}/>
          <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>전체 동의</span>
        </label>
        <div style={{ height:'1px', background:C.border }}/>

        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', border:`1px solid ${C.border}`, cursor:'pointer' }}>
          <input type="checkbox" checked={agree1} onChange={e=>setAgree1(e.target.checked)} style={{ width:'16px', height:'16px', accentColor:C.primary }}/>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'14px', color:C.text }}>[필수] 서비스 이용약관 동의</span>
              <button onClick={e=>{e.preventDefault();setTermsModal('terms')}}
                style={{ fontSize:'12px', color:C.primary, background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', textDecoration:'underline', padding:'0 2px' }}>
                보기
              </button>
            </div>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>출결 알림 수신, 언제든지 탈퇴 가능</div>
          </div>
        </label>

        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', border:`1px solid ${C.border}`, cursor:'pointer' }}>
          <input type="checkbox" checked={agree2} onChange={e=>setAgree2(e.target.checked)} style={{ width:'16px', height:'16px', accentColor:C.primary }}/>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'14px', color:C.text }}>[필수] 개인정보 수집·이용 동의</span>
              <button onClick={e=>{e.preventDefault();setTermsModal('privacy')}}
                style={{ fontSize:'12px', color:C.primary, background:'none', border:'none', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', textDecoration:'underline', padding:'0 2px' }}>
                보기
              </button>
            </div>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>이름·전화번호·자녀정보 수집, 출결 알림 제공</div>
          </div>
        </label>

        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', border:`1px solid ${C.border}`, cursor:'pointer' }}>
          <input type="checkbox" checked={agreeMarketing} onChange={e=>setAgreeMarketing(e.target.checked)} style={{ width:'16px', height:'16px', accentColor:C.primary }}/>
          <div style={{ flex:1 }}>
            <span style={{ fontSize:'14px', color:C.text }}>{cfg.marketingLabel}</span>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>{cfg.marketingDesc}</div>
          </div>
        </label>

        <button onClick={handleJoin} disabled={!agree1||!agree2}
          style={{ padding:'15px', borderRadius:'12px', border:'none', background:agree1&&agree2?C.primary:'#e5e7eb', color:agree1&&agree2?'#fff':'#9ca3af', fontSize:'16px', fontWeight:700, cursor:agree1&&agree2?'pointer':'not-allowed', fontFamily:'Noto Sans KR, sans-serif', marginTop:'8px' }}>
          가입 완료
        </button>
        <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', lineHeight:1.7 }}>
          가입 완료 후 홈 화면에 바로가기를 추가할 수 있습니다.
        </div>
      </div>

      {termsModal && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}
          onClick={()=>setTermsModal(null)}>
          <div onClick={e=>e.stopPropagation()}
            style={{ background:C.card, borderRadius:'20px 20px 0 0', padding:'24px 20px', width:'100%', maxWidth:'480px', maxHeight:'70vh', display:'flex', flexDirection:'column', boxShadow:'0 -8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
              <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>
                {termsModal==='terms' ? '📜 서비스 이용약관' : '🔒 개인정보 수집·이용 동의'}
              </div>
              <button onClick={()=>setTermsModal(null)} style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:C.muted, padding:'0 4px', lineHeight:1 }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', fontSize:'13px', color:C.text, lineHeight:1.9, whiteSpace:'pre-wrap', paddingRight:'4px' }}>
              {termsModal==='terms' ? cfg.terms : cfg.privacy}
            </div>
            <button onClick={()=>setTermsModal(null)}
              style={{ marginTop:'16px', padding:'14px', borderRadius:'12px', border:'none', background:C.primary, color:'#fff', fontSize:'15px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // 초대 정보 확인 (step === 'info')
  return (
    <div style={{ ...wrap, justifyContent:'flex-start', paddingTop:'40px' }}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>📋</div>
      <div style={{ fontSize:'20px', fontWeight:700, color:C.text, marginBottom:'4px' }}>출결서비스 초대</div>
      <div style={{ fontSize:'14px', color:C.muted, marginBottom:'20px' }}>선생님이 출결서비스에 초대했습니다</div>

      <div style={{ width:'100%', maxWidth:'400px', background:'#fffbeb', borderRadius:'14px', border:'2px solid #fbbf24', padding:'16px 18px', marginBottom:'16px' }}>
        <div style={{ fontSize:'12px', fontWeight:700, color:'#92400e', marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px' }}>
          <span>⚠️</span> 서비스 이용 전 안내
        </div>
        <div style={{ fontSize:'13px', color:'#78350f', lineHeight:1.8 }}>
          {cfg.inviteNotice.replace(/{선생님}/g, teacher?.nickname||teacher?.name||'선생님')}
        </div>
        <div style={{ marginTop:'10px', padding:'10px 12px', background:'#fef3c7', borderRadius:'10px', border:'1px solid #fde68a' }}>
          <div style={{ fontSize:'13px', fontWeight:700, color:'#b45309' }}>
            🏫 {cfg.schoolNotice}
          </div>
          <div style={{ fontSize:'12px', color:'#92400e', marginTop:'4px', lineHeight:1.6 }}>
            {cfg.notAgreeNotice}
          </div>
        </div>
      </div>

      <div style={{ width:'100%', maxWidth:'400px', background:'#fff7ed', borderRadius:'14px', border:'1px solid #fed7aa', padding:'16px', marginBottom:'16px' }}>
        <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px', fontWeight:600 }}>초대한 선생님</div>
        <div style={{ fontSize:'17px', fontWeight:700, color:C.text }}>{teacher?.nickname||teacher?.name} 선생님</div>
        {teacher?.phone && (
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>📱 {fmtPhone(teacher.phone)}</div>
        )}
      </div>
      {students.length>0 && (
        <div style={{ width:'100%', maxWidth:'400px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', marginBottom:'16px' }}>
          <div style={{ fontSize:'12px', color:C.muted, marginBottom:'10px', fontWeight:600 }}>연결될 자녀</div>
          {students.map(s=>(
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:`1px solid #f3f4f6` }}>
              <span style={{ fontSize:'20px' }}>👦</span>
              <div>
                <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{s.name}</div>
                <div style={{ fontSize:'12px', color:C.muted }}>{s.grade?`${s.grade}학년`:''}{s.classNum?` ${s.classNum}반`:''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ width:'100%', maxWidth:'400px', background:'#f9fafb', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'14px 16px', marginBottom:'24px' }}>
        <div style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', fontWeight:600 }}>내 전화번호</div>
        <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>{fmtPhone(phone)}</div>
      </div>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <button onClick={()=>setStep('agree')}
          style={{ width:'100%', padding:'16px', borderRadius:'12px', border:'none', background:C.primary, color:'#fff', fontSize:'17px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          출결서비스 가입하기
        </button>
        <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', marginTop:'12px', lineHeight:1.7 }}>
          가입 시 선생님을 통해서만 서비스를 이용하실 수 있습니다.<br/>
          출결 알림 수신 및 수업 현황 확인이 가능합니다.
        </div>
      </div>
    </div>
  )
}

const wrap = {
  minHeight:'100vh', display:'flex', flexDirection:'column',
  alignItems:'center', justifyContent:'center',
  padding:'24px 20px', background:'#fff7ed',
  fontFamily:'Noto Sans KR, sans-serif',
}
