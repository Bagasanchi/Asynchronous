import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useGameStore } from '../../store/gameStore'
import { useWebSocket } from '../../services/websocket'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { wsService } from '../../services/websocket'
import { useToastStore } from '../../store/toastStore'
import { PlayerArea, OpponentArea, EnemyRow, HandArea, BattleLog } from '../../components/game'
import { clsx } from 'clsx'

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user } = useAuthStore()
  const {
    game,
    yourPlayerIndex,
    setYourPlayerIndex,
    selectedCardId,
    hoveredCardId,
    selectCard,
    hoverCard,
    setTargetMode,
    currentPlayer,
    isYourTurn,
    timeRemaining,
    canAct,
    animationsEnabled,
    endTurnOptimistic,
    playCardOptimistic,
    endTurn,
    usePotionOptimistic,
  } = useGameStore()
  const navigate = useNavigate()
  const { playCard } = useWebSocket()

  // Fetch game state from server
  const { data: gameData = null, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch game')
      return response.json()
    },
    enabled: !!gameId && !!user,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (gameId && user && !game) {
      // Initial fetch handled by gameData redirection in navigation
    }
  }, [gameId, user, game])

  // WebSocket handlers for real-time updates
  useEffect(() => {
    if (!gameId || !user) return

    const token = localStorage.getItem('accessToken')
    if (!token) return

    wsService.connect(user.id, token)
      .then(() => wsService.joinGame(gameId))
      .catch((error) => {
        console.error('WebSocket error:', error)
        useToastStore.getState().error('Connection Error', 'Failed to connect to game via WebSocket')
      })

    return () => {
      wsService.leaveGame(gameId)
      wsService.disconnect()
    }
  }, [gameId, user])

  // Update game state from WebSocket events
  useEffect(() => {
    if (!game || !yourPlayerIndex) return

    // Listen for game state updates from WebSocket
    const unsubscribe = wsService.on(1 /* WSMessageType.GAME_UPDATE */, (payload: any) => {
      const { updates, playerIndex } = payload
      if (updates) {
        updateGame(updates)
      }
    })

    const unsubscribeTurnChange = wsService.on(5 /* WSMessageType.TURN_CHANGE */, (payload: any) => {
      const { currentPlayerIndex, turnNumber, timeRemaining: time } = payload
      updateGame({
        currentPlayerIndex: currentPlayerIndex || yourPlayerIndex,
        turnNumber,
        turnStartTime: Date.now()
      })
    })

    const unsubscribeGameEnd = wsService.on(3 /* WSMessageType.GAME_END */, (payload: any) => {
      const { winnerId, endReason, finalState } = payload
      if (winnerId === user?.id) {
        useToastStore.getState().success('Victory!', endReason)
      } else {
        useToastStore.getState().error('Defeat', endReason)
      }
      updateGame({ status: 'finished', winnerId, log: finalState?.log })
      setTimeout(() => navigate('/lobby'), 3000)
    })

    return () => {
      unsubscribe()
      unsubscribeTurnChange()
      unsubscribeGameEnd()
    }
  }, [user, yourPlayerIndex, updateGame, navigate])

  // Handle card selection and actions
  const handleCardSelect = useCallback((card: any) => {
    if (!isYourTurn) {
      useToastStore.getState().warning('Not Your Turn', 'Wait for your turn to begin')
      return
    }

    // Select card and handle target mode
    selectCard(card)

    // Determine if card needs target
    const needsTarget = card.targetType !== 'self' && card.targetType !== 'none'

    if (needsTarget) {
      setTargetMode(true, ['enemy', 'self', 'random'])
    }
  }, [isYourTurn, selectCard, setTargetMode])

  const handlePlayCard = useCallback(async (card: any, targetIndex?: number) => {
    if (!isYourTurn) return

    // Optimistic update first
    playCardOptimistic(card.id, targetIndex)

    // Send to server
    try {
      await playCard({ cardId: card.id, targetIndex })
    } catch (error) {
      console.error('Failed to play card:', error)
      useToastStore.getState().error('Play Failed', 'Could not play card')
    }
  }, [isYourTurn, playCardOptimistic, playCard])

  const handleEndTurn = useCallback(() => {
    if (!isYourTurn) return

    endTurnOptimistic()
    endTurn()
  }, [isYourTurn, endTurnOptimistic, endTurn])

  const handleUsePotion = useCallback(async (potionIndex: number, targetIndex?: number) => {
    if (!isYourTurn) return

    usePotionOptimistic(potionIndex, targetIndex)

    try {
      await usePotion({ potionIndex, targetIndex })
    } catch (error) {
      console.error('Failed to use potion:', error)
      useToastStore.getState().error('Potion Failed', 'Could not use potion')
    }
  }, [usePotionOptimistic, usePotion])

  if (!game || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 p-6 lg:p-8">
        <div className="animate-pulse bg-card border-border rounded-lg p-8">
          <p className="text-muted-foreground text-lg">Loading game...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-foreground mb-4">
        {game.metadata?.clubId ? `Club Game: ${game.metadata.clubId}` : 'Game'} - {game.players?.[yourPlayerIndex]?.user?.username || 'Your Game'}
      </h1>

      {/* Connection Status */}
      <div className={`mb-4 p-3 rounded-lg ${connectionStatus === 'connected' ? 'bg-green-500/20 border-green-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
        <p className="text-sm font-medium">
          {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </p>
        <p className="text-xs text-muted-foreground">
          Real-time updates via WebSocket
        </p>
      </div>

      {/* Game Board Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">

        {/* Left: Player Area (You) */}
        {yourPlayerIndex >= 0 && (
          <div className="lg:col-span-2">
            <PlayerArea
              player={game.players?.[yourPlayerIndex] as any || { health: 20, maxHealth: 20, energy: 3, maxEnergy: 3, gold: 0, deck: [], discardPile: [], exhaustPile: [], relics: [], potions: [], buffs: [] } as any}
              isCurrentPlayer={game.currentPlayerIndex === yourPlayerIndex}
              isYourTurn={isYourTurn}
              timeRemaining={timeRemaining}
              onEndTurn={handleEndTurn}
            />
          </div>
        )}

        {/* Center: Game Board */}
        <div className="lg:col-span-1 flex flex-col lg:flex-row gap-4">
          {/* Enemies */}
          <div className="lg:w-64 space-y-4">
            <EnemyRow
              enemies={game.enemies || []}
              currentEnemyId={game.currentEnemy?.id}
              onEnemyClick={(enemy, index) => {
                if (isYourTurn && selectedCardId) {
                  // Target enemy
                  playCard({ cardId: selectedCardId, targetIndex: index })
                  selectCard(null)
                  setTargetMode(false, [])
                }
              }}
            />
          </div>

          {/* Center game area */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-2xl">
              {/* Hand Area */}
              <HandArea
                cards={game.players?.[yourPlayerIndex]?.hand || []}
                playableCardIds={new Set((game.players?.[yourPlayerIndex]?.playableCards || []).map((c: any) => c.id))}
                exhaustedCardIds={new Set((game.players?.[yourPlayerIndex]?.exhaustedCards || []).map((c: any) => c.id))}
                targetMode={setTargetMode}
                validTargets={[]}
                onCardClick={handleCardSelect}
                onCardHover={hoverCard}
                className="mb-4"
              />

              {/* Play Area */}
              {selectedCardId && (
                <div className="mt-4 p-4 bg-gray-800 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">Selected: {selectedCardId}</p>
                  <p className="font-medium">{game.players?.[yourPlayerIndex]?.hand?.find((c: any) => c.id === selectedCardId)?.name || 'Card'}</p>
                  <p className="text-xs text-gray-400">Energy: {game.players?.[yourPlayerIndex]?.energy || 3}</p>
                  <button
                    onClick={() => handlePlayCard(game.players?.[yourPlayerIndex]?.hand?.find((c: any) => c.id === selectedCardId)!, undefined)}
                    className="mt-2 btn-primary py-2"
                  >
                    Play Card
                  </button>
                </div>
              )}

              {/* Action Log */}
              <BattleLog entries={game.log || []} currentPlayerIndex={yourPlayerIndex} />
            </div>
          </div>
        </div>

        {/* Right: Opponent/Player Areas */}
        {yourPlayerIndex >= 0 ? (
          <div className="lg:col-span-2">
            {game.players?.slice(0, yourPlayerIndex).length > 0 ? (
              <OpponentArea
                player={game.players?.[0] as any || { health: 20, maxHealth: 20, energy: 3, maxEnergy: 3, gold: 0, deck: [], discardPile: [], exhaustPile: [], relics: [], potions: [], buffs: [] } as any}
                isCurrentPlayer={false}
                className="mb-4"
              />
            ) : null}
            {game.players?.slice(yourPlayerIndex + 1).length > 0 ? (
              <OpponentArea
                player={game.players?.[game.players.length - 1] as any || { health: 20, maxHealth: 20, energy: 3, maxEnergy: 3, gold: 0, deck: [], discardPile: [], exhaustPile: [], relics: [], potions: [], buffs: [] } as any}
                isCurrentPlayer={false}
                className=""
              />
            ) : null}
          </div>
        ) : null}

      </div>

      {/* Turn Controls */}
      {isYourTurn && (
        <div className="mt-6 p-4 bg-primary/10 border border-primary rounded-lg">
          <p className="text-lg font-bold text-primary">Your Turn</p>
          <p className="text-muted-foreground mt-1">You may play cards or end your turn</p>
          <button
            onClick={handleEndTurn}
            className="mt-4 btn-primary py-2 w-full"
            disabled={!canAct}
          >
            End Turn
          </button>
        </div>
      )}

      {/* Game Status */}
      {game.status === 'finished' && (
        <div className="mt-6 p-4 rounded-lg text-center">
          {game.winnerId === user.id ? (
            <div className="text-green-400">
              <p className="text-2xl font-bold">🏆 Victory!</p>
              <p className="text-muted-foreground">You won the game!</p>
            </div>
          ) : (
            <div className="text-red-400">
              <p className="text-2xl font-bold">💀 Defeat</p>
              <p className="text-muted-foreground">You were defeated...</p>
            </div>
          )}
          <button
            onClick={() => navigate('/lobby')}
            className="mt-4 btn-primary py-2"
          >
            Return to Lobby
          </button>
        </div>
      )}
    </div>
  )
}