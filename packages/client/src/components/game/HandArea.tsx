import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { useGameStore } from '../../store/gameStore'
import { useWebSocket } from '../../services/websocket'
import type { Card } from '../../types'
import { GameCard } from './GameCard'

interface HandAreaProps {
  cards: Card[]
  playableCardIds: Set<string>
  exhaustedCardIds: Set<string>
  targetMode: boolean
  validTargets: string[]
  onCardClick: (card: Card) => void
  onCardHover: (card: Card | null) => void
  className?: string
}

export function HandArea({
  cards,
  playableCardIds,
  exhaustedCardIds,
  targetMode,
  validTargets,
  onCardClick,
  onCardHover,
  className = '',
}: HandAreaProps) {
  const {
    selectedCardId,
    hoveredCardId,
    selectCard,
    hoverCard,
    setTargetMode,
    animationsEnabled,
  } = useGameStore()
  const { playCard } = useWebSocket()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleCardClick = useCallback((card: Card) => {
    const isPlayable = playableCardIds.has(card.id)
    const isExhausted = exhaustedCardIds.has(card.id)

    if (isExhausted) return

    if (targetMode) {
      // In target mode, clicking a playable card confirms the target
      if (isPlayable && validTargets.length > 0) {
        // This would be handled by the parent component
        onCardClick(card)
      }
    } else {
      // Normal mode - select/deselect card
      if (selectedCardId === card.id) {
        selectCard(null)
        setTargetMode(false, [])
      } else if (isPlayable) {
        selectCard(card.id)
        // If card needs target, enter target mode
        const cardData = getCardTargetInfo(card)
        if (cardData.needsTarget) {
          setTargetMode(true, cardData.validTargets)
        }
      }
    }
  }, [selectedCardId, playableCardIds, exhaustedCardIds, targetMode, validTargets, onCardClick, selectCard, setTargetMode])

  const handleCardHover = useCallback((card: Card | null) => {
    hoverCard(card?.id || null)
    onCardHover(card)
  }, [hoverCard, onCardHover])

  const handlePlayCard = useCallback(async (card: Card, targetIndex?: number) => {
    try {
      await playCard({ cardId: card.id, targetIndex })
      selectCard(null)
      setTargetMode(false, [])
    } catch (error) {
      console.error('Failed to play card:', error)
    }
  }, [playCard, selectCard, setTargetMode])

  // Calculate card positions for fan layout
  const cardPositions = useMemo(() => {
    const count = cards.length
    if (count === 0) return []

    const maxFanAngle = 30 // degrees
    const cardWidth = 120 // approximate width in px
    const containerWidth = containerRef.current?.offsetWidth || count * cardWidth
    const availableWidth = containerWidth - cardWidth
    const spacing = count > 1 ? Math.min(availableWidth / (count - 1), cardWidth * 0.9) : 0

    return cards.map((_, index) => {
      const centerOffset = (index - (count - 1) / 2)
      const angle = centerOffset * (maxFanAngle / Math.max(1, count - 1)) * (Math.PI / 180)
      const x = centerOffset * spacing
      const y = -Math.abs(centerOffset) * 8 // slight curve

      return { x, y, angle, zIndex: count - Math.abs(centerOffset) }
    })
  }, [cards.length])

  // Determine which cards need targets
  function getCardTargetInfo(card: Card): { needsTarget: boolean; validTargets: string[] } {
    // This would ideally come from the game engine / card data
    // For now, we'll use heuristics based on card type and effects
    const needsTarget = card.targetType !== 'self' && card.targetType !== 'none'
    return { needsTarget, validTargets: [] }
  }

  if (cards.length === 0) {
    return (
      <div
        className={clsx('hand-area flex items-end justify-center min-h-[200px]', className)}
        role="region"
        aria-label="Your hand is empty"
      >
        <div className="text-center text-muted-foreground py-8">
          <p className="text-lg">No cards in hand</p>
          <p className="text-sm">Draw cards at the start of your turn</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={clsx('hand-area flex items-end justify-center gap-2 p-4 pb-8', className)}
      role="list"
      aria-label="Your hand"
      onMouseLeave={() => hoverCard(null)}
    >
      {cards.map((card, index) => {
        const position = cardPositions[index] || { x: 0, y: 0, angle: 0, zIndex: index }
        const isPlayable = playableCardIds.has(card.id)
        const isExhausted = exhaustedCardIds.has(card.id)
        const isSelected = selectedCardId === card.id
        const isHovered = hoveredCardId === card.id

        const transform = animationsEnabled
          ? `translateX(${position.x}px) translateY(${position.y}px) rotate(${position.angle * 180 / Math.PI}deg)`
          : `translateX(${position.x}px)`

        return (
          <div
            key={card.id}
            className="relative"
            style={{
              transform,
              zIndex: position.zIndex,
              transition: animationsEnabled ? 'transform 0.2s ease-out, z-index 0s' : 'none',
            }}
            role="listitem"
          >
            <GameCard
              card={card}
              position="hand"
              index={index}
              isPlayable={isPlayable && !targetMode}
              isSelected={isSelected && !targetMode}
              isHovered={isHovered && !targetMode}
              isExhausted={isExhausted}
              targetMode={targetMode && isPlayable}
              validTargets={validTargets}
              onClick={() => handleCardClick(card)}
              onMouseEnter={() => handleCardHover(card)}
              onMouseLeave={() => handleCardHover(null)}
              compact={cards.length > 8}
            />

            {/* Play indicator for playable cards */}
            {isPlayable && !targetMode && !isExhausted && !isSelected && !isHovered && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-green-400 text-xs font-bold animate-bounce">
                CLICK TO PLAY
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Draggable hand area for touch devices
export function DraggableHandArea({
  cards,
  playableCardIds,
  exhaustedCardIds,
  targetMode,
  validTargets,
  onCardClick,
  onCardHover,
  className = '',
}: HandAreaProps) {
  const {
    selectedCardId,
    selectCard,
    setTargetMode,
    animationsEnabled,
  } = useGameStore()
  const { playCard } = useWebSocket()
  const [dragState, setDragState] = useState<{ card: Card; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.PointerEvent, card: Card) => {
    if (exhaustedCardIds.has(card.id) || !playableCardIds.has(card.id)) return

    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    setDragState({
      card,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })

    selectCard(card.id)
    setTargetMode(true, [])
  }

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragState || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    setDragState({
      ...dragState,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const handleDragEnd = async (e: React.PointerEvent) => {
    if (!dragState) return

    const { card } = dragState
    setDragState(null)
    selectCard(null)
    setTargetMode(false, [])

    // Check if dropped in play area (bottom portion of screen)
    const playAreaThreshold = window.innerHeight * 0.6
    if (e.clientY > playAreaThreshold) {
      try {
        await playCard({ cardId: card.id })
      } catch (error) {
        console.error('Failed to play card:', error)
      }
    }
  }

  useEffect(() => {
    if (dragState) {
      window.addEventListener('pointermove', handleDragMove as any)
      window.addEventListener('pointerup', handleDragEnd as any)
      return () => {
        window.removeEventListener('pointermove', handleDragMove as any)
        window.removeEventListener('pointerup', handleDragEnd as any)
      }
    }
  }, [dragState])

  // Render similar to HandArea but with drag support
  // ... (similar implementation)

  return <HandArea {...{ cards, playableCardIds, exhaustedCardIds, targetMode, validTargets, onCardClick, onCardHover, className }} />
}