import React, { useState, useEffect, useRef } from 'react'
import { onSaveError, onSaveStart, onSaveComplete } from '../lib/db.js'
import { supabase } from '../lib/supabase.js'

function getDeviceType() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'pc'
}

export function SaveStatusBar({ user }) {
  const [saveState, setSaveState]         = useState('idle')
  const [savedTime, setSavedTime]         = useState(null)
  const [pendingCount, setPendingCount]   = useState(0)
  const [mobileConnected, setMobileConnected] = useState(false)
  const [mobileCount, setMobileCount]     = useState(0)
  const [visible, setVisible]             = useState(false)
  const hideTimerRef = useRef(null)
  const deviceType   = getDeviceType()

  // ── 저장 이벤트 구독
  useEffect(() => {
    const unsubStart = onSaveStart(() => {
      setPendingCount(c => c + 1)
      setSaveState('saving')
      setVisible(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    })
    const unsubComplete = onSaveComplete(() => {
      setPendingCount(c => {
        const next = Math.max(0, c - 1)
        if (next === 0) {
          setSaveState('saved')
          setSavedTime(new Date())
          hideTimerRef.current = setTimeout(() => setVisible(false), 4000)
        }
        return next
      })
    })
    const unsubError = onSaveError(() => {
      setPendingCount(c => Math.max(0, c - 1))
      setSaveState('error')
      setVisible(true)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    })
    return () => { unsubStart(); unsubComplete(); unsubError() }
  }, [])

  // ── Supabase Presence — 스마트폰 접속 감지
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

  const fmt = d => d
    ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    : ''

  if (!visible && saveState === 'idle') return null

  return (
    <>
      <style>{`
        @keyframes ssb-slide-down {
          from { transform: translateY(-110%) translateX(-50%); opacity: 0; }
          to   { transform: translateY(0)     translateX(-50%); opacity: 1; }
        }
        @keyframes ssb-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes ssb-pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
          50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0); }
        }
      `}</style>

      <div style={{
        position:  'fixed',
        top:       '16px',
        left:      '50%',
        transform: 'translateX(-50%)',
        zIndex:    99999,
        animation: 'ssb-slide-down 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        display:   'flex',
        alignItems: 'center',
        gap:       '10px',
        padding:   '10px 16px',
        borderRadius: '14px',
        background: saveState === 'error'
          ? 'rgba(30,10,10,0.92)'
          : 'rgba(10,20,30,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: saveState === 'error'
          ? '0 8px 32px rgba(220,38,38,0.35), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
        border: saveState === 'error'
          ? '1px solid rgba(220,38,38,0.4)'
          : '1px solid rgba(255,255,255,0.1)',
        fontFamily: 'Noto Sans KR, sans-serif',
        minWidth:  '280px',
        maxWidth:  '520px',
        whiteSpace: 'nowrap',
      }}>

        {/* 저장 상태 아이콘 */}
        {saveState === 'saving' && (
          <div style={{
            width: '18px', height: '18px', flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.15)',
            borderTop: '2px solid #60a5fa',
            borderRadius: '50%',
            animation: 'ssb-spin 0.7s linear infinite',
          }} />
        )}
        {saveState === 'saved' && (
          <div style={{
            width: '20px', height: '20px', flexShrink: 0,
            borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', boxShadow: '0 0 8px rgba(34,197,94,0.5)',
          }}>✓</div>
        )}
        {saveState === 'error' && (
          <div style={{
            width: '20px', height: '20px', flexShrink: 0,
            borderRadius: '50%', background: 'linear-gradient(135deg,#ef4444,#dc2626)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', boxShadow: '0 0 8px rgba(239,68,68,0.5)',
          }}>✕</div>
        )}

        {/* 저장 상태 텍스트 */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1px' }}>
          <span style={{
            fontSize: '13px', fontWeight: 700,
            color: saveState === 'error' ? '#fca5a5'
                 : saveState === 'saved' ? '#86efac'
                 : '#93c5fd',
          }}>
            {saveState === 'saving' && `저장 중${pendingCount > 1 ? ` (${pendingCount}건)` : '...'}`}
            {saveState === 'saved'  && `저장됨`}
            {saveState === 'error'  && '저장 실패'}
          </span>
          {saveState === 'saved' && savedTime && (
            <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)', fontWeight:400 }}>
              {fmt(savedTime)}
            </span>
          )}
          {saveState === 'error' && (
            <span style={{ fontSize:'11px', color:'rgba(255,255,255,0.4)' }}>
              다시 시도해주세요
            </span>
          )}
        </div>

        {/* 구분선 */}
        {deviceType === 'pc' && (
          <div style={{ width:'1px', height:'28px', background:'rgba(255,255,255,0.1)', margin:'0 4px', flexShrink:0 }} />
        )}

        {/* 스마트폰 접속 여부 (PC에서만 표시) */}
        {deviceType === 'pc' && (
          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
            <span style={{ fontSize:'16px' }}>{mobileConnected ? '📱' : '📵'}</span>
            <div style={{ display:'flex', flexDirection:'column', gap:'1px' }}>
              <span style={{
                fontSize: '12px', fontWeight: 600,
                color: mobileConnected ? '#86efac' : 'rgba(255,255,255,0.4)',
              }}>
                {mobileConnected ? `스마트폰 연결됨` : '스마트폰 미연결'}
              </span>
              {mobileConnected && (
                <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.35)' }}>
                  {mobileCount}대 접속 중
                </span>
              )}
            </div>
            {mobileConnected && (
              <div style={{
                width:'7px', height:'7px', borderRadius:'50%',
                background:'#4ade80', flexShrink:0,
                animation:'ssb-pulse-dot 1.8s ease-in-out infinite',
              }} />
            )}
          </div>
        )}

        {/* 닫기 버튼 */}
        <button
          onClick={() => { setVisible(false); setSaveState('idle') }}
          style={{
            marginLeft: 'auto', flexShrink: 0,
            width: '22px', height: '22px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: '11px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s',
            fontFamily: 'Noto Sans KR, sans-serif',
            lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.14)'; e.currentTarget.style.color='#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(255,255,255,0.45)' }}
        >✕</button>
      </div>
    </>
  )
}
