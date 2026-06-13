import React, { useState, useEffect } from 'react'
import LandingPage from './pages/LandingPage.jsx'
import { Users } from './lib/db.js'
import { initFromSupabase, loadCacheFromIDB, onSaveError, onDbChange } from './lib/db.js'
import { SaveStatusBar } from './components/SaveStatusBar.jsx'
import { isConfigured, authSignOut, authOnStateChange, authGetSession, sendEmail, dbCall } from './lib/supabase.js'
import { Auth } from './pages/Auth.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { Classes } from './pages/Classes.jsx'
import { Students } from './pages/Students.jsx'
import { StudentConfirm } from './pages/StudentConfirm.jsx'
import { Attendance, ProgressWindow } from './pages/Attendance.jsx'
import { Reports } from './pages/Reports.jsx'
import { Templates } from './pages/Templates.jsx'
import { PrintSetup } from './pages/PrintSetup.jsx'
import { Admin } from './pages/Admin.jsx'
import { Adsense } from './pages/Adsense.jsx'
import { AdminSettings } from './pages/AdminSettings.jsx'
import { Profile } from './pages/Profile.jsx'
import { NaverCallback } from './pages/NaverCallback.jsx'
import { KakaoCallback } from './pages/KakaoCallback.jsx'
import { TermsPage, PrivacyPage } from './pages/LegalPage.jsx'
import { Training }     from './pages/Training.jsx'
import { Certificates } from './pages/Certificates.jsx'
import { Career }       from './pages/Career.jsx'
import { AwardsPage }   from './pages/Awards.jsx'
import { Proposals }    from './pages/Proposals.jsx'
import { Jobs }         from './pages/Jobs.jsx'
import { Revenue }      from './pages/Revenue.jsx'
import { Supplies }     from './pages/Supplies.jsx'
import { MessageGuide } from './pages/MessageGuide.jsx'
import { Blog }         from './pages/Blog.jsx'
import { BlogAdmin }    from './pages/BlogAdmin.jsx'
import { BlogWrite }    from './pages/BlogWrite.jsx'
import { ParentInvite } from './pages/ParentInvite.jsx'
import { ParentLogin }  from './pages/ParentLogin.jsx'
import ParentServiceManage from './pages/ParentServiceManage.jsx'
// ✅ 업체 포털
import { VendorManage } from './pages/VendorManage.jsx'
// ✅ 학교 담당자 포털
import { SchoolAuth, LS_SCHOOL_SESSION } from './pages/SchoolAuth.jsx'
import { SchoolAdminApp } from './pages/SchoolAdminApp.jsx'
import { SchoolAdminManage } from './pages/SchoolAdminManage.jsx'
import { VendorAuth }   from './pages/VendorAuth.jsx'
import { VendorApp }    from './pages/VendorApp.jsx'
import { Sidebar } from './components/Sidebar.jsx'
import { ToastContainer, ConfirmDialog, useConfirmDialog } from './components/Atoms.jsx'
import { useToast } from './hooks/useToast.js'
import { can } from './constants/permissions.js'

// ─── 구 버전 localStorage 캐시 정리 (Supabase 토큰 + 앱 데이터만 보존)
;(function cleanOldCache() {
  try {
    Object.keys(localStorage).forEach(key => {
      if (!key.startsWith('sb-') && !key.startsWith('asa_') && !key.startsWith('access_warn_sent_')) {
        localStorage.removeItem(key)
      }
    })
  } catch (e) { console.warn('[App] 오류:', e) }
})()

// ─── 전역 에러 바운더리 ────────────────────────────────────────────
// 자식 트리에서 런타임 에러가 발생하면 전체 흰 화면 대신 안내 화면을 표시.
// "Rendered fewer/more hooks..." 같은 렌더링 단계 에러를 포함해
// 예기치 못한 모든 컴포넌트 크래시를 여기서 한 번에 막아준다.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] 처리되지 않은 오류:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '24px', textAlign: 'center', gap: '12px',
          fontFamily: 'Noto Sans KR, sans-serif', background: '#f4f5f7', color: '#111827',
        }}>
          <div style={{ fontSize: '40px' }}>⚠️</div>
          <div style={{ fontSize: '17px', fontWeight: 700 }}>화면을 표시하는 중 오류가 발생했습니다</div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>새로고침하면 정상적으로 돌아올 수 있습니다.</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: '#f97316', color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
            }}
          >새로고침</button>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── 모바일 하단 네비게이션 ───────────────────────────────────────
