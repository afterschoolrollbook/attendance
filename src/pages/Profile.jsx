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

// 이메일 발송 함수
async function sendVerifyCode(email, code) {
  if (!isConfigured) {
    console.log(`[개발모드] 인증번호: ${code}`)
    return { dev: true }
  }
  try {
    await sendEmail(email, code)
    return { sent: true }
  } catch(e) {
    console.error('이메일 발송 실패:', e)
    return { error: true }
  }
}

// ─── 본인 인증 모달
function VerifyModal({ user, onVerified, onClose }) {
  const isSocial = user.provider && user.provider !== 'email'
  const [method, setMethod] = useState(isSocial ? 'email' : 'pw')
  const [pwInput, setPwInput] = useState('')
  const [code, setCode] = useState('')
  const [sentCode, setSentCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [isDev, setIsDev] = useState(false)
  const [error, setError] = useState('')

  const sendCode = async (target) => {
    setSending(true)
    setError('')
    const c = genCode()
    setSentCode(c)
    const email = method === 'email' ? user.email : null
    if (email) {
      const result = await sendVerifyCode(email, c)
      setIsDev(!!result.dev)
    } else {
      console.log(`[개발모드] SMS 인증코드: ${c}`)
      setIsDev(true)
    }
    setSending(false)
    setCodeSent(true)
    setCode('')
  }

  const verify = () => {
    setError('')
    if (method === 'pw') {
      if (pwInput !== user.pw) { setError('비밀번호가 올바르지 않습니다.'); return }
      onVerified()
    } else {
      if (code.trim() !== sentCode) { setError('인증번호가 올바르지 않습니다.'); return }
      onVerified()
    }
  }

  const methods = isSocial
    ? [
        { key:'email', label:'이메일 인증', disabled: !user.email },
        { key:'phone', label:'휴대폰 인증', disabled: !user.phone },
      ]
    : [
        { key:'pw',    label:'비밀번호' },
        { key:'email', label:'이메일 인증', disabled: !user.email },
        { key:'phone', label:'휴대폰 인증', disabled: !user.phone },
      ]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:'16px', width:'100%', maxWidth:'420px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
        <div style={{ padding:'18px 22px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>🔒 본인 인증</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'20px', color:C.muted, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={{ fontSize:'13px', color:C.muted }}>
            정보를 변경하기 전에 본인 확인이 필요합니다.
            {isSocial && <span style={{ color:C.primary }}> ({user.provider} 계정)</span>}
          </div>

          <div style={{ display:'flex', gap:'8px' }}>
            {methods.map(m => (
              <button key={m.key} onClick={() => { if (!m.disabled) { setMethod(m.key); setCodeSent(false); setCode(''); setError('') } }}
                disabled={m.disabled}
                style={{ flex:1, padding:'9px 6px', borderRadius:'9px', border:`1.5px solid ${method===m.key?C.primary:C.border}`, background:method===m.key?'#fff7ed':'#fff', color:method===m.key?C.primary:C.muted, fontSize:'12px', fontWeight:method===m.key?700:400, cursor:m.disabled?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif', opacity:m.disabled?0.4:1 }}>
                {m.label}
              </button>
            ))}
          </div>

          {method === 'pw' && (
            <Input label="현재 비밀번호" value={pwInput} onChange={setPwInput} type="password" placeholder="비밀번호 입력" />
          )}

          {(method === 'email' || method === 'phone') && (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ fontSize:'13px', color:C.muted, background:'#f9fafb', padding:'10px 12px', borderRadius:'8px' }}>
                {method === 'email' ? `📧 ${user.email}` : `📱 ${user.phone}`} 으로 인증번호를 발송합니다.
              </div>
              {!codeSent ? (
                <Btn onClick={sendCode} disabled={sending}>{sending ? '발송 중...' : '인증번호 발송'}</Btn>
              ) : (
                <>
                  {isDev ? (
                    <div style={{ padding:'10px 12px', background:'#fffbeb', borderRadius:'8px', border:'1.5px solid #fde68a', fontSize:'13px' }}>
                      <div style={{ fontWeight:700, color:'#92400e', marginBottom:'4px' }}>🔧 개발 모드 (Resend 미설정)</div>
                      <div style={{ color:'#b45309' }}>인증번호: <strong style={{ fontSize:'20px', letterSpacing:'4px', color:C.primary }}>{sentCode}</strong></div>
                    </div>
                  ) : (
                    <div style={{ padding:'10px 12px', background:'#f0fdf4', borderRadius:'8px', border:'1.5px solid #86efac', fontSize:'13px', color:'#15803d', fontWeight:600 }}>
                      ✅ {user.email}로 인증번호를 발송했습니다.
                    </div>
                  )}
                  <div style={{ display:'flex', gap:'8px' }}>
                    <input value={code} onChange={e => setCode(e.target.value)} placeholder="6자리 입력" maxLength={6}
                      onKeyDown={e => e.key==='Enter' && verify()}
                      style={{ flex:1, padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'16px', letterSpacing:'4px', textAlign:'center', outline:'none', fontFamily:'monospace' }} />
                    <button onClick={sendCode} disabled={sending} style={{ padding:'9px 12px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', color:C.muted, fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>재발송</button>
                  </div>
                </>
              )}
            </div>
          )}

          {error && <div style={{ fontSize:'13px', color:C.danger, background:'#fef2f2', padding:'8px 12px', borderRadius:'7px' }}>⚠️ {error}</div>}

          <div style={{ display:'flex', gap:'8px', paddingTop:'4px' }}>
            <Btn variant="ghost" onClick={onClose} style={{ flex:1 }}>취소</Btn>
            <Btn onClick={verify} style={{ flex:2 }}
              disabled={(method==='email'||method==='phone') ? !codeSent : false}>
              확인
            </Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Profile({ user, onUserUpdate, onNav }) {
  const isSocial = user.provider && user.provider !== 'email'

  const [verified,   setVerified]   = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

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

  const requireVerify = (action) => {
    if (verified) { action() }
    else { setPendingAction(() => action); setShowVerify(true) }
  }

  const handleVerified = () => {
    setVerified(true)
    setShowVerify(false)
    if (pendingAction) { pendingAction(); setPendingAction(null) }
  }

  const saveInfo = () => {
    requireVerify(() => {
      if (!info.name.trim() || !info.email.trim()) { flash(setInfoMsg, false, '이름과 이메일은 필수입니다.'); return }
      const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailReg.test(info.email.trim())) { flash(setInfoMsg, false, '올바른 이메일 형식이 아닙니다.'); return }
      const dup = Users.findByEmail(info.email.trim().toLowerCase())
      if (dup && dup.id !== user.id) { flash(setInfoMsg, false, '이미 사용 중인 이메일입니다.'); return }
      const updated = Users.update(user.id, { name: info.name.trim(), email: info.email.trim().toLowerCase(), phone: info.phone.trim() })
      onUserUpdate(updated)
      flash(setInfoMsg, true, '정보가 저장되었습니다.')
    })
  }

  const savePw = () => {
    requireVerify(() => {
      if (pw.next.length < 4) { flash(setPwMsg, false, '새 비밀번호는 4자 이상이어야 합니다.'); return }
      if (pw.next !== pw.next2) { flash(setPwMsg, false, '새 비밀번호가 일치하지 않습니다.'); return }
      const updated = Users.update(user.id, { pw: pw.next })
      onUserUpdate(updated)
      setPw({ next:'', next2:'' })
      flash(setPwMsg, true, '비밀번호가 설정되었습니다.')
    })
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
        {verified && <span style={{ fontSize:'11px', background:'#f0fdf4', color:C.success, border:'1px solid #86efac', padding:'2px 8px', borderRadius:'6px', fontWeight:600 }}>🔓 인증됨</span>}
      </div>

      {isSocial && (
        <div style={{ padding:'12px 16px', background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:'10px', marginBottom:'16px', fontSize:'13px', color:'#1e40af' }}>
          💡 <strong>{providerLabels[user.provider] || user.provider} 계정</strong>으로 로그인했습니다. 정보 변경 시 이메일로 인증번호를 발송합니다.
        </div>
      )}

      {!verified && (
        <div style={{ padding:'12px 16px', background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:'10px', marginBottom:'16px', fontSize:'13px', color:'#92400e', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
          <span>⚠️ 정보 변경 시 <strong>본인 인증</strong>이 필요합니다. (저장 버튼 클릭 시 자동 실행)</span>
          <Btn size="sm" variant="ghost" onClick={() => setShowVerify(true)}>미리 인증</Btn>
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

      {showVerify && <VerifyModal user={user} onVerified={handleVerified} onClose={() => onNav('dashboard')} />}
    </div>
  )
}
