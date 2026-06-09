import React, { useState, useEffect, useRef } from 'react'

const C = {
  primary: '#f97316',
  primaryDark: '#ea6c0a',
  primaryLight: '#fff7ed',
  primaryBorder: '#fed7aa',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  white: '#ffffff',
  bg: '#f9fafb',
  blue: '#1e40af',
  blueBg: '#eff6ff',
  blueBorder: '#bfdbfe',
  green: '#15803d',
  greenBg: '#f0fdf4',
}

const FEATURES = [
  {
    icon: '✅',
    title: '스마트 출석 관리',
    desc: '학생별 출석 현황을 한눈에 확인하고, 빠르게 기록해요.',
    bg: '#fff7ed',
    border: '#fed7aa',
    color: '#f97316',
  },
  {
    icon: '📊',
    title: '상세 리포트',
    desc: '월별·분기별 출석률을 자동으로 집계하고 엑셀로 내보내요.',
    bg: '#eff6ff',
    border: '#bfdbfe',
    color: '#1e40af',
  },
  {
    icon: '👨‍👩‍👧',
    title: '학부모 알림',
    desc: '출결 내용을 학부모에게 카카오·문자로 자동 발송해요.',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    color: '#15803d',
  },
  {
    icon: '🏫',
    title: '다수 반 관리',
    desc: '여러 반을 동시에 관리하고 학생 이동도 쉽게 처리해요.',
    bg: '#fdf4ff',
    border: '#e9d5ff',
    color: '#7c3aed',
  },
  {
    icon: '📅',
    title: '수업 일정 캘린더',
    desc: '수업 일정을 달력으로 관리하고 공휴일을 자동으로 반영해요.',
    bg: '#fff7ed',
    border: '#fed7aa',
    color: '#f97316',
  },
  {
    icon: '🔒',
    title: '안전한 데이터 보호',
    desc: '학생 정보는 암호화되어 안전하게 보관돼요.',
    bg: '#fef2f2',
    border: '#fecaca',
    color: '#dc2626',
  },
]

const STEPS = [
  {
    step: '01',
    icon: '📝',
    title: '무료로 가입',
    desc: '이메일 하나로 30초 안에 가입 완료! 별도 설치 없이 바로 시작해요.',
    color: '#f97316',
  },
  {
    step: '02',
    icon: '🏫',
    title: '반과 학생 등록',
    desc: '수업 중인 반과 학생 정보를 등록하면 준비 끝!',
    color: '#1e40af',
  },
  {
    step: '03',
    icon: '✅',
    title: '출석 체크 시작',
    desc: '매 수업마다 클릭 한 번으로 출석을 기록하고 리포트를 확인해요.',
    color: '#15803d',
  },
]

const STATS = [
  { value: '5,000+', label: '가입 선생님' },
  { value: '200,000+', label: '등록 학생 수' },
  { value: '98%', label: '재이용률' },
  { value: '무료', label: '기본 사용료' },
]

