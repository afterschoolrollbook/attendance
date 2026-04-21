import React, { useState, useCallback, useRef, useEffect } from 'react'

const C = {
  primary: '#f97316',
  success: '#16a34a',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
  card: '#ffffff',
}

// Button
export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, type = 'button', full, style, className }) {
  const variants = {
    primary:  { background: C.primary,  color: '#fff', border: 'none' },
    success:  { background: C.success,  color: '#fff', border: 'none' },
    danger:   { background: C.danger,   color: '#fff', border: 'none' },
    ghost:    { background: 'transparent', color: C.text, border: `1px solid ${C.border}` },
    outline:  { background: 'transparent', color: C.primary, border: `1.5px solid ${C.primary}` },
    outlineDanger: { background: 'transparent', color: C.danger, border: `1.5px solid ${C.danger}` },
  }
  const sizes = {
    sm: { padding: '5px 12px', fontSize: '13px', borderRadius: '7px' },
    md: { padding: '9px 18px', fontSize: '14px', borderRadius: '9px' },
    lg: { padding: '13px 28px', fontSize: '15px', borderRadius: '10px' },
  }
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...variants[variant],
        ...sizes[size],
        fontFamily: 'Noto Sans KR, sans-serif',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all .15s',
        width: full ? '100%' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// Input
export function Input({ label, value, onChange, placeholder, type = 'text', disabled, required, error, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 500, color: C.text }}>
          {label}{required && <span style={{ color: C.danger }}> *</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          padding: '9px 13px',
          borderRadius: '9px',
          border: `1.5px solid ${error ? C.danger : C.border}`,
          fontSize: '14px',
          fontFamily: 'Noto Sans KR, sans-serif',
          outline: 'none',
          background: disabled ? '#f9fafb' : '#fff',
          color: C.text,
          transition: 'border .15s',
          width: '100%',
          ...style,
        }}
        onFocus={e => e.target.style.borderColor = C.primary}
        onBlur={e => e.target.style.borderColor = error ? C.danger : C.border}
      />
      {error && <span style={{ fontSize: '12px', color: C.danger }}>{error}</span>}
    </div>
  )
}

// Textarea
export function Textarea({ label, value, onChange, placeholder, rows = 4, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && <label style={{ fontSize: '13px', fontWeight: 500, color: C.text }}>{label}</label>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        style={{
          padding: '9px 13px',
          borderRadius: '9px',
          border: `1.5px solid ${C.border}`,
          fontSize: '14px',
          fontFamily: 'Noto Sans KR, sans-serif',
          outline: 'none',
          resize: 'vertical',
          color: C.text,
          width: '100%',
        }}
        onFocus={e => e.target.style.borderColor = C.primary}
        onBlur={e => e.target.style.borderColor = C.border}
      />
    </div>
  )
}

// Select
export function Select({ label, value, onChange, options, disabled, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {label && (
        <label style={{ fontSize: '13px', fontWeight: 500, color: C.text }}>
          {label}{required && <span style={{ color: C.danger }}> *</span>}
        </label>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: '9px 13px',
          borderRadius: '9px',
          border: `1.5px solid ${C.border}`,
          fontSize: '14px',
          fontFamily: 'Noto Sans KR, sans-serif',
          background: '#fff',
          color: C.text,
          outline: 'none',
          cursor: 'pointer',
          width: '100%',
        }}
        onFocus={e => e.target.style.borderColor = C.primary}
        onBlur={e => e.target.style.borderColor = C.border}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

// Card
export function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        borderRadius: '14px',
        border: `1px solid ${C.border}`,
        padding: '20px',
        cursor: onClick ? 'pointer' : undefined,
        transition: onClick ? 'box-shadow .15s, transform .15s' : undefined,
        ...style,
      }}
      onMouseEnter={onClick ? e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)' } : undefined}
      onMouseLeave={onClick ? e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' } : undefined}
    >
      {children}
    </div>
  )
}