const MOBILE_NAV = [
  { path: 'dashboard',    label: '홈',     icon: '🏠' },
  { path: 'attendance',   label: '출석부',  icon: '✅' },
  { path: 'students',     label: '학생',   icon: '👥' },
  { path: 'messageguide', label: '문구',   icon: '💬' },
  { path: '__more__',     label: '더보기', icon: '☰'  },
]

function MobileHeader({ onMenuOpen }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
      height: '52px', background: '#18181b',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>📋</span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>방과후 출석부</span>
      </div>
      <button onClick={onMenuOpen} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#fff', fontSize: '22px', padding: '4px 8px',
        display: 'flex', alignItems: 'center',
      }}>☰</button>
    </div>
  )
}

function MobileBottomNav({ currentPage, onNav }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 900,
      height: '60px', background: '#18181b',
      display: 'flex', borderTop: '1px solid #27272a',
    }}>
      {MOBILE_NAV.map(item => {
        const isActive = item.path !== '__more__' && currentPage === item.path
        return (
          <button key={item.path} onClick={() => onNav(item.path)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '2px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: isActive ? '#f97316' : '#71717a',
              fontSize: '10px', fontFamily: 'Noto Sans KR, sans-serif',
              transition: 'color .15s',
            }}>
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            <span style={{ fontWeight: isActive ? 700 : 400 }}>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function AppInner() {
  const [user, setUser] = useState(null)
  const [showLanding, setShowLanding] = useState(true)   // ← 랜딩 페이지 표시 여부
  const [landingTarget, setLandingTarget] = useState('login') // 'login' | 'signup'
  const [page, setPage] = useState('dashboard')
  const [pageParams, setPageParams] = useState({})
  const [dbReady, setDbReady] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { toasts, error: toastError } = useToast()

  // 저장 실패 — SaveStatusBar에서 표시하므로 토스트 제거
  const { confirmDialogProps } = useConfirmDialog()

  // ✅ 업체 세션 상태
  const [vendorSession, setVendorSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('asa_vendor_session') || 'null') }
    catch { return null }
  })

  // ✅ 학교 담당자 세션 상태
  const [schoolSession, setSchoolSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('asa_school_session') || 'null') }
    catch { return null }
  })

  // ─── 현재 경로 판별 (조건부 return 전에 미리 계산) ───────────────
  const pathname = window.location.pathname
  const search   = window.location.search

  const isStaticPath =
    pathname.startsWith('/blog') ||
    pathname.startsWith('/docs') ||
    pathname === '/naver-callback' ||
    pathname === '/kakao-callback' ||
    pathname === '/auth' ||
    pathname === '/legal' ||
    pathname === '/terms' ||
    pathname === '/privacy'

  const isVendorPath =
    search.includes('vendor') ||
    pathname.includes('vendor-login')

  const isSchoolPath =
    search.includes('school') ||
    pathname === '/school'

  // ─── 모든 useEffect를 조건부 return 전에 선언 ─────────────────────

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    // 정적 경로·업체·학교 포털은 DB 초기화 불필요
    if (isStaticPath || isVendorPath || isSchoolPath) return

    async function init() {
      const session = await authGetSession()

      if (session?.user) {
        // 1) IndexedDB 캐시 즉시 로드 → 화면 빠르게 표시
        await loadCacheFromIDB()
        const cached = Users.findByEmail(session.user.email)
        if (cached) {
          setUser(cached)
          setDbReady(true)
        }
        // 2) 백그라운드에서 변경분만 Supabase 로드 (증분 동기화)
        await initFromSupabase()
        const fresh = Users.findByEmail(session.user.email)
        if (fresh) {
          // 접속 기간 만료 체크
          if (fresh.role === 'teacher' && fresh.accessExpiredAt) {
            const now       = new Date()
            const expDate   = new Date(fresh.accessExpiredAt)
            const daysLeft  = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24))

            // 만료된 경우 → 로그아웃 + 안내
            if (daysLeft < 0) {
              await authSignOut()
              setDbReady(true)
              toastError('접속 기간이 만료되었습니다. 서비스 이용을 원하시면 관리자에게 문의해 주세요.')
              return
            }

            // 7일 이내 → 자동 이메일 발송 (오늘 이미 보냈으면 스킵)
            if (daysLeft <= 7 && fresh.email) {
              const storageKey  = `access_warn_sent_${fresh.id}`
              const lastSentDay = localStorage.getItem(storageKey)
              const todayStr    = now.toISOString().slice(0, 10)
              if (lastSentDay !== todayStr) {
                try {
                  await sendEmail(
                    fresh.email,
                    `[출석부] 접속 기간 만료 ${daysLeft}일 전 안내 — ${fresh.accessExpiredAt.slice(0,10)} 까지`
                  )
                  localStorage.setItem(storageKey, todayStr)
                } catch (e) {
                  console.warn('[접속기간 안내 메일 발송 실패]', e.message)
                }
              }
            }
          }
          setUser(fresh)
          const pageParam = new URLSearchParams(search).get('page')
          if (pageParam) setPage(pageParam)
        }
      }

      setDbReady(true)
    }
    init()

    // 인증 상태 변경 감지 (다른 탭 로그아웃 등)
    const unsubscribe = authOnStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        sessionStorage.removeItem('asa_user')
      }
    })
    // users 테이블 변경 감지 → level/verified 등 갱신 즉시 반영
    const unsubUsers = onDbChange('users', () => {
      setUser(prev => {
        if (!prev) return prev
        const fresh = Users.find(prev.id)
        return fresh || prev
      })
    })
    return () => { unsubscribe(); unsubUsers() }
  }, [])

  // 뒤로가기/앞으로가기 감지
  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state?.page) {
        setPage(e.state.page)
        setPageParams(e.state.params || {})
      } else {
        setPage('dashboard')
        setPageParams({})
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // ─── 조건부 렌더링 (모든 훅 선언 완료 후) ────────────────────────

  // 진도 수업 화면 별도 창
  if (new URLSearchParams(search).get('progress_screen') === '1') return <ProgressWindow />

  // 블로그 — 공개 페이지 (로그인 불필요, SEO용)
  if (pathname.startsWith('/blog')) return <Blog />
  if (pathname.startsWith('/docs')) return <Blog />

  // 네이버/카카오 콜백 — DB 불필요, 바로 렌더
  if (pathname === '/naver-callback') return <NaverCallback />
  if (pathname === '/kakao-callback') return <KakaoCallback />

  // 공개 약관 페이지 — 로그인 불필요
  if (pathname === '/legal')   return <TermsPage />
  if (pathname === '/terms')   return <TermsPage />
  if (pathname === '/privacy') return <PrivacyPage />

  // ✅ 업체 포털 분기
  if (isVendorPath) {
    if (vendorSession) {
      return (
        <VendorApp
          vendorSession={vendorSession}
          onLogout={() => {
            localStorage.removeItem('asa_vendor_session')
            setVendorSession(null)
          }}
        />
      )
    }
    return <VendorAuth onLogin={(session) => setVendorSession(session)} />
  }

  // DB 초기화 대기
  if (!dbReady) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fff7ed', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'48px' }}>📋</div>
      <div style={{ fontSize:'16px', fontWeight:700, color:'#f97316' }}>방과후 출석부</div>
      <div style={{ fontSize:'13px', color:'#9ca3af' }}>{isConfigured ? '서버 연결 중...' : '로딩 중...'}</div>
    </div>
  )

  // ✅ 학교 담당자 포털 분기
  if (isSchoolPath) {
    if (schoolSession) {
      return (
        <SchoolAdminApp
          session={schoolSession}
          onLogout={() => {
            localStorage.removeItem('asa_school_session')
            setSchoolSession(null)
            window.location.href = '/school'
          }}
        />
      )
    }
    return <SchoolAuth onLogin={(s) => setSchoolSession(s)} />
  }

  // DB 준비 완료 후 학부모 페이지 렌더
  if (pathname === '/parent-invite') return <ParentInvite />
  if (pathname === '/parent-login')  return <ParentLogin />

  // ── 랜딩 페이지 ─────────────────────────────────────────────────
  // 네이버/카카오 리다이렉트 콜백은 Auth에서 처리해야 하므로 랜딩 스킵
  const isSocialRedirect = new URLSearchParams(search).has('naver_redirect') || new URLSearchParams(search).has('kakao_redirect')
  if (showLanding && !user && !isSocialRedirect) {
    return (
      <LandingPage
        onGoLogin={() => { setLandingTarget('login'); setShowLanding(false) }}
        onGoSignup={() => { setLandingTarget('signup'); setShowLanding(false) }}
        onGoBlog={() => { window.location.href = '/blog' }}
      />
    )
  }
  if (showLanding && user) {
    return (
      <LandingPage
        onGoLogin={() => setShowLanding(false)}
        onGoSignup={() => setShowLanding(false)}
        onGoBlog={() => { window.location.href = '/blog' }}
        onGoDashboard={() => setShowLanding(false)}
        onLogout={() => { handleLogout(); setShowLanding(true) }}
        user={user}
      />
    )
  }

  // 로그인/회원가입 — /auth 직접 접근 시 (이미 로그인된 경우 대시보드로)
  if (pathname === '/auth') {
    if (user) { window.history.replaceState({}, '', '/'); return <Dashboard user={user} onNav={handleNav} pageParams={pageParams} onUserUpdate={handleUserUpdate} onLogout={handleLogout} /> }
    return <Auth onLogin={handleLogin} initialTab={landingTarget} onGoLanding={() => setShowLanding(true)} />
  }

  if (!user) return <Auth onLogin={handleLogin} initialTab={landingTarget} onGoLanding={() => setShowLanding(true)} />

  const pageProps = { user, onNav: handleNav, pageParams, onUserUpdate: handleUserUpdate, onLogout: handleLogout }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':       return <Dashboard {...pageProps} />
      case 'classes':         return <Classes {...pageProps} />
      case 'students':        return <Students {...pageProps} />
      case 'confirm':         return <StudentConfirm {...pageProps} />
      case 'attendance':      return <Attendance {...pageProps} />
      case 'reports':         return <Reports {...pageProps} />
      case 'templates':       return <Templates {...pageProps} />
      case 'printsetup':      return <PrintSetup {...pageProps} />
      case 'parent-service':  return <ParentServiceManage user={user} />
      case 'admin':           return can(user, 'approve_teacher') ? <Admin {...pageProps} /> : <Dashboard {...pageProps} />
      case 'adsense':         return <Adsense {...pageProps} />
      case 'profile':         return <Profile {...pageProps} />
      case 'admin_settings':  return can(user, 'manage_ad') ? <AdminSettings {...pageProps} /> : <Dashboard {...pageProps} />
      case 'training':        return <Training     user={user} />
      case 'certificates':    return <Certificates user={user} />
      case 'career':          return <Career       user={user} />
      case 'awards':          return <AwardsPage   user={user} />
      case 'proposals':       return <Proposals    user={user} />
      case 'jobs':            return <Jobs         user={user} />
      case 'revenue':         return <Revenue      user={user} />
      case 'supplies':        return <Supplies     user={user} />
      case 'messageguide':    return <MessageGuide user={user} />
      case 'blog_admin':      return can(user, 'manage_ad') ? <BlogAdmin user={user} /> : <Dashboard {...pageProps} />
      case 'blog_write':      return <BlogWrite user={user} onLogout={handleLogout} />
      // ✅ 본사 업체 관리 (Lv.10 전용)
      case 'vendor_manage':   return can(user, 'manage_ad') ? <VendorManage user={user} /> : <Dashboard {...pageProps} />
      // ✅ 본사 학교 담당자 관리 (Lv.10 전용)
      case 'school_manage':   return can(user, 'manage_ad') ? <SchoolAdminManage user={user} /> : <Dashboard {...pageProps} />
      default:                return <Dashboard {...pageProps} />
    }
  }

  // ─── 핸들러 (렌더링 직전에 정의) ─────────────────────────────────

  async function handleLogin(u) {
    // 소셜 로그인 / 회원가입: id가 있는 완전한 user 객체
    if (u.id) {
      setUser(u)
      sessionStorage.setItem('asa_user', JSON.stringify(u))
      const pageParam = new URLSearchParams(search).get('page')
      setPage(pageParam || 'dashboard')
      setPageParams({})
      return
    }

    const doLogin = (foundUser) => {
      setUser(foundUser)
      sessionStorage.setItem('asa_user', JSON.stringify(foundUser))
      const pageParam = new URLSearchParams(search).get('page')
      setPage(pageParam || 'dashboard')
      setPageParams({})
    }

    // 1) 캐시(로컬 메모리) 먼저 확인
    const cached = Users.findByEmail(u.email)
    if (cached) {
      doLogin(cached)
      // 백그라운드 sync
      initFromSupabase().then(() => {
        const fresh = Users.findByEmail(u.email)
        if (fresh) setUser(fresh)
      })
      return
    }

    // 2) 캐시 미스 → users 테이블만 직접 조회 (전체 sync 기다리지 않음)
    // dbCall 내부에서 const { data: d } = payload 로 받으므로 data 키로 전달
    try {
      const fromDb = await dbCall('findByEmail', 'users', { data: { email: u.email } })
      if (fromDb) {
        doLogin(fromDb)
        // 백그라운드에서 전체 sync
        initFromSupabase().catch(e => console.warn('[handleLogin] 백그라운드 sync 실패:', e.message))
        return
      }
    } catch (err) {
      console.warn('[handleLogin] 직접 조회 실패, 전체 sync 시도:', err.message)
    }

    // 3) 직접 조회 실패 시 전체 sync 후 재조회 (최후 수단)
    try {
      await initFromSupabase()
      const fresh = Users.findByEmail(u.email)
      if (fresh) { doLogin(fresh); return }
      console.error('[handleLogin] users 테이블에서 유저를 찾을 수 없음:', u.email)
    } catch (e2) {
      console.error('[handleLogin] sync 실패:', e2.message)
    }
  }

  function handleUserUpdate(updatedUser) {
    setUser(updatedUser)
    sessionStorage.setItem('asa_user', JSON.stringify(updatedUser))
  }

  async function handleLogout() {
    if (isConfigured) await authSignOut()
    setUser(null)
    sessionStorage.removeItem('asa_user')
  }

  function handleNav(p, params = {}) {
    if (p === '__more__') { setSidebarOpen(true); return }
    if (user) {
      const fresh = Users.find(user.id)
      if (fresh) setUser(fresh)
    }
    setPage(p)
    setPageParams(params)
    setSidebarOpen(false)
    window.history.pushState({ page: p, params }, '', pathname + '?page=' + p)
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f5f7', flexDirection: isMobile ? 'column' : 'row' }}>
      <SaveStatusBar user={user} />
      {isMobile && <MobileHeader onMenuOpen={() => setSidebarOpen(true)} />}
      <Sidebar user={user} currentPage={page} onNav={handleNav} onLogout={handleLogout}
               mobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
               onGoLanding={() => { setShowLanding(true) }} />
      <main style={{ flex:1, height:'100vh', overflowY:'auto', paddingTop: isMobile ? '52px' : 0, paddingBottom: isMobile ? '60px' : 0 }}>
        {renderPage()}
      </main>
      {isMobile && <MobileBottomNav currentPage={page} onNav={handleNav} />}
      <ToastContainer toasts={toasts} />
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  )
}

// ─── 최상위 ErrorBoundary 래퍼 ─────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
