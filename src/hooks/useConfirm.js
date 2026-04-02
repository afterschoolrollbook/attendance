import { useState, useEffect, useCallback } from 'react'

// ─── 전역 싱글톤 — 어느 컴포넌트에서도 confirm 다이얼로그를 열 수 있음
let setDialogState = null

/**
 * 페이지/컴포넌트에서 사용:
 *   const { confirm } = useConfirm()
 *   confirm('삭제할까요?', () => doDelete())
 *   confirm('삭제할까요?', () => doDelete(), { confirmLabel: '삭제', icon: '🗑' })
 */
export function useConfirm() {
  const confirm = useCallback((msg, onOk, options = {}) => {
    if (setDialogState) {
      setDialogState({ msg, onOk, ...options })
    }
  }, [])
  return { confirm }
}

/**
 * App.jsx 최상위에서 한 번만 사용 — ConfirmDialog에 상태 제공
 */
export function useConfirmDialog() {
  const [state, setState] = useState(null)

  useEffect(() => {
    setDialogState = setState
    return () => { setDialogState = null }
  }, [])

  return {
    open: !!state,
    msg: state?.msg ?? '',
    icon: state?.icon ?? '🗑',
    confirmLabel: state?.confirmLabel ?? '삭제',
    confirmVariant: state?.confirmVariant ?? 'danger',
    onOk: state?.onOk ?? (() => {}),
    onClose: () => setState(null),
  }
}
