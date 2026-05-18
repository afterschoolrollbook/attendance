import React from 'react'
import { AdSlots } from '../lib/db.js'
import { can, canAccessMenu, isMenuVisible, getMenuMinLevel, getLevelNames, LEVEL_COLORS } from '../constants/permissions.js'
import { FEATURES } from '../constants/permissions.js'

const NAV = [
  { path: 'dashboard',       label: '대시보드',        icon: '🏠' },
  { path: 'attendance',      label: '출석부',           icon: '✅' },
  { path: 'classes',         label: '수업등록 및 관리', icon: '📚' },
  { path: 'students',        label: '학생등록 및 관리', icon: '👥' },
  { path: 'confirm',         label: '인원확정 및 추첨', icon: '🎲' },
  { path: 'reports',         label: '출석 리포트',      icon: '📊' },
  { path: 'templates',       label: '방과후 서류',      icon: '🗂️' },
  { path: 'printsetup',      label: '출석부 출력',      icon: '🖨️' },
  { path: 'parent-service',  label: '출결 서비스 관리', icon: '📲' },
  { path: 'supplies',        label: '교구준비 및 관리', icon: '🎒' },
  { path: 'messageguide',    label: '안내 문구 관리',   icon: '💬' },
  { path: 'profile',         label: '내 정보',          icon: '👤' },
]

const MY_NAV_FIXED = [
  { path: 'revenue', label: '수익관리', icon: '💰' },
]

const MY_NAV = [
  { path: 'training',     label: '연수관리',         icon: '🎓', menuKey: 'training' },
  { path: 'certificates', label: '자격증관리',       icon: '🏆', menuKey: 'certificates' },
  { path: 'career',       label: '학력 및 이력관리', icon: '📋', menuKey: 'career' },
  { path: 'awards',       label: '수상경력',          icon: '🏅', menuKey: 'awards' },
  { path: 'proposals',    label: '제안서·자기소개서', icon: '📝', menuKey: 'proposals' },
  { path: 'jobs',         label: '공고관리',          icon: '📢', menuKey: 'jobs' },
]

const ADMIN_NAV = [
  { path: 'admin',          label: '관리자',     icon: '⚙️', feature: FEATURES.APPROVE_TEACHER },
  { path: 'admin_settings', label: '서비스 설정', icon: '🔧', feature: FEATURES.MANAGE_AD },
  { path: 'adsense',        label: '광고 관리',  icon: '📢', feature: FEATURES.MANAGE_AD },
  { path: 'blog_admin',     label: '블로그 관리', icon: '📝', feature: FEATURES.MANAGE_AD },
]

const HQ_NAV = [
  { path: 'vendor_manage', label: '업체 관리',        icon: '🏢' },
  { path: 'school_manage', label: '학교 담당자 관리', icon: '🏫' },
]

const KEY_MENU = 'asa_mymenu_settings'
function getMenuConfig() {
  return JSON.parse(localStorage.getItem(KEY_MENU) || '{"training":true,"certificates":true,"career":true,"awards":true,"proposals":true,"jobs":true}')
}

