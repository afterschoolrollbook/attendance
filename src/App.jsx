import React, { useState, useEffect } from 'react'
import { seedIfEmpty } from './lib/seed.js'
import { Users } from './lib/db.js'
import { initFromSupabase } from './lib/db.js'
import { isConfigured } from './lib/supabase.js'
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
import { Sidebar } from './components/Sidebar.jsx'
import { ToastContainer } from './components/Atoms.jsx'
import { useToast } from './hooks/useToast.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [pageParams, setPageParams] = useState({})
  const [dbReady, setDbReady] = useState(false)
  const { toasts } = useToast()

  // 네이버 콜백 페이지 처리 — 팝업으로 열린 경우 바로 렌더
  if (window.location.pathname === '/naver-callback') return <NaverCallback />
  if (window.location.pathname === '/kakao-callback') return <KakaoCallback />

  useEffect(() => {
    async function init() {
      if (isConfigured) {
        await initFromSupabase()
      } else {
        seedIfEmpty()
      }
      setDbReady(true)
      const saved = sessionStorage.getItem('asa_user')
      if (saved) {
        try {
          const u = JSON.parse(saved)
          const fresh = Users.find(u.id)
          if (fresh) setUser(fresh)
        } catch {}
      }
    }
    init()
  }, [])

  const handleLogin = (u) => {
    setUser(u)
    sessionStorage.setItem('asa_user', JSON.stringify(u))
    setPage('dashboard')
    setPageParams({})
  }

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser)
    sessionStorage.setItem('asa_user', JSON.stringify(updatedUser))
  }

  const handleLogout = () => {
    setUser(null)
    sessionStorage.removeItem('asa_user')
  }

  const handleNav = (p, params = {}) => {
    if (user) {
      const fresh = Users.find(user.id)
      if (fresh) setUser(fresh)
    }
    setPage(p)
    setPageParams(params)
  }

  if (!dbReady) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#fff7ed', flexDirection:'column', gap:'16px' }}>
      <div style={{ fontSize:'48px' }}>📋</div>
      <div style={{ fontSize:'16px', fontWeight:700, color:'#f97316' }}>방과후 출석부</div>
      <div style={{ fontSize:'13px', color:'#9ca3af' }}>{isConfigured ? '서버 연결 중...' : '로딩 중...'}</div>
    </div>
  )

  if (!user) return <Auth onLogin={handleLogin} />

  const pageProps = { user, onNav: handleNav, pageParams, onUserUpdate: handleUserUpdate }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':      return <Dashboard {...pageProps} />
      case 'classes':        return <Classes {...pageProps} />
      case 'students':       return <Students {...pageProps} />
      case 'confirm':        return <StudentConfirm {...pageProps} />
      case 'attendance':     return <Attendance {...pageProps} />
      case 'reports':        return <Reports {...pageProps} />
      case 'templates':      return <Templates {...pageProps} />
      case 'printsetup':     return <PrintSetup {...pageProps} />
      case 'admin':          return <Admin {...pageProps} />
      case 'adsense':        return <Adsense {...pageProps} />
      case 'profile':        return <Profile {...pageProps} />
      case 'admin_settings': return <AdminSettings {...pageProps} />
      default:               return <Dashboard {...pageProps} />
    }
  }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f5f7' }}>
      <Sidebar user={user} currentPage={page} onNav={handleNav} onLogout={handleLogout} />
      <main style={{ flex:1, overflowY:'auto', minHeight:'100vh' }}>
        {renderPage()}
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  )
}
