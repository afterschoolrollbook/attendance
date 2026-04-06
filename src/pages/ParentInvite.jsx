import React, { useState, useEffect, useRef } from 'react'
import { Students as StudentsDB, Users, ParentMembers, TeacherParentLinks } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'

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

// ── 학부모 홈 (가입 완료 후)
function ParentHome({ students, teacher, phone }) {
  const [attData, setAttData] = useState({})

  useEffect(() => {
    const data = {}
    students.forEach(s => {
      try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('attendance_'))
        const recs = keys.flatMap(k => {
          try { return JSON.parse(localStorage.getItem(k)) || [] } catch { return [] }
        }).filter(r => r.studentId === s.id)
        recs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        data[s.id] = recs.slice(0, 30)
      } catch {}
    })
    setAttData(data)
  }, [])

  const statusMap = {
    present: { label:'출석', color:'#16a34a', bg:'#f0fdf4', emoji:'✅' },
    late:    { label:'지각', color:'#d97706', bg:'#fffbeb', emoji:'🕐' },
    early:   { label:'조퇴', color:'#7c3aed', bg:'#f5f3ff', emoji:'🚶' },
    absent:  { label:'결석', color:'#ef4444', bg:'#fef2f2', emoji:'❌' },
    pending: { label:'미처리', color:'#9ca3af', bg:'#f9fafb', emoji:'⬜' },
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f4f5f7', fontFamily:'Noto Sans KR, sans-serif' }}>
      {/* 헤더 */}
      <div style={{ background:'#18181b', padding:'16px 20px', display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{ fontSize:'22px' }}>📋</span>
        <span style={{ fontSize:'16px', fontWeight:700, color:'#fff' }}>방과후 출석부</span>
        <span style={{ fontSize:'12px', color:'#a1a1aa', marginLeft:'auto' }}>학부모 페이지</span>
      </div>

      <div style={{ padding:'20px 16px', maxWidth:'480px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* 인사 */}
        <div style={{ background:'#fff7ed', borderRadius:'14px', border:'1px solid #fed7aa', padding:'16px 18px' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>안녕하세요! 👋</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>
            {teacher?.nickname || teacher?.name} 선생님 반 학부모님
          </div>
          <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>📱 {fmtPhone(phone)}</div>
        </div>

        {/* 자녀별 출결 현황 */}
        {students.map(s => {
          const recs    = attData[s.id] || []
          const total   = recs.length
          const present = recs.filter(r => r.status === 'present' || r.status === 'late').length
          const absent  = recs.filter(r => r.status === 'absent').length
          const rate    = total > 0 ? Math.round(present / total * 100) : 0
          const recent  = recs.slice(0, 10)

          return (
            <div key={s.id} style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, overflow:'hidden' }}>
              <div style={{ padding:'14px 16px', background:'linear-gradient(135deg,#fff7ed,#fff)', borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <span style={{ fontSize:'18px', fontWeight:700, color:C.text }}>{s.name}</span>
                    <span style={{ fontSize:'13px', color:C.muted, marginLeft:'8px' }}>
                      {s.grade ? `${s.grade}학년` : ''}{s.classNum ? ` ${s.classNum}반` : ''}
                    </span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'22px', fontWeight:700, color: rate >= 80 ? C.success : C.primary }}>{rate}%</div>
                    <div style={{ fontSize:'11px', color:C.muted }}>출석률</div>
                  </div>
                </div>
                <div style={{ marginTop:'10px', height:'6px', background:'#f3f4f6', borderRadius:'999px', overflow:'hidden' }}>
                  <div style={{ width:`${rate}%`, height:'100%', background: rate >= 80 ? C.success : C.primary, borderRadius:'999px', transition:'width .4s' }} />
                </div>
                <div style={{ display:'flex', gap:'16px', marginTop:'10px' }}>
                  {[
                    { label:'출석', val:present, color:C.success },
                    { label:'결석', val:absent,  color:'#ef4444' },
                    { label:'전체', val:total,   color:C.muted   },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'16px', fontWeight:700, color:item.color }}>{item.val}</div>
                      <div style={{ fontSize:'11px', color:C.muted }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding:'12px 16px' }}>
                <div style={{ fontSize:'12px', fontWeight:700, color:C.muted, marginBottom:'8px' }}>최근 출결 기록</div>
                {recent.length === 0 ? (
                  <div style={{ fontSize:'13px', color:'#9ca3af', textAlign:'center', padding:'12px 0' }}>출결 기록이 없습니다</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                    {recent.map((r, i) => {
                      const st = statusMap[r.status] || statusMap.pending
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:'8px', background:st.bg }}>
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

        {/* 수업 공지 (추후) */}
        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', opacity:0.5 }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'4px' }}>📢 수업 공지</div>
          <div style={{ fontSize:'13px', color:C.muted }}>추후 구현 예정입니다</div>
        </div>

        {/* 본사 안내 (추후) */}
        <div style={{ background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', opacity:0.5, marginBottom:'20px' }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'4px' }}>🎉 행사·이벤트</div>
          <div style={{ fontSize:'13px', color:C.muted }}>추후 구현 예정입니다</div>
        </div>
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
  const installPromptRef = useRef(null)

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
    setStep('info')
  }, [])

  const handleJoin = () => {
    if (!agree1 || !agree2) return

    // 학부모 등록 (appJoined=true, marketingAgree 포함)
    ParentMembers.join(phone, { marketingAgree: agreeMarketing, invitedByTeacher: teacherId })

    // 학생 parentJoined = true 업데이트 + 연결
    students.forEach(s => {
      StudentsDB.update(s.id, {
        parentJoined: true,
        parentInviteSentAt: s.parentInviteSentAt || now(),
      })
      try { TeacherParentLinks.link(teacherId, s, s.classIds?.[0] || '') } catch {}
    })

    // PWA 바탕화면 바로가기
    if (installPromptRef.current) {
      installPromptRef.current.prompt()
      installPromptRef.current.userChoice.then(() => {
        installPromptRef.current = null
      })
    }

    setStep('done')
  }

  if (step === 'loading') return (
    <div style={wrap}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>📋</div>
      <div style={{ fontSize:'15px', color:C.muted }}>정보를 불러오는 중...</div>
    </div>
  )

  if (step === 'error') return (
    <div style={wrap}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>😢</div>
      <div style={{ fontSize:'17px', fontWeight:700, color:C.text, marginBottom:'8px' }}>유효하지 않은 초대링크입니다</div>
      <div style={{ fontSize:'14px', color:C.muted }}>선생님께 다시 요청해주세요.</div>
    </div>
  )

  if (step === 'done') return <ParentHome students={students} teacher={teacher} phone={phone} />

  if (step === 'agree') return (
    <div style={{ ...wrap, justifyContent:'flex-start', paddingTop:'40px' }}>
      <div style={{ fontSize:'32px', marginBottom:'8px' }}>📋</div>
      <div style={{ fontSize:'18px', fontWeight:700, color:C.text, marginBottom:'4px' }}>약관 동의</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'24px' }}>서비스 이용을 위해 아래 약관에 동의해주세요</div>

      <div style={{ width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'12px' }}>
        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', borderRadius:'12px', border:`2px solid ${agree1&&agree2?C.primary:C.border}`, background:agree1&&agree2?'#fff7ed':C.card, cursor:'pointer' }}>
          <input type="checkbox" checked={agree1&&agree2&&agreeMarketing} onChange={e => { setAgree1(e.target.checked); setAgree2(e.target.checked); setAgreeMarketing(e.target.checked) }}
            style={{ width:'18px', height:'18px', accentColor:C.primary }} />
          <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>전체 동의</span>
        </label>

        <div style={{ height:'1px', background:C.border }} />

        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', border:`1px solid ${C.border}`, cursor:'pointer' }}>
          <input type="checkbox" checked={agree1} onChange={e => setAgree1(e.target.checked)}
            style={{ width:'16px', height:'16px', accentColor:C.primary }} />
          <div style={{ flex:1 }}>
            <span style={{ fontSize:'14px', color:C.text }}>[필수] 서비스 이용약관 동의</span>
          </div>
        </label>

        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', border:`1px solid ${C.border}`, cursor:'pointer' }}>
          <input type="checkbox" checked={agree2} onChange={e => setAgree2(e.target.checked)}
            style={{ width:'16px', height:'16px', accentColor:C.primary }} />
          <div style={{ flex:1 }}>
            <span style={{ fontSize:'14px', color:C.text }}>[필수] 개인정보 수집·이용 동의</span>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>이름·전화번호·자녀정보 수집, 출결 알림 제공</div>
          </div>
        </label>

        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', border:`1px solid ${C.border}`, cursor:'pointer' }}>
          <input type="checkbox" checked={agreeMarketing} onChange={e => setAgreeMarketing(e.target.checked)}
            style={{ width:'16px', height:'16px', accentColor:C.primary }} />
          <div style={{ flex:1 }}>
            <span style={{ fontSize:'14px', color:C.text }}>[선택] 마케팅 정보 수신 동의</span>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>교육 상품, 공동구매 등 유익한 정보 수신</div>
          </div>
        </label>

        <button onClick={handleJoin} disabled={!agree1 || !agree2}
          style={{ padding:'15px', borderRadius:'12px', border:'none', background: agree1&&agree2 ? C.primary : '#e5e7eb', color: agree1&&agree2 ? '#fff' : '#9ca3af', fontSize:'16px', fontWeight:700, cursor: agree1&&agree2 ? 'pointer' : 'not-allowed', fontFamily:'Noto Sans KR, sans-serif', marginTop:'8px' }}>
          가입 완료
        </button>
        <div style={{ fontSize:'12px', color:C.muted, textAlign:'center', lineHeight:1.7 }}>
          가입 완료 후 바탕화면 바로가기가 자동으로 추가됩니다.
        </div>
      </div>
    </div>
  )

  // 초대 정보 확인
  return (
    <div style={{ ...wrap, justifyContent:'flex-start', paddingTop:'48px' }}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>📋</div>
      <div style={{ fontSize:'20px', fontWeight:700, color:C.text, marginBottom:'4px' }}>출결서비스 초대</div>
      <div style={{ fontSize:'14px', color:C.muted, marginBottom:'28px' }}>선생님이 출결서비스에 초대했습니다</div>

      <div style={{ width:'100%', maxWidth:'400px', background:'#fff7ed', borderRadius:'14px', border:'1px solid #fed7aa', padding:'16px', marginBottom:'16px' }}>
        <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px', fontWeight:600 }}>초대한 선생님</div>
        <div style={{ fontSize:'17px', fontWeight:700, color:C.text }}>
          {teacher?.nickname || teacher?.name} 선생님
        </div>
      </div>

      {students.length > 0 && (
        <div style={{ width:'100%', maxWidth:'400px', background:C.card, borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', marginBottom:'16px' }}>
          <div style={{ fontSize:'12px', color:C.muted, marginBottom:'10px', fontWeight:600 }}>연결될 자녀</div>
          {students.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:`1px solid #f3f4f6` }}>
              <span style={{ fontSize:'20px' }}>👦</span>
              <div>
                <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{s.name}</div>
                <div style={{ fontSize:'12px', color:C.muted }}>
                  {s.grade ? `${s.grade}학년` : ''}{s.classNum ? ` ${s.classNum}반` : ''}
                </div>
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
        <button onClick={() => setStep('agree')}
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
  minHeight: '100vh',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  padding: '24px 20px',
  background: '#fff7ed',
  fontFamily: 'Noto Sans KR, sans-serif',
}
