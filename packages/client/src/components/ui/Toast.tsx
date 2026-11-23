import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import { createPortal } from 'react-dom'
import { useToastStore } from '../../store/toastStore'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors = {
  success: 'border-green-500/50 bg-green-500/5 text-green-400',
  error: 'border-red-500/50 bg-red-500/5 text-red-400',
  warning: 'border-yellow-500/50 bg-yellow-500/5 text-yellow-400',
  info: 'border-blue-500/50 bg-blue-500/5 text-blue-400',
}

interface ToastItemProps {
  toast: import('../../types').Toast
  onClose: (id: string) => void
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const Icon = icons[toast.type]

  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => onClose(toast.id), toast.duration ?? 5000)
      return () => clearTimeout(timer)
    }
  }, [toast, onClose])

  return createPortal(
    <div
      className={clsx(
        'toast flex items-start gap-3 p-4 rounded-lg border shadow-lg min-w-[300px] max-w-md animate-slide-in-right',
        colors[toast.type]
      )}
      role="alert"
      aria-live="polite"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-muted-foreground mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>,
    document.getElementById('toast-container') || document.body
  )
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div id="toast-container" className="toast-container fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={removeToast}
        />
      ))}
    </div>
  )
}

// Helper hook for easy toast usage
export function useToast() {
  const { addToast } = useToastStore()

  return {
    success: (title: string, message?: string, duration?: number) =>
      addToast({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration?: number) =>
      addToast({ type: 'error', title, message, duration: duration ?? 8000 }),
    warning: (title: string, message?: string, duration?: number) =>
      addToast({ type: 'warning', title, message, duration }),
    info: (title: string, message?: string, duration?: number) =>
      addToast({ type: 'info', title, message, duration }),
  }
}