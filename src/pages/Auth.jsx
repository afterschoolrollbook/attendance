import React, { useState, useEffect, useRef } from 'react'
import { Users } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { Btn, Input } from '../components/Atoms.jsx'
import { Settings } from '../lib/db.js'

function getSocialConfig() {
  const saved = Settings.get('social') || {}
  return {
    google: { clientId: saved.googleEnabled ? (saved.googleClientId || '') : '' },
    kakao:  { appKey:   saved.kakaoEnabled  ? (saved.kakaoAppKey  || '') : '' },
  }
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// Google 로그인 훅 — renderButton 방식 (GSI 공식)
function useGoogleAuth(onSuccess, clientId) {
  const btnRef = useRef()
  const initialized = useRef(false)

  useEffect(() => {
    if (!clientId) return

    const initGoogle = () => {
      if (initialized.current) return
      if (!window.google?.accounts?.id) return
      initialized.current = true

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res) => {
          try {
            const payload = JSON.parse(atob(res.credential.split('.')[1]))
            onSuccess({
              provider: 'google',
              email: payload.email,
              name: payload.name,
              avatar: payload.picture,
              providerId: payload.sub,
            })
          } catch(e) {
            console.error('Google login parse error', e)
          }
        },
        ux_mode: 'popup',
        auto_select: false,
      })

      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 340,
        })
      }
    }

    // 이미 로드된 경우
    if (window.google?.accounts?.id) {
      initialized.current = false
      initGoogle()
      return
    }

    // 스크립트 로드
    const existing = document.getElementById('google-gsi-script')
    if (existing) {
      existing.addEventListener('load', initGoogle)
      return () => existing.removeEventListener('load', initGoogle)
    }

    const script = document.createElement('script')
    script.id = 'google-gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initGoogle
    document.head.appendChild(script)

    return () => {
      initialized.current = false
    }
  }, [clientId])

  return btnRef
}

// 카카오 로그인 훅
function useKakaoAuth(onSuccess, appKey) {
  useEffect(() => {
    if (!appKey) return
    const script = document.createElement('script')
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js'
    script.async = true
    script.onload = () => {
      if (!window.Kakao?.isInitialized()) {
        window.Kakao?.init(appKey)
      }
    }
    document.head.appendChild(script)
    return () => { try { document.head.removeChild(script) } catch {} }
  }, [appKey])

  const loginWithKakao = () => {
    if (!appKey) {
      alert('카카오 앱 키가 설정되지 않았습니다.\n관리자 페이지 → 서비스설정 → 소셜 로그인에서 등록하세요.')
      return
    }
    window.Kakao?.Auth.login({
      success: () => {
        window.Kakao?.API.request({
          url: '/v2/user/me',
          success: (res) => {
            const kakaoAcc = res.kakao_account
            onSuccess({
              provider: 'kakao',
              email: kakaoAcc?.email || '',
              name: kakaoAcc?.profile?.nickname || '',
              avatar: kakaoAcc?.profile?.thumbnail_image_url || '',
              providerId: String(res.id),
            })
          },
        })
      },
      fail: (err) => console.error('Kakao login fail', err),
    })
  }

  return loginWithKakao
}

// 소셜 로그인 처리 공통 함수
function handleSocialLogin(profile, onLogin) {
  const existing = Users.findByEmail(profile.email?.toLowerCase())
  if (existing) { onLogin(existing); return }

  const email = profile.email || `${profile.provider}_${profile.providerId}@social.local`
  const user = {
    id: uid(),
    name: profile.name || '소셜 사용자',
    email: email.toLowerCase(),
    pw: uid(),
    phone: '',
    role: 'teacher',
    level: 1,
    verified: false,
    verifyImg: null,
    permissionOverrides: {},
    provider: profile.provider,
    providerId: profile.providerId,
    avatar: profile.avatar || '',
    createdAt: now(),
  }
  Users.insert(user)
  onLogin(user)
}

