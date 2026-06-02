import React, { useState, useEffect, useRef } from 'react'
import { onSaveError, onSaveStart, onSaveComplete } from '../lib/db.js'
import { supabase } from '../lib/supabase.js'

// 스마트폰 여부 판별
function getDeviceType() {
  const ua = navigator.userAgent
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? 'mobile' : 'pc'
}

export function SaveStatusBar({ user }) {
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [savedTime, setSavedTime] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [mobileConnected, setMobileConnected] = useState(false)
  const [mobileCount, setMobileCount] = useState(0)
  const [visible, setVisible] = useState(false)
  const channelRef = useRef(null)
  const hideTimerRef = useRef(null)
  const deviceType = getDeviceType()

  // ── 저장 이벤트 구독
  useEffect(() => {
    const unsubStart    = onSaveStart(() => {
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

  // ── Supabase Presence로 스마트폰 접속 여부 실시간 감지
  useEffect(() => {
    if (!supabase || !user?.id) return

    const channel = supabase.channel(`presence:teacher:${user.id}`, {
      config: { presence: { key: user.id } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const all = Object.values(state).flat()
        const mobiles = all.filter(p => p.device === 'mobile')
        setMobileCount(mobiles.length)
        setMobileConnected(mobiles.length > 0)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            device: deviceType,
            userId: user.id,
            joinedAt: new Date().toISOString(),
          })
        }
      })

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  if (!visible && saveState === 'idle') return null

  const fmtTime = (d) => d
    ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    : ''

  // 저장 상태 스타일
  const stateConfig = {
    saving: { bg:'#1e40af', text:'#fff',     icon:'💾', label: `저장 중... (${pendingCount}건)` },
    saved:  { bg:'#15803d', text:'#fff',     icon:'✅', label: `저장됨 ${fmtTime(savedTime)}` },
    error:  { bg:'#dc2626', text:'#fff',     icon:'❌', label: '저장 실패 — 다시 시도해주세요' },
    idle:   { bg:'#1e40af', text:'#fff',     icon:'💾', label: '저장 중...' },
  }
  const sc = stateConfig[saveState] || stateConfig.idle

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 20px',
      background: sc.bg,
      boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      fontFamily: 'Noto Sans KR, sans-serif',
      transition: 'background 0.3s',
    }}>

      {/* 왼쪽: 저장 상태 */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        {saveState === 'saving' && (
          <div style={{
            width:'16px', height:'16px', border:'2.5px solid rgba(255,255,255,0.3)',
            borderTop:'2.5px solid #fff', borderRadius:'50%',
            animation:'spin 0.8s linear infinite',
          }} />
        )}
        <span style={{ fontSize:'13px', fontWeight:700, color:sc.text }}>
          {sc.icon} {sc.label}
        </span>

        {/* 저장됨 상태일 때 진행바 */}
        {saveState === 'saving' && pendingCount > 0 && (
          <div style={{ width:'80px', height:'4px', background:'rgba(255,255,255,0.3)', borderRadius:'2px', overflow:'hidden' }}>
            <div style={{ height:'100%', background:'#fff', borderRadius:'2px', animation:'pulse 1s ease-in-out infinite' }} />
          </div>
        )}
      </div>

      {/* 오른쪽: 스마트폰 접속 여부 */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        {deviceType === 'pc' && (
          <div style={{
            display:'flex', alignItems:'center', gap:'6px',
            padding:'4px 12px', borderRadius:'20px',
            background: mobileConnected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${mobileConnected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}`,
          }}>
            <span style={{ fontSize:'14px' }}>{mobileConnected ? '📱' : '📵'}</span>
            <span style={{ fontSize:'12px', fontWeight:600, color:'#fff' }}>
              {mobileConnected
                ? `스마트폰 연결됨 (${mobileCount}대)`
                : '스마트폰 미연결'}
            </span>
            {mobileConnected && (
              <div style={{
                width:'6px', height:'6px', borderRadius:'50%',
                background:'#4ade80',
                boxShadow:'0 0 6px #4ade80',
                animation:'pulse 1.5s ease-in-out infinite',
              }} />
            )}
          </div>
        )}

        {/* 닫기 버튼 (저장 완료 시만) */}
        {saveState === 'saved' && (
          <button onClick={() => setVisible(false)}
            style={{
              background:'rgba(255,255,255,0.2)', border:'none', color:'#fff',
              width:'22px', height:'22px', borderRadius:'50%', cursor:'pointer',
              fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'Noto Sans KR, sans-serif',
            }}>✕</button>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
      `}</style>
    </div>
  )
}
