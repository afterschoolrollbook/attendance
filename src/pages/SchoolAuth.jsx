/**
 * SchoolAuth.jsx
 * 학교 담당자 포털 인증 — /?school=1
 * 업체 파트너 포털과 동일한 방식
 */
import React, { useState } from 'react'
import { dbCall, isConfigured, FUNCTIONS_BASE } from '../lib/supabase.js'
import { uid, now } from '../lib/utils.js'

const C = {
  primary:'#3b82f6', text:'#111827', muted:'#6b7280',
  border:'#e5e7eb', card:'#fff', danger:'#ef4444',
}
const iSt = {
  width:'100%', padding:'11px 14px', borderRadius:'10px',
  border:'1.5px solid #e5e7eb', fontSize:'14px',
  fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
}
function BtnPrimary({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:'100%', padding:'13px', borderRadius:'10px', border:'none',
      background: disabled ? '#e5e7eb' : C.primary,
      color: disabled ? C.muted : '#fff',
      fontSize:'15px', fontWeight:700, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily:'Noto Sans KR, sans-serif', transition:'all .15s',
    }}>{children}</button>
  )
}

const SA = {
  byPhone: async (phone) => {
    const clean = phone?.replace(/[^0-9]/g, '')
    const rows = await dbCall('getAll', 'schoolAdmins')
    return rows?.find(v => v.phone?.replace(/[^0-9]/g,'') === clean) || null
  },
  byEmail: async (email) => {
    const rows = await dbCall('getAll', 'schoolAdmins')
    return rows?.find(v => v.email?.toLowerCase() === email?.toLowerCase()) || null
  },
  save: async (v) => dbCall('upsert', 'schoolAdmins', { data: v }),
}
const SAAccounts = {
  byEmail: async (email) => {
    const rows = await dbCall('getAll', 'schoolAdminAccounts')
    return rows?.find(a => a.email?.toLowerCase() === email?.toLowerCase()) || null
  },
  byAdminId: async (adminId) => {
    const rows = await dbCall('getAll', 'schoolAdminAccounts')
    return rows?.find(a => a.adminId === adminId) || null
  },
  save: async (a) => dbCall('upsert', 'schoolAdminAccounts', { data: a }),
}

const LS_SESSION = 'asa_school_session'

// ── 로그인
function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pw, setPw]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email || !pw) return
    setLoading(true); setError('')
    try {
      const acc = await SAAccounts.byEmail(email.trim())
      if (!acc || acc.pw !== pw) { setError('이메일 또는 비밀번호가 올바르지 않습니다.'); return }
      const admin = await dbCall('getOne', 'schoolAdmins', { id: acc.adminId })
      if (!admin || admin.status === 'inactive') { setError('비활성화된 계정입니다.'); return }
      const session = { ...acc, admin, adminId: acc.adminId }
      localStorage.setItem(LS_SESSION, JSON.stringify(session))
      onLogin(session)
    } catch { setError('오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
      <div>
        <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'5px' }}>이메일</label>
        <input style={iSt} type="email" value={email} onChange={e=>setEmail(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="등록된 이메일" />
      </div>
      <div>
        <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'5px' }}>비밀번호</label>
        <input style={iSt} type="password" value={pw} onChange={e=>setPw(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="비밀번호" />
      </div>
      {error && <div style={{ fontSize:'13px', color:C.danger, background:'#fef2f2', padding:'10px 12px', borderRadius:'8px' }}>⚠️ {error}</div>}
      <BtnPrimary onClick={handleLogin} disabled={loading||!email||!pw}>
        {loading ? '로그인 중...' : '로그인'}
      </BtnPrimary>
    </div>
  )
}