// Modal (드래그 가능 — 헤더를 잡고 이동)
export function Modal({ open, onClose, title, children, width = 520 }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const start = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  // 모달이 열릴 때마다 위치 초기화
  useEffect(() => {
    if (open) setPos({ x: 0, y: 0 })
  }, [open])

  if (!open) return null

  // PC 마우스 드래그
  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return
    dragging.current = true
    start.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
    const onMove = (e) => {
      if (!dragging.current) return
      setPos({ x: start.current.px + e.clientX - start.current.mx, y: start.current.py + e.clientY - start.current.my })
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── 모바일: 하단 바텀시트
  if (isMobile) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 5000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
          {/* 드래그 핸들 */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '4px' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: '#d1d5db' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: C.text }}>{title}</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: C.muted, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: '20px' }}>{children}</div>
        </div>
      </div>
    )
  }

  // ── PC: 드래그 가능 중앙 모달
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', transform: `translate(${pos.x}px, ${pos.y}px)` }}>
        <div
          onMouseDown={handleMouseDown}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}`, cursor: 'grab', userSelect: 'none' }}
        >
          <h2 style={{ fontSize: '17px', fontWeight: 600, color: C.text }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: C.muted, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>{children}</div>
      </div>
    </div>
  )
}

// Tag / Badge
export function Tag({ children, color = C.muted, bg = '#f3f4f6', size = 'sm' }) {
  const sizes = { sm: { fontSize: '12px', padding: '3px 9px' }, md: { fontSize: '13px', padding: '5px 12px' } }
  return (
    <span style={{ ...sizes[size], color, background: bg, borderRadius: '999px', fontWeight: 500, display: 'inline-block', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// Toast
export function ToastContainer({ toasts }) {
  const typeStyle = {
    success: { background: '#f0fdf4', border: '1.5px solid #86efac', color: '#15803d' },
    error:   { background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#dc2626' },
    info:    { background: '#eff6ff', border: '1.5px solid #93c5fd', color: '#1d4ed8' },
    warning: { background: '#fffbeb', border: '1.5px solid #fcd34d', color: '#b45309' },
  }
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ ...typeStyle[t.type], borderRadius: '10px', padding: '12px 18px', fontSize: '14px', fontWeight: 500, minWidth: '240px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', animation: 'fadeIn .2s ease' }}>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }`}</style>
    </div>
  )
}

// Stat card
export function StatCard({ label, value, icon, color = C.primary, sub }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', color: C.muted, marginBottom: '6px' }}>{label}</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: C.text, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>{sub}</div>}
        </div>
        <div style={{ fontSize: '26px', background: `${color}18`, borderRadius: '12px', padding: '10px', lineHeight: 1 }}>{icon}</div>
      </div>
    </Card>
  )
}

// Progress bar
export function ProgressBar({ value, max, color = C.primary, height = 8 }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ background: '#f3f4f6', borderRadius: '999px', height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: '999px', transition: 'width .4s ease' }} />
    </div>
  )
}

// Empty state
export function EmptyState({ icon = '📭', title, desc }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
      <div style={{ fontSize: '44px', marginBottom: '12px' }}>{icon}</div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>{title}</div>
      {desc && <div style={{ fontSize: '14px' }}>{desc}</div>}
    </div>
  )
}

// Divider
export function Divider({ style }) {
  return <hr style={{ border: 'none', borderTop: `1px solid ${C.border}`, margin: '16px 0', ...style }} />
}

// 체크박스
export function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', userSelect: 'none' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: '16px', height: '16px', accentColor: C.primary, cursor: 'pointer' }} />
      {label}
    </label>
  )
}

// 토글 스위치
export function Toggle({ checked, onChange }) {
  return (
    <label style={{ position: 'relative', width: '44px', height: '24px', cursor: 'pointer', display: 'inline-block' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
      <span style={{
        position: 'absolute', inset: 0,
        background: checked ? C.primary : '#d1d5db',
        borderRadius: '999px',
        transition: '.25s',
      }} />
      <span style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '23px' : '3px',
        width: '18px', height: '18px',
        background: '#fff',
        borderRadius: '50%',
        transition: '.25s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
    </label>
  )
}

// 페이지 헤더
export function PageHeader({ title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{title}</h1>
        {sub && <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>{sub}</p>}
      </div>
      {right && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{right}</div>}
    </div>
  )
}

// 섹션 레이블
export function Label({ children }) {
  return <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>{children}</div>
}

// 그리드 레이아웃
export function Grid({ children, cols = 2, gap = 16 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap }}>
      {children}
    </div>
  )
}

