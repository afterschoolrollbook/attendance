/**
 * PopupDisplay.jsx
 * 공개 화면에 팝업을 실제로 띄우는 컴포넌트 — Fresh_Season 저장소엔 PopupPanel(관리자 CRUD)만 있고
 * 공개 노출 컴포넌트가 없어서 새로 설계했다. popups 테이블에서 활성 + 만료 안 된 팝업 중
 * 가장 최근 것 하나를 모달로 띄우고, "오늘 안보기"를 sessionStorage에 팝업 id별로 기록한다.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const SEEN_KEY_PREFIX = 'asa_popup_seen_'

export function PopupDisplay() {
  const [popup, setPopup] = useState(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('popups')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
        if (error || cancelled) return
        const nowIso = new Date().toISOString()
        const target = (data || []).find(p =>
          (!p.expires_at || p.expires_at >= nowIso) &&
          !sessionStorage.getItem(SEEN_KEY_PREFIX + p.id)
        )
        if (target) setPopup(target)
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!popup) return null

  const close = () => {
    sessionStorage.setItem(SEEN_KEY_PREFIX + popup.id, '1')
    setPopup(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={close}>
      <div onClick={e => e.stopPropagation()} style={{
        background: popup.bg_color || '#fff', color: popup.text_color || '#111827',
        border: '1px solid #e5e7eb', borderRadius: 14, padding: 28,
        maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', position: 'relative',
      }}>
        <button onClick={close} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: popup.text_color || '#111827', opacity: 0.6 }}>×</button>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10, paddingRight: 20 }}>{popup.title}</div>
        <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{popup.content}</div>
        {popup.link_url && (
          <a href={popup.link_url} target="_blank" rel="noopener noreferrer" onClick={close}
            style={{ display: 'inline-block', marginTop: 16, fontSize: 13, fontWeight: 700, padding: '8px 18px', borderRadius: 8, background: '#f97316', color: '#fff', textDecoration: 'none' }}>
            {popup.link_label || '자세히 보기'}
          </a>
        )}
      </div>
    </div>
  )
}
