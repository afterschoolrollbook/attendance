import React, { useState, useEffect } from 'react'
import { Settings, SecretSettings, Students as StudentsDB, Classes as ClassesDB } from '../lib/db.js'
import { LEVEL_NAMES, LEVEL_COLORS } from '../constants/permissions.js'
import { Card, PageHeader, Toggle, Btn, Modal, useConfirm } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'
import { isConfigured, FUNCTIONS_BASE } from '../lib/supabase.js'

const C = { border:'#e5e7eb', text:'#111827', muted:'#6b7280', primary:'#f97316', success:'#16a34a' }

function Field({ label, value, onChange, placeholder, type='text', mono=false }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
      <label style={{ fontSize:'13px', fontWeight:600, color:'#374151' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ padding:'9px 13px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily: mono ? 'monospace' : 'Noto Sans KR, sans-serif', outline:'none', color:C.text }}
        onFocus={e => e.target.style.borderColor=C.primary}
        onBlur={e => e.target.style.borderColor=C.border} />
    </div>
  )
}

// ─── 섹션: 소셜 로그인
function SocialSection() {
  const init = Settings.get('social') || { googleClientId:'', kakaoAppKey:'', googleEnabled:false, kakaoEnabled:false }
  const [cfg, setCfg] = useState(init)
  const { success } = useToast()

  // [보안] 네이버 클라이언트 Secret은 social_secret 키에 별도 저장 (관리자만 조회 가능, localStorage 미저장)
  React.useEffect(() => {
    SecretSettings.get('social_secret').then(secret => {
      if (secret?.naverClientSecret) setCfg(p => ({ ...p, naverClientSecret: secret.naverClientSecret }))
    })
  }, [])

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const save = async () => {
    const { naverClientSecret, ...publicCfg } = cfg
    Settings.set('social', publicCfg)
    await SecretSettings.set('social_secret', { naverClientSecret: naverClientSecret || '' })
    success('수정이 완료되었습니다.')
  }

  return (
    <Card style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>🔑 소셜 로그인 연동</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:1.6 }}>
        소셜 로그인 키를 등록하면 선생님들이 Google·카카오·네이버 계정으로 간편하게 가입/로그인할 수 있습니다.
      </div>

      {/* ── Google */}
      <div style={{ padding:'16px', background:'#f8f9ff', borderRadius:'12px', border:'1.5px solid #c7d2fe', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'20px' }}>🔵</span>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>Google 로그인</div>
              <div style={{ fontSize:'12px', color:C.muted }}>OAuth 2.0 클라이언트 ID 방식</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Toggle checked={cfg.googleEnabled} onChange={v => set('googleEnabled', v)} />
            <span style={{ fontSize:'12px', fontWeight:600, color:cfg.googleEnabled?C.success:C.muted }}>{cfg.googleEnabled?'활성':'비활성'}</span>
          </div>
        </div>

        <Field label="클라이언트 ID (Client ID)" value={cfg.googleClientId} onChange={v => set('googleClientId', v)}
          placeholder="000000000000-xxxxxxxxxxxxxxxx.apps.googleusercontent.com" mono />

        <details style={{ marginTop:'12px' }}>
          <summary style={{ fontSize:'12px', fontWeight:600, color:'#4338ca', cursor:'pointer', userSelect:'none' }}>
            📋 Google 클라이언트 ID 발급 방법 보기
          </summary>
          <div style={{ marginTop:'10px', padding:'12px 14px', background:'#fff', borderRadius:'8px', border:'1px solid #c7d2fe', fontSize:'12px', color:'#374151', lineHeight:2 }}>
            <strong>① Google Cloud Console 접속</strong><br />
            &nbsp;&nbsp;<a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" style={{ color:'#4338ca' }}>console.cloud.google.com</a> 접속 → Google 계정 로그인<br />
            <br />
            <strong>② 프로젝트 생성</strong><br />
            &nbsp;&nbsp;상단 프로젝트 선택 → 새 프로젝트 → 이름 입력 (예: 방과후출석부) → 만들기<br />
            <br />
            <strong>③ OAuth 동의 화면 설정</strong><br />
            &nbsp;&nbsp;왼쪽 메뉴 → API 및 서비스 → OAuth 동의 화면<br />
            &nbsp;&nbsp;→ 외부 선택 → 만들기 → 앱 이름·이메일 입력 → 저장 후 계속<br />
            <br />
            <strong>④ 클라이언트 ID 발급</strong><br />
            &nbsp;&nbsp;왼쪽 메뉴 → 사용자 인증 정보 → + 사용자 인증 정보 만들기<br />
            &nbsp;&nbsp;→ OAuth 클라이언트 ID → 웹 애플리케이션 선택<br />
            &nbsp;&nbsp;→ 승인된 JavaScript 원본에 사이트 주소 추가<br />
            &nbsp;&nbsp;&nbsp;&nbsp;예: <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>https://attendance-phi-sand.vercel.app</code><br />
            &nbsp;&nbsp;→ 만들기 → 클라이언트 ID 복사하여 위에 입력<br />
            <br />
            <strong>⑤ 비용</strong>: 무료 (Google 계정만 있으면 됨)
          </div>
        </details>
      </div>

      {/* ── 카카오 */}
      <div style={{ padding:'16px', background:'#fffde7', borderRadius:'12px', border:'1.5px solid #fde68a', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'20px' }}>💛</span>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>카카오 로그인</div>
              <div style={{ fontSize:'12px', color:C.muted }}>OAuth 팝업 방식 (REST API 키)</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Toggle checked={cfg.kakaoEnabled} onChange={v => set('kakaoEnabled', v)} />
            <span style={{ fontSize:'12px', fontWeight:600, color:cfg.kakaoEnabled?C.success:C.muted }}>{cfg.kakaoEnabled?'활성':'비활성'}</span>
          </div>
        </div>

        <Field label="REST API 키" value={cfg.kakaoAppKey} onChange={v => set('kakaoAppKey', v)}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono />

        <details style={{ marginTop:'12px' }}>
          <summary style={{ fontSize:'12px', fontWeight:600, color:'#92400e', cursor:'pointer', userSelect:'none' }}>
            📋 카카오 REST API 키 발급 방법 보기
          </summary>
          <div style={{ marginTop:'10px', padding:'12px 14px', background:'#fff', borderRadius:'8px', border:'1px solid #fde68a', fontSize:'12px', color:'#374151', lineHeight:2 }}>
            <strong>① Kakao Developers 접속</strong><br />
            &nbsp;&nbsp;<a href="https://developers.kakao.com" target="_blank" rel="noopener noreferrer" style={{ color:'#92400e' }}>developers.kakao.com</a> 접속 → 카카오 계정 로그인<br />
            <br />
            <strong>② 앱 생성</strong><br />
            &nbsp;&nbsp;내 애플리케이션 → 애플리케이션 추가하기<br />
            &nbsp;&nbsp;→ 앱 이름 입력 (예: 방과후출석부) → 저장<br />
            <br />
            <strong>③ REST API 키 확인</strong><br />
            &nbsp;&nbsp;생성된 앱 클릭 → 앱 설정 → 플랫폼 키<br />
            &nbsp;&nbsp;→ <strong>REST API 키</strong> 복사하여 위에 입력<br />
            &nbsp;&nbsp;<span style={{ color:'#ef4444', fontWeight:700 }}>⚠️ JavaScript 키 ❌ — 반드시 REST API 키 사용</span><br />
            <br />
            <strong>④ 리다이렉트 URI 등록</strong><br />
            &nbsp;&nbsp;플랫폼 키 → JavaScript 키 섹션 → 해당 키 클릭<br />
            &nbsp;&nbsp;→ 카카오 로그인 리다이렉트 URI에 아래 2개 추가:<br />
            &nbsp;&nbsp;&nbsp;&nbsp;<code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>https://attendance-phi-sand.vercel.app</code><br />
            &nbsp;&nbsp;&nbsp;&nbsp;<code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>https://attendance-phi-sand.vercel.app/kakao-callback</code><br />
            <br />
            <strong>⑤ 카카오 로그인 활성화</strong><br />
            &nbsp;&nbsp;제품 설정 → 카카오 로그인 → 활성화 ON<br />
            <br />
            <strong>⑥ 동의항목 설정</strong><br />
            &nbsp;&nbsp;카카오 로그인 → 동의항목 → 닉네임·이메일 필수 동의 설정<br />
            <br />
            <strong>⑦ Supabase 환경변수 설정 (필수)</strong><br />
            &nbsp;&nbsp;Supabase 대시보드 → Edge Functions → Secrets<br />
            &nbsp;&nbsp;→ <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>KAKAO_CLIENT_ID</code> = REST API 키 값 입력<br />
            <br />
            <strong>⑧ 비용</strong>: 무료
          </div>
        </details>
      </div>

      {/* ── 네이버 */}
      <div style={{ padding:'16px', background:'#f0fdf4', borderRadius:'12px', border:'1.5px solid #86efac', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'20px' }}>🟢</span>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>네이버 로그인</div>
              <div style={{ fontSize:'12px', color:C.muted }}>OAuth 팝업 방식 (Supabase Edge Function)</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Toggle checked={cfg.naverEnabled||false} onChange={v => setCfg(p=>({...p,naverEnabled:v}))} />
            <span style={{ fontSize:'12px', fontWeight:600, color:cfg.naverEnabled?C.success:C.muted }}>{cfg.naverEnabled?'활성':'비활성'}</span>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <Field label="클라이언트 ID" value={cfg.naverClientId||''} onChange={v => setCfg(p=>({...p,naverClientId:v}))} placeholder="XXXXXXXXXXXXXXXX" mono />
          <Field label="클라이언트 Secret" value={cfg.naverClientSecret||''} onChange={v => setCfg(p=>({...p,naverClientSecret:v}))} placeholder="XXXXXXXXXX" type="password" mono />
        </div>
        <details style={{ marginTop:'12px' }}>
          <summary style={{ fontSize:'12px', fontWeight:600, color:'#15803d', cursor:'pointer', userSelect:'none' }}>
            📋 네이버 로그인 설정 방법 보기
          </summary>
          <div style={{ marginTop:'10px', padding:'12px 14px', background:'#fff', borderRadius:'8px', border:'1px solid #86efac', fontSize:'12px', color:'#374151', lineHeight:2 }}>
            <strong>① 네이버 개발자센터 접속</strong><br />
            &nbsp;&nbsp;<a href="https://developers.naver.com" target="_blank" rel="noopener noreferrer" style={{ color:'#15803d' }}>developers.naver.com</a> → 로그인<br />
            <br />
            <strong>② 애플리케이션 등록</strong><br />
            &nbsp;&nbsp;Application → 애플리케이션 등록<br />
            &nbsp;&nbsp;→ 사용 API: 네아로(네이버 아이디로 로그인) 선택<br />
            &nbsp;&nbsp;→ 서비스 URL: <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>https://attendance-phi-sand.vercel.app</code><br />
            &nbsp;&nbsp;→ Callback URL: <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>https://attendance-phi-sand.vercel.app/naver-callback</code><br />
            <br />
            <strong>③ 키 확인</strong><br />
            &nbsp;&nbsp;Client ID + Client Secret 복사하여 위에 입력<br />
            <br />
            <strong>④ Supabase 환경변수 설정 (필수)</strong><br />
            &nbsp;&nbsp;Supabase 대시보드 → Edge Functions → Secrets<br />
            &nbsp;&nbsp;→ <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>NAVER_CLIENT_ID</code> = Client ID 입력<br />
            &nbsp;&nbsp;→ <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>NAVER_CLIENT_SECRET</code> = Client Secret 입력<br />
            <br />
            <strong>⑤ 비용</strong>: 무료
          </div>
        </details>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'12px' }}>
        <Btn onClick={save}>💾 저장</Btn>
      </div>
    </Card>
  )
}

