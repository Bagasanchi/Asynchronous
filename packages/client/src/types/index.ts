// Re-export shared types and add client-specific types

export type {
  User,
  UserPreferences,
  Card,
  CardData,
  Game,
  GameSettings,
  Player,
  Enemy,
  Relic,
  Potion,
  Buff,
  Tournament,
  Club,
  ClubMember,
  DailyRun,
  LeaderboardEntry,
  Replay,
  Achievement,
  WebSocketMessage,
  WSConnectPayload,
  WSJoinGamePayload,
  WSPlayerActionPayload,
  WSGameStatePayload,
  WSGameUpdatePayload,
  WSGameEndPayload,
  WSPlayerConnectedPayload,
  WSPlayerDisconnectedPayload,
  WSTurnChangePayload,
  WSNotificationPayload,
  WSErrorPayload,
  WSPingPayload,
  WSPongPayload,
  APIResponse,
  PaginatedResponse,
  GameAction,
  PlayerAction,
  ActionType,
  EffectType,
  TargetType,
  BuffType,
  CardType,
  CardRarity,
  GameType,
  GameStatus,
  TurnPhase,
  PlayerStatus,
  TournamentStatus,
  ClubRole,
  NotificationType,
} from '@async-card-game/shared/types'

export type {
  WSMessageType,
} from '@async-card-game/shared/types'

import type {
  WSMessageType,
  GameType,
  GameStatus,
  PlayerStatus,
  TurnPhase,
  ActionType,
} from '@async-card-game/shared/types'

// Client-specific enums (extend shared ones)
export enum ClientGamePhase {
  LOBBY = 'lobby',
  MATCHMAKING = 'matchmaking',
  IN_GAME = 'in_game',
  REPLAY = 'replay',
  TOURNAMENT = 'tournament',
  DAILY_RUN = 'daily_run',
}

export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

export enum NotificationPosition {
  TOP_RIGHT = 'top-right',
  TOP_LEFT = 'top-left',
  BOTTOM_RIGHT = 'bottom-right',
  BOTTOM_LEFT = 'bottom-left',
  TOP_CENTER = 'top-center',
  BOTTOM_CENTER = 'bottom-center',
}

