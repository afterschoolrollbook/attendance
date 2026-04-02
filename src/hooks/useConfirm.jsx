import { useState, useCallback } from 'react'

const C = {
  danger: '#ef4444',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
}

/**
 * 전역 삭제 확인 훅
 * 사용법:
 *   const { showConfirm, confirmDialog } = useConfirm()
 *   showConfirm('이 항목을 삭제할까요?', () => { delete(id) })
 *   // JSX 안에 {confirmDialog} 렌더링
 */
export function useConfirm() {
  const [state, setState] = useState(null) // { msg, onOk }

  const showConfirm = useCallback((msg, onOk) => {
    setState({ msg, onOk })
  }, [])

  const hide = () => setState(null)

  const handleOk = () => {
    if (state?.onOk) state.onOk()
    setState(null)
  }

  const confirmDialog = state ? (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      zIndex: 4000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '14px',
        padding: '24px',
        maxWidth: '320px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🗑</div>
        <div style={{ fontSize: '15px', fontWeight: 600, color: C.text, marginBottom: '20px', whiteSpace: 'pre-line' }}>
          {state.msg}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            onClick={hide}
            style={{
              padding: '9px 20px', borderRadius: '9px',
              border: `1px solid ${C.border}`, background: '#fff',
              fontSize: '14px', cursor: 'pointer',
              fontFamily: 'Noto Sans KR, sans-serif', color: C.muted,
            }}
          >
            취소
          </button>
          <button
            onClick={handleOk}
            style={{
              padding: '9px 20px', borderRadius: '9px',
              border: 'none', background: C.danger,
              color: '#fff', fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Noto Sans KR, sans-serif',
            }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { showConfirm, confirmDialog }
}
