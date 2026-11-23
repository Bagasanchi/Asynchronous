import type { APIResponse, PaginatedResponse, APIError } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

class APIErrorClass extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'APIError'
  }
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('accessToken')

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Important for HttpOnly cookies
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new APIErrorClass(
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An error occurred',
      response.status,
      data.error?.details
    )
  }

  return data as T
}

// Auth endpoints
export const authAPI = {
  register: (data: { username: string; email: string; password: string; displayName?: string }) =>
    fetchWithAuth<APIResponse<{ user: any; accessToken: string; refreshToken: string }>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string; rememberMe?: boolean }) =>
    fetchWithAuth<APIResponse<{ user: any; accessToken: string; refreshToken: string }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  logout: () =>
    fetchWithAuth<APIResponse<{ message: string }>>('/auth/logout', {
      method: 'POST',
    }),

  refresh: () =>
    fetchWithAuth<APIResponse<{ accessToken: string; refreshToken: string }>>('/auth/refresh', {
      method: 'POST',
    }),

  me: () =>
    fetchWithAuth<APIResponse<{ user: any }>>('/auth/me'),

  getPreferences: () =>
    fetchWithAuth<APIResponse<{ preferences: any }>>('/auth/preferences'),

  updatePreferences: (preferences: any) =>
    fetchWithAuth<APIResponse<{ preferences: any }>>('/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchWithAuth<APIResponse<{ message: string }>>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAccount: (password: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return fetchWithAuth<APIResponse<{ avatarUrl: string }>>('/auth/avatar', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    })
  },
}

