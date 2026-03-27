import { useState, useCallback } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const success = useCallback((msg) => toast(msg, 'success'), [toast])
  const error = useCallback((msg) => toast(msg, 'error'), [toast])
  const info = useCallback((msg) => toast(msg, 'info'), [toast])
  const warning = useCallback((msg) => toast(msg, 'warning'), [toast])

  return { toasts, toast, success, error, info, warning }
}