// ── 가입
function JoinForm({ onLogin }) {
  const [step, setStep]       = useState('check') // check | verify | register | done
  const [input, setInput]     = useState('')
  const [admin, setAdmin]     = useState(null)
  const [code, setCode]       = useState('')
  const [sentCode, setSentCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [name, setName]       = useState('')
  const [pw, setPw]           = useState('')
  const [pw2, setPw2]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleCheck = async () => {
    setLoading(true); setError('')
    try {
      const found = await SA.byPhone(input) || await SA.byEmail(input)
      if (!found) { setError('등록된 정보를 찾을 수 없습니다.\n담당자에게 등록 요청해주세요.'); return }
      if (found.status === 'joined') {
        const existing = await SAAccounts.byAdminId(found.id)
        if (existing) { setError('이미 가입된 계정입니다. 로그인해주세요.'); return }
      }
      setAdmin(found)
      setStep('verify')
    } catch { setError('오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  const sendCode = async () => {
    const c6 = String(Math.floor(100000 + Math.random() * 900000))
    setSentCode(c6)
    if (!isConfigured) { alert(`[개발모드] 인증코드: ${c6}`); return }
    try {
      await fetch(`${FUNCTIONS_BASE}/send-email`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ to: admin.email, subject:'학교 담당자 포털 인증번호', code: c6 }),
      })
    } catch { alert(`[개발모드] 인증코드: ${c6}`) }
  }

  const handleVerify = () => {
    if (code !== sentCode) { setError('인증번호가 올바르지 않습니다.'); return }
    setVerified(true); setStep('register'); setError('')
  }

  const handleRegister = async () => {
    if (!name.trim()) { setError('이름을 입력해주세요.'); return }
    if (pw.length < 4) { setError('비밀번호는 4자 이상이어야 합니다.'); return }
    if (pw !== pw2) { setError('비밀번호가 일치하지 않습니다.'); return }
    setLoading(true); setError('')
    try {
      const acc = { id:uid(), adminId:admin.id, email:admin.email, pw, name:name.trim(), active:true, createdAt:now() }
      await SAAccounts.save(acc)
      await SA.save({ ...admin, status:'joined', adminName: name.trim() })
      const session = { ...acc, admin:{ ...admin, status:'joined' }, adminId:admin.id }
      localStorage.setItem(LS_SESSION, JSON.stringify(session))
      setStep('done')
      setTimeout(() => onLogin(session), 1000)
    } catch { setError('오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  if (step === 'done') return (
    <div style={{ textAlign:'center', padding:'20px 0' }}>
      <div style={{ fontSize:'48px', marginBottom:'12px' }}>🎉</div>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>가입 완료!</div>
      <div style={{ fontSize:'13px', color:C.muted, marginTop:'6px' }}>잠시 후 이동합니다...</div>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
      {step === 'check' && <>
        <div style={{ fontSize:'13px', color:C.muted, background:'#eff6ff', padding:'10px 14px', borderRadius:'8px', lineHeight:1.7 }}>
          본사에서 등록한 학교 담당자만 가입할 수 있습니다.<br/>
          본사에 등록된 <strong>휴대폰 번호 또는 이메일</strong>을 입력해주세요.
        </div>
        <input style={iSt} value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleCheck()} placeholder="휴대폰 번호 또는 이메일" />
        {error && <div style={{ fontSize:'13px', color:C.danger, background:'#fef2f2', padding:'10px 12px', borderRadius:'8px', whiteSpace:'pre-line' }}>⚠️ {error}</div>}
        <BtnPrimary onClick={handleCheck} disabled={loading||!input}>
          {loading ? '확인 중...' : '담당자 확인'}
        </BtnPrimary>
      </>}

      {step === 'verify' && <>
        <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'12px 14px' }}>
          <div style={{ fontSize:'13px', fontWeight:700, color:'#15803d' }}>✅ 담당자 확인 완료</div>
          <div style={{ fontSize:'12px', color:'#166534', marginTop:'3px' }}>🏫 {admin?.schoolName}</div>
        </div>
        <div style={{ fontSize:'13px', color:C.muted }}>등록된 이메일({admin?.email})로 인증번호를 발송합니다.</div>
        <button onClick={sendCode} style={{ padding:'10px', borderRadius:'9px', border:`1.5px solid ${C.primary}`, background:'#eff6ff', color:C.primary, fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          📧 인증번호 발송
        </button>
        <input style={iSt} value={code} onChange={e=>setCode(e.target.value)} placeholder="인증번호 6자리" maxLength={6} />
        {error && <div style={{ fontSize:'13px', color:C.danger }}>{error}</div>}
        <BtnPrimary onClick={handleVerify} disabled={code.length<6}>인증 확인</BtnPrimary>
      </>}

      {step === 'register' && <>
        <div style={{ background:'#f0fdf4', borderRadius:'10px', padding:'12px 14px' }}>
          <div style={{ fontSize:'13px', fontWeight:700, color:'#15803d' }}>✅ 이메일 인증 완료</div>
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'5px' }}>이름</label>
          <input style={iSt} value={name} onChange={e=>setName(e.target.value)} placeholder="담당자 이름" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'5px' }}>비밀번호 (4자 이상)</label>
          <input style={iSt} type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="비밀번호" />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, display:'block', marginBottom:'5px' }}>비밀번호 확인</label>
          <input style={iSt} type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="비밀번호 확인" />
        </div>
        {error && <div style={{ fontSize:'13px', color:C.danger, background:'#fef2f2', padding:'10px 12px', borderRadius:'8px' }}>⚠️ {error}</div>}
        <BtnPrimary onClick={handleRegister} disabled={loading||!name||!pw||!pw2}>
          {loading ? '처리 중...' : '🏫 담당자 계정 만들기'}
        </BtnPrimary>
      </>}
    </div>
  )
}

// ── 메인
export function SchoolAuth({ onLogin }) {
  const [tab, setTab] = useState('join')

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#eff6ff', fontFamily:'Noto Sans KR, sans-serif', padding:'24px 16px',
    }}>
      <div style={{ width:'100%', maxWidth:'400px' }}>
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontSize:'48px', marginBottom:'8px' }}>🏫</div>
          <div style={{ fontSize:'20px', fontWeight:800, color:C.text }}>방과후 출석부</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>학교 담당자 포털</div>
        </div>

        <div style={{ background:C.card, borderRadius:'20px', border:`1px solid ${C.border}`, padding:'24px', boxShadow:'0 4px 24px rgba(0,0,0,0.07)' }}>
          <div style={{ display:'flex', background:'#f3f4f6', borderRadius:'10px', padding:'3px', marginBottom:'20px' }}>
            {[['join','담당자 가입'],['login','로그인']].map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                flex:1, padding:'9px', borderRadius:'8px', border:'none', cursor:'pointer',
                background: tab===t ? C.card : 'transparent',
                color: tab===t ? C.primary : C.muted,
                fontWeight: tab===t ? 700 : 400, fontSize:'14px',
                fontFamily:'Noto Sans KR, sans-serif',
                boxShadow: tab===t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition:'all .15s',
              }}>{l}</button>
            ))}
          </div>

          {tab === 'join' ? <JoinForm onLogin={onLogin} /> : <LoginForm onLogin={onLogin} />}
        </div>

        <div style={{ textAlign:'center', marginTop:'16px' }}>
          <a href="/" style={{ fontSize:'12px', color:C.muted, textDecoration:'none' }}>← 방과후 출석부 관리자 페이지로 돌아가기</a>
        </div>
      </div>
    </div>
  )
}

export { LS_SESSION as LS_SCHOOL_SESSION }
