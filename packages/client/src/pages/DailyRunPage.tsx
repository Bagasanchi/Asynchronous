import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useToastStore } from '../../store/toastStore'
import { Loader2, Trophy, Clock, Zap, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

export function DailyRunPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { error } = useToastStore()

  const { data: dailyRun, isLoading } = useQuery({
    queryKey: ['dailyRuns', 'current'],
    queryFn: async () => {
      const response = await fetch('/api/daily-runs/current', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch daily run')
      return response.json()
    },
    enabled: !!user,
    refetchInterval: 60000,
  })

  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useQuery({
    queryKey: ['dailyRuns', 'leaderboard', dailyRun?.id],
    queryFn: async () => {
      if (!dailyRun?.id) return []
      const response = await fetch(`/api/daily-runs/${dailyRun.id}/leaderboard`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch leaderboard')
      return response.json()
    },
    enabled: !!user && !!dailyRun?.id,
  })

  const handleJoinRun = async () => {
    if (!dailyRun?.id) return
    try {
      const response = await fetch(`/api/daily-runs/${dailyRun.id}/join`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to join daily run')
      navigate(`/daily-run/${dailyRun.id}`)
    } catch (err) {
      error('Failed to Join', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleViewRun = async (runId: string) => {
    navigate(`/daily-run/${runId}`)
  }

  if (isLoading) {
    return (
      <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-800 rounded w-1/3" />
            <div className="bg-gray-800 rounded-lg p-6 h-96" />
          </div>
        </div>
      </div>
    )
  }

  if (!dailyRun) {
    return (
      <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Clock className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">No Daily Run Available</h1>
          <p className="text-muted-foreground">Check back tomorrow for a new challenge!</p>
        </div>
      </div>
    )
  }

  const isJoined = dailyRun.players?.some((p: any) => p.userId === user?.id)
  const timeLeft = dailyRun.endTime ? Math.max(0, new Date(dailyRun.endTime).getTime() - Date.now()) : 0
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60))
  const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Daily Run Header */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Zap className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{dailyRun.name}</h1>
                    <p className="text-sm text-muted-foreground">Daily Run #{dailyRun.runNumber}</p>
                  </div>
                </div>
                <p className="text-muted-foreground max-w-2xl">{dailyRun.description}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Time Remaining</p>
                <p className="text-2xl font-bold text-foreground font-mono">
                  {hoursLeft}h {minutesLeft}m
                </p>
              </div>
            </div>

            {/* Modifiers */}
            {dailyRun.modifiers && dailyRun.modifiers.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {dailyRun.modifiers.map((mod: string, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-800 border border-border rounded-full text-sm text-muted-foreground"
                  >
                    {mod}
                  </span>
                ))}
              </div>
            )}

            {/* Action Button */}
            <div className="mt-6">
              {isJoined ? (
                <Button
                  onClick={() => navigate(`/daily-run/${dailyRun.id}`)}
                  className="w-full"
                >
                  Continue Run
                </Button>
              ) : (
                <Button onClick={handleJoinRun} className="w-full" disabled={timeLeft <= 0}>
                  <Zap className="w-4 h-4 mr-2" />
                  Join Daily Run
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Leaderboard
              </CardTitle>
              {isLoadingLeaderboard && <Loader2 className="w-5 h-5 animate-spin" />}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingLeaderboard ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-12 bg-gray-800 rounded" />
                ))}
              </div>
            ) : leaderboard?.length > 0 ? (
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry: any, index: number) => (
                  <div
                    key={entry.userId}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-lg transition-colors',
                      entry.userId === user?.id ? 'bg-primary/10 border border-primary/30' : 'bg-gray-800/50 hover:bg-gray-800'
                    )}
                  >
                    <div className={clsx(
                      'w-8 h-8 flex items-center justify-center font-bold text-sm',
                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-muted-foreground'
                    )}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{entry.username}</p>
                      <p className="text-xs text-muted-foreground">{entry.floorReached}F • {entry.score} pts</p>
                    </div>
                    {entry.userId === user?.id && (
                      <span className="px-2 py-1 text-xs bg-primary/20 text-primary rounded">You</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No runs completed yet. Be the first!</p>
            )}
          </CardContent>
        </Card>

        {/* Past Runs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">Past runs history coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}