// 메인 Auth 컴포넌트
export function Auth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', email: '', pw: '', pw2: '', phone: '' })
  const [emailChecked, setEmailChecked] = useState(false)
  const [error, setError] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [verified, setVerified] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const resetRegister = () => {
    setStep(1); setVerifyCode(''); setInputCode(''); setCodeSent(false); setVerified(false)
    setError(''); setEmailChecked(false)
  }

  const handleSocialSuccess = (profile) => handleSocialLogin(profile, onLogin)

  const socialCfg = getSocialConfig()
  const googleBtnRef = useGoogleAuth(handleSocialSuccess, socialCfg.google.clientId)
  const loginWithKakao = useKakaoAuth(handleSocialSuccess, socialCfg.kakao.appKey)
  const googleConfigured = !!socialCfg.google.clientId
  const kakaoConfigured  = !!socialCfg.kakao.appKey

  const handleLogin = () => {
    setError('')
    const user = Users.findByEmail(form.email.trim().toLowerCase())
    if (!user || user.pw !== form.pw) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    onLogin(user)
  }

  const handleNext = () => {
    setError('')
    if (!form.name.trim() || !form.email.trim() || !form.pw || !form.phone.trim()) {
      setError('필수 항목을 모두 입력해주세요.'); return
    }
    if (!emailChecked) { setError('이메일 중복 확인을 해주세요.'); return }
    if (form.pw.length < 4) { setError('비밀번호는 4자 이상이어야 합니다.'); return }
    if (form.pw !== form.pw2) { setError('비밀번호가 일치하지 않습니다.'); return }
    setStep(2)
  }

  const sendCode = () => {
    const code = generateCode()
    setVerifyCode(code); setCodeSent(true); setInputCode(''); setVerified(false); setError('')
    console.log(`[개발모드] 인증번호: ${code}`)
  }

  const checkCode = () => {
    if (inputCode.trim() === verifyCode) { setVerified(true); setError('') }
    else setError('인증번호가 올바르지 않습니다.')
  }

  const handleRegister = () => {
    if (!verified) { setError('이메일 인증을 완료해주세요.'); return }
    const user = {
      id: uid(), name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      pw: form.pw, phone: form.phone.trim(),
      role: 'teacher', level: 1, verified: false,
      verifyImg: null, permissionOverrides: {},
      provider: 'email', createdAt: now(),
    }
    Users.insert(user)
    onLogin(user)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff7ed 0%, #fff 60%, #f0fdf4 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827' }}>방과후 출석부</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px' }}>방과후 강사를 위한 스마트 출석 관리</p>
        </div>

        <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,0,0,0.1)', overflow: 'hidden' }}>

          <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6' }}>
            {['login','register'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); resetRegister(); setForm({name:'',email:'',pw:'',pw2:'',phone:''}) }}
                style={{ flex:1, padding:'16px', border:'none', cursor:'pointer', background:mode===m?'#fff':'#fafafa', fontWeight:mode===m?700:400, color:mode===m?'#f97316':'#6b7280', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', borderBottom:mode===m?'2px solid #f97316':'2px solid transparent', transition:'all .15s' }}>
                {m==='login'?'로그인':'회원가입'}
              </button>
            ))}
          </div>

          <div style={{ padding: '24px' }}>

            {/* 로그인 */}
            {mode === 'login' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {googleConfigured ? (
                    <div ref={googleBtnRef} style={{ width: '100%', minHeight: '44px' }} />
                  ) : (
                    <SocialBtn icon="🔵" label="Google로 계속하기" color="#4285F4" bg="#fff" border="#dadce0"
                      onClick={() => alert('Google 로그인을 사용하려면\n관리자 페이지 → 서비스설정 → 소셜 로그인에서 등록하세요.')} />
                  )}
                  <SocialBtn icon="💛" label="카카오로 계속하기" color="#3C1E1E" bg="#FEE500" border="#FEE500"
                    onClick={kakaoConfigured ? loginWithKakao : () => alert('카카오 로그인을 사용하려면\n관리자 페이지 → 서비스설정 → 소셜 로그인에서 등록하세요.')} />
                  {(() => {
                    const naverCfg = (Settings.get('social') || {})
                    const naverEnabled = naverCfg.naverEnabled && naverCfg.naverClientId
                    return (
                      <SocialBtn icon="🟢" label="네이버로 계속하기" color="#fff" bg="#03C75A" border="#03C75A"
                        onClick={() => naverEnabled
                          ? alert('네이버 로그인: 관리자가 클라이언트 ID를 설정하면 활성화됩니다.')
                          : alert('관리자 페이지 → 서비스설정 → 소셜 로그인에서 네이버 키를 등록하세요.')}
                        disabled={!naverEnabled} />
                    )
                  })()}
                </div>

                <Divider label="또는 이메일로 로그인" />
                <Input label="이메일" value={form.email} onChange={v => set('email', v)} placeholder="admin@test.com" type="email" />
                <Input label="비밀번호" value={form.pw} onChange={v => set('pw', v)} placeholder="비밀번호" type="password" />
                {error && <ErrBox msg={error} />}
                <Btn full onClick={handleLogin}>로그인</Btn>
                <div style={{ textAlign:'center', fontSize:'12px', color:'#9ca3af' }}>
                  테스트: admin@test.com / admin1234 &nbsp;|&nbsp; teacher@test.com / 1234
                </div>
              </div>
            )}

            {/* 회원가입 Step 1 */}
            {mode === 'register' && step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textAlign: 'center', marginBottom: '2px' }}>소셜 간편가입</div>
                  {googleConfigured ? (
                    <div ref={googleBtnRef} style={{ width: '100%', minHeight: '44px' }} />
                  ) : (
                    <SocialBtn icon="🔵" label="Google로 간편가입" color="#4285F4" bg="#fff" border="#dadce0"
                      onClick={() => alert('관리자 페이지 → 서비스설정 → 소셜 로그인에서 Google 키를 등록하세요.')} />
                  )}
                  <SocialBtn icon="💛" label="카카오로 간편가입" color="#3C1E1E" bg="#FEE500" border="#FEE500"
                    onClick={kakaoConfigured ? loginWithKakao : () => alert('관리자 페이지 → 서비스설정 → 소셜 로그인에서 카카오 키를 등록하세요.')} />
                </div>
                <Divider label="또는 이메일로 가입" />
                <Input label="이름" value={form.name} onChange={v => set('name', v)} placeholder="홍길동" required />
                <EmailInputWithCheck
                  value={form.email} onChange={v => { set('email', v); setEmailChecked(false) }}
                  onChecked={(ok) => setEmailChecked(ok)}
                />
                <Input label="연락처" value={form.phone} onChange={v => set('phone', v)} placeholder="010-0000-0000" required />
                <Input label="비밀번호 (4자 이상)" value={form.pw} onChange={v => set('pw', v)} type="password" placeholder="비밀번호" required />
                <Input label="비밀번호 확인" value={form.pw2} onChange={v => set('pw2', v)} type="password" placeholder="재입력" required />
                {error && <ErrBox msg={error} />}
                <Btn full onClick={handleNext}>다음 — 이메일 인증 →</Btn>
              </div>
            )}

            {/* 회원가입 Step 2 */}
            {mode === 'register' && step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <span style={{ color: '#16a34a', fontWeight: 700 }}>① 정보 입력 ✓</span>
                  <span style={{ color: '#9ca3af' }}>→</span>
                  <span style={{ color: '#f97316', fontWeight: 700 }}>② 이메일 인증</span>
                </div>
                <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: '10px', border: '1.5px solid #bfdbfe', fontSize: '13px', color: '#1e40af', lineHeight: 1.7 }}>
                  <strong>{form.email}</strong>으로 인증번호를 발송합니다.
                </div>
                {!verified && (
                  <button onClick={sendCode}
                    style={{ padding: '10px', borderRadius: '9px', border: '1.5px solid #f97316', background: '#fff7ed', color: '#f97316', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
                    📧 {codeSent ? '인증번호 재발송' : '인증번호 발송'}
                  </button>
                )}
                {codeSent && !verified && (
                  <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1.5px solid #fde68a', fontSize: '13px' }}>
                    <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>🔧 개발 모드 — 인증번호 확인</div>
                    <div style={{ color: '#b45309' }}>인증번호: <strong style={{ fontSize: '22px', letterSpacing: '5px', color: '#f97316' }}>{verifyCode}</strong></div>
                  </div>
                )}
                {codeSent && !verified && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={inputCode} onChange={e => setInputCode(e.target.value)}
                      placeholder="인증번호 6자리"
                      onKeyDown={e => e.key === 'Enter' && checkCode()}
                      maxLength={6}
                      style={{ flex:1, padding:'10px 14px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'18px', fontFamily:'Noto Sans KR, sans-serif', letterSpacing:'6px', textAlign:'center', outline:'none' }} />
                    <Btn onClick={checkCode}>확인</Btn>
                  </div>
                )}
                {verified && (
                  <div style={{ padding:'12px', background:'#f0fdf4', borderRadius:'10px', border:'1.5px solid #86efac', fontSize:'14px', fontWeight:700, color:'#15803d', textAlign:'center' }}>
                    ✅ 이메일 인증 완료!
                  </div>
                )}
                {error && <ErrBox msg={error} />}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Btn variant="ghost" onClick={() => { setStep(1); setError('') }} style={{ flex: 1 }}>← 뒤로</Btn>
                  <Btn onClick={handleRegister} disabled={!verified} style={{ flex: 2 }}>가입 완료</Btn>
                </div>
              </div>
            )}
          </div>
        </div>

        {(!googleConfigured || !kakaoConfigured) && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(255,255,255,0.8)', borderRadius: '10px', fontSize: '11px', color: '#9ca3af', lineHeight: 1.8 }}>
            💡 소셜 로그인 활성화: 관리자 로그인 → 서비스설정 → 소셜 로그인에서 키를 등록하세요
          </div>
        )}
      </div>
    </div>
  )
}

