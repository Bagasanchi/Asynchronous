import { useMemo } from 'react'
import { clsx } from 'clsx'
import type { Card, CardType, CardRarity } from '../../types'
import { Card as CardData, getCardData } from '@async-card-game/shared/cards'

interface GameCardProps {
  card: Card
  position: 'hand' | 'deck' | 'discard' | 'exhaust' | 'play' | 'preview'
  index?: number
  isPlayable?: boolean
  isSelected?: boolean
  isHovered?: boolean
  isExhausted?: boolean
  targetMode?: boolean
  validTargets?: string[]
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  className?: string
  showCost?: boolean
  compact?: boolean
}

const rarityColors: Record<CardRarity, string> = {
  common: 'border-gray-500',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  legendary: 'border-yellow-400',
  mythic: 'border-purple-500',
}

const typeIcons: Record<CardType, string> = {
  attack: '⚔️',
  skill: '🛡️',
  power: '✨',
  curse: '💀',
  status: '📜',
}

const typeColors: Record<CardType, string> = {
  attack: 'bg-red-500/20 border-red-500/30',
  skill: 'bg-blue-500/20 border-blue-500/30',
  power: 'bg-purple-500/20 border-purple-500/30',
  curse: 'bg-gray-500/20 border-gray-500/30',
  status: 'bg-yellow-500/20 border-yellow-500/30',
}