// ─── 섹션: 서비스 기본 설정
function ServiceSection() {
  const init = Settings.get('service') || { siteName:'방과후 출석부', adminEmail:'', pointRate:5, pointExpireDays:365 }
  const [cfg, setCfg] = useState(init)
  const { success } = useToast()
  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const save = () => {
    Settings.set('service', cfg)
    success('수정이 완료되었습니다.')
  }

  return (
    <Card style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'20px' }}>⚙️ 서비스 기본 설정</div>
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        <Field label="서비스명" value={cfg.siteName} onChange={v => set('siteName', v)} placeholder="방과후 출석부" />
        <Field label="관리자 이메일" value={cfg.adminEmail} onChange={v => set('adminEmail', v)} placeholder="admin@example.com" type="email" />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <Field label="포인트 적립률 (%)" value={cfg.pointRate} onChange={v => set('pointRate', Number(v))} placeholder="5" type="number" />
          <Field label="포인트 유효기간 (일)" value={cfg.pointExpireDays} onChange={v => set('pointExpireDays', Number(v))} placeholder="365" type="number" />
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn onClick={save}>💾 저장</Btn>
        </div>
      </div>
    </Card>
  )
}

// ─── 섹션: 이메일 발송 (Resend)
function EmailSection() {
  const [cfg, setCfg] = useState({ resendApiKey:'', fromEmail:'', enabled:false })
  const [loading, setLoading] = useState(true)
  const { success, toastError } = useToast()
  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  useEffect(() => {
    SecretSettings.get('email').then(val => {
      if (val) setCfg({ resendApiKey:'', fromEmail:'', enabled:false, ...val })
      setLoading(false)
    })
  }, [])

  const save = async () => {
    const ok = await SecretSettings.set('email', cfg)
    if (ok) success('수정이 완료되었습니다.')
    else toastError('저장에 실패했습니다. 다시 시도해주세요.')
  }

  if (loading) return <div style={{ padding:'20px', color:C.muted, fontSize:'13px' }}>불러오는 중...</div>

  return (
    <Card style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>📧 이메일 발송 (Resend)</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:1.6 }}>
        회원가입 이메일 인증, 공지 발송에 사용됩니다. 무료로 사용 가능합니다.
      </div>

      <div style={{ padding:'16px', background:'#f0f9ff', borderRadius:'12px', border:'1.5px solid #bae6fd', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'22px' }}>📨</span>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>Resend</div>
              <div style={{ fontSize:'12px', color:C.muted }}>월 3,000건 무료</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Toggle checked={cfg.enabled} onChange={v => set('enabled', v)} />
            <span style={{ fontSize:'12px', fontWeight:600, color:cfg.enabled?C.success:C.muted }}>{cfg.enabled?'활성':'비활성'}</span>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <Field label="API Key" value={cfg.resendApiKey} onChange={v => set('resendApiKey', v)} placeholder="re_xxxxxxxxxxxxxxxx" mono />
          <Field label="발신 이메일" value={cfg.fromEmail} onChange={v => set('fromEmail', v)} placeholder="noreply@yourdomain.com" />
        </div>
        <details style={{ marginTop:'12px' }}>
          <summary style={{ fontSize:'12px', fontWeight:600, color:'#0369a1', cursor:'pointer', userSelect:'none' }}>
            📋 Resend API 키 발급 방법 보기
          </summary>
          <div style={{ marginTop:'10px', padding:'12px 14px', background:'#fff', borderRadius:'8px', border:'1px solid #bae6fd', fontSize:'12px', color:'#374151', lineHeight:2 }}>
            <strong>① Resend 가입</strong><br />
            &nbsp;&nbsp;<a href="https://resend.com" target="_blank" rel="noopener noreferrer" style={{ color:'#0369a1' }}>resend.com</a> 접속 → 무료 가입<br />
            <br />
            <strong>② API Key 생성</strong><br />
            &nbsp;&nbsp;대시보드 → API Keys → Create API Key<br />
            &nbsp;&nbsp;→ 이름 입력 → 키 복사하여 위에 입력<br />
            <br />
            <strong>③ 발신 도메인 등록 (선택)</strong><br />
            &nbsp;&nbsp;자체 도메인 없으면 <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>onboarding@resend.dev</code>로 자동 발송<br />
            &nbsp;&nbsp;자체 도메인: Domains → Add → DNS 레코드 추가<br />
            <br />
            <strong>④ 비용</strong>: 월 3,000건 무료 / 초과 시 $0.001/건
          </div>
        </details>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'12px' }}>
        <Btn onClick={save}>💾 저장</Btn>
      </div>
    </Card>
  )
}

