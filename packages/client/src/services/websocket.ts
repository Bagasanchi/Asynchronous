import type {
  WSMessageType,
  Game,
  Player,
  Enemy,
  Notification,
  ClientWSHandlers,
} from '../types'

type WSMessageHandler = (message: any) => void

interface PendingRequest {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private handlers: Map<WSMessageType, WSMessageHandler[]> = new Map()
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private requestId = 0
  private pingInterval: NodeJS.Timeout | null = null
  private connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error' = 'disconnected'
  private statusListeners: ((status: typeof this.connectionStatus) => void) = []
  private userId: string | null = null
  private token: string | null = null

  constructor() {
    this.url = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'
  }

  connect(userId: string, token: string): Promise<void> {
    this.userId = userId
    this.token = token

    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      this.setStatus('connecting')

      try {
        this.ws = new WebSocket(this.url)
        this.setupEventHandlers(resolve, reject)
      } catch (error) {
        this.setStatus('error')
        reject(error)
      }
    })
  }

  private setupEventHandlers(resolve: () => void, reject: (error: Error) => void) {
    if (!this.ws) return

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.setStatus('connected')

      // Send CONNECT message with auth
      this.send(WSMessageType.CONNECT, {
        userId: this.userId,
        token: this.token,
      })

      // Start ping interval
      this.startPingInterval()

      resolve()
    }

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      this.stopPingInterval()
      this.setStatus('disconnected')

      // Clean up pending requests
      this.pendingRequests.forEach(({ reject }) => {
        reject(new Error('WebSocket connection closed'))
      })
      this.pendingRequests.clear()

      // Attempt reconnection if not intentionally closed
      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.attemptReconnect()
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.setStatus('error')
      reject(new Error('WebSocket connection failed'))
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
  }

  private attemptReconnect() {
    this.reconnectAttempts++
    this.setStatus('reconnecting')

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      if (this.userId && this.token) {
        this.connect(this.userId, this.token).catch(() => {
          // Reconnection failed, will retry via onclose
        })
      }
    }, delay)
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send(WSMessageType.PING, { timestamp: Date.now() })
      }
    }, 30000) // Every 30 seconds
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private handleMessage(message: any) {
    const { type, payload } = message

    // Handle request responses
    if (payload?.requestId && this.pendingRequests.has(payload.requestId)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(payload.requestId)!
      clearTimeout(timeout)
      this.pendingRequests.delete(payload.requestId)

      if (type === WSMessageType.ERROR) {
        reject(new Error(payload.message))
      } else {
        resolve(payload)
      }
      return
    }

    // Handle regular messages
    const handlers = this.handlers.get(type)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload)
        } catch (error) {
          console.error(`Error in WebSocket handler for ${type}:`, error)
        }
      })
    }
  }

  send(type: WSMessageType, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'))
        return
      }

      const requestId = `req_${++this.requestId}_${Date.now()}`
      const message = { type, payload: { ...payload, requestId } }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Request timeout'))
      }, 10000)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })
      this.ws.send(JSON.stringify(message))
    })
  }

  // Convenience methods
  joinGame(gameId: string) {
    return this.send(WSMessageType.JOIN_GAME, { gameId })
  }

  leaveGame(gameId: string) {
    return this.send(WSMessageType.LEAVE_GAME, { gameId })
  }

  playCard(data: { cardId: string; targetIndex?: number; targetPlayerIndex?: number; choices?: Record<string, unknown> }) {
    return this.send(WSMessageType.PLAYER_ACTION, {
      action: { type: 'play_card', data }
    })
  }

  endTurn() {
    return this.send(WSMessageType.PLAYER_ACTION, {
      action: { type: 'end_turn', data: {} }
    })
  }

  usePotion(data: { potionIndex: number; targetIndex?: number }) {
    return this.send(WSMessageType.PLAYER_ACTION, {
      action: { type: 'use_potion', data }
    })
  }

  // Event handlers
  on(type: WSMessageType, handler: WSMessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }
    this.handlers.get(type)!.push(handler)

    return () => {
      const handlers = this.handlers.get(type)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index !== -1) handlers.splice(index, 1)
      }
    }
  }

  off(type: WSMessageType, handler: WSMessageHandler) {
    const handlers = this.handlers.get(type)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index !== -1) handlers.splice(index, 1)
    }
  }

  // Connection status
  getStatus() {
    return this.connectionStatus
  }

  onStatusChange(listener: (status: typeof this.connectionStatus) => void) {
    this.statusListeners.push(listener)
    return () => {
      const index = this.statusListeners.indexOf(listener)
      if (index !== -1) this.statusListeners.splice(index, 1)
    }
  }

  private setStatus(status: typeof this.connectionStatus) {
    this.connectionStatus = status
    this.statusListeners.forEach(listener => listener(status))
  }

  disconnect() {
    this.stopPingInterval()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.setStatus('disconnected')
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Singleton instance
export const wsService = new WebSocketService()

// React hook for WebSocket
import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../store/toastStore'

export function useWebSocket() {
  const { user } = useAuthStore()
  const { setGame, updateGame, setConnectionStatus, yourPlayerIndex, setYourPlayerIndex } = useGameStore()
  const { addToast } = useToastStore()
  const initialized = useRef(false)

  useEffect(() => {
    if (!user || initialized.current) return

    initialized.current = true

    const token = localStorage.getItem('accessToken')
    if (!token) return

    wsService.connect(user.id, token)
      .then(() => {
        console.log('WebSocket connected successfully')
      })
      .catch((error) => {
        console.error('WebSocket connection failed:', error)
        addToast({ type: 'error', title: 'Connection Failed', message: 'Failed to connect to game server' })
      })

    // Set up status listener
    const unsubscribeStatus = wsService.onStatusChange((status) => {
      setConnectionStatus(status)
    })

    // Set up message handlers
    const unsubscribeGameState = wsService.on(WSMessageType.GAME_STATE, (payload: { game: Game; yourPlayerIndex: number }) => {
      setGame(payload.game)
      setYourPlayerIndex(payload.yourPlayerIndex)
    })

    const unsubscribeGameUpdate = wsService.on(WSMessageType.GAME_UPDATE, (payload: { updates: Partial<Game>; playerIndex: number }) => {
      updateGame(payload.updates)
    })

    const unsubscribeGameEnd = wsService.on(WSMessageType.GAME_END, (payload: { winnerId: string | null; endReason: string; finalState: Game }) => {
      updateGame({ status: 'finished', winnerId: payload.winnerId, log: payload.finalState.log })
      addToast({
        type: payload.winnerId === user.id ? 'success' : 'error',
        title: payload.winnerId === user.id ? 'Victory!' : 'Defeat',
        message: payload.endReason
      })
    })

    const unsubscribePlayerConnected = wsService.on(WSMessageType.PLAYER_CONNECTED, (payload: { userId: string; playerIndex: number }) => {
      addToast({ type: 'info', title: 'Player Connected', message: `Player ${payload.playerIndex} joined` })
    })

    const unsubscribePlayerDisconnected = wsService.on(WSMessageType.PLAYER_DISCONNECTED, (payload: { userId: string }) => {
      addToast({ type: 'warning', title: 'Player Disconnected', message: 'A player has disconnected' })
    })

    const unsubscribeTurnChange = wsService.on(WSMessageType.TURN_CHANGE, (payload: { currentPlayerIndex: number; turnNumber: number; timeRemaining: number }) => {
      updateGame({ currentPlayerIndex: payload.currentPlayerIndex, turnNumber: payload.turnNumber, turnStartTime: Date.now() })
    })

    const unsubscribeNotification = wsService.on(WSMessageType.NOTIFICATION, (payload: Notification) => {
      addToast({ type: 'info', title: payload.title, message: payload.message })
    })

    const unsubscribeError = wsService.on(WSMessageType.ERROR, (payload: { code: string; message: string }) => {
      addToast({ type: 'error', title: 'Error', message: payload.message })
    })

    return () => {
      unsubscribeStatus()
      unsubscribeGameState()
      unsubscribeGameUpdate()
      unsubscribeGameEnd()
      unsubscribePlayerConnected()
      unsubscribePlayerDisconnected()
      unsubscribeTurnChange()
      unsubscribeNotification()
      unsubscribeError()
      wsService.disconnect()
      initialized.current = false
    }
  }, [user])

  // Return convenience methods
  return {
    joinGame: wsService.joinGame.bind(wsService),
    leaveGame: wsService.leaveGame.bind(wsService),
    playCard: wsService.playCard.bind(wsService),
    endTurn: wsService.endTurn.bind(wsService),
    usePotion: wsService.usePotion.bind(wsService),
    isConnected: wsService.isConnected.bind(wsService),
    getStatus: wsService.getStatus.bind(wsService),
  }
}