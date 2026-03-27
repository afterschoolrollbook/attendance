import React from 'react'
import { AdSlots } from '../lib/db.js'
import { can, FEATURES } from '../constants/permissions.js'

const NAV = [
  { path: 'dashboard',  label: '대시보드',        icon: '🏠', feature: null },
  { path: 'classes',    label: '수업 관리',        icon: '📚', feature: FEATURES.MANAGE_CLASS },
  { path: 'students',   label: '학생 관리',        icon: '👥', feature: FEATURES.ADD_STUDENT },
  { path: 'attendance', label: '출석체크',          icon: '✅', feature: FEATURES.ATTENDANCE },
  { path: 'reports',    label: '출석 리포트',       icon: '📊', feature: FEATURES.VIEW_REPORT },
  { path: 'templates',  label: '출석부 양식',       icon: '📄', feature: FEATURES.MANAGE_TEMPLATE },
  { path: 'printsetup', label: '출석부 출력',       icon: '🖨️', feature: FEATURES.PRINT_ATTENDANCE },
]

const ADMIN_NAV = [
  { path: 'admin',    label: '관리자',      icon: '⚙️',  feature: FEATURES.APPROVE_TEACHER },
  { path: 'adsense',  label: '광고 관리',   icon: '📢',  feature: FEATURES.MANAGE_AD },
]

export function Sidebar({ user, currentPage, onNav, onLogout }) {
  const adSlot = AdSlots.all().find(s => s.id === 'sidebar_bottom')

  const levelColors = { 1: '#9ca3af', 2: '#f97316', 3: '#16a34a', 4: '#8b5cf6', 5: '#ef4444' }
  const levelLabels = { 1: 'Lv.1 미인증', 2: 'Lv.2 인증', 3: 'Lv.3 우수', 4: 'Lv.4 파트너', 5: 'Lv.5 관리자' }

  return (
    <aside style={{
      width: '220px',
      minWidth: '220px',
      background: '#18181b',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflow: 'hidden',
    }}>
      {/* 로고 */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #27272a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '22px' }}>📋</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>방과후 출석부</div>
            <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px' }}>AfterSchool</div>
          </div>
        </div>
      </div>

      {/* 유저 정보 */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>{user?.name}</div>
        <div style={{
          display: 'inline-block',
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '999px',
          background: `${levelColors[user?.level] || '#9ca3af'}22`,
          color: levelColors[user?.level] || '#9ca3af',
          border: `1px solid ${levelColors[user?.level] || '#9ca3af'}44`,
        }}>
          {levelLabels[user?.level] || 'Lv.1 미인증'}
        </div>
      </div>

      {/* 네비게이션 */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {NAV.map(item => {
          if (item.feature && !can(user, item.feature)) return null
          const active = currentPage === item.path
          return (
            <NavItem key={item.path} item={item} active={active} onClick={() => onNav(item.path)} />
          )
        })}

        {user?.role === 'admin' && (
          <>
            <div style={{ fontSize: '11px', color: '#52525b', padding: '12px 20px 4px', fontWeight: 600, letterSpacing: '0.05em' }}>
              관리자
            </div>
            {ADMIN_NAV.map(item => {
              const active = currentPage === item.path
              return <NavItem key={item.path} item={item} active={active} onClick={() => onNav(item.path)} />
            })}
          </>
        )}
      </nav>

      {/* 광고 슬롯 */}
      {adSlot?.active && adSlot.code && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ width: '100%', height: 120, background: '#27272a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#71717a' }}>
            광고
          </div>
        </div>
      )}

      {/* 로그아웃 */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #27272a' }}>
        <button
          onClick={onLogout}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', fontSize: '14px', padding: '6px 0', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontFamily: 'Noto Sans KR, sans-serif' }}
        >
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </aside>
  )
}

function NavItem({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 20px',
        background: active ? '#f9731618' : 'none',
        border: 'none',
        borderLeft: active ? '3px solid #f97316' : '3px solid transparent',
        color: active ? '#f97316' : '#a1a1aa',
        fontSize: '14px',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all .15s',
        fontFamily: 'Noto Sans KR, sans-serif',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = '#27272a' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'none' } }}
    >
      <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
      {item.label}
    </button>
  )
}
