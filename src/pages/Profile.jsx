import React, { useState, useRef } from 'react'
import { Users } from '../lib/db.js'
import { Btn, Input, Card, PageHeader } from '../components/Atoms.jsx'
import { sendEmail, isConfigured } from '../lib/supabase.js'

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316', success:'#16a34a', danger:'#ef4444' }

function genCode() { return String(Math.floor(100000 + Math.random() * 900000)) }

function Msg({ data }) {
  if (!data) return null
  const ok = typeof data === 'object' ? data.ok !== false : true
  const msg = typeof data === 'object' ? data.msg : data
  return <div style={{ fontSize:'13px', padding:'8px 12px', borderRadius:'7px', background:ok?'#f0fdf4':'#fef2f2', color:ok?C.success:C.danger, border:`1px solid ${ok?'#86efac':'#fca5a5'}` }}>{ok?'✅':'⚠️'} {msg}</div>
}

// 비밀번호 인증 모달 (이메일 가입자 전용)
function PwVerifyModal({ user, onVerified, onClose }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const verify = () => {
    if (pw !== user.pw) { setError('비밀번호가 올바르지 않습니다.'); return }
    onVerified()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'400px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
        <div style={{ padding:'18px 22px', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>🔒 본인 확인</div>
        </div>
        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={{ fontSize:'13px', color:C.muted }}>내 정보에 접근하려면 비밀번호를 입력하세요.</div>
          <Input label="비밀번호" value={pw} onChange={setPw} type="password" placeholder="비밀번호 입력" />
          {error && <div style={{ fontSize:'13px', color:C.danger, background:'#fef2f2', padding:'8px 12px', borderRadius:'7px' }}>⚠️ {error}</div>}
          <div style={{ display:'flex', gap:'8px' }}>
            <Btn variant="ghost" onClick={onClose} style={{ flex:1 }}>취소</Btn>
            <Btn onClick={verify} style={{ flex:2 }}>확인</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Profile({ user, onUserUpdate, onNav }) {
  const isSocial = user.provider && user.provider !== 'email'

  // 소셜 가입자는 바로 입장, 이메일 가입자는 비밀번호 확인 필요
  const [verified, setVerified] = useState(isSocial)
  const [showVerify, setShowVerify] = useState(!isSocial)

  const [info, setInfo] = useState({ name: user.name, email: user.email, phone: user.phone || '' })
  const [pw,   setPw]   = useState({ next: '', next2: '' })
  const [imgPreview, setImgPreview] = useState(user.verifyImg || null)
  const [imgFile,    setImgFile]    = useState(null)

  const [infoMsg,   setInfoMsg]   = useState(null)
  const [pwMsg,     setPwMsg]     = useState(null)
  const [verifyMsg, setVerifyMsg] = useState(null)

  const imgRef = useRef()

  const flash = (setter, ok, msg) => {
    setter({ ok, msg })
    setTimeout(() => setter(null), 4000)
  }

  const handleVerified = () => {
    setVerified(true)
    setShowVerify(false)
  }

  const handleClose = () => {
    onNav('dashboard')
  }

  const saveInfo = () => {
    if (!info.name.trim() || !info.email.trim()) { flash(setInfoMsg, false, '이름과 이메일은 필수입니다.'); return }
    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailReg.test(info.email.trim())) { flash(setInfoMsg, false, '올바른 이메일 형식이 아닙니다.'); return }
    const dup = Users.findByEmail(info.email.trim().toLowerCase())
    if (dup && dup.id !== user.id) { flash(setInfoMsg, false, '이미 사용 중인 이메일입니다.'); return }
    const updated = Users.update(user.id, { name: info.name.trim(), email: info.email.trim().toLowerCase(), phone: info.phone.trim() })
    onUserUpdate(updated)
    flash(setInfoMsg, true, '정보가 저장되었습니다.')
  }

  const savePw = () => {
    if (pw.next.length < 4) { flash(setPwMsg, false, '새 비밀번호는 4자 이상이어야 합니다.'); return }
    if (pw.next !== pw.next2) { flash(setPwMsg, false, '새 비밀번호가 일치하지 않습니다.'); return }
    const updated = Users.update(user.id, { pw: pw.next })
    onUserUpdate(updated)
    setPw({ next:'', next2:'' })
    flash(setPwMsg, true, isSocial ? '비밀번호가 설정되었습니다.' : '비밀번호가 변경되었습니다.')
  }

  const handleImg = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setImgPreview(ev.target.result); setImgFile(ev.target.result) }
    reader.readAsDataURL(file)
  }

  const submitVerify = () => {
    if (!imgFile && !imgPreview) { flash(setVerifyMsg, false, '수업안내장 이미지를 먼저 업로드해주세요.'); return }
    if (user.level >= 2) { flash(setVerifyMsg, true, '이미 인증 완료된 계정입니다.'); return }
    const updated = Users.update(user.id, { verifyImg: imgFile || imgPreview })
    onUserUpdate(updated)
    flash(setVerifyMsg, true, '인증 신청이 완료되었습니다. 관리자 승인 후 활성화됩니다.')
  }

  const levelColors = { 1:'#9ca3af', 2:C.primary, 3:C.success, 4:'#8b5cf6', 5:C.danger }
  const levelNames  = { 1:'Lv.1 미인증', 2:'Lv.2 인증완료', 3:'Lv.3 우수', 4:'Lv.4 파트너', 5:'Lv.5 관리자' }
  const providerLabels = { google:'Google', kakao:'카카오', naver:'네이버' }

  // 비밀번호 인증 전이면 모달만 표시
  if (showVerify) {
    return <PwVerifyModal user={user} onVerified={handleVerified} onClose={handleClose} />
  }

  return (
    <div style={{ padding:'28px', maxWidth:'680px' }}>
      <PageHeader title="내 정보" sub="계정 정보를 확인하고 수정합니다." />

      <div style={{ display:'inline-flex', alignItems:'center', gap:'10px', padding:'10px 18px', background:`${levelColors[user.level]}18`, borderRadius:'10px', border:`1.5px solid ${levelColors[user.level]}44`, marginBottom:'24px' }}>
        <span style={{ fontSize:'20px' }}>👩‍🏫</span>
        <div>
          <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{user.name}</div>
          <div style={{ fontSize:'12px', fontWeight:700, color:levelColors[user.level] }}>{levelNames[user.level]}</div>
        </div>
        {isSocial && (
          <span style={{ fontSize:'11px', background:'#eff6ff', color:'#3b82f6', border:'1px solid #bfdbfe', padding:'2px 8px', borderRadius:'6px', fontWeight:600 }}>
            {providerLabels[user.provider] || user.provider} 로그인
          </span>
        )}
      </div>

      {isSocial && (
        <div style={{ padding:'12px 16px', background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:'10px', marginBottom:'16px', fontSize:'13px', color:'#1e40af' }}>
          💡 <strong>{providerLabels[user.provider] || user.provider} 계정</strong>으로 로그인했습니다.
        </div>
      )}

      <Card style={{ marginBottom:'16px' }}>
        <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'16px' }}>📝 기본 정보</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <Input label="이름" value={info.name} onChange={v => setInfo(p=>({...p,name:v}))} placeholder="홍길동" required />
          <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
            <label style={{ fontSize:'13px', fontWeight:500, color:C.text }}>이메일</label>
            <input type="email" value={info.email} onChange={e => setInfo(p=>({...p,email:e.target.value}))}
              style={{ padding:'9px 13px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
          </div>
          <Input label="연락처" value={info.phone} onChange={v => setInfo(p=>({...p,phone:v}))} placeholder="010-0000-0000" />
          <Msg data={infoMsg} />
          <Btn onClick={saveInfo} style={{ alignSelf:'flex-end' }}>저장</Btn>
        </div>
      </Card>

      <Card style={{ marginBottom:'16px' }}>
        <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>
          🔒 {isSocial ? '비밀번호 설정' : '비밀번호 변경'}
        </div>
        {isSocial && (
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>
            비밀번호를 설정하면 이메일로도 로그인할 수 있습니다.
          </div>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <Input label="새 비밀번호 (4자 이상)" value={pw.next}  onChange={v => setPw(p=>({...p,next:v}))}  type="password" placeholder="새 비밀번호" />
          <Input label="새 비밀번호 확인"        value={pw.next2} onChange={v => setPw(p=>({...p,next2:v}))} type="password" placeholder="재입력" />
          <Msg data={pwMsg} />
          <Btn onClick={savePw} style={{ alignSelf:'flex-end' }}>{isSocial ? '비밀번호 설정' : '변경'}</Btn>
        </div>
      </Card>

      {user.role === 'teacher' && (
        <Card>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>🏫 선생님 인증</div>
            {user.level >= 2
              ? <span style={{ fontSize:'12px', fontWeight:700, padding:'3px 10px', borderRadius:'6px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac' }}>인증완료</span>
              : user.verifyImg
                ? <span style={{ fontSize:'12px', fontWeight:700, padding:'3px 10px', borderRadius:'6px', background:'#fffbeb', color:'#f59e0b', border:'1px solid #fde68a' }}>승인 대기중</span>
                : <span style={{ fontSize:'12px', padding:'3px 10px', borderRadius:'6px', background:'#f9fafb', color:'#9ca3af' }}>미인증</span>
            }
          </div>
          <div style={{ fontSize:'13px', color:C.muted, lineHeight:1.7, marginBottom:'16px' }}>
            방과후 수업안내장 이미지를 업로드하면 관리자 승인 후 <strong>Lv.2 인증</strong>이 완료됩니다.
          </div>
          <div style={{ display:'flex', gap:'16px', alignItems:'flex-start', flexWrap:'wrap' }}>
            <button onClick={() => imgRef.current?.click()} disabled={user.level >= 2}
              style={{ width:'120px', height:'160px', borderRadius:'10px', border:'2px dashed #e5e7eb', background:'#f9fafb', cursor:user.level>=2?'default':'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', color:'#9ca3af', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', overflow:'hidden', padding:0 }}>
              {imgPreview ? <img src={imgPreview} alt="수업안내장" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <><span style={{ fontSize:'28px' }}>+</span><span>수업안내장<br/>업로드</span></>}
            </button>
            <input ref={imgRef} type="file" accept="image/*" onChange={handleImg} style={{ display:'none' }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'12px', color:'#9ca3af', lineHeight:1.8, marginBottom:'12px' }}>
                • JPG, PNG 형식<br />
                • 해당 학교 방과후 수업안내장<br />
                • 선생님 이름이 명시된 서류
              </div>
              <Msg data={verifyMsg} />
              {user.level < 2 && <Btn onClick={submitVerify} size="sm" style={{ marginTop:'8px' }}>{user.verifyImg ? '재신청' : '인증 신청'}</Btn>}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
