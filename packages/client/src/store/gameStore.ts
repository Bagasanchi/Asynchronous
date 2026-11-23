import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Game, Player, Enemy, Card, Relic, Potion, Buff, LogEntry } from '../types'

interface GameState {
  game: Game | null
  yourPlayerIndex: number
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

  // UI State
  selectedCardId: string | null
  hoveredCardId: string | null
  targetMode: boolean
  validTargets: string[]
  showCardPreview: Card | null
  showLog: boolean
  showSettings: boolean
  animationsEnabled: boolean

  // Computed
  currentPlayer: Player | null
  currentEnemy: Enemy | null
  isYourTurn: boolean
  timeRemaining: number
  canAct: boolean

  // Actions
  setGame: (game: Game) => void
  updateGame: (updates: Partial<Game>) => void
  setYourPlayerIndex: (index: number) => void
  setConnectionStatus: (status: GameState['connectionStatus']) => void

  // UI Actions
  selectCard: (cardId: string | null) => void
  hoverCard: (cardId: string | null) => void
  setTargetMode: (enabled: boolean, validTargets?: string[]) => void
  setCardPreview: (card: Card | null) => void
  toggleLog: () => void
  toggleSettings: () => void
  setAnimationsEnabled: (enabled: boolean) => void

  // Game Actions (optimistic updates)
  playCardOptimistic: (cardId: string, targetIndex?: number) => void
  endTurnOptimistic: () => void
  usePotionOptimistic: (potionIndex: number, targetIndex?: number) => void

  // Reset
  resetGame: () => void
}

const initialState = {
  game: null,
  yourPlayerIndex: -1,
  connectionStatus: 'disconnected' as const,
  selectedCardId: null,
  hoveredCardId: null,
  targetMode: false,
  validTargets: [],
  showCardPreview: null,
  showLog: false,
  showSettings: false,
  animationsEnabled: true,
}

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    ...initialState,

    // Computed getters
    get currentPlayer() {
      const { game, yourPlayerIndex } = get()
      if (!game || yourPlayerIndex === -1) return null
      return game.players[game.currentPlayerIndex] || null
    },

    get currentEnemy() {
      const { game } = get()
      if (!game || !game.currentEnemy) return null
      return game.currentEnemy
    },

    get isYourTurn() {
      const { game, yourPlayerIndex } = get()
      if (!game || yourPlayerIndex === -1) return false
      return game.currentPlayerIndex === yourPlayerIndex && game.status === 'active'
    },

    get timeRemaining() {
      const { game } = get()
      if (!game || !game.turnStartTime || !game.turnTimeLimit) return 0
      const elapsed = (Date.now() - new Date(game.turnStartTime).getTime()) / 1000 / 60 // minutes
      return Math.max(0, game.turnTimeLimit - elapsed)
    },

    get canAct() {
      const { isYourTurn, connectionStatus } = get()
      return isYourTurn && connectionStatus === 'connected'
    },

    setGame: (game) => set({ game, yourPlayerIndex: get().yourPlayerIndex }),

    updateGame: (updates) => set(state => {
      if (state.game) {
        Object.assign(state.game, updates)
        state.game.updatedAt = new Date()
      }
    }),

    setYourPlayerIndex: (index) => set({ yourPlayerIndex: index }),

    setConnectionStatus: (status) => set({ connectionStatus: status }),

    selectCard: (cardId) => set({ selectedCardId: cardId }),

    hoverCard: (cardId) => set({ hoveredCardId: cardId }),

    setTargetMode: (enabled, validTargets = []) => set({
      targetMode: enabled,
      validTargets,
      selectedCardId: enabled ? get().selectedCardId : null,
    }),

    setCardPreview: (card) => set({ showCardPreview: card }),

    toggleLog: () => set(state => { state.showLog = !state.showLog }),

    toggleSettings: () => set(state => { state.showSettings = !state.showSettings }),

    setAnimationsEnabled: (enabled) => set({ animationsEnabled: enabled }),

    playCardOptimistic: (cardId, targetIndex) => set(state => {
      if (!state.game) return

      const player = state.game.players[state.game.currentPlayerIndex]
      if (!player) return

      const cardIndex = player.hand.findIndex(c => c.id === cardId)
      if (cardIndex === -1) return

      const card = player.hand[cardIndex]

      // Move card from hand to play area (visual)
      player.hand.splice(cardIndex, 1)
      player.energy -= card.cost
      player.totalCardsPlayed++

      // Add to log
      state.game.log.push({
        id: `log_${Date.now()}`,
        turn: state.game.turnNumber,
        playerIndex: state.game.currentPlayerIndex,
        action: 'play_card',
        message: `Played ${card.name}`,
        type: 'normal',
        timestamp: Date.now(),
        data: { cardId, targetIndex },
      })
    }),

    endTurnOptimistic: () => set(state => {
      if (!state.game) return

      state.game.log.push({
        id: `log_${Date.now()}`,
        turn: state.game.turnNumber,
        playerIndex: state.game.currentPlayerIndex,
        action: 'end_turn',
        message: 'Ended turn',
        type: 'normal',
        timestamp: Date.now(),
      })
    }),

    usePotionOptimistic: (potionIndex, targetIndex) => set(state => {
      if (!state.game) return

      const player = state.game.players[state.game.currentPlayerIndex]
      if (!player || potionIndex < 0 || potionIndex >= player.potions.length) return

      const potion = player.potions[potionIndex]
      player.potions.splice(potionIndex, 1)

      state.game.log.push({
        id: `log_${Date.now()}`,
        turn: state.game.turnNumber,
        playerIndex: state.game.currentPlayerIndex,
        action: 'use_potion',
        message: `Used ${potion.name}`,
        type: 'normal',
        timestamp: Date.now(),
        data: { potionIndex, targetIndex },
      })
    }),

    resetGame: () => set(initialState),
  }))
)

// Selectors for performance
export const useCurrentPlayer = () => useGameStore(state => state.currentPlayer)
export const useCurrentEnemy = () => useGameStore(state => state.currentEnemy)
export const useIsYourTurn = () => useGameStore(state => state.isYourTurn)
export const useTimeRemaining = () => useGameStore(state => state.timeRemaining)
export const useCanAct = () => useGameStore(state => state.canAct)
export const useGameConnectionStatus = () => useGameStore(state => state.connectionStatus)
export const useSelectedCardId = () => useGameStore(state => state.selectedCardId)
export const useHoveredCardId = () => useGameStore(state => state.hoveredCardId)
export const useTargetMode = () => useGameStore(state => state.targetMode)
export const useValidTargets = () => useGameStore(state => state.validTargets)
export const useCardPreview = () => useGameStore(state => state.showCardPreview)
export const useShowLog = () => useGameStore(state => state.showLog)
export const useShowSettings = () => useGameStore(state => state.showSettings)
export const useAnimationsEnabled = () => useGameStore(state => state.animationsEnabled)