// UI State types
export interface UIState {
  sidebarOpen: boolean
  mobileMenuOpen: boolean
  activeModal: string | null
  toasts: Toast[]
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface ModalState {
  isOpen: boolean
  title: string
  content: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  onClose: () => void
  onConfirm?: () => void
  confirmLabel?: string
  cancelLabel?: string
}

// Game UI types
export interface CardUIState {
  id: string
  card: import('@async-card-game/shared/types').Card
  position: 'hand' | 'deck' | 'discard' | 'exhaust' | 'play' | 'preview'
  index: number
  isPlayable: boolean
  isSelected: boolean
  isHovered: boolean
  isExhausted: boolean
  targetMode: boolean
  validTargets: string[]
}

export interface EnemyUIState {
  id: string
  enemy: import('@async-card-game/shared/types').Enemy
  position: number
  isTargeted: boolean
  isHovered: boolean
  intentDisplay: string
}

export interface PlayerUIState {
  player: import('@async-card-game/shared/types').Player
  hand: CardUIState[]
  deckCount: number
  discardCount: number
  exhaustCount: number
  relics: import('@async-card-game/shared/types').Relic[]
  potions: import('@async-card-game/shared/types').Potion[]
  buffs: import('@async-card-game/shared/types').Buff[]
  isCurrentTurn: boolean
  timeRemaining: number
}

export interface GameUIState {
  gameId: string
  gameType: GameType
  status: GameStatus
  currentPlayerIndex: number
  turnNumber: number
  turnPhase: TurnPhase
  turnStartTime: number
  turnTimeLimit: number
  floor: number
  act: number
  ascensionLevel: number
  enemiesDefeated: number
  players: PlayerUIState[]
  enemies: EnemyUIState[]
  currentEnemy: EnemyUIState | null
  log: LogEntryUI[]
  seed: string
  yourPlayerIndex: number
  connectionStatus: ConnectionStatus
  lastActionTime: number
}

export interface LogEntryUI {
  id: string
  turn: number
  playerIndex: number
  action: string
  message: string
  type: 'normal' | 'important' | 'damage' | 'heal' | 'block' | 'draw' | 'gain' | 'lose'
  timestamp: number
  data?: Record<string, unknown>
}

// Matchmaking UI
export interface MatchmakingState {
  status: 'idle' | 'searching' | 'found' | 'cancelled'
  queueTime: number
  estimatedWait: number
  gameType: GameType
  playersFound: number
  requiredPlayers: number
}

// API Error types
export interface APIError {
  code: string
  message: string
  details?: Record<string, unknown>
  statusCode: number
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

// Form types
export interface LoginForm {
  email: string
  password: string
  rememberMe: boolean
}

export interface RegisterForm {
  username: string
  email: string
  password: string
  confirmPassword: string
  displayName?: string
}

export interface ChangePasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface ProfileForm {
  displayName: string
  bio: string
  avatarUrl: string
}

export interface GameCreateForm {
  gameType: GameType
  settings: import('@async-card-game/shared/types').GameSettings
  invitedPlayers: string[]
}

export interface ClubCreateForm {
  name: string
  description: string
  isPublic: boolean
  requireApproval: boolean
}

export interface TournamentCreateForm {
  name: string
  description: string
  gameType: GameType
  format: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss'
  maxParticipants: number
  entryFee: number
  prizePool: number
  startDate: string
  settings: import('@async-card-game/shared/types').GameSettings
}

// WebSocket message types for client
export interface ClientWSMessage {
  type: WSMessageType
  payload: unknown
}

export interface ClientWSHandlers {
  onConnect: (payload: { userId: string; message: string }) => void
  onConnected: (payload: { userId: string; message: string }) => void
  onGameState: (payload: { game: import('@async-card-game/shared/types').Game; yourPlayerIndex: number }) => void
  onGameUpdate: (payload: { updates: Partial<import('@async-card-game/shared/types').Game>; playerIndex: number }) => void
  onGameEnd: (payload: { winnerId: string | null; endReason: string; finalState: import('@async-card-game/shared/types').Game }) => void
  onPlayerConnected: (payload: { userId: string; playerIndex: number }) => void
  onPlayerDisconnected: (payload: { userId: string }) => void
  onTurnChange: (payload: { currentPlayerIndex: number; turnNumber: number; timeRemaining: number }) => void
  onNotification: (payload: import('@async-card-game/shared/types').Notification) => void
  onError: (payload: { code: string; message: string }) => void
  onPong: (payload: { timestamp: number }) => void
}

// Theme types
export type Theme = 'dark' | 'light' | 'system'

export interface ThemeConfig {
  theme: Theme
  primaryColor: string
  fontSize: 'sm' | 'md' | 'lg'
  reducedMotion: boolean
  highContrast: boolean
}

// Settings types
export interface ClientSettings {
  theme: ThemeConfig
  notifications: {
    inGame: boolean
    email: boolean
    push: boolean
    turnReminders: boolean
    friendRequests: boolean
    gameInvites: boolean
    tournamentUpdates: boolean
    dailyRunReminders: boolean
  }
  gameplay: {
    showCardDescriptions: boolean
    showEnemyIntents: boolean
    autoEndTurn: boolean
    confirmActions: boolean
    animationSpeed: 'slow' | 'normal' | 'fast' | 'instant'
    cardHoverPreview: boolean
  }
  privacy: {
    showOnlineStatus: boolean
    showGameHistory: boolean
    allowFriendRequests: boolean
    allowGameInvites: boolean
  }
  keybinds: Record<string, string>
}