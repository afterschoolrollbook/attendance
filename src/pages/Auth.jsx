import React, { useState, useEffect, useRef } from 'react'
import { Users, initFromSupabase } from '../lib/db.js'
import { uid, now } from '../lib/utils.js'
import { Btn, Input } from '../components/Atoms.jsx'
import { Settings } from '../lib/db.js'
import { sendEmail, isConfigured, authSignIn, authSignUp, authResetPassword, supabase, dbCall } from '../lib/supabase.js'
import { useToast } from '../hooks/useToast.js'

function getSocialConfig() {
  const saved = Settings.get('social') || {}
  return {
    google: { clientId:  saved.googleEnabled ? (saved.googleClientId  || '') : '' },
    kakao:  { appKey:    saved.kakaoEnabled  ? (saved.kakaoAppKey    || '') : '' },
    naver:  { clientId:  saved.naverEnabled  ? (saved.naverClientId  || '') : '' },
  }
}

// [보안] 인증번호 서버 측 발급·검증
async function sendVerifyCode(email) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  if (!isConfigured || !supabase) {
    return { dev: true, devCode: code }
  }

  try {
    await supabase
      .from('verify_codes')
      .update({ used: true })
      .eq('target', email.toLowerCase())
      .eq('used', false)

    await supabase.from('verify_codes').insert({
      target:     email.toLowerCase(),
      code,
      purpose:    'signup',
      used:       false,
      expires_at: expiresAt,
    })

    await sendEmail(email, code)
    return { sent: true }
  } catch(e) {
    console.error('인증번호 발송 실패:', e)
    return { error: true }
  }
}

async function verifyCode(email, inputCode) {
  if (!isConfigured || !supabase) return false

  const { data: rows } = await supabase
    .from('verify_codes')
    .select('id, expires_at')
    .eq('target', email.toLowerCase())
    .eq('code', inputCode.trim())
    .eq('used', false)
    .limit(1)

  if (!rows || rows.length === 0) return false
  const row = rows[0]
  if (new Date(row.expires_at) < new Date()) return false

  await supabase.from('verify_codes').update({ used: true }).eq('id', row.id)
  return true
}

async function sendResetCode(email) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  if (!isConfigured || !supabase) {
    return { dev: true, devCode: code }
  }

  try {
    await supabase
      .from('verify_codes')
      .update({ used: true })
      .eq('target', email.toLowerCase())
      .eq('purpose', 'reset')
      .eq('used', false)

    await supabase.from('verify_codes').insert({
      target:     email.toLowerCase(),
      code,
      purpose:    'reset',
      used:       false,
      expires_at: expiresAt,
    })

    await sendEmail(email, code)
    return { sent: true }
  } catch(e) {
    return { error: true }
  }
}

async function verifyResetCode(email, inputCode) {
  if (!isConfigured || !supabase) return false

  const { data: rows } = await supabase
    .from('verify_codes')
    .select('id, expires_at')
    .eq('target', email.toLowerCase())
    .eq('code', inputCode.trim())
    .eq('purpose', 'reset')
    .eq('used', false)
    .limit(1)

  if (!rows || rows.length === 0) return false
  if (new Date(rows[0].expires_at) < new Date()) return false

  await supabase.from('verify_codes').update({ used: true }).eq('id', rows[0].id)
  return true
}

function isGarbled(str) {
  if (!str) return true
  return /[ë¬ìíê°-ÿ]{2,}/.test(str)
}

let _googleGsiInitialized = false

function useGoogleAuth(onSuccess, clientId) {
  const loginBtnRef    = useRef()
  const registerBtnRef = useRef()

  const renderButtons = () => {
    if (!window.google?.accounts?.id || !_googleGsiInitialized) return
    const configs = [
      { ref: loginBtnRef,    text: 'continue_with' },
      { ref: registerBtnRef, text: 'signup_with'   },
    ]
    configs.forEach(({ ref, text }) => {
      if (ref.current) {
        ref.current.innerHTML = ''
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard', theme: 'outline', size: 'large',
          text, shape: 'rectangular', width: 340,
        })
      }
    })
  }

  useEffect(() => {
    if (!clientId) return

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return
      if (!_googleGsiInitialized) {
        _googleGsiInitialized = true
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => {
            try {
              const base64url = res.credential.split('.')[1]
              const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
              const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4)
              const payload = JSON.parse(decodeURIComponent(
                atob(padded).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
              ))
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
      }
      renderButtons()
    }

    if (window.google?.accounts?.id) {
      initGoogle()
      return
    }

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
  }, [clientId])

  return { loginBtnRef, registerBtnRef, renderButtons }
}

function useKakaoAuth(onSuccess, restApiKey) {
  const { error: toastError } = useToast()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('kakao_redirect')) return
    window.history.replaceState({}, '', window.location.pathname)
    const raw = sessionStorage.getItem('kakao_login_result')
    if (!raw) return
    sessionStorage.removeItem('kakao_login_result')
    const data = JSON.parse(raw)
    if (data.type === 'kakao_login_fail') { toastError('카카오 로그인에 실패했습니다.'); return }
    const process = async () => {
      try {
        const redirectUri = window.location.origin + '/kakao-callback'
        const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
        const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        const res = await fetch(SUPABASE_URL + '/functions/v1/kakao-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_ANON },
          body: JSON.stringify({ code: data.code, clientId: restApiKey, redirectUri }),
        })
        const result = await res.json()
        if (!result.success) throw new Error(result.error || '카카오 로그인 실패')
        if (result.session && supabase) { await supabase.auth.setSession(result.session) }
        onSuccess({ provider: 'kakao', email: result.data.email || '', name: result.data.name || '', avatar: result.data.profile_image || '', providerId: String(result.data.id) })
      } catch(err) {
        console.error('카카오 토큰 교환 실패:', err)
        toastError('카카오 로그인에 실패했습니다: ' + err.message)
      }
    }
    process()
  }, [])

  const loginWithKakao = () => {
    if (!restApiKey) { toastError('카카오 앱 키가 설정되지 않았습니다.\n관리자 → 서비스설정 → 소셜 로그인에서 등록하세요.'); return }

    const redirectUri = window.location.origin + '/kakao-callback'
    const kakaoAuthUrl = 'https://kauth.kakao.com/oauth/authorize?client_id=' + restApiKey + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&response_type=code'

    const popup = window.open(kakaoAuthUrl, 'kakaoLogin', 'width=500,height=700,left=200,top=100')
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.href = kakaoAuthUrl + '&kakao_redirect=1'
      return
    }

    const handleMessage = async (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type !== 'kakao_callback' && e.data?.type !== 'kakao_login_fail') return
      window.removeEventListener('message', handleMessage)
      if (e.data.type === 'kakao_login_fail') { toastError('카카오 로그인에 실패했습니다.'); return }
      try {
        const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
        const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        const res = await fetch(SUPABASE_URL + '/functions/v1/kakao-oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_ANON },
          body: JSON.stringify({ code: e.data.code, clientId: restApiKey, redirectUri }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || '카카오 로그인 실패')
        if (data.session && supabase) { await supabase.auth.setSession(data.session) }
        onSuccess({ provider: 'kakao', email: data.data.email || '', name: data.data.name || '', avatar: data.data.profile_image || '', providerId: String(data.data.id) })
      } catch(err) {
        console.error('카카오 토큰 교환 실패:', err)
        toastError('카카오 로그인에 실패했습니다: ' + err.message)
      }
    }
    window.addEventListener('message', handleMessage)
  }

  return loginWithKakao
}