// ─── 섹션: Solapi 문자/알림톡
function SolapiSection() {
  const [cfg, setCfg] = useState({ apiKey:'', apiSecret:'', senderPhone:'', kakaoChannelId:'', kakaoEnabled:false, smsEnabled:false })
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const { success, toastError } = useToast()

  useEffect(() => {
    SecretSettings.get('solapi').then(val => {
      if (val) setCfg({ apiKey:'', apiSecret:'', senderPhone:'', kakaoChannelId:'', kakaoEnabled:false, smsEnabled:false, ...val })
      setLoading(false)
    })
  }, [])

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const save = async () => {
    const ok = await SecretSettings.set('solapi', cfg)
    if (ok) success('수정이 완료되었습니다.')
    else toastError('저장에 실패했습니다. 다시 시도해주세요.')
  }

  const testSMS = async () => {
    if (!cfg.apiKey || !cfg.senderPhone) { toastError('API 키와 발신번호를 먼저 입력하세요.'); return }
    setTesting(true)
    setTimeout(() => {
      success('테스트 발송 기능은 Phase 4 백엔드 연동 후 사용 가능합니다.')
      setTesting(false)
    }, 1000)
  }

  if (loading) return <div style={{ padding:'20px', color:C.muted, fontSize:'13px' }}>불러오는 중...</div>

  return (
    <Card style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>📱 Solapi 문자·카카오 알림톡</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:1.6 }}>
        Solapi를 연동하면 선생님이 출석부에서 학부모에게 <strong>문자·카카오 알림톡</strong>을 직접 발송할 수 있습니다.
      </div>

      <div style={{ padding:'16px', background:'#f0f9ff', borderRadius:'12px', border:'1.5px solid #bae6fd', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'22px' }}>🔵</span>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>Solapi 계정 연동</div>
              <div style={{ fontSize:'12px', color:C.muted }}>문자 + 카카오 알림톡 통합 발송 서비스</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Toggle checked={cfg.smsEnabled} onChange={v => set('smsEnabled', v)} />
            <span style={{ fontSize:'12px', fontWeight:600, color:cfg.smsEnabled?C.success:C.muted }}>{cfg.smsEnabled?'활성':'비활성'}</span>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <Field label="API Key" value={cfg.apiKey} onChange={v => set('apiKey', v)} placeholder="NCSXXXXXXXXXXXXXXXXXXXXX" mono />
          <Field label="API Secret" value={cfg.apiSecret} onChange={v => set('apiSecret', v)} placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" type="password" mono />
          <Field label="발신 전화번호" value={cfg.senderPhone} onChange={v => set('senderPhone', v)} placeholder="01012345678 (하이픈 없이)" />
        </div>

        <details style={{ marginTop:'14px' }}>
          <summary style={{ fontSize:'12px', fontWeight:600, color:'#0369a1', cursor:'pointer', userSelect:'none' }}>
            📋 Solapi API 키 발급 방법 보기
          </summary>
          <div style={{ marginTop:'10px', padding:'12px 14px', background:'#fff', borderRadius:'8px', border:'1px solid #bae6fd', fontSize:'12px', color:'#374151', lineHeight:2 }}>
            <strong>① Solapi 가입</strong><br />
            &nbsp;&nbsp;<a href="https://solapi.com" target="_blank" rel="noopener noreferrer" style={{ color:'#0369a1' }}>solapi.com</a> 접속 → 회원가입 (사업자 또는 개인)<br />
            <br />
            <strong>② API 키 발급</strong><br />
            &nbsp;&nbsp;로그인 → 개발자 → API 관리 → API 키 추가<br />
            &nbsp;&nbsp;→ API Key·API Secret 복사하여 위에 입력<br />
            <br />
            <strong>③ 발신번호 등록</strong><br />
            &nbsp;&nbsp;설정 → 발신번호 관리 → 발신번호 추가<br />
            &nbsp;&nbsp;→ 휴대폰 인증 후 등록<br />
            <br />
            <strong>④ 요금</strong>: SMS 건당 약 9~20원 · 카카오 알림톡 건당 약 7~15원<br />
            &nbsp;&nbsp;충전식 선불 방식 (무료 체험 크레딧 제공)
          </div>
        </details>
      </div>

      <div style={{ padding:'16px', background:'#fffde7', borderRadius:'12px', border:'1.5px solid #fde68a', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'22px' }}>💛</span>
            <div>
              <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>카카오 알림톡</div>
              <div style={{ fontSize:'12px', color:C.muted }}>Solapi를 통한 카카오 비즈니스 채널 발송</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Toggle checked={cfg.kakaoEnabled} onChange={v => set('kakaoEnabled', v)} />
            <span style={{ fontSize:'12px', fontWeight:600, color:cfg.kakaoEnabled?C.success:C.muted }}>{cfg.kakaoEnabled?'활성':'비활성'}</span>
          </div>
        </div>

        <Field label="카카오 채널 ID (pfId)" value={cfg.kakaoChannelId} onChange={v => set('kakaoChannelId', v)} placeholder="_xXXXXX" mono />
      </div>

      <div style={{ padding:'14px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}`, marginBottom:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
        <div>
          <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>테스트 발송</div>
          <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>설정 저장 후 발신번호로 테스트 SMS를 발송합니다.</div>
        </div>
        <Btn size="sm" variant="ghost" onClick={testSMS} disabled={testing}>{testing ? '발송 중...' : '테스트 발송'}</Btn>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'12px' }}>
        <Btn onClick={save}>💾 저장</Btn>
      </div>
    </Card>
  )
}

