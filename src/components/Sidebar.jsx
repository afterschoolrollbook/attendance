import React from 'react'
import { AdSlots } from '../lib/db.js'
import { can, FEATURES } from '../constants/permissions.js'

const NAV = [
  { path: 'dashboard',       label: '대시보드',        icon: '🏠', feature: null },
  { path: 'attendance',      label: '출석부',           icon: '✅', feature: FEATURES.ATTENDANCE },
  { path: 'classes',         label: '수업등록 및 관리', icon: '📚', feature: FEATURES.MANAGE_CLASS },
  { path: 'students',        label: '학생등록 및 관리', icon: '👥', feature: FEATURES.ADD_STUDENT },
  { path: 'confirm',         label: '인원확정 및 추첨', icon: '🎲', feature: null },
  { path: 'reports',         label: '출석 리포트',      icon: '📊', feature: FEATURES.VIEW_REPORT },
  { path: 'templates',       label: '출석부 양식',      icon: '📄', feature: FEATURES.MANAGE_TEMPLATE },
  { path: 'printsetup',      label: '출석부 출력',      icon: '🖨️', feature: FEATURES.PRINT_ATTENDANCE },
  { path: 'parent-service',  label: '출결 서비스 관리', icon: '📲', feature: null },
  { path: 'supplies',        label: '교구준비 및 관리', icon: '🎒', feature: null },
  { path: 'messageguide',    label: '안내 문구 관리',   icon: '💬', feature: null },
  { path: 'profile',         label: '내 정보',          icon: '👤', feature: null },
]

// 수익관리 — 항상 표시
const MY_NAV_FIXED = [
  { path: 'revenue', label: '수익관리', icon: '💰' },
]

// 내 관리 메뉴 — 관리자 ON/OFF 가능
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
]

// ✅ Lv.5 전용 — 본사 운영 메뉴
const HQ_NAV = [
  { path: 'vendor_manage', label: '업체 관리', icon: '🏢' },
]

const KEY_MENU = 'asa_mymenu_settings'
function getMenuConfig() {
  return JSON.parse(localStorage.getItem(KEY_MENU) || '{"training":true,"certificates":true,"career":true,"awards":true,"proposals":true,"jobs":true}')
}

