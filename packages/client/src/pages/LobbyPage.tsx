import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useGameStore } from '../../store/gameStore'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export function LobbyPage() {
  const { user } = useAuthStore()
  const { games, setGame, updateGame, yourPlayerIndex, setYourPlayerIndex, connectionStatus, canAct } = useGameStore()
  const navigate = useNavigate()

  // Fetch available games
  const { data: gamesList = [], isLoading, refetch } = useQuery({
    queryKey: ['games'],
    queryFn: async () => {
      const response = await fetch('/api/games', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch games')
      return response.json()
    },
    enabled: !!user,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (user) {
      refetch()
    }
  }, [user])

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Lobby</h1>

      {/* Connection Status */}
      <div className={`mb-6 p-4 rounded-lg ${connectionStatus === 'connected' ? 'bg-green-500/20 border-green-500/30' : connectionStatus === 'connecting' ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
        <p className="text-sm font-medium">
          {connectionStatus === 'connected' ? 'Connected to server' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {connectionStatus === 'connected' ? 'Ready to play' : 'Waiting for connection...'}
        </p>
      </div>

      {/* Available Games */}
      {isLoading && (
        <div className="mb-6 animate-pulse bg-card border-border rounded-lg p-4">
          <p className="text-muted-foreground">Loading games...</p>
        </div>
      )}

      {!isLoading && gamesList.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          <p className="text-lg">No active games found</p>
          <p className="text-sm mt-2">Create a new game or join the matchmaking queue</p>
        </div>
      )}

      <div className="space-y-4">
        {gamesList.map((game: any) => (
          <div
            key={game.id}
            className="card-game bg-card border border-border rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer"
            onClick={() => navigate(`/game/${game.id}`)}
            role="button"
            aria-label={`Join game ${game.id}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">
                  {game.metadata?.clubId ? `Club Game (${game.metadata.clubId})` : 'Unnamed Game'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Players: {game.players?.length || 0} / {game.maxPlayers || 4}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Floor: {game.floor || 0} | Act: {game.act || 1}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Turn: {game.turnNumber} | Phase: {game.turnPhase || 'upkeep'}
                </p>
              </div>
              <div className="text-right">
                <span className={clsx(
                  'text-sm font-medium',
                  game.status === 'active' ? 'text-green-400' : 'text-gray-400'
                )}>
                  {game.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 pt-8 border-t border-border">
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => navigate('/matchmaking')}
            className="flex-1 btn-primary"
          >
            Join Matchmaking Queue
          </button>
          <button
            onClick={() => navigate('/daily-run')}
            className="flex-1 btn-secondary"
          >
            Daily Run
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {yourPlayerIndex >= 0 ? `You are player ${yourPlayerIndex + 1}` : 'Not in a game yet'}
        </p>
      </div>
    </div>
  )
}