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
    return (
      <div style={{ ...style, background: '#f9fafb', border: '1.5px dashed #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>광고 영역 ({slot.name})</span>
        <span style={{ fontSize: '11px', color: '#d1d5db' }}>{typeof slot.w === 'number' ? `${slot.w}` : '100%'} × {slot.h}</span>
      </div>
    )
  }

  // iframe sandbox으로 광고 코드 격리 — XSS 방어
  // allow-same-origin 제거: allow-scripts + allow-same-origin 동시 사용 시 sandbox 무력화됨
  const iframeSrc = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>body{margin:0;padding:0;overflow:hidden;}</style></head>
    <body>${slot.code}</body></html>`
  const blob = typeof Blob !== 'undefined'
    ? URL.createObjectURL(new Blob([iframeSrc], { type: 'text/html' }))
    : null

  if (!blob) return (
    <div style={style} dangerouslySetInnerHTML={{ __html: slot.code }} />
  )

  return (
    <iframe
      src={blob}
      style={{ ...style, border: 'none', display: 'block' }}
      sandbox="allow-scripts allow-popups"
      title={slot.name || 'ad'}
      onLoad={() => URL.revokeObjectURL(blob)}
    />
  )
}
