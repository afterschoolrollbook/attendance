import React, { useState, useEffect } from 'react'
import { seedIfEmpty } from './lib/seed.js'
import { Users } from './lib/db.js'
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
import { Sidebar } from './components/Sidebar.jsx'
import { ToastContainer } from './components/Atoms.jsx'
import { useToast } from './hooks/useToast.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const { toasts, success } = useToast()

  useEffect(() => {
    seedIfEmpty()
    // 세션 복원
    const saved = sessionStorage.getItem('asa_user')
    if (saved) {
      try {
        const u = JSON.parse(saved)
        const fresh = Users.find(u.id)
        if (fresh) setUser(fresh)
      } catch {}
    }
  }, [])

  const handleLogin = (u) => {
    setUser(u)
    sessionStorage.setItem('asa_user', JSON.stringify(u))
    setPage('dashboard')
  }

  const handleLogout = () => {
    setUser(null)
    sessionStorage.removeItem('asa_user')
  }

  // 페이지 전환 시 최신 유저 데이터 갱신
  const handleNav = (p) => {
    if (user) {
      const fresh = Users.find(user.id)
      if (fresh) setUser(fresh)
    }
    setPage(p)
  }

  if (!user) return <Auth onLogin={handleLogin} />

  const pageProps = { user, onNav: handleNav }

  const renderPage = () => {
    switch (page) {
      case 'dashboard':   return <Dashboard {...pageProps} />
      case 'classes':     return <Classes {...pageProps} />
      case 'students':    return <Students {...pageProps} />
      case 'confirm':     return <StudentConfirm {...pageProps} />
      case 'attendance':  return <Attendance {...pageProps} />
      case 'reports':     return <Reports {...pageProps} />
      case 'templates':   return <Templates {...pageProps} />
      case 'printsetup':  return <PrintSetup {...pageProps} />
      case 'admin':       return <Admin {...pageProps} />
      case 'adsense':     return <Adsense {...pageProps} />
      default:            return <Dashboard {...pageProps} />
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f5f7' }}>
      <Sidebar user={user} currentPage={page} onNav={handleNav} onLogout={handleLogout} />
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh' }}>
        {renderPage()}
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  )
}
