import React, { useState, useEffect, useRef } from 'react'

const C = {
  primary: '#f97316', primaryDark: '#ea6c0a', primaryLight: '#fff7ed',
  primaryBorder: '#fed7aa', text: '#111827', muted: '#6b7280',
  border: '#e5e7eb', white: '#ffffff', bg: '#f9fafb',
}

const FEATURES = [
  { icon: '✅', title: '스마트 출석 관리', desc: '출석·결석·지각·조퇴·스케줄변경까지 한 화면에서 클릭 한 번으로 처리해요. 사유 입력과 이력 관리도 자동으로 기록돼요.', bg: '#fff7ed', border: '#fed7aa', color: '#f97316' },
  { icon: '📊', title: '상세 리포트 & 엑셀 출력', desc: '월별·분기별 출석률을 자동 집계하고 엑셀 파일로 내보내요. 학교 제출용 서류도 클릭 한 번이면 완성돼요.', bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' },
  { icon: '👨‍👩‍👧', title: '학부모 실시간 알림', desc: '출결 처리와 동시에 학부모에게 카카오톡·문자·웹푸시로 자동 발송해요. 학부모 앱으로 출석 현황을 직접 확인할 수도 있어요.', bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  { icon: '🏫', title: '다수 반·학교 통합 관리', desc: '여러 학교, 여러 반을 한 계정으로 관리해요. 학생 이동, 스케줄 변경, 전학 처리도 간편하게 할 수 있어요.', bg: '#fdf4ff', border: '#e9d5ff', color: '#7c3aed' },
  { icon: '📅', title: '수업 일정 캘린더', desc: '수업 일정을 달력으로 한눈에 확인해요. 공휴일 자동 반영, 보강·휴강 처리, 월별 수업 횟수 집계까지 지원해요.', bg: '#fff7ed', border: '#fed7aa', color: '#f97316' },
  { icon: '🎒', title: '교구 관리 & 진도 체크', desc: '교구 지급 현황과 학생별 진도를 함께 관리해요. 미지급·미체크 항목을 자동으로 알려줘서 누락 없이 챙길 수 있어요.', bg: '#fefce8', border: '#fde68a', color: '#d97706' },
  { icon: '📝', title: '수업 메모 & 특이사항', desc: '수업별 메모와 학생 특이사항을 바로 기록해요. 다음 수업 전에 지난 기록을 빠르게 확인할 수 있어요.', bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  { icon: '🔒', title: '안전한 데이터 보호', desc: '학생 정보는 암호화되어 Supabase 클라우드에 안전하게 보관돼요. 기기가 바뀌어도 데이터는 그대로예요.', bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
]

const STEPS = [
  { step: '01', icon: '📝', title: '무료로 가입', desc: '이메일 하나로 30초 안에 가입 완료! 별도 설치 없이 바로 시작해요.', color: '#f97316' },
  { step: '02', icon: '🏫', title: '반과 학생 등록', desc: '수업 중인 반과 학생 정보를 등록하면 준비 끝! 엑셀 일괄 등록도 지원해요.', color: '#1e40af' },
  { step: '03', icon: '✅', title: '출석 체크 시작', desc: '매 수업마다 클릭 한 번으로 출석을 기록하고, 리포트·알림이 자동으로 처리돼요.', color: '#15803d' },
]

const STATS = [
  { icon: '👩‍🏫', label: '현직 방과후 강사가\n직접 만들었어요' },
  { icon: '✅', label: '실제 강사들이\n사용 중이에요' },
  { icon: '💡', label: '현장의 불편함을\n직접 해결했어요' },
  { icon: '🎉', label: '베타 오픈 중\n지금 무료예요' },
]

const REVIEWS = [
  { text: '엑셀로 출석 관리하다가 너무 불편해서 찾아봤는데, 이게 딱 제가 원하던 거예요. 학부모 알림까지 자동으로 가니까 연락 따로 안 해도 되고 정말 편해요.', name: '초등 방과후 영어 강사', tag: '사용 3개월째' },
  { text: '여러 반을 한꺼번에 관리할 수 있는 게 최고예요. 이전엔 반마다 파일 따로 만들었는데 이제 한 화면에서 다 보여요.', name: '과학교구 방과후 강사', tag: '사용 중' },
  { text: '리포트 엑셀 출력 기능 덕분에 학교 제출 서류 만드는 시간이 확 줄었어요. 현직 강사가 만들어서 그런지 딱 필요한 것만 있어요.', name: '방과후 수학 강사', tag: '베타 초기부터 사용' },
]

export default function LandingPage({ onGoLogin, onGoSignup, onGoBlog, onGoDashboard, onLogout }) {
  const [scrollY, setScrollY] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
        background: navScrolled || mobileMenuOpen ? 'rgba(255,255,255,0.97)' : 'transparent',
        borderBottom: navScrolled || mobileMenuOpen ? `1px solid ${C.border}` : '1px solid transparent',
        backdropFilter: navScrolled || mobileMenuOpen ? 'blur(12px)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* 로고 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #f97316, #fb923c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', boxShadow: '0 2px 8px rgba(249,115,22,0.35)' }}>📋</div>
            <span style={{ fontSize: '17px', fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>방과후 출석부</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: C.primary, background: C.primaryLight, border: `1px solid ${C.primaryBorder}`, padding: '2px 7px', borderRadius: '100px', letterSpacing: '0.5px' }}>BETA</span>
          </div>

          {/* 데스크탑 메뉴 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* 모바일에서 햄버거 */}
            <button onClick={() => setMobileMenuOpen(v => !v)}
              style={{ display: 'none', background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', padding: '4px', color: C.text, className: 'mobile-only' }}>
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
            <div className="nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={onGoBlog} style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', background: 'none', color: C.muted, fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.target.style.color = C.primary }} onMouseLeave={e => { e.target.style.color = C.muted }}>블로그</button>
              {onGoDashboard ? (
                <>
                  <button onClick={onGoDashboard} style={{ padding: '9px 22px', borderRadius: '9px', border: `1.5px solid ${C.border}`, background: C.white, color: C.text, fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text }}>
                    대시보드
                  </button>

                  {onLogout && (
                    <button onClick={onLogout} style={{ padding: '9px 22px', borderRadius: '9px', border: `1.5px solid ${C.border}`, background: C.white, color: C.muted, fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted }}>
                      로그아웃
                    </button>
                  )}
                </>
              ) : (
                <button onClick={onGoLogin} style={{ padding: '9px 22px', borderRadius: '9px', border: `1.5px solid ${C.border}`, background: C.white, color: C.text, fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text }}>
                  로그인
                </button>
              )}
              {!onGoDashboard && (
                <button onClick={onGoSignup} style={{ padding: '9px 22px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', boxShadow: '0 2px 10px rgba(249,115,22,0.35)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
                  무료 시작하기 🚀
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 모바일 드롭다운 메뉴 */}
        {mobileMenuOpen && (
          <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => { onGoBlog?.(); setMobileMenuOpen(false) }} style={{ padding: '12px', borderRadius: '9px', border: 'none', background: 'none', color: C.text, fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'Noto Sans KR, sans-serif' }}>📖 블로그</button>
            {onGoDashboard ? (
              <>
                <button onClick={() => { onGoDashboard(); setMobileMenuOpen(false) }} style={{ padding: '12px', borderRadius: '9px', border: `1.5px solid ${C.border}`, background: C.white, color: C.text, fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'Noto Sans KR, sans-serif' }}>🏠 대시보드로 돌아가기</button>

                {onLogout && (
                  <button onClick={() => { onLogout(); setMobileMenuOpen(false) }} style={{ padding: '12px', borderRadius: '9px', border: `1.5px solid #fecaca`, background: '#fff5f5', color: '#ef4444', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'Noto Sans KR, sans-serif' }}>🚪 로그아웃</button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => { onGoLogin?.(); setMobileMenuOpen(false) }} style={{ padding: '12px', borderRadius: '9px', border: `1.5px solid ${C.border}`, background: C.white, color: C.text, fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', fontFamily: 'Noto Sans KR, sans-serif' }}>로그인</button>
                <button onClick={() => { onGoSignup?.(); setMobileMenuOpen(false) }} style={{ padding: '12px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'Noto Sans KR, sans-serif' }}>🚀 무료 시작하기</button>
              </>
            )}
          </div>
        )}
      </nav>

      {/* ── 히어로 섹션 ── */}
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 20px 60px',
        background: 'linear-gradient(160deg, #fff7ed 0%, #ffffff 50%, #eff6ff 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '10%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '-5%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(30,64,175,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '720px', width: '100%' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '100px', background: C.primaryLight, border: `1.5px solid ${C.primaryBorder}`, fontSize: '13px', color: C.primary, fontWeight: 600, marginBottom: '28px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.primary, display: 'inline-block', animation: 'pulse 2s infinite' }} />
            🎉 베타 오픈 중 — 지금 무료로 사용해보세요!
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 6vw, 56px)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-1px', margin: '0 0 20px', color: C.text }}>
            방과후 출석 관리,<br />
            <span style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              이제 더 쉽고 빠르게
            </span>
          </h1>

          <p style={{ fontSize: 'clamp(14px, 2.5vw, 18px)', color: C.muted, lineHeight: 1.8, maxWidth: '520px', margin: '0 auto 40px' }}>
            현직 방과후 강사가 직접 만든 출석 관리 서비스.<br />
            학생 관리부터 학부모 알림, 교구 진도, 리포트까지 한 번에 해결해요.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '48px' }}>
            {onGoDashboard ? (
              <button onClick={onGoDashboard} style={{ padding: '16px 36px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff', fontSize: '16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', boxShadow: '0 4px 20px rgba(249,115,22,0.4)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
                🏠 대시보드로 돌아가기
              </button>
            ) : (
              <>
                <button onClick={onGoSignup} style={{ padding: '16px 36px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff', fontSize: '16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', boxShadow: '0 4px 20px rgba(249,115,22,0.4)', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(249,115,22,0.45)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(249,115,22,0.4)' }}>
                  🚀 무료로 시작하기
                </button>
                <button onClick={onGoBlog} style={{ padding: '16px 32px', borderRadius: '12px', border: `1.5px solid ${C.border}`, background: C.white, color: C.text, fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.color = C.primary }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text }}>
                  📖 블로그 보기
                </button>
              </>
            )}
          </div>

          {!onGoDashboard && (
            <div style={{ fontSize: '13px', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span>✅ 신용카드 불필요</span>
              <span style={{ color: C.border }}>|</span>
              <span>✅ 즉시 사용 가능</span>
              <span style={{ color: C.border }}>|</span>
              <span>✅ 기본 기능 영구 무료</span>
            </div>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: C.muted, fontSize: '12px', animation: 'bounce 2s infinite' }}>
          <span>스크롤</span><span style={{ fontSize: '18px' }}>↓</span>
        </div>
      </div>

      {/* ── 통계 배너 ── */}
      <div style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)', padding: '40px 20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', textAlign: 'center' }} className="stats-grid">
          {STATS.map(s => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>{s.icon}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.92)', lineHeight: 1.6, textAlign: 'center', whiteSpace: 'pre-line', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 기능 소개 ── */}
      <section style={{ padding: 'clamp(48px,8vw,80px) 20px', background: C.bg }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.primary, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>Features</div>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: '-0.5px' }}>선생님이 필요한 모든 기능</h2>
            <p style={{ fontSize: '15px', color: C.muted, maxWidth: '420px', margin: '0 auto', lineHeight: 1.7 }}>출석 기록부터 교구 관리, 학부모 소통, 리포트 출력까지 — 수업에만 집중할 수 있게 도와드려요.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: C.white, borderRadius: '16px', padding: '22px', border: `1.5px solid ${C.border}`, transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = f.border; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.07)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: f.bg, border: `1.5px solid ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '14px' }}>{f.icon}</div>
                <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', color: C.text }}>{f.title}</div>
                <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 사용 방법 ── */}
      <section style={{ padding: 'clamp(48px,8vw,80px) 20px', background: C.white }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.primary, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>How it works</div>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: '-0.5px' }}>3분이면 시작할 수 있어요</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {STEPS.map((s, i) => (
              <div key={s.step} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', position: 'relative' }}>
                {i < STEPS.length - 1 && <div style={{ position: 'absolute', left: '25px', top: '56px', bottom: '-12px', width: '2px', background: `linear-gradient(to bottom, ${s.color}40, transparent)` }} />}
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0, background: s.color + '15', border: `2px solid ${s.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', position: 'relative', zIndex: 1 }}>{s.icon}</div>
                <div style={{ paddingBottom: '36px', paddingTop: '6px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: s.color, letterSpacing: '2px', marginBottom: '4px' }}>STEP {s.step}</div>
                  <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '6px', color: C.text }}>{s.title}</div>
                  <div style={{ fontSize: '14px', color: C.muted, lineHeight: 1.7 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 사용자 후기 ── */}
      <section style={{ padding: 'clamp(48px,8vw,80px) 20px', background: C.bg }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.primary, letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '12px' }}>Reviews</div>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: '-0.5px' }}>실제 강사들의 이야기</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            {REVIEWS.map((r, i) => (
              <div key={i} style={{ background: C.white, borderRadius: '16px', padding: '22px', border: `1.5px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ fontSize: '24px', color: C.primary, fontWeight: 900, lineHeight: 1 }}>"</div>
                <p style={{ fontSize: '14px', color: '#374151', lineHeight: 1.8, margin: 0, flex: 1 }}>{r.text}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>{r.name}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: C.primary, background: C.primaryLight, border: `1px solid ${C.primaryBorder}`, padding: '2px 8px', borderRadius: '100px' }}>{r.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 블로그 배너 ── */}
      <section style={{ padding: 'clamp(40px,6vw,60px) 20px', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '36px', marginBottom: '14px' }}>📖</div>
          <h2 style={{ fontSize: 'clamp(18px, 3vw, 28px)', fontWeight: 900, margin: '0 0 12px', color: '#fff', letterSpacing: '-0.5px' }}>방과후 강사를 위한 블로그</h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: '24px' }}>출석 관리 팁, 학부모 소통 노하우, 방과후 운영 이야기를 나눠요.</p>
          <button onClick={onGoBlog} style={{ padding: '14px 32px', borderRadius: '12px', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}>
            블로그 바로가기 →
          </button>
        </div>
      </section>

      {/* ── 최종 CTA ── */}
      {!onGoDashboard && (
        <section style={{ padding: 'clamp(48px,8vw,80px) 20px', background: 'linear-gradient(160deg, #fff7ed 0%, #fffbf5 100%)', textAlign: 'center', borderTop: `1px solid ${C.primaryBorder}` }}>
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
            <h2 style={{ fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 900, margin: '0 0 14px', letterSpacing: '-0.5px' }}>지금 바로 시작해보세요</h2>
            <p style={{ fontSize: '15px', color: C.muted, lineHeight: 1.8, marginBottom: '32px' }}>
              베타 오픈 기간 중 기본 기능을 무료로 이용하실 수 있어요.<br />
              지금 가입하고 편리한 출석 관리를 경험해보세요!
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={onGoSignup} style={{ padding: '16px 40px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff', fontSize: '16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', boxShadow: '0 4px 20px rgba(249,115,22,0.4)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}>
                🚀 무료 회원가입
              </button>
              <button onClick={onGoLogin} style={{ padding: '16px 32px', borderRadius: '12px', border: `1.5px solid ${C.primaryBorder}`, background: C.white, color: C.primary, fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.primaryLight }} onMouseLeave={e => { e.currentTarget.style.background = C.white }}>
                로그인
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── 푸터 ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '28px 20px', background: C.white }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #f97316, #fb923c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>📋</div>
            <span style={{ fontSize: '14px', fontWeight: 800, color: C.text }}>방과후 출석부</span>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button onClick={onGoBlog} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>블로그</button>
            {onGoDashboard
              ? <><button onClick={onGoDashboard} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>대시보드</button>
></>
              : <>
                  <button onClick={onGoLogin} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>로그인</button>
                  <button onClick={onGoSignup} style={{ background: 'none', border: 'none', fontSize: '13px', color: C.muted, cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif' }}>회원가입</button>
                </>
            }
          </div>
          <div style={{ fontSize: '12px', color: C.muted }}>© 2026 방과후 출석부. All rights reserved.</div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes bounce { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(6px); } }
        @media (max-width: 640px) {
          .nav-desktop { display: none !important; }
          button.mobile-only { display: flex !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (min-width: 641px) {
          .stats-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
