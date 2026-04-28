import React, { useState, useEffect } from 'react'
import { Users } from './lib/db.js'
import { initFromSupabase } from './lib/db.js'
import { isConfigured, authSignOut, authOnStateChange, authGetSession } from './lib/supabase.js'
import { Auth } from './pages/Auth.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { Classes } from './pages/Classes.jsx'
import { Students } from './pages/Students.jsx'
import { StudentConfirm } from './pages/StudentConfirm.jsx'
import { Attendance } from './pages/Attendance.jsx'
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

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [pageParams, setPageParams] = useState({})
  const [dbReady, setDbReady] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { toasts } = useToast()
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
        await initFromSupabase()
        const fresh = Users.findByEmail(session.user.email)
        if (fresh) {
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
    return unsubscribe
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

  // 블로그 — 공개 페이지 (로그인 불필요, SEO용)
  if (pathname.startsWith('/blog')) return <Blog />
  if (pathname.startsWith('/docs')) return <Blog />

  // 네이버/카카오 콜백 — DB 불필요, 바로 렌더
  if (pathname === '/naver-callback') return <NaverCallback />
  if (pathname === '/kakao-callback') return <KakaoCallback />

  // 공개 약관 페이지 — 로그인 불필요
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

  if (!user) return <Auth onLogin={handleLogin} />

  const pageProps = { user, onNav: handleNav, pageParams, onUserUpdate: handleUserUpdate }

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
      case 'admin':           return <Admin {...pageProps} />
      case 'adsense':         return <Adsense {...pageProps} />
      case 'profile':         return <Profile {...pageProps} />
      case 'admin_settings':  return <AdminSettings {...pageProps} />
      case 'training':        return <Training     user={user} />
      case 'certificates':    return <Certificates user={user} />
      case 'career':          return <Career       user={user} />
      case 'awards':          return <AwardsPage   user={user} />
      case 'proposals':       return <Proposals    user={user} />
      case 'jobs':            return <Jobs         user={user} />
      case 'revenue':         return <Revenue      user={user} />
      case 'supplies':        return <Supplies     user={user} />
      case 'messageguide':    return <MessageGuide user={user} />
      case 'blog_admin':      return <BlogAdmin user={user} />
      // ✅ 본사 업체 관리 (Lv.5 전용)
      case 'vendor_manage':   return <VendorManage user={user} />
      // ✅ 본사 학교 담당자 관리 (Lv.5 전용)
      case 'school_manage':   return <SchoolAdminManage user={user} />
      default:                return <Dashboard {...pageProps} />
    }
  }

  // ─── 핸들러 (렌더링 직전에 정의) ─────────────────────────────────

  function handleLogin(u) {
    console.log('[handleLogin] 호출됨, u =', u)

    // 소셜 로그인 / 회원가입: id가 있는 완전한 user 객체
    if (u.id) {
      console.log('[handleLogin] id 있음 → 바로 로그인')
      setUser(u)
      sessionStorage.setItem('asa_user', JSON.stringify(u))
      const pageParam = new URLSearchParams(search).get('page')
      setPage(pageParam || 'dashboard')
      setPageParams({})
      return
    }

    // 이메일/비밀번호 로그인: authSignIn 완료 후 DB에서 유저 조회
    console.log('[handleLogin] 이메일 로그인 → initFromSupabase 시작')
    initFromSupabase().then(() => {
      console.log('[handleLogin] initFromSupabase 완료, 이메일로 유저 조회:', u.email)
      const allUsers = Users.all()
      console.log('[handleLogin] 전체 유저 목록:', allUsers.map(x => x.email))

      const fullUser = Users.findByEmail(u.email)
      console.log('[handleLogin] findByEmail 결과:', fullUser)

      if (!fullUser) {
        console.error('[handleLogin] ❌ 유저를 찾을 수 없음:', u.email)
        return
      }
      console.log('[handleLogin] ✅ 로그인 성공:', fullUser.email)
      setUser(fullUser)
      sessionStorage.setItem('asa_user', JSON.stringify(fullUser))
      const pageParam = new URLSearchParams(search).get('page')
      setPage(pageParam || 'dashboard')
      setPageParams({})
    }).catch(err => {
      console.error('[handleLogin] initFromSupabase 에러:', err)
    })
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
    window.history.pushState({ page: p, params }, '', pathname)
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f5f7', flexDirection: isMobile ? 'column' : 'row' }}>
      {isMobile && <MobileHeader onMenuOpen={() => setSidebarOpen(true)} />}
      <Sidebar user={user} currentPage={page} onNav={handleNav} onLogout={handleLogout}
               mobile={isMobile} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main style={{ flex:1, height:'100vh', overflowY:'auto', paddingTop: isMobile ? '52px' : 0, paddingBottom: isMobile ? '60px' : 0 }}>
        {renderPage()}
      </main>
      {isMobile && <MobileBottomNav currentPage={page} onNav={handleNav} />}
      <ToastContainer toasts={toasts} />
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  )
}