export function GameCard({
  card,
  position,
  index = 0,
  isPlayable = false,
  isSelected = false,
  isHovered = false,
  isExhausted = false,
  targetMode = false,
  validTargets = [],
  onClick,
  onMouseEnter,
  onMouseLeave,
  className = '',
  showCost = true,
  compact = false,
}: GameCardProps) {
  const cardData = useMemo(() => getCardData(card.id), [card.id])
  const rarityClass = rarityColors[card.rarity] || rarityColors.common
  const typeColor = typeColors[card.type] || typeColors.attack
  const typeIcon = typeIcons[card.type] || ''

  const isInHand = position === 'hand'
  const isPreview = position === 'preview'
  const isPlayArea = position === 'play'

  const handleClick = () => {
    if (onClick && !isExhausted) {
      onClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const getTransform = () => {
    if (isPreview) return 'scale(1.2) translateY(-20px) z-50'
    if (isSelected && isInHand) return 'scale(1.1) translateY(-32px) z-40'
    if (isHovered && isInHand) return 'translateY(-16px) z-30'
    if (isPlayArea) return 'rotate(-2deg)'
    return 'translateY(0)'
  }

  const getZIndex = () => {
    if (isPreview) return 50
    if (isSelected && isInHand) return 40
    if (isHovered && isInHand) return 30
    return 10 + index
  }

  if (compact) {
    return (
      <div
        className={clsx(
          'card-frame-common relative cursor-pointer transition-all duration-200',
          rarityClass,
          isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-gray-900',
          isHovered && 'shadow-lg',
          isExhausted && 'opacity-50 grayscale',
          className
        )}
        style={{
          transform: getTransform(),
          zIndex: getZIndex(),
          width: '60px',
          height: '90px',
        }}
        onClick={handleClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${card.name} - ${card.description}`}
      >
        {showCost && (
          <div className="mana-cost text-xs">
            {card.cost}
          </div>
        )}
        <div className="p-1 h-full flex flex-col justify-between">
          <div className="text-xs font-bold text-white truncate">{card.name}</div>
          <div className="text-[10px] text-gray-300 truncate">{card.description}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'card-frame relative cursor-pointer transition-all duration-200',
        rarityClass,
        typeColor,
        isPlayable && 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-gray-900',
        isHovered && 'shadow-2xl',
        isExhausted && 'opacity-50 grayscale',
        targetMode && validTargets.length > 0 && 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-900',
        className
      )}
      style={{
        transform: getTransform(),
        zIndex: getZIndex(),
      }}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${card.name} - ${card.description}`}
      aria-pressed={isSelected}
    >
      {/* Cost */}
      {showCost && (
        <div className="mana-cost">
          {card.cost}
        </div>
      )}

      {/* Card Header - Name & Type */}
      <div className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-white font-bold text-base leading-tight flex-1 pr-2">
            {card.name}
          </h3>
          <span className="text-xl flex-shrink-0" aria-hidden="true">{typeIcon}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide',
            card.type === 'attack' && 'bg-red-500/30 text-red-300 border border-red-500/30',
            card.type === 'skill' && 'bg-blue-500/30 text-blue-300 border border-blue-500/30',
            card.type === 'power' && 'bg-purple-500/30 text-purple-300 border border-purple-500/30',
            card.type === 'curse' && 'bg-gray-500/30 text-gray-300 border border-gray-500/30',
            card.type === 'status' && 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/30',
          )}>
            {card.type}
          </span>
          <span className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide',
            rarityColors[card.rarity].replace('border-', 'bg-').replace('500', '500/30') + ' text-white border',
            card.rarity === 'common' && 'border-gray-500/30',
            card.rarity === 'uncommon' && 'border-green-500/30',
            card.rarity === 'rare' && 'border-blue-500/30',
            card.rarity === 'legendary' && 'border-yellow-400/30',
            card.rarity === 'mythic' && 'border-purple-500/30',
          )}>
            {card.rarity}
          </span>
        </div>
      </div>

      {/* Card Art Placeholder */}
      <div className="h-24 bg-gradient-to-br from-gray-800 to-gray-700 relative flex items-center justify-center overflow-hidden">
        <div className="text-6xl opacity-50">{typeIcon}</div>
        {card.tags?.includes('exhaust') && (
          <div className="absolute top-1 right-1 bg-red-500/80 text-white text-xs px-1.5 py-0.5 rounded">
            EXHAUST
          </div>
        )}
        {card.tags?.includes('zero_cost') && (
          <div className="absolute top-1 right-1 bg-green-500/80 text-white text-xs px-1.5 py-0.5 rounded">
            FREE
          </div>
        )}
      </div>

      {/* Card Description */}
      <div className="p-3 pt-2 text-sm text-gray-200 leading-relaxed min-h-[60px]">
        {card.description}
      </div>

      {/* Card Footer - Tags */}
      {card.tags && card.tags.length > 0 && (
        <div className="px-3 pb-3 pt-0 flex flex-wrap gap-1">
          {card.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-800/50 text-gray-400 text-xs rounded border border-gray-600/50"
            >
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
          {card.tags.length > 4 && (
            <span className="px-2 py-0.5 bg-gray-800/50 text-gray-500 text-xs rounded border border-gray-600/50">
              +{card.tags.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Exhausted indicator */}
      {isExhausted && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg z-10">
          <span className="text-red-400 font-bold text-lg">EXHAUSTED</span>
        </div>
      )}

      {/* Target mode indicator */}
      {targetMode && validTargets.length > 0 && !isExhausted && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
          SELECT TARGET
        </div>
      )}
    </div>
  )
}

// Card back for deck/discard piles
export function CardBack({
  count,
  label,
  className = '',
  compact = false,
}: {
  count: number
  label: string
  className?: string
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className={clsx('card-frame-common relative', className)} style={{ width: '50px', height: '75px' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
          <span className="text-2xl">🂠</span>
        </div>
        {count > 0 && (
          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={clsx('card-frame relative', className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center">
        <span className="text-6xl mb-2">🂠</span>
        <span className="text-white font-bold text-lg">{label}</span>
        {count > 0 && (
          <div className="mt-2 bg-primary text-primary-foreground text-xl font-bold w-10 h-10 rounded-full flex items-center justify-center">
            {count}
          </div>
        )}
      </div>
    </div>
  )
}

// Energy orb display
export function EnergyOrbs({
  energy,
  maxEnergy,
  className = '',
}: {
  energy: number
  maxEnergy: number
  className?: string
}) {
  return (
    <div className={clsx('flex items-center gap-1', className)} role="img" aria-label={`Energy: ${energy}/${maxEnergy}`}>
      {Array.from({ length: maxEnergy }, (_, i) => (
        <div
          key={i}
          className={clsx(
            'energy-orb relative transition-all duration-200',
            i < energy ? '' : 'opacity-20 bg-gray-600'
          )}
        >
          {i < energy && <span className="text-xs font-bold">{i + 1}</span>}
        </div>
      ))}
    </div>
  )
}