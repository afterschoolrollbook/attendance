import React, { useState } from 'react'
import { Settings } from '../lib/db.js'
import { Card, PageHeader, Toggle, Btn } from '../components/Atoms.jsx'

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

function SaveMsg({ data }) {
  if (!data) return null
  return (
    <div style={{ fontSize:'13px', padding:'8px 12px', borderRadius:'7px', background:data.ok?'#f0fdf4':'#fef2f2', color:data.ok?'#16a34a':'#ef4444', border:`1px solid ${data.ok?'#86efac':'#fca5a5'}` }}>
      {data.ok ? '✅' : '⚠️'} {data.msg}
    </div>
  )
}

// ─── 섹션: 소셜 로그인
function SocialSection() {
  const init = Settings.get('social') || { googleClientId:'', kakaoAppKey:'', googleEnabled:false, kakaoEnabled:false }
  const [cfg, setCfg] = useState(init)
  const [msg, setMsg] = useState(null)

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const save = () => {
    Settings.set('social', cfg)
    setMsg({ ok:true, msg:'저장되었습니다. 페이지 새로고침 후 적용됩니다.' })
    setTimeout(() => setMsg(null), 4000)
  }

  return (
    <Card style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>🔑 소셜 로그인 연동</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:1.6 }}>
        소셜 로그인 키를 등록하면 선생님들이 Google·카카오 계정으로 간편하게 가입/로그인할 수 있습니다.
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

        {/* 발급 안내 */}
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
            &nbsp;&nbsp;&nbsp;&nbsp;예: <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>https://afterschool.vercel.app</code><br />
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
              <div style={{ fontSize:'12px', color:C.muted }}>JavaScript SDK 방식</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Toggle checked={cfg.kakaoEnabled} onChange={v => set('kakaoEnabled', v)} />
            <span style={{ fontSize:'12px', fontWeight:600, color:cfg.kakaoEnabled?C.success:C.muted }}>{cfg.kakaoEnabled?'활성':'비활성'}</span>
          </div>
        </div>

        <Field label="JavaScript 앱 키" value={cfg.kakaoAppKey} onChange={v => set('kakaoAppKey', v)}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono />

        <details style={{ marginTop:'12px' }}>
          <summary style={{ fontSize:'12px', fontWeight:600, color:'#92400e', cursor:'pointer', userSelect:'none' }}>
            📋 카카오 앱 키 발급 방법 보기
          </summary>
          <div style={{ marginTop:'10px', padding:'12px 14px', background:'#fff', borderRadius:'8px', border:'1px solid #fde68a', fontSize:'12px', color:'#374151', lineHeight:2 }}>
            <strong>① Kakao Developers 접속</strong><br />
            &nbsp;&nbsp;<a href="https://developers.kakao.com" target="_blank" rel="noopener noreferrer" style={{ color:'#92400e' }}>developers.kakao.com</a> 접속 → 카카오 계정 로그인<br />
            <br />
            <strong>② 앱 생성</strong><br />
            &nbsp;&nbsp;내 애플리케이션 → 애플리케이션 추가하기<br />
            &nbsp;&nbsp;→ 앱 이름 입력 (예: 방과후출석부) → 저장<br />
            <br />
            <strong>③ 앱 키 확인</strong><br />
            &nbsp;&nbsp;생성된 앱 클릭 → 앱 키 탭<br />
            &nbsp;&nbsp;→ <strong>JavaScript 키</strong> 복사하여 위에 입력<br />
            <br />
            <strong>④ 플랫폼 등록</strong><br />
            &nbsp;&nbsp;앱 설정 → 플랫폼 → Web → 사이트 도메인 추가<br />
            &nbsp;&nbsp;예: <code style={{ background:'#f3f4f6', padding:'1px 5px', borderRadius:'3px' }}>https://afterschool.vercel.app</code><br />
            <br />
            <strong>⑤ 카카오 로그인 활성화</strong><br />
            &nbsp;&nbsp;제품 설정 → 카카오 로그인 → 활성화 ON<br />
            &nbsp;&nbsp;→ Redirect URI 등록 (동일 도메인)<br />
            <br />
            <strong>⑥ 동의항목 설정</strong><br />
            &nbsp;&nbsp;카카오 로그인 → 동의항목 → 닉네임·이메일 필수 동의 설정<br />
            <br />
            <strong>⑦ 비용</strong>: 무료
          </div>
        </details>
      </div>

      {/* ── 네이버 안내 */}
      <div style={{ padding:'14px 16px', background:'#f9fafb', borderRadius:'12px', border:'1.5px solid #e5e7eb', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
          <span style={{ fontSize:'20px' }}>🟢</span>
          <div>
            <div style={{ fontSize:'14px', fontWeight:700, color:'#9ca3af' }}>네이버 로그인 (Phase 4 예정)</div>
            <div style={{ fontSize:'12px', color:'#d1d5db' }}>서버 사이드 처리 필요 — Supabase/Node.js 백엔드 연동 후 지원</div>
          </div>
        </div>
        <div style={{ fontSize:'12px', color:'#9ca3af', lineHeight:1.8, background:'#fff', padding:'10px 12px', borderRadius:'8px', border:'1px solid #e5e7eb' }}>
          네이버 로그인은 보안 정책상 <strong>브라우저에서 직접 토큰 교환이 불가</strong>합니다.<br />
          백엔드 서버(Node.js / Supabase Edge Function)를 통해 처리해야 합니다.<br />
          Phase 4에서 실서버 연동 시 함께 구현 예정입니다.
        </div>
      </div>

      <SaveMsg data={msg} />
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
  const [msg, setMsg] = useState(null)
  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const save = () => {
    Settings.set('service', cfg)
    setMsg({ ok:true, msg:'저장되었습니다.' })
    setTimeout(() => setMsg(null), 3000)
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
        <SaveMsg data={msg} />
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <Btn onClick={save}>💾 저장</Btn>
        </div>
      </div>
    </Card>
  )
}


// ─── 섹션: Solapi 문자/알림톡
function SolapiSection() {
  const init = Settings.get('solapi') || { apiKey:'', apiSecret:'', senderPhone:'', kakaoChannelId:'', kakaoEnabled:false, smsEnabled:false }
  const [cfg, setCfg] = useState(init)
  const [msg, setMsg] = useState(null)
  const [testing, setTesting] = useState(false)

  const set = (k, v) => setCfg(p => ({ ...p, [k]: v }))

  const save = () => {
    Settings.set('solapi', cfg)
    setMsg({ ok:true, msg:'저장되었습니다.' })
    setTimeout(() => setMsg(null), 3000)
  }

  const testSMS = async () => {
    if (!cfg.apiKey || !cfg.senderPhone) { setMsg({ ok:false, msg:'API 키와 발신번호를 먼저 입력하세요.' }); return }
    setTesting(true)
    // 실제 테스트는 Phase 4 백엔드 연동 후 구현
    setTimeout(() => {
      setMsg({ ok:true, msg:'테스트 발송 기능은 Phase 4 백엔드 연동 후 사용 가능합니다.' })
      setTesting(false)
    }, 1000)
  }

  return (
    <Card style={{ marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>📱 Solapi 문자·카카오 알림톡</div>
      <div style={{ fontSize:'13px', color:C.muted, marginBottom:'20px', lineHeight:1.6 }}>
        Solapi를 연동하면 선생님이 출석부에서 학부모에게 <strong>문자·카카오 알림톡</strong>을 직접 발송할 수 있습니다.
      </div>

      {/* API 설정 */}
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
            &nbsp;&nbsp;충전식 선불 방식 (무료 체험 크레딧 제공)<br />
            <br />
            <strong>⑤ 주의사항</strong>: 대량 발송 시 스팸 신고 방지를 위해<br />
            &nbsp;&nbsp;수신 동의를 받은 학부모에게만 발송하세요.
          </div>
        </details>
      </div>

      {/* 카카오 알림톡 */}
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

        <details style={{ marginTop:'12px' }}>
          <summary style={{ fontSize:'12px', fontWeight:600, color:'#92400e', cursor:'pointer', userSelect:'none' }}>
            📋 카카오 알림톡 채널 등록 방법 보기
          </summary>
          <div style={{ marginTop:'10px', padding:'12px 14px', background:'#fff', borderRadius:'8px', border:'1px solid #fde68a', fontSize:'12px', color:'#374151', lineHeight:2 }}>
            <strong>① 카카오 비즈니스 채널 생성</strong><br />
            &nbsp;&nbsp;<a href="https://business.kakao.com" target="_blank" rel="noopener noreferrer" style={{ color:'#92400e' }}>business.kakao.com</a> → 카카오톡 채널 개설<br />
            &nbsp;&nbsp;→ 채널명, 검색용 아이디 설정<br />
            <br />
            <strong>② 알림톡 발신 프로필 등록</strong><br />
            &nbsp;&nbsp;채널 관리자센터 → 알림톡 → 발신프로필 등록<br />
            &nbsp;&nbsp;→ 채널 ID(pfId) 확인 후 위에 입력<br />
            <br />
            <strong>③ Solapi에서 카카오 연동</strong><br />
            &nbsp;&nbsp;Solapi → 카카오 채널 → 채널 추가 → pfId 입력<br />
            <br />
            <strong>④ 주의</strong>: 알림톡은 사전에 승인된 템플릿만 발송 가능합니다.<br />
            &nbsp;&nbsp;자유 문자는 SMS/LMS를 사용하세요.
          </div>
        </details>
      </div>

      {/* 테스트 발송 */}
      <div style={{ padding:'14px', background:'#f9fafb', borderRadius:'10px', border:`1px solid ${C.border}`, marginBottom:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
        <div>
          <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>테스트 발송</div>
          <div style={{ fontSize:'12px', color:C.muted, marginTop:'2px' }}>설정 저장 후 발신번호로 테스트 SMS를 발송합니다.</div>
        </div>
        <Btn size="sm" variant="ghost" onClick={testSMS} disabled={testing}>{testing ? '발송 중...' : '테스트 발송'}</Btn>
      </div>

      <SaveMsg data={msg} />
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'12px' }}>
        <Btn onClick={save}>💾 저장</Btn>
      </div>
    </Card>
  )
}

// ─── 메인
export function AdminSettings() {
  const [tab, setTab] = useState('social') // 'social' | 'solapi' | 'service'

  return (
    <div style={{ padding:'28px', maxWidth:'780px' }}>
      <PageHeader title="서비스 설정" sub="소셜 로그인 연동, 포인트 정책 등을 관리합니다." />

      <div style={{ display:'flex', gap:'8px', marginBottom:'24px', borderBottom:`1px solid ${C.border}`, paddingBottom:'0' }}>
        {[
          { key:'social',   label:'🔑 소셜 로그인' },
          { key:'solapi',   label:'📱 문자·알림톡' },
          { key:'service',  label:'⚙️ 기본 설정' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'10px 16px', border:'none', cursor:'pointer', background:'none', color:tab===t.key?C.primary:'#9ca3af', fontWeight:tab===t.key?700:400, fontSize:'14px', borderBottom:tab===t.key?`2px solid ${C.primary}`:'2px solid transparent', fontFamily:'Noto Sans KR, sans-serif', marginBottom:'-1px', transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'social'  && <SocialSection />}
      {tab === 'solapi'  && <SolapiSection />}
      {tab === 'service' && <ServiceSection />}
    </div>
  )
}
