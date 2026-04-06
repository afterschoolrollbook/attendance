import React, { useState, useEffect } from 'react'
import { Students as StudentsDB, Users, ParentMembers, TeacherParentLinks } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'

// 전화번호 포맷
function fmtPhone(p) {
  if (!p) return ''
  const n = p.replace(/[^0-9]/g, '')
  if (n.length === 11) return `${n.slice(0,3)}-${n.slice(3,7)}-${n.slice(7)}`
  if (n.length === 10) return `${n.slice(0,3)}-${n.slice(3,6)}-${n.slice(6)}`
  return p
}

export function ParentInvite() {
  const params  = new URLSearchParams(window.location.search)
  const phone   = decodeURIComponent(params.get('phone') || '')
  const teacherId = params.get('teacher') || ''

  const [step, setStep] = useState('loading') // loading | info | agree | done | error
  const [teacher, setTeacher]   = useState(null)
  const [students, setStudents] = useState([])
  const [agree1, setAgree1]     = useState(false) // 이용약관
  const [agree2, setAgree2]     = useState(false) // 개인정보
  const [agreeMarketing, setAgreeMarketing] = useState(false) // 마케팅 (선택)

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
    // 학부모 회원 등록
    const existing = ParentMembers.findByPhone(phone)
    let parent = existing
    if (!parent) {
      parent = {
        id: uid(), phone: phone.replace(/[^0-9]/g,''),
        name: '', appJoined: true,
        marketingAgree: agreeMarketing,
        invitedByTeacher: teacherId,
        joinedAt: now(), createdAt: now(),
      }
      ParentMembers.upsert(phone)
    }
    // 선생님-학부모 연결
    students.forEach(s => {
      TeacherParentLinks.link(teacherId, s, s.classIds?.[0] || '')
      StudentsDB.update(s.id, { parentInviteSentAt: now() })
    })
    setStep('done')
  }

  const C = { primary: '#f97316', text: '#111827', muted: '#6b7280', border: '#e5e7eb' }

  // ── 로딩
  if (step === 'loading') return (
    <div style={wrap}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>📋</div>
      <div style={{ fontSize:'15px', color:C.muted }}>정보를 불러오는 중...</div>
    </div>
  )

  // ── 에러
  if (step === 'error') return (
    <div style={wrap}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>😢</div>
      <div style={{ fontSize:'17px', fontWeight:700, color:C.text, marginBottom:'8px' }}>유효하지 않은 초대링크입니다</div>
      <div style={{ fontSize:'14px', color:C.muted }}>선생님께 다시 요청해주세요.</div>
    </div>
  )

  // ── 가입 완료
  if (step === 'done') return (
    <div style={wrap}>
      <div style={{ fontSize:'50px', marginBottom:'16px' }}>🎉</div>
      <div style={{ fontSize:'20px', fontWeight:700, color:C.text, marginBottom:'8px' }}>가입 완료!</div>
      <div style={{ fontSize:'15px', color:C.muted, textAlign:'center', lineHeight:1.8 }}>
        출결서비스 가입이 완료되었습니다.<br/>
        이제 출결 알림을 받아보실 수 있습니다 😊
      </div>
      {students.length > 0 && (
        <div style={{ marginTop:'20px', width:'100%', maxWidth:'360px' }}>
          {students.map(s => (
            <div key={s.id} style={{ padding:'12px 16px', background:'#fff7ed', borderRadius:'10px', border:'1px solid #fed7aa', marginBottom:'8px', textAlign:'center' }}>
              <span style={{ fontSize:'15px', fontWeight:700, color:C.primary }}>{s.name}</span>
              <span style={{ fontSize:'13px', color:C.muted }}> 학생 출결 알림 연결됨 ✅</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── 약관 동의
  if (step === 'agree') return (
    <div style={{ ...wrap, justifyContent:'flex-start', paddingTop:'40px' }}>
      <div style={{ fontSize:'32px', marginBottom:'8px' }}>📋</div>
      <div style={{ fontSize:'18px', fontWeight:700, color:C.text, marginBottom:'4px' }}>약관 동의</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'24px' }}>서비스 이용을 위해 아래 약관에 동의해주세요</div>

      <div style={{ width:'100%', maxWidth:'400px', display:'flex', flexDirection:'column', gap:'12px' }}>
        {/* 전체 동의 */}
        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', borderRadius:'12px', border:`2px solid ${agree1&&agree2?C.primary:C.border}`, background:agree1&&agree2?'#fff7ed':'#fff', cursor:'pointer' }}>
          <input type="checkbox" checked={agree1&&agree2&&agreeMarketing} onChange={e => { setAgree1(e.target.checked); setAgree2(e.target.checked); setAgreeMarketing(e.target.checked) }}
            style={{ width:'18px', height:'18px', accentColor:C.primary }} />
          <span style={{ fontSize:'15px', fontWeight:700, color:C.text }}>전체 동의</span>
        </label>

        <div style={{ height:'1px', background:C.border }} />

        {/* 이용약관 필수 */}
        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', border:`1px solid ${C.border}`, cursor:'pointer' }}>
          <input type="checkbox" checked={agree1} onChange={e => setAgree1(e.target.checked)}
            style={{ width:'16px', height:'16px', accentColor:C.primary }} />
          <div style={{ flex:1 }}>
            <span style={{ fontSize:'14px', color:C.text }}>[필수] 서비스 이용약관 동의</span>
          </div>
        </label>

        {/* 개인정보 필수 */}
        <label style={{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', borderRadius:'10px', border:`1px solid ${C.border}`, cursor:'pointer' }}>
          <input type="checkbox" checked={agree2} onChange={e => setAgree2(e.target.checked)}
            style={{ width:'16px', height:'16px', accentColor:C.primary }} />
          <div style={{ flex:1 }}>
            <span style={{ fontSize:'14px', color:C.text }}>[필수] 개인정보 수집·이용 동의</span>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>이름·전화번호·자녀정보 수집, 출결 알림 제공</div>
          </div>
        </label>

        {/* 마케팅 선택 */}
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
      </div>
    </div>
  )

  // ── 초대 정보 확인 (기본 화면)
  return (
    <div style={{ ...wrap, justifyContent:'flex-start', paddingTop:'48px' }}>
      <div style={{ fontSize:'40px', marginBottom:'12px' }}>📋</div>
      <div style={{ fontSize:'20px', fontWeight:700, color:C.text, marginBottom:'4px' }}>출결서비스 초대</div>
      <div style={{ fontSize:'14px', color:C.muted, marginBottom:'28px' }}>선생님이 출결서비스에 초대했습니다</div>

      {/* 선생님 정보 */}
      <div style={{ width:'100%', maxWidth:'400px', background:'#fff7ed', borderRadius:'14px', border:'1px solid #fed7aa', padding:'16px', marginBottom:'16px' }}>
        <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px', fontWeight:600 }}>초대한 선생님</div>
        <div style={{ fontSize:'17px', fontWeight:700, color:C.text }}>
          {teacher?.nickname || teacher?.name} 선생님
        </div>
      </div>

      {/* 학생 정보 */}
      {students.length > 0 && (
        <div style={{ width:'100%', maxWidth:'400px', background:'#fff', borderRadius:'14px', border:`1px solid ${C.border}`, padding:'16px', marginBottom:'16px' }}>
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

      {/* 내 전화번호 */}
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
