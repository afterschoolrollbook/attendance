import React, { useState } from 'react'
import { Settings, Students as StudentsDB, Classes as ClassesDB } from '../lib/db.js'
import { Card, PageHeader, Toggle, Btn, Modal, useConfirm } from '../components/Atoms.jsx'
import { useToast } from '../hooks/useToast.js'

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

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const save = () => {
    Settings.set('social', cfg)
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
  const init = Settings.get('email') || { resendApiKey:'', fromEmail:'', enabled:false }
  const [cfg, setCfg] = useState(init)
  const { success } = useToast()
  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const save = () => {
    Settings.set('email', cfg)
    success('수정이 완료되었습니다.')
  }

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
  const init = Settings.get('solapi') || { apiKey:'', apiSecret:'', senderPhone:'', kakaoChannelId:'', kakaoEnabled:false, smsEnabled:false }
  const [cfg, setCfg] = useState(init)
  const [testing, setTesting] = useState(false)
  const { success, toastError } = useToast()

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const save = () => {
    Settings.set('solapi', cfg)
    success('수정이 완료되었습니다.')
  }

  const testSMS = async () => {
    if (!cfg.apiKey || !cfg.senderPhone) { toastError('API 키와 발신번호를 먼저 입력하세요.'); return }
    setTesting(true)
    setTimeout(() => {
      success('테스트 발송 기능은 Phase 4 백엔드 연동 후 사용 가능합니다.')
      setTesting(false)
    }, 1000)
  }

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

// ─── 섹션: 지역/학교 관리
function RegionSection() {
  const [regions,    setRegions]    = useState(() => (Settings.get('regionMap') || {}).regions    || [])
  const [neisApiKey, setNeisApiKey] = useState(() => (Settings.get('regionMap') || {}).neisApiKey || '')
  const { success, toastError } = useToast()
  const confirm = useConfirm()

  // NEIS 학교 검색
  const [neisQuery,   setNeisQuery]   = useState('')
  const [neisResults, setNeisResults] = useState([])
  const [neisLoading, setNeisLoading] = useState(false)
  const [neisMsg,     setNeisMsg]     = useState(null)

  const searchNeis = async () => {
    if (!neisApiKey.trim()) { setNeisMsg({ ok:false, msg:'NEIS API 키를 먼저 입력하고 저장하세요.' }); return }
    if (!neisQuery.trim())  { setNeisMsg({ ok:false, msg:'학교명을 입력하세요.' }); return }
    setNeisLoading(true); setNeisMsg(null); setNeisResults([])
    try {
      const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${neisApiKey.trim()}&Type=json&pIndex=1&pSize=20&SCHUL_NM=${encodeURIComponent(neisQuery.trim())}`
      const res  = await fetch(url)
      const data = await res.json()
      const rows = data?.schoolInfo?.[1]?.row || []
      if (rows.length === 0) { setNeisMsg({ ok:false, msg:'검색 결과가 없습니다.' }); return }
      setNeisResults(rows.map(r => ({
        name:       r.SCHUL_NM,
        sido:       r.ATPT_OFCDC_SC_NM?.replace('교육청','').replace('특별시','').replace('광역시','').replace('특별자치시','').replace('특별자치도','').replace('도','').trim() || '',
        sidoFull:   r.ATPT_OFCDC_SC_NM || '',
        support:    r.JU_ORG_NM || '',
        address:    r.ORG_RDNMA || '',
        url:        r.HMPG_ADRES || '',
        phone:      r.ORG_TELNO || '',
      })))
    } catch(e) {
      setNeisMsg({ ok:false, msg:'검색 중 오류가 발생했습니다. API 키를 확인해주세요.' })
    } finally {
      setNeisLoading(false)
    }
  }

  const addFromNeis = (school) => {
    const currentKey = neisApiKey  // 현재 입력된 키
    const existing = regions.find(r => r.support === school.support && r.sido === school.sido)
    let updated
    if (existing) {
      if (!existing.schools.find(s => (s.name||s) === school.name)) {
        updated = regions.map(r =>
          r.id === existing.id
            ? { ...r, schools: [...r.schools, { name: school.name, url: school.url }] }
            : r
        )
        setRegions(updated)
        Settings.set('regionMap', { regions: updated, neisApiKey: currentKey })
        setNeisMsg({ ok:true, msg:`✅ ${school.name}을(를) "${school.support}"에 추가하고 저장했습니다.` })
      } else {
        setNeisMsg({ ok:false, msg:`${school.name}은(는) 이미 등록되어 있습니다.` })
      }
    } else {
      const newEntry = {
        id: String(Date.now()), sido: school.sido, office: school.sidoFull,
        officeUrl: '', support: school.support, supportUrl: '',
        schools: [{ name: school.name, url: school.url }]
      }
      updated = [...regions, newEntry]
      setRegions(updated)
      Settings.set('regionMap', { regions: updated, neisApiKey: currentKey })
      setNeisMsg({ ok:true, msg:`✅ ${school.name}과(와) "${school.support}"을(를) 추가하고 저장했습니다.` })
    }
    // 저장 확인 로그
    console.log('[RegionSection] 저장된 데이터:', Settings.get('regionMap'))
  }

  // 폼 상태
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [form, setForm] = useState({ sido:'', office:'', officeUrl:'', support:'', supportUrl:'', schoolInput:'', schoolUrlInput:'' })
  const [schools, setSchools] = useState([])  // [{ name, url }, ...]

  // 미매핑 학교 계산
  const { Students, Classes } = (() => {
    try {
      const s = StudentsDB.all()
      const c = ClassesDB.all()
      return { Students: s, Classes: c }
    } catch { return { Students: [], Classes: [] } }
  })()

  const allSchools = [...new Set([
    ...Students.map(s => s.school).filter(Boolean),
    ...Classes.map(c => c.organization).filter(Boolean),
  ])]
  const mappedSchools = new Set(regions.flatMap(r => r.schools.map(s => s.name || s)))
  const unmappedSchools = allSchools.filter(s => !mappedSchools.has(s))

  const inSt  = { padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', width:'100%', boxSizing:'border-box' }
  const selSt = { ...inSt, background:'#fff' }

  const SIDO_LIST = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']

  const saveAll = () => {
    Settings.set('regionMap', { regions, neisApiKey })
    success('수정이 완료되었습니다.')
  }

  const openNew = () => {
    setForm({ sido:'', office:'', officeUrl:'', support:'', supportUrl:'', schoolInput:'', schoolUrlInput:'' })
    setSchools([]); setEditId(null); setShowForm(true)
  }

  const openEdit = (r) => {
    setForm({ sido:r.sido, office:r.office||'', officeUrl:r.officeUrl||'', support:r.support||'', supportUrl:r.supportUrl||'', schoolInput:'', schoolUrlInput:'' })
    setSchools(r.schools.map(s => typeof s === 'string' ? { name:s, url:'' } : s))
    setEditId(r.id); setShowForm(true)
  }

  const addSchool = () => {
    const name = form.schoolInput.trim()
    if (!name) return
    if (!schools.find(s => s.name === name)) setSchools(p => [...p, { name, url: form.schoolUrlInput.trim() }])
    setForm(p => ({ ...p, schoolInput:'', schoolUrlInput:'' }))
  }

  const addUnmapped = (school) => {
    if (!schools.find(s => s.name === school)) setSchools(p => [...p, { name: school, url: '' }])
  }

  const removeSchool = (name) => setSchools(p => p.filter(s => s.name !== name))

  const saveForm = () => {
    if (!form.sido) { toastError('시도를 선택하세요.'); return }
    if (!form.support.trim()) { toastError('교육지원청명을 입력하세요.'); return }
    const entry = { id: editId || String(Date.now()), sido: form.sido, office: form.office.trim(), officeUrl: form.officeUrl.trim(), support: form.support.trim(), supportUrl: form.supportUrl.trim(), schools }
    if (editId) {
      setRegions(p => p.map(r => r.id === editId ? entry : r))
    } else {
      setRegions(p => [...p, entry])
    }
    setShowForm(false); setEditId(null)
  }

  const deleteRegion = (id) => {
    confirm('삭제하시겠습니까?', () => {
      setRegions(p => p.filter(r => r.id !== id))
    })
  }

  return (
    <Card style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>🗺️ 지역 / 학교 관리</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:1.6 }}>
        시도 → 교육청 → 교육지원청 → 학교 계층을 등록합니다.<br/>
        NEIS API로 학교를 검색하면 교육지원청·홈페이지가 자동으로 입력됩니다.
      </div>

      {/* NEIS API 키 입력 */}
      <div style={{ padding:'16px', background:'#f0f9ff', borderRadius:'12px', border:'1.5px solid #bae6fd', marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
          <span style={{ fontSize:'20px' }}>🏫</span>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>NEIS 교육정보 Open API</div>
            <div style={{ fontSize:'12px', color:C.muted }}>학교명 검색 시 교육지원청·홈페이지 자동 입력</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>
              API 인증키 <a href="https://open.neis.go.kr/portal/guide/apiUsageGuide.do" target="_blank" rel="noopener noreferrer" style={{ color:'#0369a1', fontSize:'11px', marginLeft:'6px' }}>📋 발급받기</a>
            </label>
            <input value={neisApiKey} onChange={e => setNeisApiKey(e.target.value)}
              placeholder="NEIS Open API 인증키 입력"
              style={{ padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'monospace', outline:'none', width:'100%', boxSizing:'border-box' }} />
          </div>
          <button onClick={saveAll}
            style={{ padding:'8px 16px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', height:'38px' }}>
            💾 저장
          </button>
        </div>

        {/* NEIS 학교 검색 */}
        <div style={{ marginTop:'14px', borderTop:`1px solid #bae6fd`, paddingTop:'14px' }}>
          <div style={{ fontSize:'13px', fontWeight:600, color:C.text, marginBottom:'8px' }}>🔍 학교 검색 (NEIS API)</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <input value={neisQuery} onChange={e => setNeisQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchNeis()}
              placeholder="학교명 입력 후 검색 (예: 군포초등학교)"
              style={{ flex:1, padding:'8px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none' }} />
            <button onClick={searchNeis} disabled={neisLoading}
              style={{ padding:'8px 16px', borderRadius:'9px', border:`1.5px solid #0369a1`, background:neisLoading?'#f0f9ff':'#0369a1', color:neisLoading?'#0369a1':'#fff', fontSize:'13px', fontWeight:700, cursor:neisLoading?'not-allowed':'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', opacity:neisLoading?0.7:1 }}>
              {neisLoading ? '검색 중...' : '검색'}
            </button>
          </div>

          {neisMsg && (
            <div style={{ marginTop:'8px', fontSize:'12px', padding:'8px 12px', borderRadius:'7px', background:neisMsg.ok?'#f0fdf4':'#fef2f2', color:neisMsg.ok?'#16a34a':'#ef4444', border:`1px solid ${neisMsg.ok?'#86efac':'#fca5a5'}` }}>
              {neisMsg.ok ? '✅' : '⚠️'} {neisMsg.msg}
            </div>
          )}

          {neisResults.length > 0 && (
            <div style={{ marginTop:'10px', display:'flex', flexDirection:'column', gap:'6px', maxHeight:'280px', overflowY:'auto' }}>
              {neisResults.map((school, i) => (
                <div key={i} style={{ padding:'10px 12px', background:'#fff', borderRadius:'9px', border:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{school.name}</div>
                    <div style={{ fontSize:'11px', color:C.muted, marginTop:'2px' }}>
                      {school.sido} · {school.support}
                      {school.address && ` · ${school.address}`}
                    </div>
                    {school.url && <a href={school.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', color:'#3b82f6' }}>🔗 홈페이지</a>}
                  </div>
                  <button onClick={() => addFromNeis(school)}
                    style={{ padding:'5px 12px', borderRadius:'7px', border:`1.5px solid ${C.primary}`, background:'#fff7ed', color:C.primary, fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap' }}>
                    + 추가
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 미매핑 학교 알림 */}
      {unmappedSchools.length > 0 && (
        <div style={{ padding:'14px 16px', background:'#fffbeb', borderRadius:'12px', border:'1.5px solid #fde68a', marginBottom:'20px' }}>
          <div style={{ fontSize:'14px', fontWeight:700, color:'#92400e', marginBottom:'10px' }}>
            ⚠️ 지역/교육청 미등록 학교 {unmappedSchools.length}곳
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
            {unmappedSchools.map(s => (
              <span key={s} style={{ fontSize:'12px', padding:'3px 10px', background:'#fff', border:'1px solid #fde68a', borderRadius:'6px', color:'#92400e', display:'flex', alignItems:'center', gap:'6px' }}>
                {s}
                {showForm && (
                  <button onClick={() => addUnmapped(s)}
                    style={{ background:'#f97316', color:'#fff', border:'none', borderRadius:'4px', padding:'1px 6px', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                    + 추가
                  </button>
                )}
              </span>
            ))}
          </div>
          {!showForm && (
            <div style={{ fontSize:'12px', color:'#b45309', marginTop:'8px' }}>
              📌 교육지원청 등록/수정 시 미등록 학교를 바로 추가할 수 있습니다.
            </div>
          )}
        </div>
      )}

      {/* 추가 버튼 */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
        <button onClick={openNew}
          style={{ padding:'8px 16px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          + 교육지원청 추가
        </button>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <div style={{ padding:'18px', background:'#fff7ed', borderRadius:'12px', border:`1.5px solid ${C.primary}`, marginBottom:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={{ fontSize:'15px', fontWeight:700, color:C.text }}>{editId ? '교육지원청 수정' : '교육지원청 추가'}</div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>시도 *</label>
              <select value={form.sido} onChange={e => setForm(p=>({...p,sido:e.target.value}))} style={selSt}>
                <option value="">선택</option>
                {SIDO_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육청 (시도교육청)</label>
              <input value={form.office} onChange={e => setForm(p=>({...p,office:e.target.value}))} placeholder="예: 경기도교육청" style={inSt} />
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육지원청 *</label>
              <input value={form.support} onChange={e => setForm(p=>({...p,support:e.target.value}))} placeholder="예: 군포의왕교육지원청" style={inSt} />
            </div>
          </div>

          {/* 교육청/교육지원청 URL */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육청 홈페이지 URL</label>
              <input value={form.officeUrl} onChange={e => setForm(p=>({...p,officeUrl:e.target.value}))} placeholder="https://www.goe.go.kr" style={inSt} />
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육지원청 홈페이지 URL</label>
              <input value={form.supportUrl} onChange={e => setForm(p=>({...p,supportUrl:e.target.value}))} placeholder="https://gunpo.goe.go.kr" style={inSt} />
            </div>
          </div>

          {/* 학교 추가 */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>소속 학교</label>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 2fr auto', gap:'8px', marginBottom:'8px', alignItems:'flex-end' }}>
              <div>
                <div style={{ fontSize:'11px', color:C.muted, marginBottom:'3px' }}>학교명</div>
                <input value={form.schoolInput} onChange={e => setForm(p=>({...p,schoolInput:e.target.value}))}
                  onKeyDown={e => e.key === 'Enter' && addSchool()}
                  placeholder="예: 군포초등학교" style={inSt} />
              </div>
              <div>
                <div style={{ fontSize:'11px', color:C.muted, marginBottom:'3px' }}>홈페이지 URL (선택)</div>
                <input value={form.schoolUrlInput} onChange={e => setForm(p=>({...p,schoolUrlInput:e.target.value}))}
                  onKeyDown={e => e.key === 'Enter' && addSchool()}
                  placeholder="https://gunpo.es.kr" style={inSt} />
              </div>
              <button onClick={addSchool}
                style={{ padding:'8px 14px', borderRadius:'9px', border:`1.5px solid ${C.primary}`, background:'#fff', color:C.primary, fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', whiteSpace:'nowrap', height:'38px' }}>
                추가
              </button>
            </div>
            {unmappedSchools.length > 0 && (
              <div style={{ marginBottom:'8px' }}>
                <div style={{ fontSize:'11px', color:'#b45309', marginBottom:'4px' }}>⚠️ 미등록 학교 클릭하여 빠르게 추가:</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                  {unmappedSchools.filter(s => !schools.find(x => x.name === s)).map(s => (
                    <button key={s} onClick={() => addUnmapped(s)}
                      style={{ padding:'2px 8px', borderRadius:'5px', border:'1px solid #fde68a', background:'#fffbeb', color:'#92400e', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {schools.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                {schools.map(s => (
                  <div key={s.name} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 10px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'7px' }}>
                    <span style={{ fontSize:'12px', fontWeight:600, color:'#15803d', flex:1 }}>🏫 {s.name}</span>
                    {s.url
                      ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', color:'#3b82f6', textDecoration:'none' }}>🔗 홈페이지</a>
                      : <span style={{ fontSize:'11px', color:'#d1d5db' }}>URL 미등록</span>
                    }
                    <button onClick={() => removeSchool(s.name)}
                      style={{ background:'#fef2f2', border:'1px solid #fca5a5', color:'#ef4444', cursor:'pointer', padding:'2px 8px', fontSize:'12px', borderRadius:'5px', fontFamily:'Noto Sans KR, sans-serif' }}>삭제</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              style={{ padding:'7px 14px', borderRadius:'8px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
            <button onClick={saveForm}
              style={{ padding:'7px 16px', borderRadius:'8px', border:'none', background:C.primary, color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
          </div>
        </div>
      )}

      {/* 등록된 목록 */}
      {regions.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px', color:C.muted, background:'#f9fafb', borderRadius:'12px', fontSize:'14px' }}>
          <div style={{ fontSize:'32px', marginBottom:'10px' }}>🗺️</div>
          등록된 지역이 없습니다.<br/>
          <span style={{ fontSize:'13px' }}>교육지원청 추가 버튼으로 시작하세요.</span>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'20px' }}>
          {/* 시도별 그룹 */}
          {SIDO_LIST.filter(sido => regions.some(r => r.sido === sido)).map(sido => (
            <div key={sido}>
              <div style={{ fontSize:'13px', fontWeight:700, color:'#374151', padding:'6px 10px', background:'#f3f4f6', borderRadius:'8px', marginBottom:'6px' }}>
                📍 {sido}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px', paddingLeft:'10px' }}>
                {regions.filter(r => r.sido === sido).map(r => (
                  <div key={r.id} style={{ padding:'12px 16px', background:'#fff', borderRadius:'10px', border:`1px solid ${C.border}`, display:'flex', alignItems:'flex-start', gap:'12px' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                        {r.office && <span style={{ fontSize:'12px', color:C.muted }}>
                          {r.officeUrl
                            ? <a href={r.officeUrl} target="_blank" rel="noopener noreferrer" style={{ color:C.muted, textDecoration:'none' }}>{r.office} 🔗</a>
                            : r.office} &rsaquo;
                        </span>}
                        <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>
                          {r.supportUrl
                            ? <a href={r.supportUrl} target="_blank" rel="noopener noreferrer" style={{ color:C.text, textDecoration:'none' }}>{r.support} 🔗</a>
                            : r.support}
                        </span>
                        <span style={{ fontSize:'11px', background:'#eff6ff', color:'#3b82f6', padding:'1px 7px', borderRadius:'5px', fontWeight:600 }}>
                          학교 {r.schools.length}곳
                        </span>
                      </div>
                      {r.schools.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginTop:'6px' }}>
                          {r.schools.map(s => (
                            <span key={s.name || s} style={{ fontSize:'11px', padding:'2px 8px', background:'#f9fafb', border:`1px solid ${C.border}`, borderRadius:'5px', color:C.muted, display:'flex', alignItems:'center', gap:'4px' }}>
                              {s.name || s}
                              {(s.url) && <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color:'#3b82f6', textDecoration:'none', fontSize:'11px' }}>🔗</a>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      <button onClick={() => openEdit(r)}
                        style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>수정</button>
                      <button onClick={() => deleteRegion(r.id)}
                        style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#ef4444' }}>삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    </Card>
  )
}

// ─── 섹션: 강사 서비스 관리
const TS_KEY = 'asa_settings_teacherService'

function loadTS() {
  return Settings.get('teacherService') || { menuVisible:{ training:true, certificates:true, career:true, jobs:true }, trainingSites:[], certPartners:[], jobPostings:[] }
}
function saveTS(data) { Settings.set('teacherService', data) }

const MENU_LABELS = [
  { key:'training',     icon:'🎓', label:'연수관리',   desc:'의무연수 이수 기록 및 연수 사이트 안내' },
  { key:'certificates', icon:'🏆', label:'자격증관리', desc:'보유 자격증 및 취득 기관 안내' },
  { key:'career',       icon:'📋', label:'이력관리',   desc:'강사 활동 이력 및 서류 관리' },
  { key:'jobs',         icon:'📢', label:'공고관리',   desc:'방과후 구인 공고 알림 구독 및 조회' },
]

function SubTitle({ children }) {
  return <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'14px', paddingBottom:'10px', borderBottom:`1px solid ${C.border}` }}>{children}</div>
}

function TeacherServiceSection() {
  const [ts, setTs]       = useState(loadTS)
  const [subtab, setSubtab] = useState('menu')
  const { success, toastError } = useToast()
  const confirm = useConfirm()

  // ── 연수기관 폼
  const EMPTY_SITE = { name:'', url:'', desc:'', courses:'' }
  const [siteModal, setSiteModal]   = useState(false)
  const [siteForm, setSiteForm]     = useState(EMPTY_SITE)
  const [siteEditIdx, setSiteEditIdx] = useState(null)

  // ── 자격증 제휴처 폼
  const EMPTY_PARTNER = { name:'', url:'', desc:'', tag:'제휴', subjects:'' }
  const [partnerModal, setPartnerModal]   = useState(false)
  const [partnerForm, setPartnerForm]     = useState(EMPTY_PARTNER)
  const [partnerEditIdx, setPartnerEditIdx] = useState(null)

  // ── 공고 직접 등록 폼
  const EMPTY_JOB = { title:'', office:'', school:'', subject:'', deadline:'', url:'', memo:'' }
  const [jobModal, setJobModal]   = useState(false)
  const [jobForm, setJobForm]     = useState(EMPTY_JOB)
  const [jobEditIdx, setJobEditIdx] = useState(null)

  const update = (patch) => { const next = { ...ts, ...patch }; setTs(next); return next }

  const save = (patch) => {
    const next = patch ? { ...ts, ...patch } : ts
    setTs(next); saveTS(next)
    success('수정이 완료되었습니다.')
  }

  // ─ 연수기관 저장
  const saveSite = () => {
    if (!siteForm.name.trim()) { toastError('기관명을 입력하세요.'); return }
    const item = { ...siteForm, courses: siteForm.courses.split('\n').map(s=>s.trim()).filter(Boolean), id: siteEditIdx !== null ? ts.trainingSites[siteEditIdx].id : String(Date.now()) }
    const updated = siteEditIdx !== null
      ? ts.trainingSites.map((s,i) => i===siteEditIdx ? item : s)
      : [...ts.trainingSites, item]
    save({ trainingSites: updated })
    setSiteModal(false)
  }
  const openAddSite = () => { setSiteForm(EMPTY_SITE); setSiteEditIdx(null); setSiteModal(true) }
  const openEditSite = (i) => {
    const s = ts.trainingSites[i]
    setSiteForm({ name:s.name, url:s.url||'', desc:s.desc||'', courses: Array.isArray(s.courses) ? s.courses.join('\n') : (s.courses||'') })
    setSiteEditIdx(i); setSiteModal(true)
  }
  const deleteSite = (i) => {
    confirm('삭제할까요?', () => {
      save({ trainingSites: ts.trainingSites.filter((_,idx)=>idx!==i) })
    })
  }

  // ─ 자격증 제휴처 저장
  const savePartner = () => {
    if (!partnerForm.name.trim()) { toastError('기관명을 입력하세요.'); return }
    const item = { ...partnerForm, subjects: partnerForm.subjects.split(',').map(s=>s.trim()).filter(Boolean), id: partnerEditIdx !== null ? ts.certPartners[partnerEditIdx].id : String(Date.now()) }
    const updated = partnerEditIdx !== null
      ? ts.certPartners.map((p,i) => i===partnerEditIdx ? item : p)
      : [...ts.certPartners, item]
    save({ certPartners: updated })
    setPartnerModal(false)
  }
  const openAddPartner = () => { setPartnerForm(EMPTY_PARTNER); setPartnerEditIdx(null); setPartnerModal(true) }
  const openEditPartner = (i) => {
    const p = ts.certPartners[i]
    setPartnerForm({ name:p.name, url:p.url||'', desc:p.desc||'', tag:p.tag||'제휴', subjects: Array.isArray(p.subjects) ? p.subjects.join(', ') : (p.subjects||'') })
    setPartnerEditIdx(i); setPartnerModal(true)
  }
  const deletePartner = (i) => {
    confirm('삭제할까요?', () => {
      save({ certPartners: ts.certPartners.filter((_,idx)=>idx!==i) })
    })
  }

  // ─ 공고 직접 등록
  const saveJob = () => {
    if (!jobForm.title.trim()) { toastError('공고 제목을 입력하세요.'); return }
    const item = { ...jobForm, id: jobEditIdx !== null ? ts.jobPostings[jobEditIdx].id : String(Date.now()), createdAt: jobEditIdx !== null ? ts.jobPostings[jobEditIdx].createdAt : new Date().toISOString().slice(0,10) }
    const updated = jobEditIdx !== null
      ? ts.jobPostings.map((j,i) => i===jobEditIdx ? item : j)
      : [item, ...ts.jobPostings]
    save({ jobPostings: updated })
    setJobModal(false)
  }
  const openAddJob = () => { setJobForm(EMPTY_JOB); setJobEditIdx(null); setJobModal(true) }
  const openEditJob = (i) => { setJobForm({ ...ts.jobPostings[i] }); setJobEditIdx(i); setJobModal(true) }
  const deleteJob = (i) => {
    confirm('삭제할까요?', () => {
      save({ jobPostings: ts.jobPostings.filter((_,idx)=>idx!==i) })
    })
  }

  const fStyle = { width:'100%', padding:'9px 12px', borderRadius:'9px', border:`1.5px solid ${C.border}`, fontSize:'13px', fontFamily:'Noto Sans KR, sans-serif', outline:'none', boxSizing:'border-box' }
  const tagColors = { '제휴':'#eff6ff:#bfdbfe:#1d4ed8', '광고':'#fff7ed:#fed7aa:#9a3412', '공식':'#f0fdf4:#86efac:#15803d' }
  const getTagColor = (tag) => { const [bg,border,text] = (tagColors[tag]||'#f3f4f6:#d1d5db:#374151').split(':'); return { bg,border,color:text } }

  return (
    <Card style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>🎓 강사 서비스 관리</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:1.6 }}>
        사이드바의 "내 관리" 메뉴 ON/OFF, 연수기관·자격증 제휴처·공고를 직접 등록하고 관리합니다.
      </div>

      {/* 서브탭 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'20px', flexWrap:'wrap' }}>
        {[
          { key:'menu',     label:'📋 메뉴 ON/OFF' },
          { key:'training', label:'🎓 연수기관 관리' },
          { key:'cert',     label:'🏆 자격증 제휴처' },
          { key:'jobs',     label:'📢 공고 직접 등록' },
        ].map(t => (
          <button key={t.key} onClick={() => setSubtab(t.key)}
            style={{ padding:'7px 14px', borderRadius:'8px', border:`1.5px solid ${subtab===t.key?C.primary:C.border}`, background: subtab===t.key?'#fff7ed':'#fff', color: subtab===t.key?C.primary:'#6b7280', fontWeight: subtab===t.key?700:400, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 메뉴 ON/OFF */}
      {subtab === 'menu' && (
        <>
          <SubTitle>📋 사이드바 "내 관리" 메뉴 표시 설정</SubTitle>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>비활성화하면 모든 사용자의 사이드바에서 해당 메뉴가 숨겨집니다.</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
            {MENU_LABELS.map(m => (
              <div key={m.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background: ts.menuVisible[m.key]?'#fffbf5':'#f9fafb', borderRadius:'12px', border:`1.5px solid ${ts.menuVisible[m.key]?'#fed7aa':C.border}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'22px' }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{m.label}</div>
                    <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>{m.desc}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'12px', fontWeight:600, color: ts.menuVisible[m.key]?C.success:C.muted }}>
                    {ts.menuVisible[m.key] ? '표시' : '숨김'}
                  </span>
                  <Toggle
                    checked={ts.menuVisible[m.key]}
                    onChange={v => {
                      const next = { ...ts, menuVisible: { ...ts.menuVisible, [m.key]: v } }
                      setTs(next)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <Btn onClick={() => save()}>💾 저장</Btn>
          </div>
        </>
      )}

      {/* ── 연수기관 관리 */}
      {subtab === 'training' && (
        <>
          <SubTitle>🎓 연수기관 목록 관리</SubTitle>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>
            여기서 등록한 기관이 강사의 <strong>연수관리 → 연수 사이트</strong> 탭에 표시됩니다.
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'12px' }}>
            <button onClick={openAddSite} style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 기관 추가</button>
          </div>
          {ts.trainingSites.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}`, color:C.muted, fontSize:'14px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>🎓</div>
              등록된 연수기관이 없습니다.<br/>
              <span style={{ fontSize:'12px' }}>기본 연수기관은 강사 페이지에 하드코딩된 목록이 표시됩니다.</span>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
              {ts.trainingSites.map((s,i) => (
                <div key={s.id||i} style={{ padding:'14px 16px', background:'#fff', borderRadius:'10px', border:`1px solid ${C.border}`, display:'flex', alignItems:'flex-start', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{s.name}</span>
                      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'11px', color:'#3b82f6' }}>🔗 사이트</a>}
                    </div>
                    {s.desc && <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px' }}>{s.desc}</div>}
                    {s.courses?.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                        {s.courses.map((c,ci) => <span key={ci} style={{ fontSize:'11px', background:'#fff7ed', color:'#92400e', border:'1px solid #fde68a', borderRadius:'5px', padding:'1px 7px' }}>{c}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                    <button onClick={() => openEditSite(i)} style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                    <button onClick={() => deleteSite(i)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#ef4444' }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 자격증 제휴처 */}
      {subtab === 'cert' && (
        <>
          <SubTitle>🏆 자격증 취득 제휴처 / 광고 기관</SubTitle>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>
            여기서 등록한 기관이 강사의 <strong>자격증관리 → 취득 기관 안내</strong> 탭에 표시됩니다.<br/>
            제휴처·공식기관·광고 등 태그로 구분할 수 있습니다.
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'12px' }}>
            <button onClick={openAddPartner} style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 기관 추가</button>
          </div>
          {ts.certPartners.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}`, color:C.muted, fontSize:'14px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>🏆</div>
              등록된 제휴처가 없습니다.
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:'8px', marginBottom:'12px' }}>
              {ts.certPartners.map((p,i) => {
                const tc = getTagColor(p.tag)
                return (
                  <div key={p.id||i} style={{ padding:'14px 16px', background:'#fff', borderRadius:'10px', border:`1px solid ${C.border}` }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                      <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{p.name}</span>
                      <span style={{ fontSize:'11px', padding:'1px 7px', borderRadius:'5px', background:tc.bg, border:`1px solid ${tc.border}`, color:tc.color, fontWeight:700 }}>{p.tag}</span>
                    </div>
                    {p.desc && <div style={{ fontSize:'12px', color:C.muted, marginBottom:'6px' }}>{p.desc}</div>}
                    {p.subjects?.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:'3px', marginBottom:'8px' }}>
                        {p.subjects.map((s,si) => <span key={si} style={{ fontSize:'11px', background:'#f3f4f6', color:C.muted, borderRadius:'4px', padding:'1px 6px' }}>{s}</span>)}
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontSize:'12px', color:'#3b82f6' }}>🔗 바로가기</a>}
                      <div style={{ marginLeft:'auto', display:'flex', gap:'6px' }}>
                        <button onClick={() => openEditPartner(i)} style={{ padding:'3px 8px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                        <button onClick={() => deletePartner(i)} style={{ padding:'3px 8px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'11px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#ef4444' }}>삭제</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── 공고 직접 등록 */}
      {subtab === 'jobs' && (
        <>
          <SubTitle>📢 공고 직접 등록</SubTitle>
          <div style={{ fontSize:'13px', color:C.muted, marginBottom:'14px' }}>
            NEIS에서 자동 수집되지 않는 공고를 직접 등록하세요.<br/>
            강사의 <strong>공고관리 → 공고 조회</strong>에 함께 표시됩니다.
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'12px' }}>
            <button onClick={openAddJob} style={{ padding:'8px 18px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontWeight:700, fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>+ 공고 등록</button>
          </div>
          {ts.jobPostings.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', background:'#f9fafb', borderRadius:'12px', border:`1px solid ${C.border}`, color:C.muted, fontSize:'14px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>📢</div>
              직접 등록된 공고가 없습니다.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
              {ts.jobPostings.map((j,i) => (
                <div key={j.id||i} style={{ padding:'14px 18px', background:'#fff', borderRadius:'10px', border:`1px solid ${C.border}`, display:'flex', alignItems:'flex-start', gap:'12px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{j.title}</span>
                      {j.subject && <span style={{ fontSize:'12px', background:'#fff7ed', color:C.primary, border:'1px solid #fed7aa', borderRadius:'5px', padding:'1px 7px', fontWeight:600 }}>{j.subject}</span>}
                      {j.deadline && new Date(j.deadline) < new Date() && <span style={{ fontSize:'11px', background:'#fef2f2', color:'#ef4444', border:'1px solid #fca5a5', borderRadius:'5px', padding:'1px 6px', fontWeight:700 }}>마감</span>}
                    </div>
                    <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:C.muted, flexWrap:'wrap' }}>
                      {j.office && <span>🏛 {j.office}</span>}
                      {j.school && <span>🏫 {j.school}</span>}
                      {j.deadline && <span>⏰ 마감: {j.deadline}</span>}
                      <span>📅 등록: {j.createdAt}</span>
                    </div>
                    {j.memo && <div style={{ fontSize:'12px', color:'#374151', marginTop:'5px' }}>{j.memo}</div>}
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexShrink:0, alignItems:'center' }}>
                    {j.url && <a href={j.url} target="_blank" rel="noopener noreferrer" style={{ padding:'4px 10px', borderRadius:'6px', background:'#f0fdf4', border:'1px solid #86efac', fontSize:'12px', color:'#15803d', textDecoration:'none', fontWeight:600 }}>🔗 공고</a>}
                    <button onClick={() => openEditJob(i)} style={{ padding:'4px 10px', borderRadius:'6px', border:`1px solid ${C.border}`, background:'#f9fafb', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>편집</button>
                    <button onClick={() => deleteJob(i)} style={{ padding:'4px 10px', borderRadius:'6px', border:'1px solid #fca5a5', background:'#fef2f2', fontSize:'12px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:'#ef4444' }}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── 연수기관 모달 */}
      <Modal open={siteModal} onClose={()=>setSiteModal(false)} title={siteEditIdx !== null ? '연수기관 편집' : '연수기관 추가'} width={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:'13px' }}>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>기관명 *</label><input value={siteForm.name} onChange={e=>setSiteForm(v=>({...v,name:e.target.value}))} placeholder="예: 경기도교육청남부연수원" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>홈페이지 URL</label><input value={siteForm.url} onChange={e=>setSiteForm(v=>({...v,url:e.target.value}))} placeholder="https://" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>설명</label><input value={siteForm.desc} onChange={e=>setSiteForm(v=>({...v,desc:e.target.value}))} placeholder="간단한 설명" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>과정 목록 (줄바꿈으로 구분)</label>
            <textarea value={siteForm.courses} onChange={e=>setSiteForm(v=>({...v,courses:e.target.value}))} placeholder={'4대폭력예방교육\n개인정보 보호 교육'} rows={4} style={{ ...fStyle, resize:'vertical' }}/></div>
          <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
            <button onClick={saveSite} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
            <button onClick={()=>setSiteModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
          </div>
        </div>
      </Modal>

      {/* ─── 자격증 제휴처 모달 */}
      <Modal open={partnerModal} onClose={()=>setPartnerModal(false)} title={partnerEditIdx !== null ? '제휴처 편집' : '제휴처 추가'} width={460}>
        <div style={{ display:'flex', flexDirection:'column', gap:'13px' }}>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>기관명 *</label><input value={partnerForm.name} onChange={e=>setPartnerForm(v=>({...v,name:e.target.value}))} placeholder="예: 한국로봇산업협회" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>홈페이지 URL</label><input value={partnerForm.url} onChange={e=>setPartnerForm(v=>({...v,url:e.target.value}))} placeholder="https://" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>설명</label><input value={partnerForm.desc} onChange={e=>setPartnerForm(v=>({...v,desc:e.target.value}))} placeholder="간단한 설명" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>태그</label>
            <select value={partnerForm.tag} onChange={e=>setPartnerForm(v=>({...v,tag:e.target.value}))} style={fStyle}>
              <option value="제휴">제휴</option>
              <option value="광고">광고</option>
              <option value="공식">공식</option>
            </select>
          </div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>관련 과목 (쉼표 구분)</label><input value={partnerForm.subjects} onChange={e=>setPartnerForm(v=>({...v,subjects:e.target.value}))} placeholder="로봇과학, 코딩, 드론" style={fStyle}/></div>
          <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
            <button onClick={savePartner} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
            <button onClick={()=>setPartnerModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
          </div>
        </div>
      </Modal>

      {/* ─── 공고 등록 모달 */}
      <Modal open={jobModal} onClose={()=>setJobModal(false)} title={jobEditIdx !== null ? '공고 편집' : '공고 등록'} width={480}>
        <div style={{ display:'flex', flexDirection:'column', gap:'13px' }}>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>공고 제목 *</label><input value={jobForm.title} onChange={e=>setJobForm(v=>({...v,title:e.target.value}))} placeholder="예: 2026년 로봇과학 방과후 강사 모집" style={fStyle}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>교육지원청</label><input value={jobForm.office} onChange={e=>setJobForm(v=>({...v,office:e.target.value}))} placeholder="예: 경기군포의왕" style={fStyle}/></div>
            <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>학교명</label><input value={jobForm.school} onChange={e=>setJobForm(v=>({...v,school:e.target.value}))} placeholder="예: 군포초등학교" style={fStyle}/></div>
          </div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>과목</label><input value={jobForm.subject} onChange={e=>setJobForm(v=>({...v,subject:e.target.value}))} placeholder="예: 로봇과학" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>마감일</label><input type="date" value={jobForm.deadline} onChange={e=>setJobForm(v=>({...v,deadline:e.target.value}))} style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>공고 URL</label><input value={jobForm.url} onChange={e=>setJobForm(v=>({...v,url:e.target.value}))} placeholder="https://" style={fStyle}/></div>
          <div><label style={{ fontSize:'12px', fontWeight:600, color:C.muted, display:'block', marginBottom:'5px' }}>메모</label><input value={jobForm.memo} onChange={e=>setJobForm(v=>({...v,memo:e.target.value}))} placeholder="추가 안내사항" style={fStyle}/></div>
          <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
            <button onClick={saveJob} style={{ flex:1, padding:'11px', borderRadius:'9px', border:'none', background:C.primary, color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>저장</button>
            <button onClick={()=>setJobModal(false)} style={{ padding:'11px 18px', borderRadius:'9px', border:`1px solid ${C.border}`, background:'#fff', fontSize:'13px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', color:C.muted }}>취소</button>
          </div>
        </div>
      </Modal>

    </Card>
  )
}

// ─── 메인
export function AdminSettings() {
  const [tab, setTab] = useState('social')

  return (
    <div style={{ padding:'28px', maxWidth:'780px' }}>
      <PageHeader title="서비스 설정" sub="소셜 로그인 연동, 포인트 정책 등을 관리합니다." />

      <div style={{ display:'flex', gap:'8px', marginBottom:'24px', borderBottom:`1px solid ${C.border}`, paddingBottom:'0', flexWrap:'wrap' }}>
        {[
          { key:'social',   label:'🔑 소셜 로그인' },
          { key:'email',    label:'📧 이메일 발송' },
          { key:'solapi',   label:'📱 문자·알림톡' },
          { key:'service',  label:'⚙️ 기본 설정' },
          { key:'region',   label:'🗺️ 지역/학교' },
          { key:'teacher',  label:'🎓 강사 서비스' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'10px 16px', border:'none', cursor:'pointer', background:'none', color:tab===t.key?C.primary:'#9ca3af', fontWeight:tab===t.key?700:400, fontSize:'14px', borderBottom:tab===t.key?`2px solid ${C.primary}`:'2px solid transparent', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'-1px', transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'social'  && <SocialSection />}
      {tab === 'email'   && <EmailSection />}
      {tab === 'solapi'  && <SolapiSection />}
      {tab === 'service' && <ServiceSection />}
      {tab === 'region'  && <RegionSection />}
      {tab === 'teacher' && <TeacherServiceSection />}
    </div>
  )
}