function SocialBtn({ icon, label, color, bg, border, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width:'100%', padding:'10px 16px', borderRadius:'10px', border:`1.5px solid ${border}`, background:bg, color, fontSize:'14px', fontWeight:600, cursor:disabled?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity:disabled?0.5:1, transition:'all .15s' }}>
      <span>{icon}</span>{label}
    </button>
  )
}

function Divider({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', color:'#9ca3af', fontSize:'12px' }}>
      <div style={{ flex:1, height:'1px', background:'#e5e7eb' }} />
      <span>{label}</span>
      <div style={{ flex:1, height:'1px', background:'#e5e7eb' }} />
    </div>
  )
}

function EmailInputWithCheck({ value, onChange, onChecked }) {
  const [state, setState] = useState(null)

  const check = () => {
    if (!value.trim()) { setState({ ok:false, msg:'이메일을 입력해주세요.' }); return }
    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailReg.test(value.trim())) { setState({ ok:false, msg:'올바른 이메일 형식이 아닙니다.' }); onChecked(false); return }
    const dup = Users.findByEmail(value.trim().toLowerCase())
    if (dup) {
      setState({ ok:false, msg:'이미 사용 중인 이메일입니다.' }); onChecked(false)
    } else {
      setState({ ok:true, msg:'사용 가능한 이메일입니다.' }); onChecked(true)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <label style={{ fontSize:'13px', fontWeight:500, color:'#111827' }}>이메일 (아이디) <span style={{ color:'#ef4444' }}>*</span></label>
      <div style={{ display:'flex', gap:'8px' }}>
        <input type="email" value={value}
          onChange={e => { onChange(e.target.value); setState(null); onChecked(false) }}
          placeholder="example@email.com"
          style={{ flex:1, padding:'9px 13px', borderRadius:'9px', border:`1.5px solid ${state ? (state.ok?'#86efac':'#fca5a5') : '#e5e7eb'}`, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
        <button onClick={check}
          style={{ padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${state?.ok ? '#86efac' : '#e5e7eb'}`, background:state?.ok?'#f0fdf4':'#fff', color:state?.ok?'#16a34a':'#374151', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', minWidth:'76px', transition:'all .15s' }}>
          {state?.ok ? '✅ 확인됨' : '중복 확인'}
        </button>
      </div>
      {state && (
        <div style={{ fontSize:'12px', color:state.ok?'#16a34a':'#ef4444', display:'flex', alignItems:'center', gap:'4px' }}>
          {state.ok ? '✓' : '✗'} {state.msg}
        </div>
      )}
    </div>
  )
}

function ErrBox({ msg }) {
  return <div style={{ fontSize:'13px', color:'#ef4444', background:'#fef2f2', padding:'10px 14px', borderRadius:'8px', border:'1px solid #fca5a5' }}>{msg}</div>
}
