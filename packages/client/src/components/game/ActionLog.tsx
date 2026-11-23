import { clsx } from 'clsx'
import type { LogEntry } from '../../types'
import { formatDistanceToNow } from 'date-fns'

interface ActionLogProps {
  entries: LogEntry[]
  maxEntries?: number
  className?: string
  autoScroll?: boolean
}

const actionIcons: Record<string, string> = {
  play_card: '🃏',
  end_turn: '⏭️',
  use_potion: '🧪',
  draw_card: '📦',
  gain_block: '🛡️',
  lose_block: '🛡️',
  deal_damage: '⚔️',
  take_damage: '💔',
  heal: '❤️',
  gain_energy: '⚡',
  lose_energy: '⚡',
  apply_buff: '✨',
  remove_buff: '✨',
  gain_gold: '💰',
  exhaust_card: '🔥',
  shuffle: '🔀',
  turn_start: '🌅',
  turn_end: '🌙',
  combat_start: '⚔️',
  combat_end: '🏁',
  victory: '🏆',
  defeat: '💀',
}

const typeColors: Record<string, string> = {
  normal: 'text-gray-300',
  important: 'text-yellow-300 font-medium',
  damage: 'text-red-400',
  heal: 'text-green-400',
  block: 'text-blue-400',
  draw: 'text-purple-400',
  gain: 'text-green-400',
  lose: 'text-red-400',
}

export function ActionLog({
  entries,
  maxEntries = 50,
  className = '',
  autoScroll = true,
}: ActionLogProps) {
  const logRef = useRef<HTMLDivElement>(null)
  const [showTimestamps, setShowTimestamps] = useState(false)

  // Auto-scroll to bottom when new entries added
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [entries.length, autoScroll])

  const visibleEntries = entries.slice(-maxEntries)

  if (visibleEntries.length === 0) {
    return (
      <div className={clsx('action-log', className)} role="log" aria-label="Action log">
        <p className="text-center text-muted-foreground py-8">No actions yet</p>
      </div>
    )
  }

  return (
    <div className={clsx('action-log relative', className)} role="log" aria-label="Action log">
      {/* Toggle timestamps */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={() => setShowTimestamps(!showTimestamps)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          aria-label={showTimestamps ? 'Hide timestamps' : 'Show timestamps'}
        >
          <span className="text-xs">🕐</span>
        </button>
      </div>

      <div ref={logRef} className="space-y-1">
        {visibleEntries.map((entry, index) => (
          <div
            key={entry.id || index}
            className={clsx(
              'log-entry flex items-start gap-2 p-2 rounded transition-colors',
              typeColors[entry.type] || typeColors.normal,
              entry.type === 'important' && 'bg-yellow-500/10',
              entry.type === 'damage' && 'bg-red-500/10',
              entry.type === 'heal' && 'bg-green-500/10',
              entry.type === 'block' && 'bg-blue-500/10',
            )}
          >
            {/* Turn indicator */}
            <span className="text-xs text-muted-foreground shrink-0 w-12 text-right pr-2">
              T{entry.turn}
            </span>

            {/* Player indicator */}
            <span className="text-xs text-muted-foreground shrink-0 w-8 text-center">
              P{entry.playerIndex + 1}
            </span>

            {/* Action icon */}
            <span className="text-base shrink-0" aria-hidden="true">
              {actionIcons[entry.action] || '📝'}
            </span>

            {/* Message */}
            <span className="flex-1 min-w-0 break-words">
              {entry.message}
            </span>

            {/* Timestamp */}
            {showTimestamps && (
              <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Scroll indicator */}
      {entries.length > maxEntries && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          Showing last {maxEntries} of {entries.length} entries
        </div>
      )}
    </div>
  )
}

import { useRef, useEffect, useState } from 'react'

// Compact version for sidebar
export function CompactActionLog({
  entries,
  maxEntries = 10,
  className = '',
}: ActionLogProps) {
  const visibleEntries = entries.slice(-maxEntries)

  return (
    <div className={clsx('space-y-1 max-h-64 overflow-y-auto', className)} role="log" aria-label="Recent actions">
      {visibleEntries.map((entry, index) => (
        <div
          key={entry.id || index}
          className={clsx(
            'text-xs p-1.5 rounded',
            typeColors[entry.type] || typeColors.normal
          )}
        >
          <span className="font-medium">T{entry.turn} P{entry.playerIndex + 1}:</span>
          <span className="ml-1">{entry.message}</span>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-center text-muted-foreground text-xs py-4">No actions yet</p>
      )}
    </div>
  )
}

// Battle log with more detail
export function BattleLog({
  entries,
  currentPlayerIndex,
  className = '',
}: ActionLogProps & { currentPlayerIndex: number }) {
  const combatEntries = entries.filter(e =>
    !['turn_start', 'turn_end'].includes(e.action)
  )

  return (
    <div className={clsx('action-log', className)} role="log" aria-label="Battle log">
      <div className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b border-border pb-2 mb-2">
        <h3 className="text-sm font-semibold text-foreground">Combat Log</h3>
      </div>
      <ActionLog entries={combatEntries} maxEntries={100} autoScroll={true} />
    </div>
  )
}