export function Sidebar({ user, currentPage, onNav, onLogout, mobile, open, onClose }) {
  const adSlot  = AdSlots.all().find(s => s.id === 'sidebar_bottom')
  const menuCfg = getMenuConfig()

  const levelColors = { 1:'#9ca3af', 2:'#f97316', 3:'#16a34a', 4:'#8b5cf6', 5:'#ef4444' }
  const levelLabels = { 1:'Lv.1 미인증', 2:'Lv.2 인증', 3:'Lv.3 우수', 4:'Lv.4 파트너', 5:'Lv.5 관리자' }

  const visibleMyNav = MY_NAV.filter(item => menuCfg[item.menuKey] !== false)
  const isSuperAdmin = user?.level === 5  // ✅ Lv.5 판별

  const handleNav = (path) => { onNav(path); if (mobile) onClose?.() }
  const handleLogout = () => { onLogout(); if (mobile) onClose?.() }

  // ── 모바일: 오버레이 + 슬라이드 드로어
  if (mobile) return (
    <>
      {open && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.55)',
        }} />
      )}
      <aside style={{
        position: 'fixed', top: 0, left: open ? 0 : '-260px', zIndex: 1100,
        width: '240px', height: '100vh', background: '#18181b',
        display: 'flex', flexDirection: 'column',
        transition: 'left .25s ease',
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
          <div style={{ display:'inline-block', fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'999px', background:`${levelColors[user?.level]||'#9ca3af'}22`, color:levelColors[user?.level]||'#9ca3af', border:`1px solid ${levelColors[user?.level]||'#9ca3af'}44` }}>
            {levelLabels[user?.level] || 'Lv.1 미인증'}
          </div>
        </div>
        <nav style={{ flex:1, overflowY:'auto', padding:'10px 0' }}>
          {NAV.map(item => {
            if (item.feature && !can(user, item.feature)) return null
            return <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleNav(item.path)} />
          })}
          <div style={{ fontSize:'11px', color:'#52525b', padding:'10px 16px 4px', fontWeight:600 }}>선생님 커리어</div>
          {MY_NAV_FIXED.map(item => <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleNav(item.path)} />)}
          {visibleMyNav.map(item => <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleNav(item.path)} />)}
          {user?.role === 'admin' && (
            <>
              <div style={{ fontSize:'11px', color:'#52525b', padding:'10px 16px 4px', fontWeight:600 }}>관리자</div>
              {ADMIN_NAV.map(item => <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleNav(item.path)} />)}
            </>
          )}
          {/* ✅ Lv.5 전용 본사 운영 — 모바일 */}
          {isSuperAdmin && (
            <>
              <div style={{ fontSize:'11px', color:'#a78bfa', padding:'10px 16px 4px', fontWeight:700 }}>본사 운영</div>
              {HQ_NAV.map(item => <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleNav(item.path)} accent="#8b5cf6" />)}
            </>
          )}
        </nav>
        <div style={{ padding:'12px 16px', borderTop:'1px solid #27272a' }}>
          <button onClick={handleLogout} style={{ background:'none', border:'none', cursor:'pointer', color:'#71717a', fontSize:'14px', padding:'6px 0', display:'flex', alignItems:'center', gap:'8px', width:'100%', fontFamily:'Noto Sans KR, sans-serif' }}>
            <span>🚪</span> 로그아웃
          </button>
        </div>
      </aside>
    </>
  )

  // ── PC 레이아웃
  return (
    <aside style={{
      width: '220px', minWidth: '220px', background: '#18181b',
      display: 'flex', flexDirection: 'column', height: '100vh',
      position: 'sticky', top: 0, overflow: 'hidden',
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
        <div style={{
          display:'inline-block', fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'999px',
          background:`${levelColors[user?.level] || '#9ca3af'}22`,
          color: levelColors[user?.level] || '#9ca3af',
          border:`1px solid ${levelColors[user?.level] || '#9ca3af'}44`,
        }}>
          {levelLabels[user?.level] || 'Lv.1 미인증'}
        </div>
      </div>

      <nav style={{ flex:1, overflowY:'auto', padding:'12px 0' }}>
        {NAV.map(item => {
          if (item.feature && !can(user, item.feature)) return null
          return <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>onNav(item.path)} />
        })}

        <div style={{ fontSize:'11px', color:'#52525b', padding:'12px 20px 4px', fontWeight:600, letterSpacing:'0.05em' }}>
          선생님 커리어
        </div>
        {MY_NAV_FIXED.map(item => (
          <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>onNav(item.path)} />
        ))}
        {visibleMyNav.map(item => (
          <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>onNav(item.path)} />
        ))}

        {user?.role === 'admin' && (
          <>
            <div style={{ fontSize:'11px', color:'#52525b', padding:'12px 20px 4px', fontWeight:600, letterSpacing:'0.05em' }}>
              관리자
            </div>
            {ADMIN_NAV.map(item => (
              <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>onNav(item.path)} />
            ))}
          </>
        )}

        {/* ✅ Lv.5 전용 본사 운영 — PC */}
        {isSuperAdmin && (
          <>
            <div style={{ fontSize:'11px', color:'#a78bfa', padding:'12px 20px 4px', fontWeight:700, letterSpacing:'0.05em' }}>
              본사 운영
            </div>
            {HQ_NAV.map(item => (
              <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>onNav(item.path)} accent="#8b5cf6" />
            ))}
          </>
        )}
      </nav>

      {adSlot?.active && adSlot.code && (
        <div style={{ padding:'12px 16px' }}>
          <div style={{ width:'100%', height:120, background:'#27272a', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#71717a' }}>
            광고
          </div>
        </div>
      )}

      <div style={{ padding:'12px 20px', borderTop:'1px solid #27272a' }}>
        <button onClick={onLogout}
          style={{ background:'none', border:'none', cursor:'pointer', color:'#71717a', fontSize:'14px', padding:'6px 0', display:'flex', alignItems:'center', gap:'8px', width:'100%', fontFamily:'Noto Sans KR, sans-serif' }}>
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </aside>
  )
}

// ✅ accent prop 추가 — 본사 메뉴는 보라색
function NavItem({ item, active, onClick, accent }) {
  const activeColor = accent || '#f97316'
  const activeBg    = accent ? '#8b5cf618' : '#f9731618'

  return (
    <button
      onClick={onClick}
      style={{
        width:'100%', display:'flex', alignItems:'center', gap:'10px',
        padding:'10px 20px',
        background: active ? activeBg : 'none',
        border:'none',
        borderLeft: active ? `3px solid ${activeColor}` : '3px solid transparent',
        color: active ? activeColor : '#a1a1aa',
        fontSize:'14px', fontWeight: active ? 600 : 400,
        cursor:'pointer', textAlign:'left', transition:'all .15s',
        fontFamily:'Noto Sans KR, sans-serif',
      }}
      onMouseEnter={e=>{ if(!active){ e.currentTarget.style.color='#fff'; e.currentTarget.style.background='#27272a' } }}
      onMouseLeave={e=>{ if(!active){ e.currentTarget.style.color='#a1a1aa'; e.currentTarget.style.background='none' } }}
    >
      <span style={{ fontSize:'16px', width:'20px', textAlign:'center' }}>{item.icon}</span>
      {item.label}
    </button>
  )
}
