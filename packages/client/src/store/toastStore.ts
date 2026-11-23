import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Toast } from '../types'

interface ToastState {
  toasts: Toast[]

  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

let toastId = 0

export const useToastStore = create<ToastState>()(
  immer((set) => ({
    toasts: [],

    addToast: (toast) => {
      const id = `toast_${++toastId}_${Date.now()}`
      set(state => {
        state.toasts.push({ ...toast, id })
      })

      // Auto-remove after duration
      const duration = toast.duration ?? 5000
      if (duration > 0) {
        setTimeout(() => {
          set(state => {
            const index = state.toasts.findIndex(t => t.id === id)
            if (index !== -1) state.toasts.splice(index, 1)
          })
        }, duration)
      }

      return id
    },

    removeToast: (id) => set(state => {
      const index = state.toasts.findIndex(t => t.id === id)
      if (index !== -1) state.toasts.splice(index, 1)
    }),

    clearToasts: () => set({ toasts: [] }),
  }))
)

// Helper functions
export function showToast(type: Toast['type'], title: string, message?: string, duration?: number) {
  return useToastStore.getState().addToast({ type, title, message, duration })
}

export function showSuccess(title: string, message?: string) {
  return showToast('success', title, message)
}

export function showError(title: string, message?: string) {
  return showToast('error', title, message, 8000)
}

export function showWarning(title: string, message?: string) {
  return showToast('warning', title, message)
}

export function showInfo(title: string, message?: string) {
  return showToast('info', title, message)
}