export function Sidebar({ user, currentPage, onNav, onLogout, mobile, open, onClose }) {
  const adSlot     = AdSlots.all().find(s => s.id === 'sidebar_bottom')
  const menuCfg    = getMenuConfig()
  const levelNames = getLevelNames()

  const userLevel   = user?.level || 1
  const levelColor  = LEVEL_COLORS[userLevel] || '#9ca3af'
  const levelLabel  = `Lv.${userLevel} ${levelNames[userLevel] || '미인증 선생님'}`
  const isAdmin     = user?.role === 'admin' || userLevel >= 10

  const visibleMyNav = MY_NAV.filter(item => menuCfg[item.menuKey] !== false)

  const [lockModal, setLockModal] = React.useState(null)

  const handleMenuClick = (path) => {
    if (!canAccessMenu(user, path)) {
      setLockModal({ path, minLevel: getMenuMinLevel(path) })
      return
    }
    onNav(path)
    if (mobile) onClose?.()
  }
  const handleNav = (path) => { onNav(path); if (mobile) onClose?.() }
  const handleLogout = () => { onLogout(); if (mobile) onClose?.() }

  const UserBadge = () => (
    <div style={{
      display:'inline-block', fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'999px',
      background:`${levelColor}22`, color:levelColor, border:`1px solid ${levelColor}44`,
    }}>
      {levelLabel}
    </div>
  )

  const renderNav = (isMobile) => (
    <nav style={{ flex:1, overflowY:'auto', padding: isMobile ? '10px 0' : '12px 0' }}>
      {NAV.map(item => {
        if (!isMenuVisible(user, item.path)) return null
        const locked = !canAccessMenu(user, item.path)
        return <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleMenuClick(item.path)} locked={locked} />
      })}

      <div style={{ fontSize:'11px', color:'#52525b', padding: isMobile ? '10px 16px 4px' : '12px 20px 4px', fontWeight:600, letterSpacing:'0.05em' }}>
        선생님 커리어
      </div>
      {isMenuVisible(user, 'revenue') && MY_NAV_FIXED.map(item => {
        const locked = !canAccessMenu(user, item.path)
        return <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleMenuClick(item.path)} locked={locked} />
      })}
      {visibleMyNav.filter(item => isMenuVisible(user, item.menuKey)).map(item => {
        const locked = !canAccessMenu(user, item.menuKey)
        return <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleMenuClick(item.path)} locked={locked} />
      })}

      {isAdmin && (
        <>
          <div style={{ fontSize:'11px', color:'#52525b', padding: isMobile ? '10px 16px 4px' : '12px 20px 4px', fontWeight:600, letterSpacing:'0.05em' }}>
            관리자
          </div>
          {ADMIN_NAV.map(item => (
            <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleNav(item.path)} />
          ))}
        </>
      )}

      {isAdmin && (
        <>
          <div style={{ fontSize:'11px', color:'#a78bfa', padding: isMobile ? '10px 16px 4px' : '12px 20px 4px', fontWeight:700, letterSpacing:'0.05em' }}>
            본사 운영
          </div>
          {HQ_NAV.map(item => (
            <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleNav(item.path)} accent="#8b5cf6" />
          ))}
        </>
      )}
    </nav>
  )

  // ── 모바일
  if (mobile) return (
    <>
      {open && <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)' }} />}
      <aside style={{
        position:'fixed', top:0, left:open ? 0 : '-260px', zIndex:1100,
        width:'240px', height:'100vh', background:'#18181b',
        display:'flex', flexDirection:'column',
        transition:'left .25s ease',
        boxShadow: open ? '4px 0 24px rgba(0,0,0,0.35)' : 'none',
      }}>
        <div style={{ padding:'18px 16px 16px', borderBottom:'1px solid #27272a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ fontSize:'20px' }}>📋</span>
            <span style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>방과후 출석부</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#71717a', fontSize:'22px', cursor:'pointer', padding:'2px 6px' }}>✕</button>
        </div>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #27272a' }}>
          <div style={{ fontSize:'14px', fontWeight:600, color:'#fff', marginBottom:'4px' }}>{user?.name}</div>
          <UserBadge />
        </div>
        {renderNav(true)}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #27272a' }}>
          <button onClick={handleLogout} style={{ background:'none', border:'none', cursor:'pointer', color:'#71717a', fontSize:'14px', padding:'6px 0', display:'flex', alignItems:'center', gap:'8px', width:'100%', fontFamily:'Noto Sans KR, sans-serif' }}>
            <span>🚪</span> 로그아웃
          </button>
        </div>
      </aside>
    </>
  )

  // ── PC
  return (
    <aside style={{
      width:'220px', minWidth:'220px', background:'#18181b',
      display:'flex', flexDirection:'column', height:'100vh',
      position:'sticky', top:0, overflow:'hidden',
    }}>
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid #27272a' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'22px' }}>📋</span>
          <div>
            <div style={{ fontSize:'15px', fontWeight:700, color:'#fff' }}>방과후 출석부</div>
            <div style={{ fontSize:'11px', color:'#71717a', marginTop:'2px' }}>AfterSchool</div>
          </div>
        </div>
      </div>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #27272a' }}>
        <div style={{ fontSize:'14px', fontWeight:600, color:'#fff', marginBottom:'4px' }}>{user?.name}</div>
        <UserBadge />
      </div>
      {renderNav(false)}
      {adSlot?.active && adSlot.code && (
        <div style={{ padding:'12px 16px' }}>
          <div style={{ width:'100%', height:120, background:'#27272a', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#71717a' }}>
            광고
          </div>
        </div>
      )}

      {/* 잠금 모달 */}
      {lockModal && (
        <div onClick={() => setLockModal(null)}
          style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#fff', borderRadius:'16px', padding:'32px 24px', maxWidth:'300px', width:'100%', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔒</div>
            <div style={{ fontSize:'16px', fontWeight:700, color:'#111827', marginBottom:'10px' }}>접근 제한</div>
            <div style={{ fontSize:'14px', color:'#6b7280', lineHeight:1.7, marginBottom:'24px' }}>
              <strong style={{ color:'#f97316' }}>Lv.{lockModal.minLevel}</strong> 등급 이상 사용이 가능합니다.<br/>
              관리자에게 문의해 주세요.
            </div>
            <button onClick={() => setLockModal(null)}
              style={{ padding:'10px 32px', borderRadius:'10px', border:'none', background:'#f97316', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
              확인
            </button>
          </div>
        </div>
      )}
      <div style={{ padding:'12px 20px', borderTop:'1px solid #27272a' }}>
        <button onClick={onLogout} style={{ background:'none', border:'none', cursor:'pointer', color:'#71717a', fontSize:'14px', padding:'6px 0', display:'flex', alignItems:'center', gap:'8px', width:'100%', fontFamily:'Noto Sans KR, sans-serif' }}>
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </aside>
  )
}

function NavItem({ item, active, onClick, accent, locked }) {
  const activeColor = accent || '#f97316'
  const activeBg    = accent ? '#8b5cf618' : '#f9731618'
  return (
    <button onClick={onClick}
      style={{
        width:'100%', display:'flex', alignItems:'center', gap:'10px',
        padding:'10px 20px', background: active ? activeBg : 'none',
        border:'none', borderLeft: active ? `3px solid ${activeColor}` : '3px solid transparent',
        color: locked ? '#52525b' : active ? activeColor : '#a1a1aa',
        fontSize:'14px', fontWeight: active ? 600 : 400,
        cursor:'pointer', textAlign:'left', transition:'all .15s',
        fontFamily:'Noto Sans KR, sans-serif',
        opacity: locked ? 0.6 : 1,
      }}
      onMouseEnter={e=>{ if(!active && !locked){ e.currentTarget.style.color='#fff'; e.currentTarget.style.background='#27272a' } }}
      onMouseLeave={e=>{ if(!active && !locked){ e.currentTarget.style.color='#a1a1aa'; e.currentTarget.style.background='none' } }}
    >
      <span style={{ fontSize:'16px', width:'20px', textAlign:'center' }}>{item.icon}</span>
      <span style={{ flex:1 }}>{item.label}</span>
      {locked && <span style={{ fontSize:'12px', color:'#52525b' }}>🔒</span>}
    </button>
  )
}
