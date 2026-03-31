import { useState, useEffect, useCallback } from 'react'

// ─── 전역 싱글톤 — 어느 컴포넌트에서 호출해도 같은 상태 공유
let listeners = []
let toastList  = []

function emit(next) {
  toastList = next
  listeners.forEach(fn => fn(next))
}

function addToast(message, type = 'info', duration = 3000) {
  const id = Date.now() + Math.random()
  const next = [...toastList, { id, message, type }]
  emit(next)
  setTimeout(() => {
    emit(toastList.filter(t => t.id !== id))
  }, duration)
}

export function useToast() {
  const [toasts, setToasts] = useState(toastList)

  useEffect(() => {
    listeners.push(setToasts)
    return () => { listeners = listeners.filter(fn => fn !== setToasts) }
  }, [])

  const toast   = useCallback((msg, type = 'info', duration = 3000) => addToast(msg, type, duration), [])
  const success = useCallback((msg, duration = 3000) => addToast(msg, 'success', duration), [])
  const error   = useCallback((msg, duration = 3000) => addToast(msg, 'error',   duration), [])
  const info    = useCallback((msg, duration = 3000) => addToast(msg, 'info',    duration), [])
  const warning = useCallback((msg, duration = 3000) => addToast(msg, 'warning', duration), [])

  return { toasts, toast, success, error, info, warning }
}
