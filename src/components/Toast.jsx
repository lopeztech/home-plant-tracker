import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { Toast as BsToast, ToastContainer } from 'react-bootstrap'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  const isError = toast.type === 'error'

  return (
    <BsToast
      onClose={() => onDismiss(toast.id)}
      bg={isError ? 'danger' : 'dark'}
      autohide
      delay={toast.duration}
    >
      <BsToast.Header closeButton>
        <svg className={`sa-icon me-2 ${isError ? 'text-danger' : 'text-success'}`} style={{ width: 14, height: 14 }}>
          <use href={`/icons/sprite.svg#${isError ? 'alert-circle' : 'check-circle'}`}></use>
        </svg>
        <strong className="me-auto">{isError ? 'Error' : 'Success'}</strong>
      </BsToast.Header>
      <BsToast.Body className={isError ? 'text-white' : ''}>
        {toast.message}
      </BsToast.Body>
    </BsToast>
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
