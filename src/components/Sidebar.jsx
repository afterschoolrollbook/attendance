import React from 'react'
import ReactDOM from 'react-dom'
import { AdSlots } from '../lib/db.js'
import { can, canAccessMenu, isMenuVisible, getMenuMinLevel, getLevelNames, LEVEL_COLORS, DEFAULT_LEVEL_NAMES } from '../constants/permissions.js'
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
  { path: 'blog_write',      label: '게시판',            icon: '📝' },
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
  { path: 'level_manage',   label: '등급 관리',  icon: '🎖️', feature: FEATURES.MANAGE_LEVEL },
  { path: 'admin_settings', label: '서비스 설정', icon: '🔧', feature: FEATURES.MANAGE_AD },
  { path: 'adsense',        label: '광고 관리',  icon: '📢', feature: FEATURES.MANAGE_AD },
  { path: 'blog_write',     label: '블로그 글쓰기', icon: '✍️', feature: FEATURES.MANAGE_AD },
  { path: 'blog_admin',     label: '블로그 관리', icon: '📝', feature: FEATURES.MANAGE_AD },
  { path: 'blog_menu_manage',     label: '블로그 메뉴관리',  icon: '📋', feature: FEATURES.MANAGE_AD },
  { path: 'blog_ai_write',  label: 'AI 블로그 글쓰기', icon: '✨', feature: FEATURES.MANAGE_AD },
  { path: 'blog_publish_log', label: '발행 기록',     icon: '🗂️', feature: FEATURES.MANAGE_AD },
  { path: 'blog_keywords',    label: '키워드 관리',   icon: '🔍', feature: FEATURES.MANAGE_AD },
  { path: 'region_manage',         label: '지역/학교 관리',   icon: '🗺️', feature: FEATURES.MANAGE_AD },
  { path: 'teacher_service_manage',label: '강사 서비스 관리', icon: '🎓', feature: FEATURES.MANAGE_AD },
  { path: 'demo_data',             label: '데모 데이터 생성', icon: '🎬', feature: FEATURES.MANAGE_AD },
]

const HQ_NAV = [
  { path: 'vendor_manage', label: '업체 관리',        icon: '🏢' },
  { path: 'school_manage', label: '학교 담당자 관리', icon: '🏫' },
]

const KEY_MENU = 'asa_mymenu_settings'
function getMenuConfig() {
  return JSON.parse(localStorage.getItem(KEY_MENU) || '{"training":true,"certificates":true,"career":true,"awards":true,"proposals":true,"jobs":true}')
}

