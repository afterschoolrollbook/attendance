import React from 'react'
import { AdSlots } from '../lib/db.js'

export function AdSlot({ slotId }) {
  const slot = AdSlots.all().find(s => s.id === slotId)
  if (!slot || !slot.active) return null

  const style = {
    width: typeof slot.w === 'number' ? `${slot.w}px` : slot.w,
    height: `${slot.h}px`,
    overflow: 'hidden',
    borderRadius: '8px',
    marginBottom: '12px',
  }

  if (!slot.code) {
    // 플레이스홀더 (광고 코드 없을 때)
    return (
      <div style={{ ...style, background: '#f9fafb', border: '1.5px dashed #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>광고 영역 ({slot.name})</span>
        <span style={{ fontSize: '11px', color: '#d1d5db' }}>{typeof slot.w === 'number' ? `${slot.w}` : '100%'} × {slot.h}</span>
      </div>
    )
  }

  return (
    <div
      style={style}
      dangerouslySetInnerHTML={{ __html: slot.code }}
    />
  )
}