function useNaverAuth(onSuccess, clientId) {
  const { error: toastError } = useToast()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('naver_redirect')) return
    window.history.replaceState({}, '', window.location.pathname)
    const raw = sessionStorage.getItem('naver_login_result')
    if (!raw) return
    sessionStorage.removeItem('naver_login_result')
    const data = JSON.parse(raw)
    if (data.type === 'naver_login_fail') { toastError('네이버 로그인에 실패했습니다.'); return }
    const process = async () => {
      if (data.session && supabase) { await supabase.auth.setSession(data.session) }
      await initFromSupabase()
      onSuccess({ provider: 'naver', email: data.email || '', name: data.name || '', avatar: data.avatar || '', providerId: String(data.id) })
    }
    process()
  }, [])

  const loginWithNaver = () => {
    if (!clientId) { toastError('네이버 클라이언트 ID가 설정되지 않았습니다.\n관리자 → 서비스설정 → 소셜 로그인에서 등록하세요.'); return }

    const state = Math.random().toString(36).substring(2, 15)
    const redirectUri = window.location.origin + '/naver-callback'
    const naverAuthUrl = 'https://nid.naver.com/oauth2.0/authorize?client_id=' + clientId
      + '&redirect_uri=' + encodeURIComponent(redirectUri)
      + '&response_type=code'
      + '&state=' + state

    const popup = window.open(naverAuthUrl, 'naverLogin', 'width=500,height=700,left=200,top=100')

    const handleMessage = async (e) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type !== 'naver_login_success' && e.data?.type !== 'naver_login_fail') return
      window.removeEventListener('message', handleMessage)
      clearInterval(popupCheck)
      if (e.data.type === 'naver_login_fail') { toastError('네이버 로그인에 실패했습니다.'); return }
      if (e.data.session && supabase) { await supabase.auth.setSession(e.data.session) }
      await initFromSupabase()
      onSuccess({ provider: 'naver', email: e.data.email || '', name: e.data.name || '', avatar: e.data.avatar || '', providerId: String(e.data.id) })
    }
    window.addEventListener('message', handleMessage)

    const popupCheck = setInterval(() => {
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        clearInterval(popupCheck)
        window.removeEventListener('message', handleMessage)
        window.location.href = naverAuthUrl + '&naver_redirect=1'
      }
    }, 500)
  }

  return loginWithNaver
}

