/**
 * VendorAuth.jsx
 * 업체 전용 로그인 · 회원가입 · 아이디찾기 · 비밀번호 초기화
 * ✅ 업체 조회/계정 — Supabase hq_vendors, vendor_accounts 테이블 사용
 */
import React, { useState } from 'react'
import { uid, now } from '../lib/utils.js'
import { vendorRpc, isConfigured, FUNCTIONS_BASE } from '../lib/supabase.js'
import { hashPassword, verifyPassword, isHashed } from '../lib/crypto.js'

const C = {
  primary: '#f97316', text: '#111827', muted: '#6b7280',
  border: '#e5e7eb', success: '#16a34a', danger: '#ef4444',
  bg: '#fff7ed',
}

const LS_SESSION = 'asa_vendor_session'


// ─── 브루트포스 방어
const loginAttempts = {}
function checkBruteForce(key) {
  const now = Date.now()
  if (!loginAttempts[key]) loginAttempts[key] = { count: 0, lockedUntil: 0 }
  const a = loginAttempts[key]
  if (a.lockedUntil > now) {
    const secs = Math.ceil((a.lockedUntil - now) / 1000)
    throw new Error(`로그인 시도가 너무 많습니다. ${secs}초 후 다시 시도해주세요.`)
  }
  a.count++
  if (a.count >= 5) { a.lockedUntil = now + 60000; a.count = 0; throw new Error('로그인 시도가 너무 많습니다. 1분 후 다시 시도해주세요.') }
}
function resetBruteForce(key) { delete loginAttempts[key] }

// ─── 인증번호 만료 관리 (5분)
const CODE_EXPIRY_MS = 5 * 60 * 1000
function makeCode() { return { code: String(Math.floor(100000 + Math.random() * 900000)), expiresAt: Date.now() + CODE_EXPIRY_MS } }
function checkCode(input, stored) {
  if (!stored) return '인증번호를 먼저 발송해주세요.'
  if (Date.now() > stored.expiresAt) return '인증번호가 만료되었습니다. 다시 발송해주세요.'
  if (input !== stored.code) return '인증번호가 올바르지 않습니다.'
  return null
}
// ─── 업체 조회 — RPC 경유 (hq_vendors RLS: for all using (false))
const HQVendors = {
  byPhone: async (phone) => {
    if (!isConfigured) return null
    return vendorRpc.getVendorByPhone(phone)
  },
  byEmail: async (email) => {
    if (!isConfigured) return null
    return vendorRpc.getVendorByEmail(email)
  },
  save: async (v) => {
    if (!isConfigured) return
    await vendorRpc.upsertVendor(v)
  },
}

// ─── 업체 계정 조회/저장 — RPC 경유 (vendor_accounts RLS: for all using (false))
const VendorAccounts = {
  byEmail: async (email) => {
    if (!isConfigured) return null
    return vendorRpc.getAccountByEmail(email)
  },
  byVendorId: async (vid) => {
    if (!isConfigured) return null
    return vendorRpc.getAccountByVendorId(vid)
  },
  save: async (a) => {
    if (!isConfigured) return
    await vendorRpc.upsertAccount(a)
  },
}

const iSt = {
  width:'100%', padding:'12px 14px', borderRadius:'10px', border:'1.5px solid #e5e7eb',
  fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box',
  transition:'border-color .15s',
}

function BtnPrimary({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:'100%', padding:'13px', borderRadius:'10px', border:'none',
      background: disabled ? '#d1d5db' : C.primary,
      color:'#fff', fontWeight:700, fontSize:'15px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily:'Noto Sans KR, sans-serif', transition:'background .15s',
    }}>{children}</button>
  )
}

function BackLink({ onClick }) {
  return (
    <button onClick={onClick} style={{
      background:'none', border:'none', color:C.muted, fontSize:'13px',
      cursor:'pointer', padding:'0', fontFamily:'Noto Sans KR, sans-serif',
      marginBottom:'16px', display:'flex', alignItems:'center', gap:'4px',
    }}>← 로그인으로 돌아가기</button>
  )
}

