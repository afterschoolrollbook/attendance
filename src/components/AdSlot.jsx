
import React, { useState, useEffect, useMemo } from 'react'
import { AdSlots } from '../lib/db.js'
import { supabase } from '../lib/supabase.js'
import { SLOT_BANNER_SIZE } from '../lib/adSlotSizes.js'

export function AdSlot({ slotId, slotData }) {
  // slotData가 주어지면 그것을 우선 사용한다 (예: 블로그처럼 대시보드 오프라인 캐시가
  // 채워지지 않는 페이지에서 AdSlotsContext가 직접 조회해서 넘겨주는 경우).
  // 넘어오지 않으면 기존처럼 대시보드 캐시(AdSlots.all())에서 찾는다.
  const cachedSlot = AdSlots.all().find(s => s.id === slotId)
  const slot = slotData || cachedSlot
  const source = slot?.source || 'adsense'
  const [coupangHtml, setCoupangHtml] = useState(null)

  // 쿠팡/무작위 소스 슬롯은 코드 입력이 없으므로, 슬롯 사이즈에 맞는 등록된 쿠팡 배너를
  // coupang_widgets에서 직접 조회해 온다 (Adsense.jsx의 countCoupangBanners와 동일한 매칭 기준).
  useEffect(() => {
    if (!slot?.active || !supabase || source === 'adsense') return
    const size = SLOT_BANNER_SIZE[slot.id]
    if (!size) return
    let cancelled = false
    supabase.from('coupang_widgets').select('widget_html')
      .eq('size', size).eq('enabled', true)
      .then(({ data, error }) => {
        if (cancelled || error || !data?.length) return
        setCoupangHtml(data[Math.floor(Math.random() * data.length)].widget_html)
      })
    return () => { cancelled = true }
  }, [slot?.id, slot?.active, source])

  const html = useMemo(() => {
    if (source === 'coupang') return coupangHtml
    if (source === 'random') {
      const candidates = [slot?.code, coupangHtml].filter(Boolean)
      if (!candidates.length) return null
      return candidates[Math.floor(Math.random() * candidates.length)]
    }
    return slot?.code
  }, [source, slot?.code, coupangHtml])

  if (!slot || !slot.active) return null

  const style = {
    width: typeof slot.w === 'number' ? `${slot.w}px` : slot.w,
    height: `${slot.h}px`,
    overflow: 'hidden',
    borderRadius: '8px',
    marginBottom: '12px',
  }

  if (!html) {
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
    <body>${html}</body></html>`
  const blob = typeof Blob !== 'undefined'
    ? URL.createObjectURL(new Blob([iframeSrc], { type: 'text/html' }))
    : null

  if (!blob) return null

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
