import { clsx } from 'clsx'
import type { Enemy, Buff } from '../../types'
import { getEnemyData } from '@async-card-game/shared/cards'

interface EnemyCardProps {
  enemy: Enemy
  position: number
  isTargeted?: boolean
  isHovered?: boolean
  isCurrentEnemy?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  className?: string
  compact?: boolean
}

const intentIcons: Record<string, string> = {
  attack: '⚔️',
  defend: '🛡️',
  buff: '⬆️',
  debuff: '⬇️',
  heal: '❤️',
  escape: '🏃',
  special: '✨',
}

const intentColors: Record<string, string> = {
  attack: 'bg-red-500/20 border-red-500/30 text-red-300',
  defend: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  buff: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
  debuff: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
  heal: 'bg-green-500/20 border-green-500/30 text-green-300',
  escape: 'bg-gray-500/20 border-gray-500/30 text-gray-300',
  special: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300',
}

export function EnemyCard({
  enemy,
  position,
  isTargeted = false,
  isHovered = false,
  isCurrentEnemy = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className = '',
  compact = false,
}: EnemyCardProps) {
  const enemyData = getEnemyData(enemy.id)
  const hpPercent = enemy.maxHealth > 0 ? (enemy.health / enemy.maxHealth) * 100 : 0
  const intent = enemy.intent || 'unknown'
  const intentDisplay = enemy.intentDisplay || '???'
  const intentIcon = intentIcons[intent] || '❓'
  const intentColor = intentColors[intent] || intentColors.special

  const handleClick = () => {
    if (onClick && enemy.health > 0) {
      onClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  if (compact) {
    return (
      <div
        className={clsx(
          'relative bg-gray-800 border-2 rounded-lg overflow-hidden transition-all duration-200',
          isTargeted && 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900',
          isHovered && 'shadow-lg scale-105',
          enemy.health <= 0 && 'opacity-50 grayscale',
          className
        )}
        style={{ width: '80px', height: '80px' }}
        onClick={handleClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`${enemyData?.name || enemy.id} - HP: ${enemy.health}/${enemy.maxHealth}`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center p-2">
          <span className="text-3xl">{enemyData?.icon || '👹'}</span>
          <span className="text-xs font-bold text-white text-center">{enemyData?.name || enemy.id}</span>
        </div>
        {/* HP Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-700">
          <div
            className="hp-fill h-full transition-all duration-300"
            style={{
              width: `${hpPercent}%`,
              backgroundColor: hpPercent > 50 ? '#ef4444' : hpPercent > 25 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-black/50 px-1 rounded-t">
          {enemy.health}/{enemy.maxHealth}
        </div>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'relative bg-card border-2 rounded-xl overflow-hidden transition-all duration-200',
        isCurrentEnemy && 'border-primary shadow-lg shadow-primary/20',
        isTargeted && 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900',
        isHovered && 'shadow-xl scale-[1.02]',
        enemy.health <= 0 && 'opacity-50 grayscale',
        className
      )}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${enemyData?.name || enemy.id} - HP: ${enemy.health}/${enemy.maxHealth}`}
    >
      {/* Enemy Header */}
      <div className="p-4 pb-2 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{enemyData?.icon || '👹'}</span>
            <div>
              <h3 className="text-xl font-bold text-foreground">{enemyData?.name || enemy.id}</h3>
              <p className="text-sm text-muted-foreground">{enemyData?.description || 'A hostile creature'}</p>
            </div>
          </div>

          {/* HP Display */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground">{enemy.health}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-lg text-muted-foreground">{enemy.maxHealth}</span>
            </div>
            <div className="hp-bar w-32">
              <div
                className="hp-fill"
                style={{
                  width: `${hpPercent}%`,
                  backgroundColor: hpPercent > 50 ? '#ef4444' : hpPercent > 25 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Intent Display */}
      <div className="p-4">
        <div className={clsx('flex items-center gap-3 p-3 rounded-lg border', intentColor)}>
          <span className="text-2xl" aria-hidden="true">{intentIcon}</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Intent: <span className="font-bold capitalize">{intent}</span></p>
            <p className="text-sm text-muted-foreground">{intentDisplay}</p>
          </div>
        </div>
      </div>

      {/* Buffs/Debuffs */}
      {(enemy.buffs && enemy.buffs.length > 0) || (enemy.debuffs && enemy.debuffs.length > 0) ? (
        <div className="px-4 pb-4 flex flex-wrap gap-1">
          {enemy.buffs?.map(buff => (
            <BuffIcon key={buff.id} buff={buff} isBuff={true} compact />
          ))}
          {enemy.debuffs?.map(debuff => (
            <BuffIcon key={debuff.id} buff={debuff} isBuff={false} compact />
          ))}
        </div>
      ) : null}

      {/* Block */}
      {enemy.block && enemy.block > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="block-bar flex-1 max-w-xs">
              <div className="block-fill" style={{ width: '100%' }} />
            </div>
            <span className="text-blue-400 font-bold text-lg">BLOCK: {enemy.block}</span>
          </div>
        </div>
      )}

      {/* Strength/Dexterity indicators */}
      {(enemy.strength && enemy.strength > 0) || (enemy.dexterity && enemy.dexterity > 0) ? (
        <div className="px-4 pb-4 flex gap-4">
          {enemy.strength && enemy.strength > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-lg">
              <span className="text-red-400">⚔️</span>
              <span className="text-red-300 font-bold">STR {enemy.strength}</span>
            </div>
          )}
          {enemy.dexterity && enemy.dexterity > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-lg">
              <span className="text-green-400">🛡️</span>
              <span className="text-green-300 font-bold">DEX {enemy.dexterity}</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Dead indicator */}
      {enemy.health <= 0 && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
          <span className="text-red-400 font-bold text-3xl animate-pulse">DEFEATED</span>
        </div>
      )}
    </div>
  )
}

interface BuffIconProps {
  buff: Buff
  isBuff: boolean
  compact?: boolean
}

function BuffIcon({ buff, isBuff, compact = false }: BuffIconProps) {
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

// Multiple enemies layout
export function EnemyRow({
  enemies,
  currentEnemyId,
  onEnemyClick,
  onEnemyHover,
  onEnemyLeave,
  compact = false,
}: {
  enemies: Enemy[]
  currentEnemyId?: string
  onEnemyClick?: (enemy: Enemy, index: number) => void
  onEnemyHover?: (enemy: Enemy, index: number) => void
  onEnemyLeave?: () => void
  compact?: boolean
}) {
  return (
    <div className="flex gap-4 justify-center flex-wrap">
      {enemies.map((enemy, index) => (
        <EnemyCard
          key={enemy.id}
          enemy={enemy}
          position={index}
          isCurrentEnemy={enemy.id === currentEnemyId}
          isTargeted={false} // Will be set by parent
          onClick={() => onEnemyClick?.(enemy, index)}
          onMouseEnter={() => onEnemyHover?.(enemy, index)}
          onMouseLeave={onEnemyLeave}
          compact={compact}
        />
      ))}
    </div>
  )
}