// Game endpoints
export const gamesAPI = {
  list: (params?: { status?: string; gameType?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<PaginatedResponse<any[]>>(`/games?${searchParams.toString()}`)
  },

  create: (data: { gameType: string; settings: any; invitedPlayers?: string[] }) =>
    fetchWithAuth<APIResponse<{ game: any }>>('/games', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (gameId: string) =>
    fetchWithAuth<APIResponse<{ game: any }>>(`/games/${gameId}`),

  join: (gameId: string) =>
    fetchWithAuth<APIResponse<{ game: any }>>(`/games/${gameId}/join`, {
      method: 'POST',
    }),

  leave: (gameId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/games/${gameId}/leave`, {
      method: 'POST',
    }),

  forfeit: (gameId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/games/${gameId}/forfeit`, {
      method: 'POST',
    }),

  playCard: (gameId: string, data: { cardId: string; targetIndex?: number; targetPlayerIndex?: number; choices?: Record<string, unknown> }) =>
    fetchWithAuth<APIResponse<{ game: any; success: boolean }>>(`/games/${gameId}/play-card`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  endTurn: (gameId: string) =>
    fetchWithAuth<APIResponse<{ game: any }>>(`/games/${gameId}/end-turn`, {
      method: 'POST',
    }),

  usePotion: (gameId: string, data: { potionIndex: number; targetIndex?: number }) =>
    fetchWithAuth<APIResponse<{ game: any; success: boolean }>>(`/games/${gameId}/use-potion`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getLog: (gameId: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<APIResponse<{ log: any[] }>>(`/games/${gameId}/log?${searchParams.toString()}`)
  },

  getReplay: (gameId: string) =>
    fetchWithAuth<APIResponse<{ replay: any }>>(`/games/${gameId}/replay`),
}

// Matchmaking endpoints
export const matchmakingAPI = {
  joinQueue: (data: { gameType: string; settings?: any }) =>
    fetchWithAuth<APIResponse<{ queueId: string; position: number; estimatedWait: number }>>('/matchmaking/join', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  leaveQueue: (queueId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/matchmaking/${queueId}/leave`, {
      method: 'POST',
    }),

  getStatus: (queueId: string) =>
    fetchWithAuth<APIResponse<{ status: string; position: number; estimatedWait: number; playersFound: number; gameId?: string }>>(`/matchmaking/${queueId}/status`),

  acceptMatch: (queueId: string) =>
    fetchWithAuth<APIResponse<{ gameId: string }>>(`/matchmaking/${queueId}/accept`, {
      method: 'POST',
    }),
}

// User endpoints
export const usersAPI = {
  getProfile: (userId: string) =>
    fetchWithAuth<APIResponse<{ user: any }>>(`/users/${userId}`),

  updateProfile: (data: { displayName?: string; bio?: string; avatarUrl?: string }) =>
    fetchWithAuth<APIResponse<{ user: any }>>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getStats: (userId?: string) =>
    fetchWithAuth<APIResponse<{ stats: any }>>(`/users/${userId || 'me'}/stats`),

  getFriends: (params?: { status?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<PaginatedResponse<any[]>>(`/users/friends?${searchParams.toString()}`)
  },

  sendFriendRequest: (userId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/users/friends/${userId}`, {
      method: 'POST',
    }),

  acceptFriendRequest: (userId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/users/friends/${userId}/accept`, {
      method: 'POST',
    }),

  removeFriend: (userId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/users/friends/${userId}`, {
      method: 'DELETE',
    }),

  blockUser: (userId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/users/block/${userId}`, {
      method: 'POST',
    }),

  unblockUser: (userId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/users/block/${userId}`, {
      method: 'DELETE',
    }),

  searchUsers: (query: string, limit = 10) =>
    fetchWithAuth<APIResponse<{ users: any[] }>>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`),

  getAchievements: (userId?: string) =>
    fetchWithAuth<APIResponse<{ achievements: any[] }>>(`/users/${userId || 'me'}/achievements`),
}

// Daily Run endpoints
export const dailyRunsAPI = {
  getCurrent: () =>
    fetchWithAuth<APIResponse<{ dailyRun: any }>>('/daily-runs/current'),

  getHistory: (params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<PaginatedResponse<any[]>>(`/daily-runs/history?${searchParams.toString()}`)
  },

  join: (dailyRunId: string) =>
    fetchWithAuth<APIResponse<{ game: any }>>(`/daily-runs/${dailyRunId}/join`, {
      method: 'POST',
    }),

  getLeaderboard: (dailyRunId: string, params?: { limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<APIResponse<{ leaderboard: any[] }>>(`/daily-runs/${dailyRunId}/leaderboard?${searchParams.toString()}`)
  },

  submitScore: (dailyRunId: string, data: { score: number; gameId: string }) =>
    fetchWithAuth<APIResponse<{ rank: number; score: number }>>(`/daily-runs/${dailyRunId}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

// Leaderboard endpoints
export const leaderboardsAPI = {
  get: (period: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'all_time', params?: { gameType?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<APIResponse<{ leaderboard: any[]; period: string; updatedAt: string }>>(`/leaderboards/${period}?${searchParams.toString()}`)
  },

  getPlayerRank: (period: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'all_time', userId?: string) =>
    fetchWithAuth<APIResponse<{ rank: number; score: number; totalPlayers: number }>>(`/leaderboards/${period}/rank${userId ? `?userId=${userId}` : ''}`),
}

// Replay endpoints
export const replaysAPI = {
  list: (params?: { gameType?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<PaginatedResponse<any[]>>(`/replays?${searchParams.toString()}`)
  },

  get: (replayId: string) =>
    fetchWithAuth<APIResponse<{ replay: any }>>(`/replays/${replayId}`),

  getByGame: (gameId: string) =>
    fetchWithAuth<APIResponse<{ replay: any }>>(`/replays/game/${gameId}`),

  watch: (replayId: string, data: { turn?: number; actionIndex?: number }) =>
    fetchWithAuth<APIResponse<{ state: any; currentTurn: number; currentAction: number; totalTurns: number; totalActions: number }>>(`/replays/${replayId}/watch`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  download: (replayId: string) =>
    fetch(`${API_BASE_URL}/replays/${replayId}/download`, {
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    }).then(res => res.blob()),

  create: (gameId: string) =>
    fetchWithAuth<APIResponse<{ replay: any }>>('/replays/create', {
      method: 'POST',
      body: JSON.stringify({ gameId }),
    }),
}

// Club endpoints
export const clubsAPI = {
  list: (params?: { q?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<PaginatedResponse<any[]>>(`/clubs?${searchParams.toString()}`)
  },

  create: (data: { name: string; description?: string; isPublic?: boolean; requireApproval?: boolean }) =>
    fetchWithAuth<APIResponse<{ club: any }>>('/clubs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (clubId: string) =>
    fetchWithAuth<APIResponse<{ club: any }>>(`/clubs/${clubId}`),

  join: (clubId: string) =>
    fetchWithAuth<APIResponse<{ status: string; message: string }>>(`/clubs/${clubId}/join`, {
      method: 'POST',
    }),

  leave: (clubId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/clubs/${clubId}/leave`, {
      method: 'POST',
    }),

  manageMember: (clubId: string, memberId: string, action: 'kick' | 'promote' | 'demote' | 'approve' | 'reject') =>
    fetchWithAuth<APIResponse<{ message: string; role?: string }>>(`/clubs/${clubId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),

  createGame: (clubId: string, data: { gameType: string; settings?: any; invitedPlayers?: string[] }) =>
    fetchWithAuth<APIResponse<{ game: any }>>(`/clubs/${clubId}/games`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyClubs: () =>
    fetchWithAuth<APIResponse<{ clubs: any[] }>>('/clubs/me'),
}

// Tournament endpoints
export const tournamentsAPI = {
  list: (params?: { status?: string; gameType?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<PaginatedResponse<any[]>>(`/tournaments?${searchParams.toString()}`)
  },

  create: (data: any) =>
    fetchWithAuth<APIResponse<{ tournament: any }>>('/tournaments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (tournamentId: string) =>
    fetchWithAuth<APIResponse<{ tournament: any }>>(`/tournaments/${tournamentId}`),

  register: (tournamentId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/tournaments/${tournamentId}/register`, {
      method: 'POST',
    }),

  unregister: (tournamentId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/tournaments/${tournamentId}/unregister`, {
      method: 'POST',
    }),

  getBracket: (tournamentId: string) =>
    fetchWithAuth<APIResponse<{ bracket: any }>>(`/tournaments/${tournamentId}/bracket`),

  reportMatch: (tournamentId: string, matchId: string, data: { winnerId: string; score: string }) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/tournaments/${tournamentId}/matches/${matchId}/report`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyTournaments: () =>
    fetchWithAuth<APIResponse<{ tournaments: any[] }>>('/tournaments/me'),
}

// Notification endpoints
export const notificationsAPI = {
  list: (params?: { unreadOnly?: boolean; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value))
      })
    }
    return fetchWithAuth<PaginatedResponse<any[]>>(`/notifications?${searchParams.toString()}`)
  },

  getUnreadCount: () =>
    fetchWithAuth<APIResponse<{ count: number }>>('/notifications/unread-count'),

  markAsRead: (notificationId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    }),

  markAllAsRead: () =>
    fetchWithAuth<APIResponse<{ message: string }>>('/notifications/read-all', {
      method: 'PATCH',
    }),

  delete: (notificationId: string) =>
    fetchWithAuth<APIResponse<{ message: string }>>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    }),

  getPreferences: () =>
    fetchWithAuth<APIResponse<{ preferences: any }>>('/notifications/preferences'),

  updatePreferences: (preferences: any) =>
    fetchWithAuth<APIResponse<{ preferences: any }>>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    }),

  createTest: (data: { type?: string; title: string; message: string; data?: Record<string, unknown> }) =>
    fetchWithAuth<APIResponse<{ message: string }>>('/notifications/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}

export { APIErrorClass as APIError }
export type { APIResponse, PaginatedResponse }