import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useToastStore } from '../../store/toastStore'
import { Trophy, Clock, Users, Calendar, ChevronRight, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

export function TournamentsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { error } = useToastStore()

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const response = await fetch('/api/tournaments', { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch tournaments')
      return response.json()
    },
    enabled: !!user,
    refetchInterval: 30000,
  })

  const handleJoinTournament = async (tournamentId: string) => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/join`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to join tournament')
      navigate(`/tournaments/${tournamentId}`)
    } catch (err) {
      error('Failed to Join', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const getTournamentStatus = (tournament: any) => {
    if (!tournament) return 'unknown'

    const now = new Date()
    const start = new Date(tournament.startTime)
    const end = new Date(tournament.endTime)

    if (now < start) return 'upcoming'
    if (now > end) return 'completed'
    return tournament.status || 'active'
  }

  const statusColors: Record<string, { bg: string; text: string }> = {
    upcoming: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    active: { bg: 'bg-green-500/20', text: 'text-green-400' },
    completed: { bg: 'bg-gray-700', text: 'text-muted-foreground' },
    unknown: { bg: 'bg-gray-700', text: 'text-muted-foreground' },
  }

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">Tournaments</h1>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse card-game bg-card border-border rounded-xl p-5 h-64" />
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-16">
            <Trophy className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">No Tournaments Yet</h2>
            <p className="text-muted-foreground">Check back later for upcoming tournaments!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((tournament: any) => {
              const status = getTournamentStatus(tournament)
              const color = statusColors[status] || statusColors.unknown

              return (
                <Card
                  key={tournament.id}
                  className="card-game bg-card border border-border rounded-xl p-5 transition-all hover:shadow-lg"
                >
                  <CardContent className="p-0">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                          <Trophy className="w-6 h-6 text-primary-foreground" />
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${color.bg} ${color.text}`}>
                          {status.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="font-bold text-foreground text-lg mb-1">{tournament.name}</h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{tournament.description}</p>

                      <div className="space-y-2 text-xs text-muted-foreground mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(tournament.startTime).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-3 h-3" />
                          <span>{tournament.players?.length || 0} / {tournament.maxPlayers} players</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>{tournament.duration} days</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {status === 'upcoming' && (
                          <Button
                            onClick={() => handleJoinTournament(tournament.id)}
                            className="flex-1"
                          >
                            Join
                          </Button>
                        )}
                        {status === 'active' && tournament.isJoined && (
                          <Button
                            onClick={() => navigate(`/tournaments/${tournament.id}`)}
                            className="flex-1"
                          >
                            View
                          </Button>
                        )}
                        {status === 'active' && !tournament.isJoined && (
                          <Button
                            onClick={() => handleJoinTournament(tournament.id)}
                            className="flex-1"
                          >
                            Join
                          </Button>
                        )}
                        {status === 'completed' && (
                          <Button
                            variant="outline"
                            onClick={() => navigate(`/tournaments/${tournament.id}`)}
                            className="flex-1"
                          >
                            Results
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}