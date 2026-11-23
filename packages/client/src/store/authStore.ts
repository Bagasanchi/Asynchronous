import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { User, UserPreferences } from '../types'
import { authAPI } from '../services/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  loading: boolean
  error: string | null

  // Actions
  setUser: (user: User | null) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  clearAuth: () => void
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (data: { username: string; email: string; password: string; displayName?: string }) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<void>
  fetchMe: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  deleteAccount: (password: string) => Promise<void>
  uploadAvatar: (file: File) => Promise<string>
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    immer((set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      loading: true,
      error: null,

      setUser: (user) => set({ user }),

      setTokens: (accessToken, refreshToken) => set({
        accessToken,
        refreshToken,
        error: null,
      }),

      clearAuth: () => set({
        user: null,
        accessToken: null,
        refreshToken: null,
        loading: false,
        error: null,
      }),

      setLoading: (loading) => set({ loading }),

      setError: (error) => set({ error }),

      login: async (email, password, rememberMe = false) => {
        set({ loading: true, error: null })
        try {
          const response = await authAPI.login({ email, password, rememberMe })
          const { user, accessToken, refreshToken } = response.data
          set({
            user,
            accessToken,
            refreshToken,
            loading: false,
            error: null,
          })
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
        } catch (error: any) {
          set({ loading: false, error: error.message || 'Login failed' })
          throw error
        }
      },

      register: async (data) => {
        set({ loading: true, error: null })
        try {
          const response = await authAPI.register(data)
          const { user, accessToken, refreshToken } = response.data
          set({
            user,
            accessToken,
            refreshToken,
            loading: false,
            error: null,
          })
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', refreshToken)
        } catch (error: any) {
          set({ loading: false, error: error.message || 'Registration failed' })
          throw error
        }
      },

      logout: async () => {
        const { accessToken } = get()
        set({ loading: true })
        try {
          if (accessToken) {
            await authAPI.logout()
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            loading: false,
          })
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) throw new Error('No refresh token')

        try {
          const response = await authAPI.refresh()
          const { accessToken, refreshToken: newRefreshToken } = response.data
          set({ accessToken, refreshToken: newRefreshToken })
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)
        } catch (error) {
          get().clearAuth()
          throw error
        }
      },

      fetchMe: async () => {
        const { accessToken } = get()
        if (!accessToken) {
          set({ loading: false })
          return
        }

        set({ loading: true })
        try {
          const response = await authAPI.me()
          set({ user: response.data.user, loading: false, error: null })
        } catch (error: any) {
          if (error.statusCode === 401) {
            try {
              await get().refreshAccessToken()
              const response = await authAPI.me()
              set({ user: response.data.user, loading: false, error: null })
            } catch {
              get().clearAuth()
            }
          } else {
            set({ loading: false, error: error.message })
            get().clearAuth()
          }
        }
      },

      updateProfile: async (data) => {
        set({ loading: true, error: null })
        try {
          const response = await authAPI.updateProfile(data)
          set({ user: response.data.user, loading: false })
        } catch (error: any) {
          set({ loading: false, error: error.message })
          throw error
        }
      },

      updatePreferences: async (preferences) => {
        set({ loading: true, error: null })
        try {
          const response = await authAPI.updatePreferences(preferences)
          set(state => {
            if (state.user) {
              state.user.preferences = response.data.preferences
            }
            state.loading = false
          })
        } catch (error: any) {
          set({ loading: false, error: error.message })
          throw error
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        set({ loading: true, error: null })
        try {
          await authAPI.changePassword({ currentPassword, newPassword })
          set({ loading: false })
        } catch (error: any) {
          set({ loading: false, error: error.message })
          throw error
        }
      },

      deleteAccount: async (password) => {
        set({ loading: true, error: null })
        try {
          await authAPI.deleteAccount(password)
          get().clearAuth()
        } catch (error: any) {
          set({ loading: false, error: error.message })
          throw error
        }
      },

      uploadAvatar: async (file) => {
        set({ loading: true, error: null })
        try {
          const response = await authAPI.uploadAvatar(file)
          set(state => {
            if (state.user) {
              state.user.avatarUrl = response.data.avatarUrl
            }
            state.loading = false
          })
          return response.data.avatarUrl
        } catch (error: any) {
          set({ loading: false, error: error.message })
          throw error
        }
      },
    })),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)

// Initialize auth on app load
export function initAuth() {
  const { fetchMe, accessToken } = useAuthStore.getState()
  if (accessToken) {
    fetchMe()
  } else {
    useAuthStore.setState({ loading: false })
  }
}