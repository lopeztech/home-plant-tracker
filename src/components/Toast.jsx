import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { ToastContainer } from 'react-bootstrap'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

// Render the Bootstrap toast markup directly — react-bootstrap's <Toast>
// hardcodes role="alert"/aria-live="assertive", which is too noisy for our
// success confirmations. We want polite announcements for success and
// assertive ones for errors.
function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  const isError = toast.type === 'error'
  const bgClass = isError ? 'bg-danger' : 'bg-dark'

  return (
    <div
      className={`toast show ${bgClass}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="toast-header">
        <svg className={`sa-icon me-2 ${isError ? 'text-danger' : 'text-success'}`} style={{ width: 14, height: 14 }} aria-hidden="true">
          <use href={`/icons/sprite.svg#${isError ? 'alert-circle' : 'check-circle'}`}></use>
        </svg>
        <strong className="me-auto">{isError ? 'Error' : 'Success'}</strong>
        <button
          type="button"
          className="btn-close"
          aria-label="Close"
          onClick={() => onDismiss(toast.id)}
        />
      </div>
      <div className={`toast-body ${isError ? 'text-white' : ''}`}>
        {toast.message}
      </div>
    </div>
  )
}

let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, message, type, duration }])
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message) => addToast(message, 'success'), [addToast])
  toast.error = useCallback((message) => addToast(message, 'error'), [addToast])
  toast.success = useCallback((message) => addToast(message, 'success'), [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  )
}
