import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Select } from '../../components/ui/Input'
import { useToastStore } from '../../store/toastStore'
import { Trophy, Clock, Users, Flame, Sword, Shield, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

export function LeaderboardsPage() {
  const { user } = useAuthStore()
  const { error } = useToastStore()
  const [timeRange, setTimeRange] = useState<'all-time' | 'season' | 'month' | 'week'>('season')
  const [gameMode, setGameMode] = useState<'overall' | 'async' | 'daily' | 'tournament'>('overall')
  const [page, setPage] = useState(1)

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['leaderboards', timeRange, gameMode, page],
    queryFn: async () => {
      const response = await fetch(
        `/api/leaderboards?timeRange=${timeRange}&gameMode=${gameMode}&page=${page}&limit=50`,
        { credentials: 'include' }
      )
      if (!response.ok) throw new Error('Failed to fetch leaderboard')
      return response.json()
    },
    enabled: !!user,
    refetchInterval: 60000,
  })

  const { data: userRank, isLoading: isLoadingUserRank } = useQuery({
    queryKey: ['leaderboards', 'user-rank', timeRange, gameMode],
    queryFn: async () => {
      if (!user?.id) return null
      const response = await fetch(
        `/api/leaderboards/user/${user.id}?timeRange=${timeRange}&gameMode=${gameMode}`,
        { credentials: 'include' }
      )
      if (!response.ok) throw new Error('Failed to fetch user rank')
      return response.json()
    },
    enabled: !!user,
  })

  const handlePreviousPage = () => setPage(p => Math.max(1, p - 1))
  const handleNextPage = () => setPage(p => p + 1)

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return <span className="text-yellow-400 text-xl">🥇</span>
    if (rank === 2) return <span className="text-gray-400 text-xl">🥈</span>
    if (rank === 3) return <span className="text-amber-600 text-xl">🥉</span>
    return <span className="text-muted-foreground">#{rank}</span>
  }

  const timeRangeOptions = [
    { value: 'all-time', label: 'All Time' },
    { value: 'season', label: 'Current Season' },
    { value: 'month', label: 'This Month' },
    { value: 'week', label: 'This Week' },
  ]

  const gameModeOptions = [
    { value: 'overall', label: 'Overall' },
    { value: 'async', label: 'Async' },
    { value: 'daily', label: 'Daily Runs' },
    { value: 'tournament', label: 'Tournaments' },
  ]

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Leaderboards</h1>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as any)}
                  className="w-40"
                >
                  {timeRangeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Sword className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={gameMode}
                  onChange={(e) => setGameMode(e.target.value as any)}
                  className="w-40"
                >
                  {gameModeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Rank */}
        {userRank && !isLoadingUserRank && (
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{getMedalIcon(userRank.rank)}</div>
                  <div>
                    <p className="font-bold text-foreground">Your Rank</p>
                    <p className="text-sm text-muted-foreground">
                      {userRank.rank} • {userRank.score} points
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">{userRank.elo} ELO</p>
                  <p className="text-sm text-muted-foreground">
                    {userRank.wins}W {userRank.losses}L
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Top Players
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="animate-pulse h-14 bg-gray-800 rounded" />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No players on the leaderboard yet</p>
            ) : (
              <div className="space-y-2">
                {/* Header Row */}
                <div className="grid grid-cols-[40px_1fr_120px_120px_100px] gap-4 px-4 py-3 text-xs text-muted-foreground border-b border-border">
                  <span>Rank</span>
                  <span>Player</span>
                  <span>ELO</span>
                  <span>Score</span>
                  <span>Record</span>
                </div>

                {/* Player Rows */}
                {leaderboard.map((entry: any, index: number) => (
                  <div
                    key={entry.userId}
                    className={clsx(
                      'grid grid-cols-[40px_1fr_120px_120px_100px] gap-4 items-center px-4 py-3 rounded-lg transition-colors',
                      entry.userId === user?.id ? 'bg-primary/10 border border-primary/30' : 'bg-gray-800/50 hover:bg-gray-800'
                    )}
                  >
                    <div className="flex items-center justify-center">
                      {getMedalIcon(entry.rank)}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold">
                        {entry.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="font-medium text-foreground">{entry.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{entry.elo}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.eloChange >= 0 ? `+${entry.eloChange}` : entry.eloChange}
                      </span>
                    </div>
                    <span className="font-medium text-foreground">{entry.score}</span>
                    <span className="text-sm text-muted-foreground">
                      {entry.wins}W {entry.losses}L
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            onClick={handlePreviousPage}
            disabled={page === 1}
            className="w-10 h-10 p-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-foreground font-medium">Page {page}</span>
          <Button
            variant="outline"
            onClick={handleNextPage}
            disabled={leaderboard.length < 50}
            className="w-10 h-10 p-0"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Flame className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-foreground">{leaderboard[0]?.score || 0}</p>
              <p className="text-sm text-muted-foreground">Top Score</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Sword className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-foreground">{leaderboard[0]?.elo || 0}</p>
              <p className="text-sm text-muted-foreground">Highest ELO</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-foreground">{leaderboard.length}</p>
              <p className="text-sm text-muted-foreground">Ranked Players</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}