// ─────────────────────────────────────────────────────
// 로그인
// ─────────────────────────────────────────────────────
function LoginTab({ onLogin, onSwitch, onFindId, onResetPw }) {
  const [email, setEmail]     = useState('')
  const [pw, setPw]           = useState('')
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setErr('')
    if (!email || !pw) return
    setLoading(true)
    try {
      checkBruteForce(email.trim().toLowerCase())
      const acc = await VendorAccounts.byEmail(email.trim())
      if (!acc || !(await verifyPassword(pw, acc.pw))) { setErr('이메일 또는 비밀번호가 올바르지 않습니다.'); return }
      if (!isHashed(acc.pw)) {
        const hashedPw = await hashPassword(pw)
        await VendorAccounts.save({ ...acc, pw: hashedPw })
        acc.pw = hashedPw
      }
      const vendor = await vendorRpc.getVendorById(acc.vendorId)
      if (!vendor) { setErr('연결된 업체 정보가 없습니다.'); return }
      resetBruteForce(email.trim().toLowerCase())
      const { pw: _pw, ...safeAcc } = acc
      localStorage.setItem(LS_SESSION, JSON.stringify({ ...safeAcc, vendor }))
      onLogin({ ...safeAcc, vendor })
    } catch(e) { setErr(e.message || '오류가 발생했습니다. 다시 시도해주세요.') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px' }}>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>이메일</label>
          <input style={iSt} type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="가입 시 사용한 이메일"
            onKeyDown={e=>e.key==='Enter'&&handleLogin()} />
        </div>
        <div>
          <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>비밀번호</label>
          <input style={iSt} type="password" value={pw} onChange={e=>setPw(e.target.value)}
            placeholder="비밀번호"
            onKeyDown={e=>e.key==='Enter'&&handleLogin()} />
        </div>
        {err && <p style={{ color:C.danger, fontSize:'13px', margin:0 }}>⚠️ {err}</p>}
      </div>

      <BtnPrimary onClick={handleLogin} disabled={loading || !email || !pw}>
        {loading ? '로그인 중...' : '🔐 업체 로그인'}
      </BtnPrimary>

      {/* ✅ 아이디 찾기 / 비밀번호 초기화 */}
      <div style={{ display:'flex', justifyContent:'center', gap:'16px', marginTop:'14px' }}>
        <button onClick={onFindId} style={{
          background:'none', border:'none', color:C.muted, fontSize:'12px',
          cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', textDecoration:'underline',
        }}>아이디(이메일) 찾기</button>
        <span style={{ color:C.border, lineHeight:'1.8' }}>|</span>
        <button onClick={onResetPw} style={{
          background:'none', border:'none', color:C.muted, fontSize:'12px',
          cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', textDecoration:'underline',
        }}>비밀번호 초기화</button>
      </div>

      <p style={{ textAlign:'center', fontSize:'13px', color:C.muted, marginTop:'16px' }}>
        계정이 없으신가요?{' '}
        <button onClick={onSwitch} style={{
          background:'none', border:'none', color:C.primary, fontWeight:600,
          cursor:'pointer', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif',
        }}>업체 가입하기</button>
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 아이디(이메일) 찾기
// 본사 등록 전화번호 입력 → 가입 이메일 마스킹 표시
// ─────────────────────────────────────────────────────
function FindIdTab({ onBack }) {
  const [phone, setPhone]   = useState('')
  const [result, setResult] = useState(null)
  const [err, setErr]       = useState('')

  const handleFind = async () => {
    setErr('')
    setResult(null)
    try {
      const vendor = await HQVendors.byPhone(phone)
      if (!vendor) { setErr('본사에 등록된 전화번호가 아닙니다.'); return }
      const acc = await VendorAccounts.byVendorId(vendor.id)
      if (!acc) { setErr('해당 업체로 가입된 계정이 없습니다.\n업체 가입을 먼저 진행해주세요.'); return }
      const [local, domain] = acc.email.split('@')
      const masked = local.slice(0, 3) + '***@' + domain
      setResult({ masked, vendorName: vendor.name })
    } catch { setErr('오류가 발생했습니다. 다시 시도해주세요.') }
  }

  return (
    <div>
      <BackLink onClick={onBack} />
      <h3 style={{ fontSize:'16px', fontWeight:700, color:C.text, margin:'0 0 6px' }}>🔍 아이디(이메일) 찾기</h3>
      <p style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:'1.6' }}>
        본사에 등록된 <strong>휴대폰 번호</strong>를 입력하면<br />가입 시 사용한 이메일을 확인할 수 있습니다.
      </p>

      <div style={{ marginBottom:'12px' }}>
        <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>휴대폰 번호</label>
        <input style={iSt} value={phone} onChange={e=>setPhone(e.target.value)}
          placeholder="010-0000-0000"
          onKeyDown={e=>e.key==='Enter'&&handleFind()} />
      </div>
      {err && <pre style={{ color:C.danger, fontSize:'12px', margin:'0 0 12px', whiteSpace:'pre-wrap' }}>⚠️ {err}</pre>}
      <BtnPrimary onClick={handleFind} disabled={!phone}>이메일 찾기</BtnPrimary>

      {result && (
        <div style={{ marginTop:'20px', padding:'20px', background:'#f0fdf4', borderRadius:'12px', border:'1px solid #86efac', textAlign:'center' }}>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'6px' }}>🏢 {result.vendorName}</div>
          <div style={{ fontSize:'20px', fontWeight:700, color:C.success, letterSpacing:'0.05em' }}>
            {result.masked}
          </div>
          <div style={{ fontSize:'12px', color:C.muted, marginTop:'8px' }}>위 이메일로 로그인해주세요.</div>
          <button onClick={onBack} style={{
            marginTop:'14px', padding:'9px 24px', borderRadius:'9px',
            border:`1.5px solid ${C.primary}`, background:'#fff7ed',
            color:C.primary, fontWeight:700, fontSize:'13px',
            cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
          }}>🔐 로그인하러 가기</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 비밀번호 초기화
// 흐름: 이메일 입력 → 인증번호 발송 → 확인 → 새 비번 설정 → 완료
// ─────────────────────────────────────────────────────
function ResetPwTab({ onBack }) {
  const [step, setStep]           = useState(1)
  const [email, setEmail]         = useState('')
  const [code, setCode]           = useState('')
  const [sentCode, setSentCode]   = useState(null) // { code, expiresAt }
  const [pw, setPw]               = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [err, setErr]             = useState('')
  const [done, setDone]           = useState(false)
  const [targetAcc, setTargetAcc] = useState(null)

  // Step 1 → 2: 이메일 확인 + 인증번호 발송
  const handleSendCode = async () => {
    setErr('')
    try {
      const acc = await VendorAccounts.byEmail(email.trim())
      if (!acc) { setErr('가입되지 않은 이메일입니다.'); return }
      setTargetAcc(acc)
      const codeObj = makeCode()
      setSentCode(codeObj)
      const code6 = codeObj.code
      // Resend API로 인증번호 발송
      if (isConfigured && FUNCTIONS_BASE) {
        try {
          await fetch(`${FUNCTIONS_BASE}/send-email`, {
            method:'POST',
            headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ to: email.trim(), code: code6 }),
          })
        } catch { /* 발송 실패해도 진행 */ }
      } else {
        alert(`[개발 모드] 인증번호: ${code6}`)
      }
      setStep(2)
    } catch { setErr('오류가 발생했습니다.') }
  }

  // Step 2 → 3: 인증번호 확인
  const handleVerify = () => {
    const err = checkCode(code, sentCode)
    if (err) { setErr(err); return }
    setErr(''); setStep(3)
  }

  // Step 3: 새 비번 저장
  const handleReset = async () => {
    setErr('')
    if (pw.length < 8) { setErr('비밀번호는 8자 이상이어야 합니다.'); return }
    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(pw)) { setErr('비밀번호는 영문+숫자를 조합해야 합니다.'); return }
    if (pw !== pwConfirm) { setErr('비밀번호가 일치하지 않습니다.'); return }
    try {
      const hashedPw = await hashPassword(pw)
      await VendorAccounts.save({ ...targetAcc, pw: hashedPw })
      setDone(true)
    } catch { setErr('오류가 발생했습니다.') }
  }

  // 진행바 컴포넌트
  const Steps = () => (
    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'22px' }}>
      {['이메일 확인','인증번호','새 비밀번호'].map((label, i) => {
        const sn = i + 1
        const isActive = step === sn
        const isDone   = step > sn
        return (
          <React.Fragment key={label}>
            <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
              <div style={{
                width:'22px', height:'22px', borderRadius:'50%', display:'flex',
                alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700,
                background: isDone ? C.success : isActive ? C.primary : '#e5e7eb',
                color: (isDone || isActive) ? '#fff' : C.muted,
                flexShrink:0,
              }}>{isDone ? '✓' : sn}</div>
              <span style={{ fontSize:'11px', color: isActive ? C.primary : isDone ? C.success : C.muted, fontWeight: isActive ? 700 : 400, whiteSpace:'nowrap' }}>
                {label}
              </span>
            </div>
            {i < 2 && <div style={{ flex:1, height:'1.5px', background: step > sn ? C.success : '#e5e7eb', minWidth:'12px' }} />}
          </React.Fragment>
        )
      })}
    </div>
  )

  if (done) return (
    <div style={{ textAlign:'center', padding:'10px 0' }}>
      <div style={{ fontSize:'52px', marginBottom:'14px' }}>✅</div>
      <div style={{ fontSize:'17px', fontWeight:700, color:C.success, marginBottom:'6px' }}>비밀번호가 변경되었습니다!</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'24px' }}>새 비밀번호로 로그인해주세요.</div>
      <BtnPrimary onClick={onBack}>🔐 로그인하러 가기</BtnPrimary>
    </div>
  )

  return (
    <div>
      <BackLink onClick={onBack} />
      <h3 style={{ fontSize:'16px', fontWeight:700, color:C.text, margin:'0 0 16px' }}>🔑 비밀번호 초기화</h3>
      <Steps />

      {/* Step 1: 이메일 입력 */}
      {step === 1 && (
        <>
          <p style={{ fontSize:'13px', color:C.muted, marginBottom:'16px', lineHeight:'1.6' }}>
            가입 시 사용한 이메일을 입력하면<br />인증번호를 발송해드립니다.
          </p>
          <div style={{ marginBottom:'12px' }}>
            <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>가입 이메일</label>
            <input style={iSt} type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="가입 시 사용한 이메일"
              onKeyDown={e=>e.key==='Enter'&&handleSendCode()} />
          </div>
          {err && <p style={{ color:C.danger, fontSize:'13px', margin:'0 0 12px' }}>⚠️ {err}</p>}
          <BtnPrimary onClick={handleSendCode} disabled={!email}>인증번호 발송</BtnPrimary>
        </>
      )}

      {/* Step 2: 인증번호 입력 */}
      {step === 2 && (
        <>
          <div style={{ padding:'12px 14px', background:'#eff6ff', borderRadius:'10px', border:'1px solid #bfdbfe', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', color:'#1d4ed8', fontWeight:600 }}>📧 인증번호 발송 완료</div>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>{email} 로 발송되었습니다.</div>
          </div>
          <div style={{ marginBottom:'12px' }}>
            <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>인증번호 6자리</label>
            <input style={iSt} value={code} onChange={e=>setCode(e.target.value)}
              placeholder="000000" maxLength={6}
              onKeyDown={e=>e.key==='Enter'&&handleVerify()} />
          </div>
          {err && <p style={{ color:C.danger, fontSize:'13px', margin:'0 0 12px' }}>⚠️ {err}</p>}
          <BtnPrimary onClick={handleVerify} disabled={code.length < 6}>인증번호 확인</BtnPrimary>
          <p style={{ textAlign:'center', fontSize:'12px', color:C.muted, marginTop:'12px' }}>
            못 받으셨나요?{' '}
            <button onClick={()=>{ setSentCode(''); setCode(''); setStep(1) }}
              style={{ background:'none', border:'none', color:C.primary, fontWeight:600, cursor:'pointer', fontSize:'12px', fontFamily:'Noto Sans KR, sans-serif' }}>
              다시 발송
            </button>
          </p>
        </>
      )}

      {/* Step 3: 새 비밀번호 */}
      {step === 3 && (
        <>
          <div style={{ padding:'12px 14px', background:'#f0fdf4', borderRadius:'10px', border:'1px solid #86efac', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', color:C.success, fontWeight:600 }}>✅ 본인 인증 완료 — 새 비밀번호를 설정해주세요</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px' }}>
            <div>
              <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>새 비밀번호 (8자 이상)</label>
              <input style={iSt} type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="새 비밀번호 입력" />
              {pw && (
                <div style={{ fontSize:'11px', marginTop:'4px', color: pw.length >= 8 ? C.success : C.danger }}>
                  {pw.length >= 8 ? '✅ 안전한 비밀번호' : '❌ 8자 이상 입력해주세요'}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>새 비밀번호 확인</label>
              <input style={iSt} type="password" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)}
                placeholder="비밀번호 재입력"
                onKeyDown={e=>e.key==='Enter'&&handleReset()} />
              {pwConfirm && (
                <div style={{ fontSize:'11px', marginTop:'4px', color: pw === pwConfirm ? C.success : C.danger }}>
                  {pw === pwConfirm ? '✅ 비밀번호가 일치합니다' : '❌ 비밀번호가 일치하지 않습니다'}
                </div>
              )}
            </div>
          </div>
          {err && <p style={{ color:C.danger, fontSize:'13px', margin:'0 0 12px' }}>⚠️ {err}</p>}
          <BtnPrimary onClick={handleReset} disabled={!pw || !pwConfirm || pw !== pwConfirm || pw.length < 8}>
            🔑 비밀번호 변경 완료
          </BtnPrimary>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 회원가입
// ─────────────────────────────────────────────────────
function RegisterTab({ onDone, onSwitch }) {
  const [step, setStep]           = useState(1)
  const [phone, setPhone]         = useState('')
  const [regEmail, setRegEmail]   = useState('')
  const [code, setCode]           = useState('')
  const [sentCode, setSentCode]   = useState(null) // { code, expiresAt }
  const [verified, setVerified]   = useState(false)
  const [pw, setPw]               = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [name, setName]           = useState('')
  const [matchedVendor, setMatchedVendor] = useState(null)
  const [err, setErr]             = useState('')
  const [loading, setLoading]     = useState(false)

  const handleCheckVendor = async () => {
    setErr('')
    try {
      const cleanPhone = phone.replace(/[^0-9@._\-a-zA-Z]/g, '')
      const vendor = phone.includes('@')
        ? await HQVendors.byEmail(phone)
        : (await HQVendors.byPhone(phone)) || (await HQVendors.byEmail(phone))
      if (!vendor) { setErr('본사에 등록된 업체 정보가 없습니다.\n담당자에게 업체 등록을 요청해주세요.'); return }
      const existing = await VendorAccounts.byVendorId(vendor.id)
      if (existing) { setErr('이미 가입된 업체입니다. 로그인해주세요.'); return }
      setMatchedVendor(vendor)
      if (vendor.email) setRegEmail(vendor.email)
      setStep(2)
    } catch { setErr('오류가 발생했습니다. 다시 시도해주세요.') }
  }

  const handleSendCode = async () => {
    if (!regEmail.includes('@')) { setErr('올바른 이메일을 입력해주세요.'); return }
    if (regEmail.toLowerCase() !== matchedVendor.email?.toLowerCase()) {
      setErr('본사에서 초대한 이메일만 사용 가능합니다.\n다른 이메일을 사용하고 싶으시면 본사 담당자에게 연락해주세요.')
      return
    }
    const codeObj = makeCode()
    setSentCode(codeObj)
    const code6 = codeObj.code
    setErr('')
    if (isConfigured && FUNCTIONS_BASE) {
      try {
        await fetch(`${FUNCTIONS_BASE}/send-email`, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ to: regEmail, code: code6 }),
        })
      } catch {}
    } else {
      alert(`[개발 모드] 인증번호: ${code6}`)
    }
  }

  const handleVerifyCode = () => {
    const err = checkCode(code, sentCode)
    if (err) { setErr(err); return }
    setVerified(true); setErr('')
  }

  const handleRegister = async () => {
    setErr('')
    if (!verified) { setErr('이메일 인증을 완료해주세요.'); return }
    if (pw.length < 8) { setErr('비밀번호는 8자 이상이어야 합니다.'); return }
    if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(pw)) { setErr('비밀번호는 영문+숫자를 조합해야 합니다.'); return }
    if (pw !== pwConfirm) { setErr('비밀번호가 일치하지 않습니다.'); return }
    setLoading(true)
    try {
      const hashedPw = await hashPassword(pw)
      const acc = { id:uid(), vendorId:matchedVendor.id, email:regEmail, pw: hashedPw, name: name || matchedVendor.managerName || matchedVendor.name, createdAt:now() }
      await VendorAccounts.save(acc)
      await HQVendors.save({ ...matchedVendor, status:'joined', joinedAt: now() })
      const { pw: _pw2, ...safeAcc2 } = acc
      localStorage.setItem(LS_SESSION, JSON.stringify({ ...safeAcc2, vendor: matchedVendor }))
      onDone({ ...safeAcc2, vendor: matchedVendor })
    } catch { setErr('가입 중 오류가 발생했습니다.') }
    finally { setLoading(false) }
  }

  return (
    <div>
      {step === 1 && (
        <>
          <p style={{ fontSize:'13px', color:C.muted, marginBottom:'16px', lineHeight:'1.6' }}>
            본사에서 초대받은 업체만 가입할 수 있습니다.<br />
            본사에 등록된 <strong>휴대폰 번호</strong> 또는 <strong>이메일</strong>을 입력해주세요.
          </p>
          <div style={{ marginBottom:'12px' }}>
            <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>휴대폰 번호 또는 이메일</label>
            <input style={iSt} value={phone} onChange={e=>setPhone(e.target.value)}
              placeholder="010-0000-0000 또는 email@example.com"
              onKeyDown={e=>e.key==='Enter'&&handleCheckVendor()} />
          </div>
          {err && <pre style={{ color:C.danger, fontSize:'12px', margin:'0 0 12px', whiteSpace:'pre-wrap' }}>⚠️ {err}</pre>}
          <BtnPrimary onClick={handleCheckVendor} disabled={!phone}>업체 확인</BtnPrimary>
        </>
      )}

      {step === 2 && matchedVendor && (
        <>
          <div style={{ padding:'12px 14px', background:'#f0fdf4', borderRadius:'10px', border:'1px solid #86efac', marginBottom:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:C.success }}>✅ 업체 확인 완료</div>
            <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>🏢 {matchedVendor.name}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px' }}>
            <div>
              <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>담당자 이름</label>
              <input style={iSt} value={name} onChange={e=>setName(e.target.value)} placeholder="담당자 이름" />
            </div>
            <div>
              <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>이메일 (로그인 ID)</label>
              {!verified && (
                <div style={{ padding:'10px 12px', background:'#fff7ed', borderRadius:'8px', border:'1px solid #fed7aa', marginBottom:'8px', fontSize:'12px', color:'#92400e', lineHeight:'1.7' }}>
                  📧 실제 사용하시는 이메일을 입력 후 <strong>"발송" 버튼을 클릭</strong>하여 인증번호를 받아주세요.<br />
                  <span style={{ color:'#b45309' }}>※ 이메일 인증은 필수입니다.</span>
                </div>
              )}
              <div style={{ display:'flex', gap:'8px' }}>
                <input style={{ ...iSt, flex:1 }} type="email" value={regEmail} onChange={e=>setRegEmail(e.target.value)} placeholder="이메일 입력" />
                <button onClick={handleSendCode} disabled={verified} style={{
                  flexShrink:0, padding:'0 14px', borderRadius:'10px', border:`1.5px solid ${C.primary}`,
                  background: verified ? '#f3f4f6' : C.primary, color: verified ? C.muted : '#fff',
                  fontWeight:600, fontSize:'13px', cursor: verified ? 'not-allowed' : 'pointer',
                  fontFamily:'Noto Sans KR, sans-serif',
                }}>{verified ? '✅ 인증완료' : '발송 →'}</button>
              </div>
              {!verified && !sentCode && (
                <p style={{ fontSize:'11px', color:C.primary, margin:'5px 0 0', fontWeight:600 }}>
                  ⬆️ 이메일 입력 후 "발송 →" 버튼을 클릭하세요
                </p>
              )}
            </div>
            {sentCode && !verified && (
              <div style={{ display:'flex', gap:'8px' }}>
                <input style={{ ...iSt, flex:1 }} value={code} onChange={e=>setCode(e.target.value)} placeholder="인증번호 6자리" maxLength={6} />
                <button onClick={handleVerifyCode} style={{
                  flexShrink:0, padding:'0 14px', borderRadius:'10px', border:`1.5px solid ${C.success}`,
                  background:'#f0fdf4', color:C.success, fontWeight:600, fontSize:'13px',
                  cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                }}>확인</button>
              </div>
            )}
            {verified && <p style={{ color:C.success, fontSize:'12px', margin:0 }}>✅ 이메일이 인증되었습니다.</p>}
            <div>
              <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>비밀번호 (8자 이상, 영문+숫자)</label>
              <input style={iSt} type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="비밀번호 설정" />
            </div>
            <div>
              <label style={{ fontSize:'12px', color:C.muted, marginBottom:'4px', display:'block' }}>비밀번호 확인</label>
              <input style={iSt} type="password" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} placeholder="비밀번호 재입력" />
            </div>
            {err && <p style={{ color:C.danger, fontSize:'13px', margin:0 }}>⚠️ {err}</p>}
          </div>
          <BtnPrimary onClick={handleRegister} disabled={loading || !verified || !pw || !pwConfirm}>
            {loading ? '가입 중...' : '🎒 업체 계정 만들기'}
          </BtnPrimary>
        </>
      )}

      <p style={{ textAlign:'center', fontSize:'13px', color:C.muted, marginTop:'16px' }}>
        이미 계정이 있으신가요?{' '}
        <button onClick={onSwitch} style={{ background:'none', border:'none', color:C.primary, fontWeight:600, cursor:'pointer', fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif' }}>
          로그인하기
        </button>
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 메인 VendorAuth
// mode: 'login' | 'register' | 'findId' | 'resetPw'
// ─────────────────────────────────────────────────────
export function VendorAuth({ onLogin }) {
  const [mode, setMode] = useState('login')

  return (
    <div style={{
      minHeight:'100vh', background:'linear-gradient(135deg, #fff7ed 0%, #fef3c7 50%, #fff7ed 100%)',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Noto Sans KR, sans-serif',
    }}>
      <div style={{
        width:'100%', maxWidth:'440px', background:'#fff',
        borderRadius:'20px', boxShadow:'0 8px 40px rgba(249,115,22,0.12)',
        padding:'40px 36px',
      }}>
        {/* 로고 */}
        <div style={{ textAlign:'center', marginBottom:'28px' }}>
          <div style={{ fontSize:'40px', marginBottom:'8px' }}>🎒</div>
          <div style={{ fontSize:'20px', fontWeight:700, color:C.text }}>방과후 출석부</div>
          <div style={{ fontSize:'13px', color:C.muted, marginTop:'4px' }}>업체 파트너 포털</div>
        </div>

        {/* 탭 버튼 — findId / resetPw 에서는 숨김 */}
        {(mode === 'login' || mode === 'register') && (
          <div style={{ display:'flex', background:'#f9fafb', borderRadius:'10px', padding:'4px', marginBottom:'24px' }}>
            {[['login','로그인'],['register','업체 가입']].map(([m,l])=>(
              <button key={m} onClick={()=>setMode(m)} style={{
                flex:1, padding:'9px', borderRadius:'8px', border:'none',
                background: mode===m ? C.primary : 'none',
                color: mode===m ? '#fff' : C.muted,
                fontWeight: mode===m ? 700 : 400,
                fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif',
                transition:'all .15s',
              }}>{l}</button>
            ))}
          </div>
        )}

        {mode === 'login'    && <LoginTab    onLogin={onLogin} onSwitch={()=>setMode('register')} onFindId={()=>setMode('findId')} onResetPw={()=>setMode('resetPw')} />}
        {mode === 'register' && <RegisterTab onDone={onLogin}  onSwitch={()=>setMode('login')} />}
        {mode === 'findId'   && <FindIdTab   onBack={()=>setMode('login')} />}
        {mode === 'resetPw'  && <ResetPwTab  onBack={()=>setMode('login')} />}

        <div style={{ textAlign:'center', marginTop:'24px', paddingTop:'20px', borderTop:`1px solid ${C.border}` }}>
          <a href="/" style={{ fontSize:'12px', color:C.muted, textDecoration:'none' }}>
            ← 방과후 출석부 관리자 페이지로 돌아가기
          </a>
        </div>
      </div>
    </div>
  )
}
