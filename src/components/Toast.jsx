import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

function ToastItem({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), toast.duration - 300)
    const remove = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => { clearTimeout(timer); clearTimeout(remove) }
  }, [toast, onDismiss])

  const isError = toast.type === 'error'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm max-w-xs transition-all duration-300 ${
        exiting ? 'animate-slide-out' : 'animate-slide-in'
      } ${
        isError
          ? 'bg-red-950 border-red-800 text-red-200'
          : 'bg-gray-800 border-gray-700 text-gray-200'
      }`}
    >
      {isError
        ? <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
        : <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
      }
      <span className="flex-1 min-w-0">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, message, type, duration }])
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message) => addToast(message, 'success'), [addToast])
  toast.error = useCallback((message) => addToast(message, 'error'), [addToast])
  toast.success = useCallback((message) => addToast(message, 'success'), [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-auto">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
