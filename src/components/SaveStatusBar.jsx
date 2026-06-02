import React, { useState, useEffect, useRef } from 'react'
import { onSaveError, onSaveStart, onSaveComplete } from '../lib/db.js'
import { supabase } from '../lib/supabase.js'

function getDeviceType() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'pc'
}

export function SaveStatusBar({ user }) {
  const [saveState, setSaveState]             = useState('idle')
  const [savedTime, setSavedTime]             = useState(null)
  const [pendingCount, setPendingCount]       = useState(0)
  const [mobileConnected, setMobileConnected] = useState(false)
  const [mobileCount, setMobileCount]         = useState(0)
  const [collapsed, setCollapsed]             = useState(false)
  const [pos, setPos]                         = useState({ x: null, y: 16 })
  const [dragging, setDragging]               = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const barRef     = useRef(null)
  const deviceType = getDeviceType()

  // 저장 이벤트 구독
  useEffect(() => {
    const unsubStart = onSaveStart(() => {
      setPendingCount(c => c + 1)
      setSaveState('saving')
      setCollapsed(false) // 저장 시작하면 자동으로 펼침
    })
    const unsubComplete = onSaveComplete(() => {
      setPendingCount(c => {
        const next = Math.max(0, c - 1)
        if (next === 0) {
          setSaveState('saved')
          setSavedTime(new Date())
          setTimeout(() => setSaveState('idle'), 4000)
        }
        return next
      })
    })
    const unsubError = onSaveError(() => {
      setPendingCount(c => Math.max(0, c - 1))
      setSaveState('error')
      setCollapsed(false) // 실패하면 자동으로 펼침
    })
    return () => { unsubStart(); unsubComplete(); unsubError() }
  }, [])

  // Supabase Presence — 스마트폰 접속 감지
  useEffect(() => {
    if (!supabase || !user?.id) return
    const channel = supabase.channel(`presence:teacher:${user.id}`, {
      config: { presence: { key: user.id } }
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const all     = Object.values(channel.presenceState()).flat()
        const mobiles = all.filter(p => p.device === 'mobile')
        setMobileCount(mobiles.length)
        setMobileConnected(mobiles.length > 0)
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ device: deviceType, userId: user.id })
        }
      })
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  // 드래그
  const startDrag = (clientX, clientY) => {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const cy = e.touches ? e.touches[0].clientY : e.clientY
      setPos({ x: cx - dragOffset.current.x, y: Math.max(0, cy - dragOffset.current.y) })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend',  onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend',  onUp)
    }
  }, [dragging])

  const fmt = d => d
    ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    : ''

  const stateColor = { idle:'rgba(255,255,255,0.4)', saving:'#60a5fa', saved:'#4ade80', error:'#f87171' }

  // 접힌 상태 아이콘
  const collapseIcon = {
    idle:   '💾',
    saving: '⏳',
    saved:  '✅',
    error:  '❌',
  }

  const posStyle = pos.x === null
    ? { top: pos.y, left: '50%', transform: 'translateX(-50%)' }
    : { top: pos.y, left: pos.x, transform: 'none' }

  const baseStyle = {
    position: 'fixed', ...posStyle, zIndex: 99999,
    background: 'rgba(10,20,30,0.88)',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    boxShadow: saveState === 'error'
      ? '0 8px 32px rgba(220,38,38,0.35), inset 0 1px 0 rgba(255,255,255,0.08)'
      : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
    border: saveState === 'error'
      ? '1px solid rgba(220,38,38,0.4)'
      : '1px solid rgba(255,255,255,0.1)',
    fontFamily: 'Noto Sans KR, sans-serif',
    cursor: dragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    transition: dragging ? 'none' : 'box-shadow 0.3s, border 0.3s, width 0.25s',
  }

  return (
    <>
      <style>{`
        @keyframes ssb-spin { to { transform: rotate(360deg) } }
        @keyframes ssb-pulse-dot {
          0%,100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
          50%      { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
        }
      `}</style>

      {/* ── 접힌 상태 — 작은 원형 버튼 */}
      {collapsed ? (
        <div
          ref={barRef}
          onMouseDown={e => { e.stopPropagation(); startDrag(e.clientX, e.clientY) }}
          onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
          onClick={() => !dragging && setCollapsed(false)}
          style={{
            ...baseStyle,
            width: '44px', height: '44px',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px',
          }}
          title="펼치기"
        >
          {collapseIcon[saveState]}
        </div>

      ) : (
        /* ── 펼쳐진 상태 */
        <div
          ref={barRef}
          onMouseDown={e => startDrag(e.clientX, e.clientY)}
          onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
          style={{
            ...baseStyle,
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', borderRadius: '14px',
            minWidth: '240px',
          }}
        >
          {/* 저장 상태 아이콘 */}
          {saveState === 'saving' && (
            <div style={{
              width:'18px', height:'18px', flexShrink:0,
              border:'2px solid rgba(255,255,255,0.15)',
              borderTop:'2px solid #60a5fa', borderRadius:'50%',
              animation:'ssb-spin 0.7s linear infinite',
            }} />
          )}
          {saveState === 'saved' && (
            <div style={{
              width:'20px', height:'20px', flexShrink:0, borderRadius:'50%',
              background:'linear-gradient(135deg,#22c55e,#16a34a)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'11px', color:'#fff', fontWeight:700,
              boxShadow:'0 0 8px rgba(34,197,94,0.5)',
            }}>✓</div>
          )}
          {saveState === 'error' && (
            <div style={{
              width:'20px', height:'20px', flexShrink:0, borderRadius:'50%',
              background:'linear-gradient(135deg,#ef4444,#dc2626)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'11px', color:'#fff', fontWeight:700,
            }}>✕</div>
          )}
          {saveState === 'idle' && (
            <div style={{ width:'8px', height:'8px', flexShrink:0, borderRadius:'50%', background:'rgba(255,255,255,0.2)' }} />
          )}

          {/* 저장 상태 텍스트 */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1px', minWidth:'58px' }}>
            <span style={{ fontSize:'13px', fontWeight:700, color: stateColor[saveState] }}>
              {saveState === 'idle'   && '대기 중'}
              {saveState === 'saving' && `저장 중${pendingCount > 1 ? ` (${pendingCount}건)` : '...'}`}
              {saveState === 'saved'  && '저장됨'}
              {saveState === 'error'  && '저장 실패'}
            </span>
            <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.3)' }}>
              {saveState === 'idle'   && '자동저장'}
              {saveState === 'saved'  && savedTime && fmt(savedTime)}
              {saveState === 'error'  && '다시 시도해주세요'}
            </span>
          </div>

          {/* 구분선 + 스마트폰 (PC만) */}
          {deviceType === 'pc' && (
            <>
              <div style={{ width:'1px', height:'28px', background:'rgba(255,255,255,0.1)', flexShrink:0 }} />
              <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                <span style={{ fontSize:'15px' }}>{mobileConnected ? '📱' : '📵'}</span>
                <div style={{ display:'flex', flexDirection:'column', gap:'1px' }}>
                  <span style={{ fontSize:'12px', fontWeight:600, color: mobileConnected ? '#86efac' : 'rgba(255,255,255,0.3)' }}>
                    {mobileConnected ? '스마트폰 연결됨' : '스마트폰 미연결'}
                  </span>
                  {mobileConnected && (
                    <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.25)' }}>{mobileCount}대 접속 중</span>
                  )}
                </div>
                {mobileConnected && (
                  <div style={{
                    width:'7px', height:'7px', borderRadius:'50%', background:'#4ade80', flexShrink:0,
                    animation:'ssb-pulse-dot 1.8s ease-in-out infinite',
                  }} />
                )}
              </div>
            </>
          )}

          {/* 접기 버튼 */}
          <button
            onMouseDown={e => e.stopPropagation()} // 드래그 방지
            onClick={() => setCollapsed(true)}
            style={{
              marginLeft: 'auto', flexShrink:0,
              width:'24px', height:'24px', borderRadius:'6px',
              border:'1px solid rgba(255,255,255,0.12)',
              background:'rgba(255,255,255,0.06)',
              color:'rgba(255,255,255,0.4)',
              fontSize:'11px', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'Noto Sans KR, sans-serif', lineHeight:1,
              transition:'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.15)'; e.currentTarget.style.color='#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(255,255,255,0.4)' }}
            title="접기"
          >▲</button>
        </div>
      )}
    </>
  )
}
