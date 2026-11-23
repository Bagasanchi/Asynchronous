import { clsx } from 'clsx'
import { useGameStore } from '../../store/gameStore'
import type { Player, Relic, Potion, Buff } from '../../types'
import { EnergyOrbs } from './GameCard'

interface PlayerAreaProps {
  player: Player
  isCurrentPlayer: boolean
  isYourTurn: boolean
  timeRemaining: number
  onEndTurn: () => void
  className?: string
}

export function PlayerArea({
  player,
  isCurrentPlayer,
  isYourTurn,
  timeRemaining,
  onEndTurn,
  className = '',
}: PlayerAreaProps) {
  const hpPercent = player.maxHealth > 0 ? (player.health / player.maxHealth) * 100 : 0
  const { animationsEnabled } = useGameStore()

  return (
    <div className={clsx('player-area relative', className)}>
      {/* Player Info Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* Avatar/Class Icon */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-xl font-bold">
            {player.userId.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <h3 className="text-lg font-bold text-foreground">
              {isCurrentPlayer ? 'You' : `Player ${player.seatIndex + 1}`}
            </h3>
            <p className="text-sm text-muted-foreground">
              {player.status === 'connected' ? '🟢 Online' : '🔴 Offline'}
            </p>
          </div>
        </div>

        {/* Turn Indicator */}
        {isCurrentPlayer && (
          <div className="turn-indicator animate-pulse">
            YOUR TURN
          </div>
        )}

        {/* Timer */}
        <div className={clsx(
          'text-right',
          timeRemaining < 5 && 'text-red-400 animate-pulse',
          timeRemaining < 15 && 'text-yellow-400'
        )}>
          <p className="text-sm text-muted-foreground">Time Remaining</p>
          <p className="text-xl font-bold text-foreground">
            {Math.ceil(timeRemaining)}m
          </p>
        </div>
      </div>

      {/* Health & Energy */}
      <div className="flex items-center gap-6 mb-4">
        {/* Health Bar */}
        <div className="flex-1 max-w-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground">HP</span>
            <span className="text-sm font-bold text-foreground">
              {player.health} / {player.maxHealth}
            </span>
          </div>
          <div className="hp-bar">
            <div
              className="hp-fill"
              style={{
                width: `${hpPercent}%`,
                backgroundColor: hpPercent > 50 ? '#ef4444' : hpPercent > 25 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>

        {/* Block */}
        {player.block && player.block > 0 && (
          <div className="flex items-center gap-2">
            <div className="block-bar w-24">
              <div className="block-fill" style={{ width: '100%' }} />
            </div>
            <span className="text-blue-400 font-bold">BLOCK: {player.block}</span>
          </div>
        )}

        {/* Energy */}
        <div className="flex items-center gap-2">
          <EnergyOrbs energy={player.energy} maxEnergy={player.maxEnergy} />
          <span className="text-sm text-muted-foreground">Energy</span>
        </div>
      </div>

      {/* Gold */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-yellow-400 text-xl">💰</span>
        <span className="text-lg font-bold text-yellow-300">{player.gold} Gold</span>
      </div>

      {/* Relics */}
      {(player.relics && player.relics.length > 0) && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏺</span>
            <span className="text-sm font-medium text-foreground">Relics</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {player.relics.map(relic => (
              <RelicIcon key={relic.id} relic={relic} />
            ))}
          </div>
        </div>
      )}

      {/* Potions */}
      {(player.potions && player.potions.length > 0) && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🧪</span>
            <span className="text-sm font-medium text-foreground">Potions</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {player.potions.map((potion, index) => (
              <PotionIcon
                key={`${potion.id}-${index}`}
                potion={potion}
                index={index}
              />
            ))}
          </div>
        </div>
      )}

      {/* Buffs/Debuffs */}
      {(player.buffs && player.buffs.length > 0) && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">✨</span>
            <span className="text-sm font-medium text-foreground">Effects</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {player.buffs.map(buff => (
              <BuffIcon key={buff.id} buff={buff} compact />
            ))}
          </div>
        </div>
      )}

      {/* Deck/Discard/Exhaust Counts */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground border-t border-border pt-3">
        <div className="flex items-center gap-1" title="Draw Pile">
          <span className="text-xl">📦</span>
          <span>{player.deck?.length || 0}</span>
        </div>
        <div className="flex items-center gap-1" title="Discard Pile">
          <span className="text-xl">🗑️</span>
          <span>{player.discardPile?.length || 0}</span>
        </div>
        <div className="flex items-center gap-1" title="Exhaust Pile">
          <span className="text-xl">🔥</span>
          <span>{player.exhaustPile?.length || 0}</span>
        </div>
      </div>

      {/* End Turn Button */}
      {isYourTurn && (
        <button
          onClick={onEndTurn}
          className="w-full mt-4 btn-primary text-lg py-3"
          disabled={!isYourTurn}
        >
          End Turn
        </button>
      )}
    </div>
  )
}

interface RelicIconProps {
  relic: Relic
  compact?: boolean
}

function RelicIcon({ relic, compact = false }: RelicIconProps) {
  const rarityColors = {
    common: 'border-gray-500',
    uncommon: 'border-green-500',
    rare: 'border-blue-500',
    legendary: 'border-yellow-400',
    mythic: 'border-purple-500',
  }

  return (
    <div
      className={clsx(
        'relative w-12 h-12 rounded-lg border-2 flex items-center justify-center overflow-hidden transition-all duration-200 hover:scale-110',
        rarityColors[relic.rarity] || rarityColors.common,
        compact && 'w-10 h-10'
      )}
      title={`${relic.name}: ${relic.description}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        <span className="text-2xl">{relic.icon || '🏺'}</span>
      </div>
      {relic.counter !== undefined && relic.counter > 0 && (
        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
          {relic.counter}
        </div>
      )}
      {relic.exhausted && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <span className="text-red-400 text-xs font-bold">✕</span>
        </div>
      )}
    </div>
  )
}

interface PotionIconProps {
  potion: Potion
  index: number
  compact?: boolean
}

function PotionIcon({ potion, index, compact = false }: PotionIconProps) {
  const rarityColors = {
    common: 'border-gray-500',
    uncommon: 'border-green-500',
    rare: 'border-blue-500',
  }

  const potionColors = {
    healing: 'bg-green-500/30',
    strength: 'bg-red-500/30',
    dexterity: 'bg-blue-500/30',
    focus: 'bg-purple-500/30',
    fire: 'bg-orange-500/30',
    ice: 'bg-cyan-500/30',
    poison: 'bg-green-500/30',
    block: 'bg-blue-500/30',
    energy: 'bg-yellow-500/30',
    draw: 'bg-purple-500/30',
  }

  return (
    <div
      className={clsx(
        'relative w-12 h-16 rounded-lg border-2 flex flex-col items-center justify-center overflow-hidden transition-all duration-200 hover:scale-110',
        rarityColors[potion.rarity] || rarityColors.common,
        compact && 'w-10 h-14'
      )}
      title={`${potion.name}: ${potion.description}`}
    >
      <div className={clsx(
        'absolute inset-0 flex items-center justify-center',
        potionColors[potion.type as keyof typeof potionColors] || potionColors.healing
      )}>
        <span className="text-2xl">{potion.icon || '🧪'}</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs font-bold px-1 py-0.5 text-center">
        {potion.name}
      </div>
    </div>
  )
}

interface BuffIconProps {
  buff: Buff
  compact?: boolean
}

function BuffIcon({ buff, compact = false }: BuffIconProps) {
  const buffData = {
    strength: { icon: '⚔️', color: 'red', name: 'Strength' },
    dexterity: { icon: '🛡️', color: 'green', name: 'Dexterity' },
    focus: { icon: '🎯', color: 'purple', name: 'Focus' },
    vulnerable: { icon: '💥', color: 'red', name: 'Vulnerable' },
    weak: { icon: '😵', color: 'blue', name: 'Weak' },
    frail: { icon: '🩸', color: 'orange', name: 'Frail' },
    poison: { icon: '☠️', color: 'green', name: 'Poison' },
    thorns: { icon: '🌵', color: 'yellow', name: 'Thorns' },
    regen: { icon: '💚', color: 'green', name: 'Regen' },
    metallicize: { icon: '🔩', color: 'blue', name: 'Metallicize' },
    plated: { icon: '🛡️', color: 'gray', name: 'Plated' },
    intangible: { icon: '👻', color: 'purple', name: 'Intangible' },
    artifact: { icon: '🏺', color: 'yellow', name: 'Artifact' },
    ritual: { icon: '🕯️', color: 'purple', name: 'Ritual' },
    combo: { icon: '🔗', color: 'pink', name: 'Combo' },
    mantle: { icon: '🧥', color: 'blue', name: 'Mantle' },
    after_image: { icon: '🌫️', color: 'gray', name: 'After Image' },
    flight: { icon: '🕊️', color: 'blue', name: 'Flight' },
    barricade: { icon: '🏰', color: 'gray', name: 'Barricade' },
    corruption: { icon: '💀', color: 'purple', name: 'Corruption' },
  } as Record<string, { icon: string; color: string; name: string }>

  const data = buffData[buff.type] || { icon: '✨', color: 'gray', name: buff.type }
  const colorClasses = {
    red: 'bg-red-500/20 border-red-500/30 text-red-300',
    green: 'bg-green-500/20 border-green-500/30 text-green-300',
    blue: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
    yellow: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
    orange: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
    purple: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
    pink: 'bg-pink-500/20 border-pink-500/30 text-pink-300',
    gray: 'bg-gray-500/20 border-gray-500/30 text-gray-300',
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-medium',
        colorClasses[data.color as keyof typeof colorClasses] || colorClasses.gray,
        !compact && 'px-3 py-1.5 text-sm'
      )}
      title={`${data.name}: ${buff.value}${buff.turns ? ` (${buff.turns} turns)` : ''}`}
    >
      <span aria-hidden="true">{data.icon}</span>
      <span>{buff.value}</span>
      {buff.turns && <span className="opacity-70">({buff.turns})</span>}
    </div>
  )
}

// Opponent player area (simplified)
export function OpponentArea({
  player,
  isCurrentPlayer,
  className = '',
}: {
  player: Player
  isCurrentPlayer: boolean
  className?: string
}) {
  const hpPercent = player.maxHealth > 0 ? (player.health / player.maxHealth) * 100 : 0

  return (
    <div className={clsx('player-area relative', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-xl font-bold">
            {player.userId.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">
              Player {player.seatIndex + 1}
            </h3>
            <p className="text-sm text-muted-foreground">
              {player.status === 'connected' ? '🟢 Online' : '🔴 Offline'}
            </p>
          </div>
        </div>

        {isCurrentPlayer && (
          <div className="turn-indicator">
            THEIR TURN
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 mb-4">
        <div className="flex-1 max-w-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground">HP</span>
            <span className="text-sm font-bold text-foreground">
              {player.health} / {player.maxHealth}
            </span>
          </div>
          <div className="hp-bar">
            <div
              className="hp-fill"
              style={{
                width: `${hpPercent}%`,
                backgroundColor: hpPercent > 50 ? '#ef4444' : hpPercent > 25 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>

        {player.block && player.block > 0 && (
          <div className="flex items-center gap-2">
            <div className="block-bar w-24">
              <div className="block-fill" style={{ width: '100%' }} />
            </div>
            <span className="text-blue-400 font-bold">BLOCK: {player.block}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <EnergyOrbs energy={player.energy} maxEnergy={player.maxEnergy} />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-yellow-400 text-xl">💰</span>
        <span className="text-lg font-bold text-yellow-300">{player.gold} Gold</span>
      </div>

      {(player.relics && player.relics.length > 0) && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {player.relics.map(relic => (
              <RelicIcon key={relic.id} relic={relic} compact />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 text-sm text-muted-foreground border-t border-border pt-3">
        <div className="flex items-center gap-1">
          <span className="text-xl">📦</span>
          <span>{player.deck?.length || 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xl">🗑️</span>
          <span>{player.discardPile?.length || 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xl">🔥</span>
          <span>{player.exhaustPile?.length || 0}</span>
        </div>
      </div>
    </div>
  )
}