// 요일 선택 버튼
export function DayPicker({ value, onChange }) {
  const days = ['월', '화', '수', '목', '금', '토', '일']
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {days.map(d => {
        const selected = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(selected ? value.filter(x => x !== d) : [...value, d])}
            style={{
              width: '38px', height: '38px',
              borderRadius: '9px',
              border: `1.5px solid ${selected ? C.primary : '#e5e7eb'}`,
              background: selected ? C.primary : '#fff',
              color: selected ? '#fff' : '#374151',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              fontFamily: 'Noto Sans KR, sans-serif',
              transition: 'all .15s',
            }}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// ConfirmDialog — 전역 삭제 확인 다이얼로그
// 사용법:
//   App.jsx     → useConfirmDialog() + <ConfirmDialog />
//   각 페이지   → useConfirm() → confirm('메시지', () => { 삭제로직 })
// ────────────────────────────────────────────────────────────

// 모듈 레벨 싱글톤: App.jsx에서 등록한 열기 함수를 보관
let _openConfirm = null

// App.jsx 전용 훅 — dialog 상태와 ConfirmDialog에 넘길 props를 반환
export function useConfirmDialog() {
  const [state, setState] = useState({ open: false, message: '', onOk: null })

  // 이 함수를 모듈 변수에 등록해 두면 어느 페이지에서든 호출 가능
  _openConfirm = useCallback((message, onOk) => {
    setState({ open: true, message, onOk })
  }, [])

  const handleOk = useCallback(() => {
    setState(prev => {
      prev.onOk?.()
      return { ...prev, open: false }
    })
  }, [])

  const handleCancel = useCallback(() => {
    setState(prev => ({ ...prev, open: false }))
  }, [])

  return {
    confirmDialogProps: {
      open: state.open,
      message: state.message,
      onOk: handleOk,
      onCancel: handleCancel,
    },
  }
}

// 각 페이지 전용 훅 — confirm('메시지', () => { 삭제로직 }) 형태로 호출
export function useConfirm() {
  return useCallback((message, onOk) => {
    if (_openConfirm) {
      _openConfirm(message, onOk)
    } else {
      // App.jsx에 ConfirmDialog가 마운트되지 않은 경우 폴백
      if (window.confirm(message)) onOk?.()
    }
  }, [])
}

// ConfirmDialog 컴포넌트 — App.jsx 루트에 딱 한 번만 마운트
export function ConfirmDialog({ open, message, onOk, onCancel }) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        animation: 'fadeIn .15s ease',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '20px 24px 16px',
        }}>
          <span style={{ fontSize: '22px', lineHeight: 1 }}>🗑️</span>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>삭제 확인</h2>
        </div>

        {/* 메시지 */}
        <div style={{ padding: '0 24px 24px', fontSize: '14px', color: C.muted, lineHeight: 1.6 }}>
          {message}
        </div>

        {/* 버튼 */}
        <div style={{
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
          padding: '16px 24px',
          borderTop: `1px solid ${C.border}`,
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 20px', borderRadius: '9px',
              border: `1.5px solid ${C.border}`,
              background: 'transparent', color: C.text,
              fontSize: '14px', fontWeight: 500,
              fontFamily: 'Noto Sans KR, sans-serif',
              cursor: 'pointer',
            }}
          >
            취소
          </button>
          <button
            onClick={onOk}
            style={{
              padding: '9px 20px', borderRadius: '9px',
              border: 'none',
              background: C.danger, color: '#fff',
              fontSize: '14px', fontWeight: 500,
              fontFamily: 'Noto Sans KR, sans-serif',
              cursor: 'pointer',
            }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