function SocialEmailVerify({ profile, onVerified, onCancel }) {
  const isKakao = profile.provider === 'kakao'
  const isFakeEmail = (e) => !e || e.includes('@social.local')

  const [emailInput, setEmailInput] = useState(isFakeEmail(profile.email) ? '' : (profile.email || ''))
  const [code,       setCode]       = useState('')
  const [codeSent,   setCodeSent]   = useState(false)
  const [sending,    setSending]    = useState(false)
  const [isDev,      setIsDev]      = useState(false)
  const [devCode,    setDevCode]    = useState('')
  const [error,      setError]      = useState('')
  const [useOtherEmail, setUseOtherEmail] = useState(false)
  const [otherEmail,    setOtherEmail]    = useState('')

  const targetEmail = isKakao ? emailInput.trim() : useOtherEmail ? otherEmail.trim() : profile.email

  const handleSend = async () => {
    setError('')
    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (isKakao) {
      if (!emailInput.trim()) { setError('이메일을 입력해주세요.'); return }
      if (!emailReg.test(emailInput.trim())) { setError('올바른 이메일 형식이 아닙니다.'); return }
    }
    if (useOtherEmail) {
      if (!otherEmail.trim()) { setError('이메일을 입력해주세요.'); return }
      if (!emailReg.test(otherEmail.trim())) { setError('올바른 이메일 형식이 아닙니다.'); return }
    }
    const dup = Users.findByEmail(targetEmail.toLowerCase())
    if (dup) {
      setError('이미 가입된 이메일입니다.\n회원이시면 해당 이메일로 로그인해 주시길 바랍니다!')
      return
    }
    setSending(true)
    const result = await sendVerifyCode(targetEmail)
    setSending(false)
    setCodeSent(true)
    setIsDev(!!result.dev)
    setDevCode(result.devCode || '')
  }

  const handleVerify = async () => {
    if (isDev) {
      if (code.trim() !== devCode) { setError('인증번호가 올바르지 않습니다.'); return }
      onVerified(targetEmail)
      return
    }
    const ok = await verifyCode(targetEmail, code)
    if (!ok) { setError('인증번호가 올바르지 않거나 만료되었습니다.'); return }
    onVerified(targetEmail)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        {profile.avatar && (
          <img src={profile.avatar} alt="" style={{ width: 56, height: 56, borderRadius: '50%', marginBottom: 8 }} />
        )}
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>이메일 인증</div>
      </div>

      {isKakao ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>💛 실제로 사용하시는 이메일 주소 입력 <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="email"
            value={emailInput}
            onChange={e => { setEmailInput(e.target.value); setCodeSent(false); setCode('') }}
            placeholder="example@email.com"
            style={{ padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }}
          />
          <div style={{ fontSize: '12px', color: '#6b7280' }}>평소 실제로 사용하시는 이메일 주소를 입력해주세요.</div>
        </div>
      ) : (
        <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: '10px', border: '1.5px solid #bfdbfe', fontSize: '13px', color: '#1e40af' }}>
          <div style={{ marginBottom: '10px', fontSize: '14px', color: '#1e40af', lineHeight: '1.8' }}>
            안녕하세요~!<br/>
            방과후 출석부를 찾아오신 선생님 반갑습니다!<br/>
            대한민국 교육의 한 축을 이루고 있는 방과후 교육을 담당하고 계신 선생님 감사합니다!
          </div>
          <div style={{ marginBottom: '10px', fontSize: '13px', color: '#1e40af', lineHeight: '1.8' }}>
            선생님께서는 처음 방문하신 선생님이셔서 불편하시더라도<br/>
            실 사용하시는 이메일 인증을 통해 입장을 하고 있으니 양해 부탁드립니다.
          </div>
          <div style={{ marginBottom: '10px', fontSize: '13px', color: '#1e40af', lineHeight: '1.8' }}>
            방과후 출석부는 무료회원가입으로 기본 출석부 기능을 사용하실수 있습니다!
          </div>
          <div style={{ fontSize: '13px', color: '#1e40af' }}>
            <strong>{useOtherEmail ? otherEmail : profile.email}</strong>으로 인증번호를 발송합니다.
          </div>
          {!codeSent && (
            <div style={{ marginTop: '10px' }}>
              {!useOtherEmail ? (
                <button onClick={() => { setUseOtherEmail(true); setCodeSent(false); setCode('') }}
                  style={{ fontSize: '12px', color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Noto Sans KR, sans-serif' }}>
                  다른 이메일로 인증받기
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  <input
                    type="email"
                    value={otherEmail}
                    onChange={e => setOtherEmail(e.target.value)}
                    placeholder="다른 이메일 주소 입력"
                    style={{ padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #f97316', fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }}
                  />
                  <button onClick={() => { setUseOtherEmail(false); setOtherEmail('') }}
                    style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Noto Sans KR, sans-serif', textAlign: 'left' }}>
                    원래 이메일로 돌아가기
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!codeSent ? (
        <button onClick={handleSend} disabled={sending}
          style={{ padding: '11px', borderRadius: '9px', border: '1.5px solid #f97316', background: '#fff7ed', color: '#f97316', fontSize: '13px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif', opacity: sending ? 0.7 : 1 }}>
          {sending ? '발송 중...' : '📧 인증번호 발송'}
        </button>
      ) : (
        <>
          {isDev && (
            <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1.5px solid #fde68a', fontSize: '13px' }}>
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>🔧 개발 모드 (Resend 미설정)</div>
              <div style={{ color: '#b45309' }}>인증번호: <strong style={{ fontSize: '22px', letterSpacing: '5px', color: '#f97316' }}>{devCode}</strong></div>
            </div>
          )}
          {!isDev && (
            <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1.5px solid #86efac', fontSize: '13px', color: '#15803d', fontWeight: 600 }}>
              ✅ {targetEmail}로 인증번호를 발송했습니다.
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={code} onChange={e => setCode(e.target.value)}
              placeholder="인증번호 6자리"
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              maxLength={6}
              style={{ flex:1, padding:'10px 14px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'18px', fontFamily:'Noto Sans KR, sans-serif', letterSpacing:'6px', textAlign:'center', outline:'none' }} />
            <button onClick={handleSend} style={{ padding:'10px 12px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>재발송</button>
          </div>
          {error && <div style={{ fontSize:'13px', color:'#ef4444', background:'#fef2f2', padding:'10px 14px', borderRadius:'8px', border:'1px solid #fca5a5' }}>{error}</div>}
          <button onClick={handleVerify}
            style={{ padding:'11px', borderRadius:'9px', border:'none', background:'#f97316', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            확인
          </button>
        </>
      )}

      {error && !codeSent && (
        <div style={{ fontSize:'13px', color:'#ef4444', background:'#fef2f2', padding:'10px 14px', borderRadius:'8px', border:'1px solid #fca5a5', whiteSpace:'pre-line' }}>
          {error}
          {error.includes('가입된 이메일') && (
            <div style={{ marginTop:'10px' }}>
              <button onClick={onCancel}
                style={{ width:'100%', padding:'8px', borderRadius:'7px', border:'1.5px solid #ef4444', background:'#fff', color:'#ef4444', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                🔐 로그인하러 가기
              </button>
            </div>
          )}
        </div>
      )}

      <button onClick={onCancel}
        style={{ padding:'9px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
        취소
      </button>
    </div>
  )
}

function SocialProfileForm({ profile, onComplete }) {
  const isKakao = profile.provider === 'kakao'
  const isFakeEmail = (e) => !e || e.includes('@social.local')

  const [name,  setName]  = useState(isGarbled(profile.name) ? '' : (profile.name || ''))
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(isFakeEmail(profile.email) ? '' : (profile.email || ''))
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!name.trim()) { setError('이름을 입력해주세요.'); return }
    if (!phone.trim()) { setError('연락처를 입력해주세요.'); return }
    onComplete({ name: name.trim(), phone: phone.trim(), email: email || profile.email })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        {profile.avatar && (
          <img src={profile.avatar} alt="" style={{ width: 56, height: 56, borderRadius: '50%', marginBottom: 8 }} />
        )}
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>프로필 정보 입력</div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: 4 }}>
          {isKakao ? '💛 카카오 로그인' : profile.email}
        </div>
      </div>
      <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: '10px', border: '1.5px solid #bfdbfe', fontSize: '13px', color: '#1e40af', lineHeight: 1.7 }}>
        서비스 이용을 위해 아래 정보를 입력해주세요.<br/>
        {isKakao && <span style={{ fontWeight: 700 }}>📧 이메일은 실제로 사용하시는 이메일 주소를 입력해주세요.<br/>인증번호 수신 및 중요 알림에 사용됩니다.</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>이름 <span style={{ color: '#ef4444' }}>*</span></label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동"
          style={{ padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>연락처 <span style={{ color: '#ef4444' }}>*</span></label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000"
          style={{ padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #e5e7eb', fontSize: '14px', fontFamily: 'Noto Sans KR, sans-serif', outline: 'none' }} />
      </div>

      {isKakao && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>이메일</label>
          <div style={{ padding: '9px 13px', borderRadius: '9px', border: '1.5px solid #86efac', background: '#f0fdf4', fontSize: '14px', color: '#15803d', fontFamily: 'Noto Sans KR, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✅</span>
            <span style={{ fontWeight: 600 }}>{email}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>인증 완료된 이메일입니다. 변경하려면 이전 단계로 돌아가세요.</div>
        </div>
      )}

      {error && <div style={{ fontSize:'13px', color:'#ef4444', background:'#fef2f2', padding:'10px 14px', borderRadius:'8px', border:'1px solid #fca5a5' }}>{error}</div>}
      <button onClick={handleSubmit}
        style={{ padding:'11px', borderRadius:'9px', border:'none', background:'#f97316', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
        시작하기 →
      </button>
    </div>
  )
}

export function Auth({ onLogin, initialTab }) {
  const [mode, setMode] = useState(initialTab === 'signup' ? 'register' : 'login')
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', email: '', pw: '', pw2: '', phone: '' })
  const [emailChecked, setEmailChecked] = useState(false)
  const [error, setError] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [verified, setVerified] = useState(false)
  const [sending, setSending] = useState(false)
  const [isDev, setIsDev] = useState(false)

  const [findIdPhone, setFindIdPhone] = useState('')
  const [foundEmail,  setFoundEmail]  = useState(null)

  const [fpEmail,    setFpEmail]    = useState('')
  const [fpCode,     setFpCode]     = useState('')
  const [fpCodeSent, setFpCodeSent] = useState(false)
  const [fpVerified, setFpVerified] = useState(false)
  const [fpNewPw,    setFpNewPw]    = useState('')
  const [fpNewPw2,   setFpNewPw2]   = useState('')
  const [fpSending,  setFpSending]  = useState(false)
  const [fpDev,      setFpDev]      = useState('')
  const [fpDone,     setFpDone]     = useState(false)

  const [socialStep, setSocialStep] = useState(null)
  const [pendingSocialProfile, setPendingSocialProfile] = useState(null)

  const [terms, setTerms] = useState({ service: false, privacy: false, marketing: false, thirdParty: false })
  const allRequired = terms.service && terms.privacy
  const toggleTerm = (k) => setTerms(p => ({ ...p, [k]: !p[k] }))

  const { error: toastError } = useToast()
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const resetRegister = () => {
    setStep(1); setVerifyCode(''); setInputCode(''); setCodeSent(false); setVerified(false)
    setError(''); setEmailChecked(false); setSending(false); setIsDev(false)
  }

  const goMode = (m) => {
    setMode(m); setError('')
    setFindIdPhone(''); setFoundEmail(null)
    setFpEmail(''); setFpCode(''); setFpCodeSent(false)
    setFpVerified(false); setFpNewPw(''); setFpNewPw2(''); setFpDev(''); setFpDone(false)
    resetRegister()
    setForm({ name:'', email:'', pw:'', pw2:'', phone:'' })
  }

  const handleFindId = () => {
    const phone = findIdPhone.trim()
    if (!phone) { setError('연락처를 입력해주세요.'); return }
    const all = Users.all()
    const normalize = (p) => p.replace(/-/g, "")
    const user = all.find(u => normalize(u.phone) === normalize(phone))
    if (!user) { setFoundEmail('notfound'); return }
    const [local, domain] = user.email.split('@')
    const half = Math.ceil(local.length / 2)
    const masked = local.slice(0, half) + '*'.repeat(local.length - half) + '@' + domain
    setFoundEmail(masked)
    setError('')
  }

  const handleFpSend = async () => {
    setError('')
    const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!fpEmail.trim()) { setError('이메일을 입력해주세요.'); return }
    if (!emailReg.test(fpEmail.trim())) { setError('올바른 이메일 형식이 아닙니다.'); return }
    const all = Users.all()
    const user = all.find(u => u.email === fpEmail.trim().toLowerCase())
    if (!user) { setError('등록되지 않은 이메일입니다.'); return }
    if (user.provider && user.provider !== 'email') {
      setError(`${user.provider === 'google' ? 'Google' : user.provider === 'kakao' ? '카카오' : '네이버'} 소셜 로그인 계정입니다.\n해당 소셜 서비스에서 비밀번호를 관리해주세요.`)
      return
    }
    setFpSending(true)
    const result = await sendResetCode(fpEmail.trim().toLowerCase())
    setFpSending(false)
    setFpCodeSent(true)
    setFpDev(result.dev ? result.devCode : '')
  }

  const handleFpVerify = async () => {
    if (fpDev) {
      if (fpCode.trim() !== fpDev) { setError('인증번호가 올바르지 않습니다.'); return }
      setFpVerified(true); setError(''); return
    }
    const ok = await verifyResetCode(fpEmail.trim().toLowerCase(), fpCode)
    if (!ok) { setError('인증번호가 올바르지 않거나 만료되었습니다.'); return }
    setFpVerified(true); setError('')
  }

  const handleFpReset = async () => {
    if (fpNewPw.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return }
    if (!/[a-zA-Z]/.test(fpNewPw) || !/[0-9]/.test(fpNewPw)) { setError('비밀번호는 영문과 숫자를 모두 포함해야 합니다.'); return }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(fpNewPw)) { setError('비밀번호는 특수문자를 하나 이상 포함해야 합니다.'); return }
    if (fpNewPw !== fpNewPw2) { setError('비밀번호가 일치하지 않습니다.'); return }
    try {
      await authResetPassword(fpEmail.trim().toLowerCase())
      setFpDone(true); setError('')
    } catch (e) {
      setError(e.message || '오류가 발생했습니다.')
    }
  }

  const isFakeEmail = (email) => !email || email.includes('@social.local')

  const handleSocialSuccess = async (profile) => {
    const email = profile.email?.toLowerCase() || ''
    let existing = null

    if (supabase) {
      try {
        const toCamel = (obj) => {
          if (!obj) return null
          const result = {}
          for (const [k, v] of Object.entries(obj)) {
            const camel = k.startsWith('_') ? k : k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
            result[camel] = Array.isArray(v) ? v : (v !== null && typeof v === 'object' ? toCamel(v) : v)
          }
          return result
        }
        if (profile.providerId) {
          const { data } = await supabase.from('users').select('*').eq('provider_id', String(profile.providerId)).maybeSingle()
          if (data) existing = toCamel(data)
        }
        if (!existing && email && !isFakeEmail(email)) {
          const { data } = await supabase.from('users').select('*').eq('email', email).maybeSingle()
          if (data) existing = toCamel(data)
        }
      } catch (e) {
        console.warn('[Auth] Supabase 직접 조회 실패:', e.message)
      }
    }

    if (existing) {
      if (profile.providerId && (!existing.providerId || existing.providerId === 'undefined')) {
        Users.update(existing.id, { providerId: profile.providerId, provider: profile.provider })
        existing = Users.find(existing.id) || existing
      }
      if (isGarbled(existing.name) || !existing.phone) {
        setPendingSocialProfile({ ...profile, existingId: existing.id })
        setSocialStep('profile')
        return
      }
      if (profile.provider === 'kakao' && isFakeEmail(existing.email)) {
        setPendingSocialProfile({ ...profile, existingId: existing.id })
        setSocialStep('email_verify')
        return
      }
      onLogin(existing)
      return
    }

    setPendingSocialProfile(profile)
    if (profile.provider === 'kakao') {
      setSocialStep('email_verify')
    } else {
      setSocialStep(email ? 'email_verify' : 'profile')
    }
  }

  const handleEmailVerified = (verifiedEmail) => {
    const email = verifiedEmail || pendingSocialProfile?.email
    if (email) {
      setPendingSocialProfile(prev => ({ ...prev, email }))
      const existingByEmail = Users.findByEmail(email)
      if (existingByEmail) {
        if (pendingSocialProfile?.providerId) {
          Users.update(existingByEmail.id, {
            provider: pendingSocialProfile.provider,
            providerId: pendingSocialProfile.providerId,
          })
        }
        setSocialStep(null)
        setPendingSocialProfile(null)
        onLogin(Users.find(existingByEmail.id) || existingByEmail)
        return
      }
    }
    setSocialStep('profile')
  }

  // ─────────────────────────────────────────────────────────────
  // 소셜 신규 회원 생성
  //
  // 카카오·네이버는 Edge Function(naver-oauth/kakao-oauth)에서
  // 이미 Supabase Auth 계정을 생성하고 session을 반환합니다.
  // 따라서 이 시점에 authSignUp을 호출하면 "User already registered"
  // 에러가 발생할 수 있습니다.
  //
  // 처리 순서:
  // 1. authSignUp 성공 → authUser.id를 authId로 사용
  // 2. authSignUp 실패 → 현재 세션(setSession으로 이미 설정된)에서
  //    supabase.auth.getUser()로 uid를 가져와 authId로 사용
  // 3. 세션도 없으면 authId = '' 로 저장하되,
  //    users 테이블에는 정상 저장 (이후 로그인 시 auth_id 업데이트 가능)
  // ─────────────────────────────────────────────────────────────
  const handleProfileComplete = async ({ name, phone, email: inputEmail }) => {
    const profile = pendingSocialProfile
    setSocialStep(null)
    setPendingSocialProfile(null)

    const email = (inputEmail?.trim().toLowerCase()) || (profile.email?.toLowerCase()) || `${profile.provider}_${profile.providerId}@social.local`

    const existing = profile.existingId
      ? Users.find(profile.existingId)
      : (!isFakeEmail(email) ? Users.findByEmail(email) : null)

    if (existing) {
      const updated = Users.update(existing.id, { name, phone, email })
      onLogin(updated)
      return
    }

    // authId 확보: authSignUp 시도 → 실패 시 현재 세션에서 uid 가져오기
    let authId = ''
    try {
      const { user: authUser } = await authSignUp(email.toLowerCase(), uid() + uid())
      authId = authUser?.id || ''
    } catch {
      // 이미 Auth 계정이 있는 경우(카카오·네이버 Edge Function이 생성한 계정)
      // setSession으로 세션이 설정돼 있으므로 getUser로 uid를 가져온다
      if (supabase) {
        try {
          const { data: { user: sessionUser } } = await supabase.auth.getUser()
          authId = sessionUser?.id || ''
        } catch {
          // 세션이 없는 극단적 케이스 — authId=''로 저장, 이후 로그인 시 자동 복구
        }
      }
    }

    const user = {
      id: uid(), name, phone,
      email: email.toLowerCase(),
      pw: '', role: 'teacher', level: 1,
      verified: false, verifyImg: null, permissionOverrides: {},
      provider: profile.provider, providerId: profile.providerId,
      avatar: profile.avatar || '', authId, createdAt: now(),
    }
    Users.insert(user)
    onLogin(user)
  }

  const socialCfg = getSocialConfig()
  const { loginBtnRef, registerBtnRef, renderButtons } = useGoogleAuth(handleSocialSuccess, socialCfg.google.clientId)
  const loginWithKakao   = useKakaoAuth(handleSocialSuccess, socialCfg.kakao.appKey)
  const loginWithNaver   = useNaverAuth(handleSocialSuccess, socialCfg.naver.clientId)
  const googleConfigured = !!socialCfg.google.clientId
  const kakaoConfigured  = !!socialCfg.kakao.appKey
  const naverConfigured  = !!socialCfg.naver.clientId

  useEffect(() => { renderButtons() }, [mode, socialStep, fpVerified])

  const loginAttemptsRef = React.useRef({})
  function checkBruteForce(email) {
    const key = email.toLowerCase()
    const a = loginAttemptsRef.current[key] || { count: 0, lockedUntil: 0 }
    if (Date.now() < a.lockedUntil) {
      const left = Math.ceil((a.lockedUntil - Date.now()) / 1000 / 60)
      return `로그인 시도 횟수 초과. ${left}분 후 다시 시도해주세요.`
    }
    return null
  }
  function recordFailedAttempt(email) {
    const key = email.toLowerCase()
    const a = loginAttemptsRef.current[key] || { count: 0, lockedUntil: 0 }
    a.count += 1
    if (a.count >= 5) { a.lockedUntil = Date.now() + 5 * 60 * 1000; a.count = 0 }
    loginAttemptsRef.current[key] = a
  }
  function resetAttempts(email) { delete loginAttemptsRef.current[email.toLowerCase()] }

  const handleLogin = async () => {
    setError('')
    const email = form.email.trim().toLowerCase()
    const locked = checkBruteForce(email)
    if (locked) { setError(locked); return }
    try {
      const { user: authUser } = await authSignIn(email, form.pw)
      if (!authUser) {
        recordFailedAttempt(email)
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        return
      }
      resetAttempts(email)
      onLogin({ email, _authDone: true })
    } catch (e) {
      recordFailedAttempt(email)
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  const handleNext = () => {
    setError('')
    if (!form.name.trim() || !form.email.trim() || !form.pw || !form.phone.trim()) { setError('필수 항목을 모두 입력해주세요.'); return }
    if (!emailChecked) { setError('이메일 중복 확인을 해주세요.'); return }
    if (form.pw.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return }
    if (!/[a-zA-Z]/.test(form.pw) || !/[0-9]/.test(form.pw)) { setError('비밀번호는 영문과 숫자를 모두 포함해야 합니다.'); return }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.pw)) { setError('비밀번호는 특수문자를 하나 이상 포함해야 합니다.'); return }
    if (form.pw !== form.pw2) { setError('비밀번호가 일치하지 않습니다.'); return }
    if (!allRequired) { setError('필수 약관에 동의해주세요.'); return }
    setStep(2)
  }

  const sendCode = async () => {
    setSending(true)
    setError('')
    const result = await sendVerifyCode(form.email)
    setSending(false)
    setCodeSent(true)
    setIsDev(!!result.dev)
    setVerifyCode(result.devCode || '')
    setInputCode('')
    setVerified(false)
  }

  const checkCode = async () => {
    if (isDev) {
      if (inputCode.trim() === verifyCode) { setVerified(true); setError('') }
      else setError('인증번호가 올바르지 않습니다.')
      return
    }
    const ok = await verifyCode(form.email, inputCode)
    if (ok) { setVerified(true); setError('') }
    else setError('인증번호가 올바르지 않거나 만료되었습니다.')
  }

  const handleRegister = async () => {
    if (!verified) { setError('이메일 인증을 완료해주세요.'); return }
    try {
      const { user: authUser } = await authSignUp(form.email.trim().toLowerCase(), form.pw)
      if (!authUser) { setError('회원가입에 실패했습니다.'); return }
      const user = {
        id: uid(), name: form.name.trim(), email: form.email.trim().toLowerCase(),
        pw: '', phone: form.phone.trim(), role: 'teacher', level: 1,
        verified: false, verifyImg: null, permissionOverrides: {},
        provider: 'email', authId: authUser.id, createdAt: now(),
      }
      await Users.insert(user)
      onLogin(user)
    } catch (e) {
      setError(e.message || '회원가입에 실패했습니다.')
    }
  }

  const isMobile = window.innerWidth <= 768

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff7ed 0%, #fff 60%, #f0fdf4 100%)', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center', padding: isMobile ? '0' : '20px' }}>
      <div style={{ width: '100%', maxWidth: isMobile ? '100%' : '440px' }}>

        <div style={{ textAlign: 'center', marginBottom: isMobile ? '20px' : '32px', paddingTop: isMobile ? '32px' : '0' }}>
          <div style={{ fontSize: isMobile ? '40px' : '48px', marginBottom: '12px' }}>📋</div>
          <h1 style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: 700, color: '#111827' }}>방과후 출석부</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px' }}>방과후 강사를 위한 스마트 출석 관리</p>
        </div>

        <div style={{ background: '#fff', borderRadius: isMobile ? '20px 20px 0 0' : '20px', boxShadow: isMobile ? '0 -4px 24px rgba(0,0,0,0.1)' : '0 8px 40px rgba(0,0,0,0.1)', overflow: 'hidden', minHeight: isMobile ? 'calc(100vh - 180px)' : 'auto' }}>

          {socialStep === 'email_verify' && (
            <div style={{ padding: '28px 24px' }}>
              <SocialEmailVerify
                profile={pendingSocialProfile}
                onVerified={handleEmailVerified}
                onCancel={() => { setSocialStep(null); setPendingSocialProfile(null) }}
              />
            </div>
          )}

          {socialStep === 'profile' && (
            <div style={{ padding: '28px 24px' }}>
              <SocialProfileForm profile={pendingSocialProfile} onComplete={handleProfileComplete} />
            </div>
          )}

          {!socialStep && (
            <>
              {(mode === 'findId' || mode === 'findPw') && (
                <div style={{ padding: '28px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>

                  {mode === 'findId' && (
                    <>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:'28px', marginBottom:'8px' }}>🔍</div>
                        <div style={{ fontSize:'16px', fontWeight:700, color:'#111827' }}>아이디 찾기</div>
                        <div style={{ fontSize:'13px', color:'#6b7280', marginTop:'4px' }}>가입 시 등록한 연락처를 입력하세요</div>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                        <label style={{ fontSize:'13px', fontWeight:500, color:'#111827' }}>연락처</label>
                        <input value={findIdPhone} onChange={e => { setFindIdPhone(e.target.value); setFoundEmail(null); setError('') }}
                          placeholder="010-0000-0000" onKeyDown={e => e.key === 'Enter' && handleFindId()}
                          style={{ padding:'9px 13px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                      </div>
                      {error && <ErrBox msg={error} />}
                      {foundEmail && foundEmail !== 'notfound' && (
                        <div style={{ padding:'14px 16px', background:'#eff6ff', borderRadius:'10px', border:'1.5px solid #bfdbfe', fontSize:'14px', color:'#1e40af', textAlign:'center' }}>
                          가입된 이메일: <strong>{foundEmail}</strong>
                        </div>
                      )}
                      {foundEmail === 'notfound' && (
                        <div style={{ padding:'12px', background:'#fef2f2', borderRadius:'9px', border:'1px solid #fca5a5', fontSize:'13px', color:'#ef4444', textAlign:'center' }}>
                          ⚠️ 등록된 연락처가 없습니다.
                        </div>
                      )}
                      <Btn full onClick={handleFindId}>확인</Btn>
                    </>
                  )}

                  {mode === 'findPw' && (
                    <>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:'28px', marginBottom:'8px' }}>🔑</div>
                        <div style={{ fontSize:'16px', fontWeight:700, color:'#111827' }}>비밀번호 초기화</div>
                        <div style={{ fontSize:'13px', color:'#6b7280', marginTop:'4px' }}>가입한 이메일로 인증 후 새 비밀번호를 설정합니다</div>
                      </div>

                      {!fpDone ? (
                        <>
                          {!fpVerified && (
                            <>
                              <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                                <label style={{ fontSize:'13px', fontWeight:500, color:'#111827' }}>이메일 (아이디)</label>
                                <input value={fpEmail} onChange={e => { setFpEmail(e.target.value); setFpCodeSent(false); setFpCode(''); setError('') }}
                                  placeholder="example@email.com" type="email"
                                  style={{ padding:'9px 13px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                              </div>
                              <button onClick={handleFpSend} disabled={fpSending}
                                style={{ padding:'10px', borderRadius:'9px', border:'1.5px solid #f97316', background:'#fff7ed', color:'#f97316', fontSize:'13px', fontWeight:700, cursor:fpSending?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif', opacity:fpSending?0.7:1 }}>
                                {fpSending ? '발송 중...' : fpCodeSent ? '인증번호 재발송' : '📧 인증번호 발송'}
                              </button>
                              {fpCodeSent && (
                                <>
                                  {fpDev ? (
                                    <div style={{ padding:'10px 12px', background:'#fffbeb', borderRadius:'8px', border:'1.5px solid #fde68a', fontSize:'13px' }}>
                                      <div style={{ fontWeight:700, color:'#92400e', marginBottom:'4px' }}>🔧 개발 모드</div>
                                      <div style={{ color:'#b45309' }}>인증번호: <strong style={{ fontSize:'20px', letterSpacing:'4px', color:'#f97316' }}>{fpDev}</strong></div>
                                    </div>
                                  ) : (
                                    <div style={{ padding:'10px 12px', background:'#f0fdf4', borderRadius:'8px', border:'1.5px solid #86efac', fontSize:'13px', color:'#15803d', fontWeight:600 }}>
                                      ✅ {fpEmail}로 인증번호를 발송했습니다.
                                    </div>
                                  )}
                                  <div style={{ display:'flex', gap:'8px' }}>
                                    <input value={fpCode} onChange={e => { setFpCode(e.target.value); setError('') }}
                                      placeholder="인증번호 6자리" maxLength={6} onKeyDown={e => e.key === 'Enter' && handleFpVerify()}
                                      style={{ flex:1, padding:'10px 14px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'18px', letterSpacing:'6px', textAlign:'center', outline:'none', fontFamily:'monospace' }} />
                                    <Btn onClick={handleFpVerify}>확인</Btn>
                                  </div>
                                </>
                              )}
                            </>
                          )}

                          {fpVerified && (
                            <>
                              <div style={{ padding:'10px 12px', background:'#f0fdf4', borderRadius:'8px', border:'1.5px solid #86efac', fontSize:'13px', color:'#15803d', fontWeight:600 }}>
                                ✅ 이메일 인증 완료! 새 비밀번호를 설정하세요.
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                                <label style={{ fontSize:'13px', fontWeight:500, color:'#111827' }}>새 비밀번호 (8자 이상, 영문+숫자+특수문자)</label>
                                <input value={fpNewPw} onChange={e => { setFpNewPw(e.target.value); setError('') }} type="password" placeholder="새 비밀번호"
                                  style={{ padding:'9px 13px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
                                <label style={{ fontSize:'13px', fontWeight:500, color:'#111827' }}>새 비밀번호 확인</label>
                                <input value={fpNewPw2} onChange={e => { setFpNewPw2(e.target.value); setError('') }} type="password" placeholder="재입력"
                                  style={{ padding:'9px 13px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
                              </div>
                              <Btn full onClick={handleFpReset}>비밀번호 변경 완료</Btn>
                            </>
                          )}
                        </>
                      ) : (
                        <div style={{ textAlign:'center', padding:'16px 0', display:'flex', flexDirection:'column', gap:'12px' }}>
                          <div style={{ fontSize:'40px' }}>🎉</div>
                          <div style={{ fontSize:'15px', fontWeight:700, color:'#111827' }}>비밀번호가 변경되었습니다!</div>
                          <div style={{ fontSize:'13px', color:'#6b7280' }}>새 비밀번호로 로그인해주세요.</div>
                        </div>
                      )}

                      {error && <ErrBox msg={error} />}
                    </>
                  )}

                  <button onClick={() => goMode('login')}
                    style={{ padding:'9px', borderRadius:'9px', border:'1px solid #e5e7eb', background:'#fff', color:'#6b7280', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    ← 로그인으로 돌아가기
                  </button>
                </div>
              )}

              {(mode === 'login' || mode === 'register') && (
                <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb' }}>
                  {['login','register'].map(m => (
                    <button key={m} onClick={() => goMode(m)}
                      style={{ flex:1, padding:'16px', border:'none', cursor:'pointer', background:mode===m?'#fff':'#fafafa', fontWeight:mode===m?700:400, color:mode===m?'#f97316':'#6b7280', fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', borderBottom:mode===m?'2px solid #f97316':'2px solid transparent', transition:'all .15s' }}>
                      {m==='login'?'로그인':'회원가입'}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ padding: '24px' }}>

                {mode === 'login' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {googleConfigured ? (
                        <div ref={loginBtnRef} style={{ width: '100%', minHeight: '44px' }} />
                      ) : (
                        <SocialBtn icon="🔵" label="Google로 계속하기" color="#4285F4" bg="#fff" border="#dadce0"
                          onClick={() => toastError('Google 로그인을 사용하려면 관리자 → 서비스설정 → 소셜 로그인에서 등록하세요.')} />
                      )}
                      <SocialBtn icon="💛" label="카카오로 계속하기" color="#3C1E1E" bg="#FEE500" border="#FEE500"
                        onClick={kakaoConfigured ? loginWithKakao : () => toastError('카카오 로그인을 사용하려면 관리자 → 서비스설정 → 소셜 로그인에서 등록하세요.')} />
                      <SocialBtn icon="🟢" label="네이버로 계속하기" color="#fff" bg="#03C75A" border="#03C75A"
                        onClick={naverConfigured ? loginWithNaver : () => toastError('네이버 로그인을 사용하려면 관리자 → 서비스설정 → 소셜 로그인에서 등록하세요.')} />
                    </div>
                    <Divider label="또는 이메일로 로그인" />
                    <Input label="이메일" value={form.email} onChange={v => set('email', v)} placeholder="이메일 입력" type="email" />
                    <Input label="비밀번호" value={form.pw} onChange={v => set('pw', v)} placeholder="비밀번호" type="password" />
                    {error && <ErrBox msg={error} />}
                    <Btn full onClick={handleLogin}>로그인</Btn>
                    <div style={{ display:'flex', justifyContent:'center', gap:'16px', fontSize:'12px' }}>
                      <button onClick={() => goMode('findId')} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', textDecoration:'underline' }}>아이디 찾기</button>
                      <span style={{ color:'#e5e7eb' }}>|</span>
                      <button onClick={() => goMode('findPw')} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', textDecoration:'underline' }}>비밀번호 초기화</button>
                    </div>
                  </div>
                )}

                {mode === 'register' && step === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', textAlign: 'center', marginBottom: '2px' }}>소셜 간편가입</div>
                      {googleConfigured ? (
                        <div ref={registerBtnRef} style={{ width: '100%', minHeight: '44px' }} />
                      ) : (
                        <SocialBtn icon="🔵" label="Google로 간편가입" color="#4285F4" bg="#fff" border="#dadce0"
                          onClick={() => toastError('관리자 → 서비스설정 → 소셜 로그인에서 Google 키를 등록하세요.')} />
                      )}
                      <SocialBtn icon="💛" label="카카오로 간편가입" color="#3C1E1E" bg="#FEE500" border="#FEE500"
                        onClick={kakaoConfigured ? loginWithKakao : () => toastError('관리자 → 서비스설정 → 소셜 로그인에서 카카오 키를 등록하세요.')} />
                      <SocialBtn icon="🟢" label="네이버로 간편가입" color="#fff" bg="#03C75A" border="#03C75A"
                        onClick={naverConfigured ? loginWithNaver : () => toastError('관리자 → 서비스설정 → 소셜 로그인에서 네이버 키를 등록하세요.')} />
                    </div>
                    <Divider label="또는 이메일로 가입" />
                    <Input label="이름" value={form.name} onChange={v => set('name', v)} placeholder="홍길동" required />
                    <EmailInputWithCheck value={form.email} onChange={v => { set('email', v); setEmailChecked(false) }} onChecked={ok => setEmailChecked(ok)} />
                    <Input label="연락처" value={form.phone} onChange={v => set('phone', v)} placeholder="010-0000-0000" required />
                    <Input label="비밀번호 (8자 이상, 영문+숫자+특수문자)" value={form.pw} onChange={v => set('pw', v)} type="password" placeholder="비밀번호" required />
                    <Input label="비밀번호 확인" value={form.pw2} onChange={v => set('pw2', v)} type="password" placeholder="재입력" required />

                    <div style={{ borderRadius:'10px', border:'1.5px solid #e5e7eb', padding:'14px 16px', display:'flex', flexDirection:'column', gap:'10px' }}>
                      <div style={{ fontSize:'12px', fontWeight:700, color:'#374151', marginBottom:'2px' }}>약관 동의</div>
                      <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', padding:'8px 12px', borderRadius:'8px', background: (terms.service&&terms.privacy&&terms.marketing&&terms.thirdParty)?'#fff7ed':'#f9fafb', border:'1px solid #e5e7eb' }}>
                        <input type="checkbox"
                          checked={terms.service&&terms.privacy&&terms.marketing&&terms.thirdParty}
                          onChange={() => {
                            const all = terms.service&&terms.privacy&&terms.marketing&&terms.thirdParty
                            setTerms({ service:!all, privacy:!all, marketing:!all, thirdParty:!all })
                          }}
                          style={{ width:'16px', height:'16px', accentColor:'#f97316', cursor:'pointer', flexShrink:0 }} />
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#111827' }}>전체 동의</span>
                      </label>
                      <div style={{ height:'1px', background:'#e5e7eb' }} />
                      {[
                        { key:'service',    label:'서비스 이용약관',        required:true  },
                        { key:'privacy',    label:'개인정보 수집·이용 동의', required:true  },
                        { key:'marketing',  label:'마케팅 정보 수신 동의',  required:false },
                        { key:'thirdParty', label:'제3자 정보 제공 동의',   required:false },
                      ].map(item => (
                        <label key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', gap:'8px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                            <input type="checkbox" checked={terms[item.key]} onChange={() => toggleTerm(item.key)}
                              style={{ width:'15px', height:'15px', accentColor:'#f97316', cursor:'pointer', flexShrink:0 }} />
                            <span style={{ fontSize:'13px', color:'#374151' }}>{item.label}</span>
                            <span style={{ fontSize:'11px', fontWeight:600, padding:'1px 6px', borderRadius:'4px', background: item.required?'#fef2f2':'#f3f4f6', color: item.required?'#ef4444':'#9ca3af' }}>
                              {item.required?'필수':'선택'}
                            </span>
                          </div>
                          <button type="button" style={{ background:'none', border:'none', fontSize:'11px', color:'#9ca3af', cursor:'pointer', textDecoration:'underline', flexShrink:0, fontFamily:'Noto Sans KR, sans-serif' }}>
                            보기
                          </button>
                        </label>
                      ))}
                    </div>

                    {error && <ErrBox msg={error} />}
                    <Btn full onClick={handleNext}>다음 — 이메일 인증 →</Btn>
                  </div>
                )}

                {mode === 'register' && step === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>① 정보 입력 ✓</span>
                      <span style={{ color: '#9ca3af' }}>→</span>
                      <span style={{ color: '#f97316', fontWeight: 700 }}>② 이메일 인증</span>
                    </div>
                    <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: '10px', border: '1.5px solid #bfdbfe', fontSize: '13px', color: '#1e40af', lineHeight: 1.8 }}>
                      <div style={{ marginBottom: '10px', fontSize: '14px', lineHeight: '1.8' }}>
                        안녕하세요~!<br/>
                        방과후 출석부를 찾아오신 선생님 반갑습니다!<br/>
                        대한민국 교육의 한 축을 이루고 있는 방과후 교육을 담당하고 계신 선생님 감사합니다!
                      </div>
                      <div style={{ marginBottom: '10px', fontSize: '13px', lineHeight: '1.8' }}>
                        선생님께서는 처음 방문하신 선생님이셔서 불편하시더라도<br/>
                        실 사용하시는 이메일 인증을 통해 입장을 하고 있으니 양해 부탁드립니다.
                      </div>
                      <div style={{ marginBottom: '10px', fontSize: '13px', lineHeight: '1.8' }}>
                        방과후 출석부는 무료회원가입으로 기본 출석부 기능을 사용하실수 있습니다!
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        <strong>{form.email}</strong>으로 인증번호를 발송합니다.
                      </div>
                    </div>
                    {!verified && (
                      <button onClick={sendCode} disabled={sending}
                        style={{ padding: '10px', borderRadius: '9px', border: '1.5px solid #f97316', background: '#fff7ed', color: '#f97316', fontSize: '13px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'Noto Sans KR, sans-serif', opacity: sending ? 0.7 : 1 }}>
                        📧 {sending ? '발송 중...' : codeSent ? '인증번호 재발송' : '인증번호 발송'}
                      </button>
                    )}
                    {codeSent && !verified && (
                      <>
                        {isDev ? (
                          <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1.5px solid #fde68a', fontSize: '13px' }}>
                            <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>🔧 개발 모드 (Resend 미설정)</div>
                            <div style={{ color: '#b45309' }}>인증번호: <strong style={{ fontSize: '22px', letterSpacing: '5px', color: '#f97316' }}>{verifyCode}</strong></div>
                          </div>
                        ) : (
                          <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1.5px solid #86efac', fontSize: '13px', color: '#15803d', fontWeight: 600 }}>
                            ✅ {form.email}로 인증번호를 발송했습니다.
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input value={inputCode} onChange={e => setInputCode(e.target.value)}
                            placeholder="인증번호 6자리" onKeyDown={e => e.key === 'Enter' && checkCode()} maxLength={6}
                            style={{ flex:1, padding:'10px 14px', borderRadius:'9px', border:'1.5px solid #e5e7eb', fontSize:'18px', fontFamily:'Noto Sans KR, sans-serif', letterSpacing:'6px', textAlign:'center', outline:'none' }} />
                          <Btn onClick={checkCode}>확인</Btn>
                        </div>
                      </>
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
            </>
          )}
        </div>
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
    if (dup) { setState({ ok:false, msg:'이미 사용 중인 이메일입니다.' }); onChecked(false) }
    else { setState({ ok:true, msg:'사용 가능한 이메일입니다.' }); onChecked(true) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <label style={{ fontSize:'13px', fontWeight:500, color:'#111827' }}>이메일 (아이디) <span style={{ color:'#ef4444' }}>*</span></label>
      <div style={{ display:'flex', gap:'8px' }}>
        <input type="email" value={value} onChange={e => { onChange(e.target.value); setState(null); onChecked(false) }} placeholder="example@email.com"
          style={{ flex:1, padding:'9px 13px', borderRadius:'9px', border:`1.5px solid ${state?(state.ok?'#86efac':'#fca5a5'):'#e5e7eb'}`, fontSize:'14px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
        <button onClick={check}
          style={{ padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${state?.ok?'#86efac':'#e5e7eb'}`, background:state?.ok?'#f0fdf4':'#fff', color:state?.ok?'#16a34a':'#374151', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', minWidth:'76px', transition:'all .15s' }}>
          {state?.ok ? '✅ 확인됨' : '중복 확인'}
        </button>
      </div>
      {state && <div style={{ fontSize:'12px', color:state.ok?'#16a34a':'#ef4444', display:'flex', alignItems:'center', gap:'4px' }}>{state.ok?'✓':'✗'} {state.msg}</div>}
    </div>
  )
}

function ErrBox({ msg }) {
  return <div style={{ fontSize:'13px', color:'#ef4444', background:'#fef2f2', padding:'10px 14px', borderRadius:'8px', border:'1px solid #fca5a5' }}>{msg}</div>
}
