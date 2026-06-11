import React, { useEffect, useState } from 'react'
import { dbCall } from '../lib/supabase.js'

// 기본값 (Supabase에서 못 불러올 때 fallback)
const DEFAULT_TERMS = `방과후 출석부 서비스 이용약관

제1조 (목적)
본 약관은 집현전에듀 지원센터(이하 "운영자")가 제공하는 방과후 출석부 서비스(이하 "서비스")의 이용과 관련하여 운영자와 이용자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. "서비스"란 운영자가 제공하는 방과후 출결 관리 웹 애플리케이션 및 관련 부가 서비스 일체를 말합니다.
2. "이용자"란 본 약관에 동의하고 서비스에 가입하여 이용하는 자를 말합니다.

제3조 (약관의 효력 및 변경)
본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력이 발생합니다.

제4조 (이용자의 의무)
이용자는 타인의 개인정보 무단 수집, 서비스 운영 방해, 관련 법령 위반 행위를 하여서는 안 됩니다.

제5조 (면책 조항)
운영자는 천재지변, 불가항력적 사유로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.

[시행일] 2025년 1월 1일`

const DEFAULT_PRIVACY = `개인정보처리방침

집현전에듀 지원센터(이하 "운영자")는 방과후 출석부 서비스 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」, 「아동·청소년의 성보호에 관한 법률」 등 관련 법령을 준수합니다.

1. 수집하는 개인정보 항목

[강사 회원]
- 소셜 로그인(Google/네이버/카카오): 이름, 이메일, 프로필 사진, 고유 식별자
- 서비스 이용 중: 연락처, 소속 학교·기관명, 담당 수업 정보

[학생 정보 — 강사가 직접 입력]
- 이름, 학년, 반, 번호, 출결 기록
- 학부모 연락처(전화번호) — 출결 알림 발송 목적

[학부모 포털]
- 전화번호 — 본인 확인 및 출결 알림 수신 목적
- PIN(암호화 저장) — 로그인 인증 목적

2. 개인정보의 수집 및 이용 목적
- 강사 회원 식별 및 로그인 서비스 제공
- 방과후 출결 관리 및 출결 알림(SMS/카카오) 발송
- 학부모 출결 조회 포털 운영

3. 미성년자 개인정보 처리
본 서비스는 방과후 수업 운영을 위해 미성년 학생의 이름·학급 정보·출결 기록을 처리합니다.
해당 정보는 담당 강사(정보 입력자)가 「개인정보 보호법」 제15조 제1항 제4호(정보주체와의 계약 이행) 및 학교·기관의 위탁에 근거하여 수집·이용합니다.
학부모 연락처는 출결 알림 발송을 위해 강사가 입력하며, 학부모 본인의 동의를 받은 후 등록하여야 합니다.

4. 개인정보의 보유 및 이용 기간
서비스 이용 계약 존속 기간 동안 보유하며, 회원 탈퇴 시 지체 없이 파기합니다.
단, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.

5. 개인정보의 제3자 제공
운영자는 이용자의 사전 동의 없이 개인정보를 외부에 제공하지 않습니다.
단, 출결 알림 발송을 위해 Solapi㈜에 수신자 전화번호를 전달합니다(위탁 범위 내).

6. 개인정보 처리 위탁

수탁자 | 위탁 업무
Supabase Inc. | 데이터베이스 저장 및 관리
Resend Inc. | 이메일 발송
Solapi㈜ | SMS·카카오 알림톡 발송
Google LLC | 소셜 로그인 인증 처리
네이버㈜ | 소셜 로그인 인증 처리
카카오㈜ | 소셜 로그인 인증 처리

7. 이용자의 권리
이용자는 언제든지 본인의 개인정보 열람, 정정, 삭제, 처리 정지를 요청할 수 있습니다.
요청은 아래 개인정보 보호 책임자에게 이메일로 접수하시기 바랍니다.

8. 개인정보 보호 책임자
- 담당자: 민찬홍 (집현전에듀 지원센터)
- 이메일: afterschool.rollbook@gmail.com
- 전화: 010-2704-0307

[시행일] 2026년 6월 12일`