// ─── 웹 푸시 알림 설정
function PushSection() {
  const init = Settings.get('push') || { vapidPublicKey: '', enabled: false }
  const [cfg,        setCfg]        = useState(init)
  const [generating, setGenerating] = useState(false)
  const [genResult,  setGenResult]  = useState(null) // { publicKey, privateKey } | null
  const [error,      setError]      = useState('')
  const [copied,     setCopied]     = useState('')   // 'pub' | 'priv' | ''
  const { success, toastError } = useToast()

  const save = (next) => { Settings.set('push', next); setCfg(next) }

  const generateVapid = async () => {
    if (!isConfigured) { setError('Supabase가 연결되지 않았습니다.'); return }
    setGenerating(true); setError(''); setGenResult(null)
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/generate-vapid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || '생성 실패')
      // 공개키는 Settings에 저장, 비밀키는 화면에 표시해서 관리자가 Secrets에 직접 등록
      save({ ...cfg, vapidPublicKey: data.publicKey, enabled: true })
      setGenResult({ publicKey: data.publicKey, privateKey: data.privateKey })
      success('VAPID 키 생성 완료!')
    } catch (e) {
      setError(`오류: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const mono = { fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', lineHeight: 1.6 }
  const hasKey = !!cfg.vapidPublicKey

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: C.text, marginBottom: '4px' }}>🔔 웹 푸시 알림</div>
            <div style={{ fontSize: '13px', color: C.muted }}>선생님이 출석 체크하면 학부모 기기로 즉시 알림 전송. 무료.</div>
          </div>
          <Toggle checked={cfg.enabled && hasKey} onChange={v => {
            if (v && !hasKey) { setError('먼저 VAPID 키를 생성해주세요.'); return }
            save({ ...cfg, enabled: v })
            success(v ? '웹 푸시 활성화' : '웹 푸시 비활성화')
          }} />
        </div>

        {/* 현재 상태 */}
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: hasKey ? '#f0fdf4' : '#fafafa', border: `1px solid ${hasKey ? '#86efac' : C.border}`, marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: hasKey ? C.success : C.muted }}>
            {hasKey ? '✅ VAPID 키 등록됨' : '⬜ VAPID 키 미등록'}
          </div>
          {hasKey && <div style={{ ...mono, color: '#374151', marginTop: '4px' }}>공개키: {cfg.vapidPublicKey.slice(0, 40)}...</div>}
        </div>

        <button onClick={generateVapid} disabled={generating} style={{
          padding: '11px 22px', borderRadius: '8px', border: 'none',
          background: generating ? '#d1d5db' : C.primary, color: '#fff',
          fontSize: '14px', fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer',
          fontFamily: 'Noto Sans KR, sans-serif',
        }}>
          {generating ? '⏳ 생성 중...' : hasKey ? '🔄 VAPID 키 재생성' : '✨ VAPID 키 자동 생성'}
        </button>
        {hasKey && <div style={{ fontSize: '12px', color: '#d97706', marginTop: '6px' }}>⚠️ 재생성 시 기존 학부모는 재가입 필요</div>}
        {error && <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fca5a5', fontSize: '13px', color: '#b91c1c' }}>{error}</div>}
      </Card>

      {/* 생성 결과 — 비밀키 Secrets 등록 안내 */}
      {genResult && (
        <Card>
          <div style={{ fontWeight: 700, fontSize: '14px', color: C.text, marginBottom: '4px' }}>🔑 생성된 키 — Supabase Secrets에 등록하세요</div>
          <div style={{ fontSize: '12px', color: '#d97706', marginBottom: '14px' }}>⚠️ 비밀키는 지금만 표시됩니다. 반드시 아래 절차대로 저장하세요.</div>

          {[
            { label: 'VAPID_PUBLIC_KEY', value: genResult.publicKey, key: 'pub' },
            { label: 'VAPID_PRIVATE_KEY', value: genResult.privateKey, key: 'priv' },
            { label: 'VAPID_EMAIL', value: 'mailto:admin@afterschool.app', key: 'email' },
          ].map(item => (
            <div key={item.key} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: C.muted, marginBottom: '4px' }}>{item.label}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ ...mono, flex: 1, padding: '8px 10px', background: '#f4f4f5', borderRadius: '6px', border: `1px solid ${C.border}` }}>{item.value}</div>
                <button onClick={() => copyText(item.value, item.key)} style={{
                  padding: '8px 12px', borderRadius: '6px', border: 'none', whiteSpace: 'nowrap',
                  background: copied === item.key ? C.success : '#e5e7eb', color: copied === item.key ? '#fff' : C.text,
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                }}>{copied === item.key ? '✅ 복사됨' : '복사'}</button>
              </div>
            </div>
          ))}

          <div style={{ marginTop: '8px', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '12px', color: '#92400e', lineHeight: 1.8 }}>
            <b>등록 방법:</b><br />
            Supabase Dashboard → Edge Functions → <b>Secrets</b> 탭<br />
            → 위 3개 키/값을 각각 추가 → Save
          </div>
        </Card>
      )}

      {/* 작동 조건 */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: '14px', color: C.text, marginBottom: '12px' }}>📋 작동 조건 안내</div>
        {[
          ['Android Chrome / Samsung Browser', '✅ 바로 작동'],
          ['PC Chrome / Edge / Firefox', '✅ 바로 작동'],
          ['iPhone Safari (iOS 16.4 이상)', '📲 홈 화면 추가(PWA) 후 작동'],
          ['iPhone Safari (iOS 16.3 이하)', '❌ 미지원'],
          ['카카오 인앱 브라우저', '❌ 미지원'],
        ].map(([env, desc]) => (
          <div key={env} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
            <span style={{ color: C.text }}>{env}</span>
            <span style={{ color: C.muted }}>{desc}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ─── 섹션: 약관 / 개인정보처리방침
function LegalSection() {
  const DEFAULT_TERMS = `방과후 출석부 서비스 이용약관

제1조 (목적)
본 약관은 집현전에듀 지원센터(이하 "운영자")가 제공하는 방과후 출석부 서비스(이하 "서비스")의 이용과 관련하여 운영자와 이용자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 운영자가 제공하는 방과후 출결 관리 웹 애플리케이션 및 관련 부가 서비스 일체를 말합니다.
2. "이용자"란 본 약관에 동의하고 서비스에 가입하여 이용하는 자를 말합니다.

제3조 (약관의 효력 및 변경)
본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다. 운영자는 필요한 경우 관련 법령에 위반되지 않는 범위 내에서 본 약관을 변경할 수 있으며, 변경 시 시행 7일 전에 서비스 내 공지합니다.

제4조 (서비스 이용 계약의 성립)
서비스 이용 계약은 이용자가 본 약관에 동의하고, 소셜 로그인 등을 통해 회원 가입을 완료한 시점에 성립합니다.

제5조 (이용자의 의무)
이용자는 타인의 개인정보 무단 수집, 서비스 운영 방해, 관련 법령 위반 행위를 하여서는 안 됩니다.

제6조 (면책 조항)
운영자는 천재지변, 불가항력적 사유로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.

[시행일] 2025년 1월 1일`

  const DEFAULT_PRIVACY = `개인정보처리방침

집현전에듀 지원센터(이하 "운영자")는 방과후 출석부 서비스 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.

1. 수집하는 개인정보 항목
- 네이버/카카오 로그인: 이름, 이메일, 프로필 사진, 고유 식별자
- 서비스 이용 중: 학급 정보, 학생 이름, 출결 기록

2. 개인정보의 수집 및 이용 목적
- 회원 식별 및 로그인 서비스 제공
- 방과후 출결 관리 서비스 제공
- 서비스 관련 공지 및 안내 발송

3. 개인정보의 보유 및 이용 기간
서비스 이용 계약 존속 기간 동안 보유하며, 회원 탈퇴 시 지체 없이 파기합니다.

4. 개인정보의 제3자 제공
운영자는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다.

5. 개인정보 처리 위탁
- Supabase Inc.: 데이터베이스 저장 및 관리
- 네이버㈜: 소셜 로그인 인증 처리

6. 개인정보 보호 책임자
- 담당자: 민찬홍 (집현전에듀 지원센터)
- 이메일: afterschool.rollbook@gmail.com
- 전화: 010-2704-0307

[시행일] 2025년 1월 1일`

  const stored = Settings.get('legal') || {}
  const [terms,   setTerms]   = useState(stored.terms   || DEFAULT_TERMS)
  const [privacy, setPrivacy] = useState(stored.privacy || DEFAULT_PRIVACY)
  const [subtab,  setSubtab]  = useState('terms')
  const { success } = useToast()

  const save = () => {
    Settings.set('legal', { terms, privacy })
    success('약관이 저장되었습니다. (Supabase 동기화 완료)')
  }

  const reset = () => {
    if (subtab === 'terms') setTerms(DEFAULT_TERMS)
    else setPrivacy(DEFAULT_PRIVACY)
  }

  const textareaStyle = {
    width: '100%', minHeight: '420px', padding: '14px 16px',
    borderRadius: '10px', border: `1.5px solid ${C.border}`,
    fontSize: '13px', fontFamily: 'Noto Sans KR, sans-serif',
    lineHeight: '1.8', color: C.text, resize: 'vertical', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <Card style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '16px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>📜 약관 / 개인정보처리방침 관리</div>
      <div style={{ fontSize: '13px', color: C.muted, marginBottom: '20px', lineHeight: 1.6 }}>
        네이버 로그인 플러스 검수 및 서비스 공개용 약관을 관리합니다.
        저장 시 Supabase에 자동으로 동기화됩니다.
      </div>

      {/* 서브탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: `1px solid ${C.border}`, paddingBottom: '0' }}>
        {[
          { key: 'terms',   label: '📜 서비스 이용약관' },
          { key: 'privacy', label: '🔒 개인정보처리방침' },
        ].map(t => (
          <button key={t.key} onClick={() => setSubtab(t.key)}
            style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', background: 'none',
              color: subtab === t.key ? C.primary : '#9ca3af',
              fontWeight: subtab === t.key ? 700 : 400, fontSize: '13px',
              borderBottom: subtab === t.key ? `2px solid ${C.primary}` : '2px solid transparent',
              fontFamily: 'Noto Sans KR, sans-serif', marginBottom: '-1px', transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* URL 안내 */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#15803d' }}>
        💡 약관 페이지 URL: <strong>/terms</strong> · <strong>/privacy</strong> — Vercel 배포 후 네이버 개발자센터에 해당 URL 등록하세요.
      </div>

      {/* 텍스트 에디터 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
          {subtab === 'terms' ? '서비스 이용약관 본문' : '개인정보처리방침 본문'}
        </label>
        <textarea
          value={subtab === 'terms' ? terms : privacy}
          onChange={e => subtab === 'terms' ? setTerms(e.target.value) : setPrivacy(e.target.value)}
          style={textareaStyle}
          onFocus={e => e.target.style.borderColor = C.primary}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <div style={{ fontSize: '12px', color: C.muted }}>
          {(subtab === 'terms' ? terms : privacy).length.toLocaleString()}자
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <button onClick={reset}
          style={{ padding: '8px 16px', borderRadius: '8px', border: `1.5px solid ${C.border}`, background: '#fff', color: C.muted, fontSize: '13px', cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>
          🔄 기본값으로 초기화
        </button>
        <Btn onClick={save}>💾 저장 (Supabase 동기화)</Btn>
      </div>
    </Card>
  )
}

// ─── 메인
export function AdminSettings() {
  const [tab, setTab] = useState('social')

  return (
    <div style={{ padding:'28px', maxWidth:'780px' }}>
      <PageHeader title="서비스 설정" sub="소셜 로그인 연동, 포인트 정책 등을 관리합니다." />

      <div style={{ display:'flex', gap:'0', marginBottom:'24px', borderBottom:`1px solid ${C.border}`, paddingBottom:'0', overflowX:'auto' }}>
        {[
          { key:'service',     label:'⚙️ 기본 설정' },
          { key:'social',      label:'🔑 소셜 로그인' },
          { key:'email',       label:'📧 이메일 발송' },
          { key:'solapi',      label:'📱 문자·알림톡' },
          { key:'push',        label:'🔔 푸시 알림' },
          { key:'legal',       label:'📜 약관 관리' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'10px 16px', border:'none', cursor:'pointer', background:'none', color:tab===t.key?C.primary:'#9ca3af', fontWeight:tab===t.key?700:400, fontSize:'14px', borderBottom:tab===t.key?`2px solid ${C.primary}`:'2px solid transparent', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'-1px', transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'social'      && <SocialSection />}
      {tab === 'email'       && <EmailSection />}
      {tab === 'solapi'      && <SolapiSection />}
      {tab === 'push'        && <PushSection />}
      {tab === 'service'     && <ServiceSection />}
      {tab === 'legal'       && <LegalSection />}
    </div>
  )
}