// ─── 권한 레벨 배지 (Sidebar 밖으로 분리)
function UserBadge({ levelColor, levelLabel, onClick }) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => { if(onClick) setHovered(true) }}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:'inline-flex', alignItems:'center', gap:'4px',
        fontSize:'11px', fontWeight:600, padding:'3px 9px', borderRadius:'999px',
        background: hovered ? `${levelColor}44` : `${levelColor}22`,
        color:levelColor, border:`1px solid ${hovered ? levelColor : levelColor + '44'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition:'all .15s', userSelect:'none',
      }}>
      {levelLabel}
      {onClick && <span style={{ fontSize:'10px', opacity: hovered ? 1 : 0.5, transition:'opacity .15s' }}>✏️</span>}
    </div>
  )
}

export function Sidebar({ user, currentPage, onNav, onLogout, mobile, open, onClose, onGoLanding, realUser, previewLevel, onSetPreviewLevel }) {
  const adSlot     = AdSlots.all().find(s => s.id === 'sidebar_bottom')
  const menuCfg    = getMenuConfig()
  const levelNames = getLevelNames()

  const userLevel   = user?.level || 1
  const levelColor  = LEVEL_COLORS[userLevel] || '#9ca3af'
  const levelLabel  = `Lv.${userLevel} ${levelNames[userLevel] || '미인증 선생님'}`
  const isAdmin     = user?.role === 'admin' || userLevel >= 10

  // 미리보기 관련 표시용
  // realUser = 원본 user(Lv.10), user = effectiveUser(미리보기 레벨)
  // previewLevel 이 있으면 미리보기 중 → 본 레벨은 realUser, 체험 레벨은 previewLevel
  const realLevel      = realUser?.level || userLevel
  const realLevelColor = LEVEL_COLORS[realLevel] || '#9ca3af'
  const realLevelLabel = `Lv.${realLevel} ${levelNames[realLevel] || '미인증 선생님'}`
  const previewLevelColor = LEVEL_COLORS[previewLevel] || '#9ca3af'
  const previewLevelLabel = previewLevel ? `Lv.${previewLevel} ${levelNames[previewLevel] || '미인증 선생님'}` : ''

  const visibleMyNav = MY_NAV.filter(item => menuCfg[item.menuKey] !== false)

  const [lockModal, setLockModal] = React.useState(null)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const isRealAdmin = realUser?.level >= 10 || realUser?.role === 'admin' || userLevel >= 10
  const isPreviewActive = isRealAdmin && previewLevel !== null

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


  // ── 레벨 미리보기 모달 (관리자 전용)
  const PreviewModal = (isRealAdmin && previewOpen) ? ReactDOM.createPortal(
    <div onClick={() => setPreviewOpen(false)}
      style={{ position:'fixed', inset:0, zIndex:999999, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'Noto Sans KR, sans-serif' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:'#1c1c1e', borderRadius:'20px', padding:'28px 24px', width:'280px', boxShadow:'0 24px 64px rgba(0,0,0,0.5)', border:'1px solid #3a3a3c' }}>
        <div style={{ fontSize:'18px', fontWeight:700, color:'#fff', marginBottom:'6px', textAlign:'center' }}>🎭 레벨 미리보기</div>
        <div style={{ fontSize:'12px', color:'#8e8e93', textAlign:'center', marginBottom:'20px' }}>DB 변경 없이 해당 레벨의 UI를 체험합니다</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {Array.from({length:10}, (_,i) => i+1).map(lv => {
            const isCurrentReal = lv === realUser?.level
            const isSelected = lv === previewLevel
            const lvColor = LEVEL_COLORS[lv] || '#9ca3af'
            const lvName = DEFAULT_LEVEL_NAMES[lv] || ('레벨' + lv)
            return (
              <button key={lv}
                onClick={() => { if(isCurrentReal && !isSelected) return; onSetPreviewLevel(isSelected ? null : lv); setPreviewOpen(false) }}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 14px', borderRadius:'10px', border: isSelected ? '2px solid ' + lvColor : '2px solid transparent',
                  background: isSelected ? lvColor + '22' : isCurrentReal ? '#2c2c2e' : '#2c2c2e',
                  cursor: isCurrentReal && !isSelected ? 'default' : 'pointer',
                  opacity: isCurrentReal && !isSelected ? 0.5 : 1,
                  transition:'all .15s',
                }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'13px', fontWeight:700, color: lvColor, width:'28px' }}>Lv.{lv}</span>
                  <span style={{ fontSize:'13px', color:'#e5e5ea' }}>{lvName}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  {isCurrentReal && <span style={{ fontSize:'11px', color:'#8e8e93' }}>현재</span>}
                  {isSelected && <span style={{ fontSize:'13px' }}>✓</span>}
                </div>
              </button>
            )
          })}
        </div>
        {isPreviewActive && (
          <button onClick={() => { onSetPreviewLevel(null); setPreviewOpen(false) }}
            style={{ marginTop:'16px', width:'100%', padding:'11px', borderRadius:'10px', border:'none', background:'#ff453a', color:'#fff', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
            원래 레벨(10)로 복귀
          </button>
        )}
        <button onClick={() => setPreviewOpen(false)}
          style={{ marginTop:'8px', width:'100%', padding:'10px', borderRadius:'10px', border:'none', background:'#3a3a3c', color:'#aeaeb2', fontSize:'14px', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif' }}>
          닫기
        </button>
      </div>
    </div>,
    document.body
  ) : null

  const LockModal = lockModal ? ReactDOM.createPortal(
    <div onClick={() => setLockModal(null)}
      style={{ position:'fixed', inset:0, zIndex:999999, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', fontFamily:'Noto Sans KR, sans-serif' }}>
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
    </div>,
    document.body
  ) : null

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
          {ADMIN_NAV.map(item => {
            if (item.feature && !can(user, item.feature)) return null
            return <NavItem key={item.path} item={item} active={currentPage===item.path} onClick={()=>handleNav(item.path)} />
          })}
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
    <>{LockModal}{PreviewModal}
      {open && <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)' }} />}
      <aside style={{
        position:'fixed', top:0, left:open ? 0 : '-260px', zIndex:1100,
        width:'240px', height:'100vh', background:'#18181b',
        display:'flex', flexDirection:'column',
        transition:'left .25s ease',
        boxShadow: open ? '4px 0 24px rgba(0,0,0,0.35)' : 'none',
      }}>
        <div style={{ padding:'18px 16px 16px', borderBottom:'1px solid #27272a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div onClick={onGoLanding} style={{ display:'flex', alignItems:'center', gap:'8px', cursor: onGoLanding ? 'pointer' : 'default' }}>
            <span style={{ fontSize:'20px' }}>📋</span>
            <span style={{ fontSize:'14px', fontWeight:700, color:'#fff' }}>방과후 출석부</span>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#71717a', fontSize:'22px', cursor:'pointer', padding:'2px 6px' }}>✕</button>
        </div>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #27272a' }}>
          <div style={{ fontSize:'14px', fontWeight:600, color:'#fff', marginBottom:'6px' }}>{user?.name}</div>
          {isPreviewActive ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'5px', flexWrap:'wrap' }}>
                <UserBadge levelColor={realLevelColor} levelLabel={realLevelLabel} />
                <span style={{ fontSize:'10px', color:'#52525b' }}>→</span>
                <UserBadge levelColor={previewLevelColor} levelLabel={previewLevelLabel} />
              </div>
              <button onClick={() => onSetPreviewLevel(null)}
                style={{ alignSelf:'flex-start', fontSize:'11px', padding:'3px 10px', borderRadius:'6px', border:'1px solid #3f3f46', background:'#27272a', color:'#a1a1aa', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                ↩ 원래 레벨로 복귀
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              <UserBadge levelColor={levelColor} levelLabel={levelLabel} />
              {isRealAdmin && (
                <button onClick={() => setPreviewOpen(true)}
                  style={{ alignSelf:'flex-start', fontSize:'11px', padding:'3px 10px', borderRadius:'6px', border:'1px solid #3f3f46', background:'#27272a', color:'#71717a', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                  🎭 레벨 미리보기
                </button>
              )}
            </div>
          )}
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
  return (<>{LockModal}{PreviewModal}
    <aside style={{
      width:'220px', minWidth:'220px', background:'#18181b',
      display:'flex', flexDirection:'column', height:'100vh',
      position:'sticky', top:0, overflow:'hidden',
    }}>
      <div style={{ padding:'24px 20px 20px', borderBottom:'1px solid #27272a' }}>
        <div onClick={onGoLanding} style={{ display:'flex', alignItems:'center', gap:'10px', cursor: onGoLanding ? 'pointer' : 'default', borderRadius:'8px', transition:'background .15s' }}
          onMouseEnter={e=>{ if(onGoLanding) e.currentTarget.style.background='#27272a' }}
          onMouseLeave={e=>{ e.currentTarget.style.background='transparent' }}>
          <span style={{ fontSize:'22px' }}>📋</span>
          <div>
            <div style={{ fontSize:'15px', fontWeight:700, color:'#fff' }}>방과후 출석부</div>
            <div style={{ fontSize:'11px', color:'#71717a', marginTop:'2px' }}>AfterSchool</div>
          </div>
        </div>
      </div>
      <div style={{ padding:'16px 20px', borderBottom:'1px solid #27272a' }}>
        <div style={{ fontSize:'14px', fontWeight:600, color:'#fff', marginBottom:'6px' }}>{user?.name}</div>
        {isPreviewActive ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'5px', flexWrap:'wrap' }}>
              <UserBadge levelColor={realLevelColor} levelLabel={realLevelLabel} />
              <span style={{ fontSize:'10px', color:'#52525b' }}>→</span>
              <UserBadge levelColor={previewLevelColor} levelLabel={previewLevelLabel} />
            </div>
            <button onClick={() => onSetPreviewLevel(null)}
              style={{ alignSelf:'flex-start', fontSize:'11px', padding:'3px 10px', borderRadius:'6px', border:'1px solid #3f3f46', background:'#27272a', color:'#a1a1aa', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
              ↩ 원래 레벨로 복귀
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <UserBadge levelColor={levelColor} levelLabel={levelLabel} />
            {isRealAdmin && (
              <button onClick={() => setPreviewOpen(true)}
                style={{ alignSelf:'flex-start', fontSize:'11px', padding:'3px 10px', borderRadius:'6px', border:'1px solid #3f3f46', background:'#27272a', color:'#71717a', cursor:'pointer', fontFamily:'Noto Sans KR, sans-serif', fontWeight:600 }}>
                🎭 레벨 미리보기
              </button>
            )}
          </div>
        )}
      </div>
      {renderNav(false)}
      {adSlot?.active && adSlot.code && (
        <div style={{ padding:'12px 16px' }}>
          <div style={{ width:'100%', height:120, background:'#27272a', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', color:'#71717a' }}>
            광고
          </div>
        </div>
      )}


      <div style={{ padding:'12px 20px', borderTop:'1px solid #27272a' }}>
        <button onClick={onLogout} style={{ background:'none', border:'none', cursor:'pointer', color:'#71717a', fontSize:'14px', padding:'6px 0', display:'flex', alignItems:'center', gap:'8px', width:'100%', fontFamily:'Noto Sans KR, sans-serif' }}>
          <span>🚪</span> 로그아웃
        </button>
      </div>
    </aside>
  </>) 
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