const C = {
  green: '#03C75A',
  dark: '#1a1a2e',
  text: '#2d3748',
  muted: '#718096',
  bg: '#f7f9fc',
  border: '#e2e8f0',
  accent: '#ebfaf2',
}

export function TermsPage() {
  return <LegalPage type="terms" />
}

export function PrivacyPage() {
  return <LegalPage type="privacy" />
}

function LegalPage({ type }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  const isTerms = type === 'terms'
  const title = isTerms ? '서비스 이용약관' : '개인정보처리방침'
  const icon  = isTerms ? '📜' : '🔒'

  useEffect(() => {
    // Supabase에서 최신 약관 불러오기
    dbCall('settingGet', 'settings', { id: 'legal' })
      .then(data => {
        const text = isTerms ? data?.terms : data?.privacy
        setContent(text || (isTerms ? DEFAULT_TERMS : DEFAULT_PRIVACY))
      })
      .catch(() => {
        // Supabase 실패 시 localStorage fallback
        try {
          const stored = JSON.parse(localStorage.getItem('asa_settings_legal') || '{}')
          const text = isTerms ? stored.terms : stored.privacy
          setContent(text || (isTerms ? DEFAULT_TERMS : DEFAULT_PRIVACY))
        } catch {
          setContent(isTerms ? DEFAULT_TERMS : DEFAULT_PRIVACY)
        }
      })
      .finally(() => setLoading(false))
  }, [type])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 헤더 */}
      <header style={{
        background: '#fff', borderBottom: `3px solid ${C.green}`,
        padding: '20px 0', textAlign: 'center', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 12px rgba(3,199,90,0.08)'
      }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: C.dark, letterSpacing: '-0.5px' }}>
          방과후 <span style={{ color: C.green }}>출석부</span>
        </div>
        <div style={{
          display: 'inline-block', marginTop: '6px', background: C.accent,
          color: C.green, fontSize: '12px', fontWeight: 600, padding: '3px 12px',
          borderRadius: '20px', border: '1px solid #b2f0d0'
        }}>
          {icon} {title}
        </div>
      </header>

      {/* 본문 */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, color: C.dark, marginBottom: '8px', letterSpacing: '-1px' }}>
          {icon} {title}
        </h1>
        <div style={{ fontSize: '13px', color: C.muted, marginBottom: '32px', paddingBottom: '24px', borderBottom: `1px solid ${C.border}` }}>
          운영자: 민찬홍 / 집현전에듀 지원센터 &nbsp;|&nbsp; afterschool.rollbook@gmail.com
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: C.muted, fontSize: '14px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            불러오는 중...
          </div>
        ) : (
          <div style={{
            background: '#fff', borderRadius: '14px', padding: '32px',
            border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            whiteSpace: 'pre-wrap', lineHeight: '1.9', fontSize: '14.5px', color: C.text,
          }}>
            {content}
          </div>
        )}
      </div>

      {/* 푸터 */}
      <footer style={{ textAlign: 'center', padding: '28px 24px', background: C.dark, color: '#a0aec0', fontSize: '13px' }}>
        <strong style={{ color: '#fff' }}>방과후 출석부</strong> &nbsp;|&nbsp; 운영자: 민찬홍 / 집현전에듀 지원센터<br />
        📞 010-2704-0307 &nbsp;|&nbsp;
        <a href="mailto:afterschool.rollbook@gmail.com" style={{ color: C.green, textDecoration: 'none' }}>
          afterschool.rollbook@gmail.com
        </a>
        <br /><br />
        <span style={{ color: '#718096', fontSize: '12px' }}>© 2025 집현전에듀 지원센터. All rights reserved.</span>
      </footer>
    </div>
  )
}