export default function LandingPage({ onGoLogin, onGoSignup }) {
  const [scrollY, setScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const heroRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navScrolled = scrollY > 40

  return (
    <div style={{ minHeight: '100vh', background: C.white, color: C.text, fontFamily: 'Noto Sans KR, sans-serif', overflowX: 'hidden' }}>

      {/* ── 네비게이션 ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: navScrolled ? 'rgba(255,255,255,0.97)' : 'transparent',
        borderBottom: navScrolled ? `1px solid ${C.border}` : '1px solid transparent',
        backdropFilter: navScrolled ? 'blur(12px)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* 로고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', boxShadow: '0 2px 8px rgba(249,115,22,0.35)',
            }}>📋</div>
            <span style={{ fontSize: '17px', fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>방과후 출석부</span>
          </div>

          {/* 데스크탑 메뉴 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={onGoLogin}
              style={{
                padding: '9px 22px', borderRadius: '9px', border: `1.5px solid ${C.border}`,
                background: C.white, color: C.text, fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.borderColor = C.primary; e.target.style.color = C.primary }}
              onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.text }}
            >
              로그인
            </button>
            <button
              onClick={onGoSignup}
              style={{
                padding: '9px 22px', borderRadius: '9px', border: 'none',
                background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Noto Sans KR, sans-serif',
                boxShadow: '0 2px 10px rgba(249,115,22,0.35)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(249,115,22,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(249,115,22,0.35)' }}
            >
              무료 시작하기 🚀
            </button>
          </div>
        </div>
      </nav>

      {/* ── 히어로 섹션 ── */}
      <div ref={heroRef} style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 20px 60px',
        background: 'linear-gradient(160deg, #fff7ed 0%, #ffffff 50%, #eff6ff 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* 배경 장식 */}
        <div style={{
          position: 'absolute', top: '10%', right: '-5%',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '-5%',
          width: '350px', height: '350px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(30,64,175,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '720px', width: '100%' }}>
          {/* 뱃지 */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '100px',
            background: C.primaryLight, border: `1.5px solid ${C.primaryBorder}`,
            fontSize: '13px', color: C.primary, fontWeight: 600, marginBottom: '28px',
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.primary, display: 'inline-block', animation: 'pulse 2s infinite' }} />
            방과후 선생님을 위한 무료 출석 관리 서비스
          </div>

          {/* 메인 타이틀 */}
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900,
            lineHeight: 1.15, letterSpacing: '-1px',
            margin: '0 0 20px', color: C.text,
          }}>
            출석 관리,<br />
            <span style={{
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              이제 더 쉽고 빠르게
            </span>
          </h1>

          <p style={{
            fontSize: 'clamp(15px, 2vw, 18px)', color: C.muted,
            lineHeight: 1.8, marginBottom: '40px', maxWidth: '520px', margin: '0 auto 40px',
          }}>
            방과후 수업 출석부를 스마트하게.<br />
            학생 관리부터 학부모 알림, 리포트까지 한 번에 해결해요.
          </p>

          {/* CTA 버튼 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '48px' }}>
            <button
              onClick={onGoSignup}
              style={{
                padding: '16px 36px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff',
                fontSize: '16px', fontWeight: 800, cursor: 'pointer',
                fontFamily: 'Noto Sans KR, sans-serif',
                boxShadow: '0 4px 20px rgba(249,115,22,0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(249,115,22,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(249,115,22,0.4)' }}
            >
              🚀 무료로 시작하기
            </button>
            <button
              onClick={onGoLogin}
              style={{
                padding: '16px 32px', borderRadius: '12px',
                border: `1.5px solid ${C.border}`, background: C.white,
                color: C.text, fontSize: '15px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text }}
            >
              로그인
            </button>
          </div>

          {/* 신뢰 문구 */}
          <div style={{ fontSize: '13px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span>✅ 신용카드 불필요</span>
            <span style={{ color: C.border }}>|</span>
            <span>✅ 즉시 사용 가능</span>
            <span style={{ color: C.border }}>|</span>
            <span>✅ 기본 기능 영구 무료</span>
          </div>
        </div>

        {/* 스크롤 유도 */}
        <div style={{
          position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
          color: C.muted, fontSize: '12px', animation: 'bounce 2s infinite',
        }}>
          <span>스크롤</span>
          <span style={{ fontSize: '18px' }}>↓</span>
        </div>
      </div>

      {/* ── 통계 배너 ── */}
      <div style={{
        background: 'linear-gradient(135deg, #f97316, #fb923c)',
        padding: '40px 20px',
      }}>
        <div style={{
          maxWidth: '900px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px', textAlign: 'center',
        }}>
          {STATS.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 기능 소개 ── */}
      <section style={{ padding: '80px 20px', background: C.bg }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.primary, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>Features</div>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: '-0.5px' }}>선생님이 필요한 모든 기능</h2>
            <p style={{ fontSize: '15px', color: C.muted, maxWidth: '420px', margin: '0 auto', lineHeight: 1.7 }}>출석 기록부터 학부모 소통, 리포트 출력까지 — 수업에 집중할 수 있게 도와드려요.</p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '16px',
          }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: C.white, borderRadius: '16px', padding: '24px',
                border: `1.5px solid ${C.border}`,
                transition: 'all 0.2s',
                cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = f.border; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.07)` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: f.bg, border: `1.5px solid ${f.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', marginBottom: '16px',
                }}>
                  {f.icon}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: C.text }}>{f.title}</div>
                <div style={{ fontSize: '14px', color: C.muted, lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 사용 방법 ── */}
      <section style={{ padding: '80px 20px', background: C.white }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.primary, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>How it works</div>
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: '-0.5px' }}>3분이면 시작할 수 있어요</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
            {STEPS.map((s, i) => (
              <div key={s.step} style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', position: 'relative' }}>
                {/* 세로선 */}
                {i < STEPS.length - 1 && (
                  <div style={{
                    position: 'absolute', left: '27px', top: '60px', bottom: '-12px',
                    width: '2px', background: `linear-gradient(to bottom, ${s.color}40, transparent)`,
                  }} />
                )}
                {/* 아이콘 */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '16px', flexShrink: 0,
                  background: s.color + '15', border: `2px solid ${s.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', position: 'relative', zIndex: 1,
                }}>
                  {s.icon}
                </div>
                <div style={{ paddingBottom: '40px', paddingTop: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: s.color, letterSpacing: '2px', marginBottom: '4px' }}>STEP {s.step}</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, marginBottom: '6px', color: C.text }}>{s.title}</div>
                  <div style={{ fontSize: '14px', color: C.muted, lineHeight: 1.7 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 최종 CTA ── */}
      <section style={{
        padding: '80px 20px',
        background: 'linear-gradient(160deg, #fff7ed 0%, #fffbf5 100%)',
        textAlign: 'center',
        borderTop: `1px solid ${C.primaryBorder}`,
      }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: '-0.5px' }}>
            지금 바로 시작해보세요
          </h2>
          <p style={{ fontSize: '15px', color: C.muted, lineHeight: 1.8, marginBottom: '36px' }}>
            수천 명의 방과후 선생님이 이미 사용하고 있어요.<br />
            무료 가입 후 바로 출석부를 만들어보세요!
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={onGoSignup}
              style={{
                padding: '16px 40px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff',
                fontSize: '16px', fontWeight: 800, cursor: 'pointer',
                fontFamily: 'Noto Sans KR, sans-serif',
                boxShadow: '0 4px 20px rgba(249,115,22,0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              🚀 무료 회원가입
            </button>
            <button
              onClick={onGoLogin}
              style={{
                padding: '16px 32px', borderRadius: '12px',
                border: `1.5px solid ${C.primaryBorder}`,
                background: C.white, color: C.primary,
                fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Noto Sans KR, sans-serif',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.primaryLight }}
              onMouseLeave={e => { e.currentTarget.style.background = C.white }}
            >
              로그인
            </button>
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer style={{
        borderTop: `1px solid ${C.border}`,
        padding: '32px 20px',
        background: C.white,
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'flex', flexWrap: 'wrap',
          alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
            }}>📋</div>
            <span style={{ fontSize: '14px', fontWeight: 800, color: C.text }}>방과후 출석부</span>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <button onClick={onGoLogin} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>로그인</button>
            <button onClick={onGoSignup} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>회원가입</button>
          </div>
          <div style={{ fontSize: '12px', color: C.muted }}>© 2026 방과후 출석부. All rights reserved.</div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </div>
  )
}
