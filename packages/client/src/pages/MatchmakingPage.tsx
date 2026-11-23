import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useToastStore } from '../../store/toastStore'
import { Loader2, X, Search, Users, Clock } from 'lucide-react'

export function MatchmakingPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { success, error } = useToastStore()
  const [isSearching, setIsSearching] = useState(false)
  const [queueTime, setQueueTime] = useState(0)
  const [foundMatch, setFoundMatch] = useState(false)

  const { data: queueInfo, refetch } = useQuery({
    queryKey: ['matchmaking', 'queue'],
    queryFn: async () => {
      const response = await fetch('/api/matchmaking/queue', {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch queue info')
      return response.json()
    },
    enabled: !!user && isSearching,
    refetchInterval: 3000,
  })

  useEffect(() => {
    if (isSearching) {
      const interval = setInterval(() => setQueueTime(t => t + 1), 1000)
      return () => clearInterval(interval)
    }
  }, [isSearching])

  const handleJoinQueue = async () => {
    try {
      const response = await fetch('/api/matchmaking/join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameMode: 'async' }),
      })
      if (!response.ok) throw new Error('Failed to join queue')
      setIsSearching(true)
      setQueueTime(0)
      success('Queue Joined', 'You are now in the matchmaking queue')
    } catch (err) {
      error('Failed to Join Queue', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleLeaveQueue = async () => {
    try {
      await fetch('/api/matchmaking/leave', {
        method: 'POST',
        credentials: 'include',
      })
      setIsSearching(false)
      setQueueTime(0)
      success('Left Queue', 'You have left the matchmaking queue')
    } catch (err) {
      error('Failed to Leave Queue', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleCancelMatch = () => {
    setFoundMatch(false)
  }

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Matchmaking</h1>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Queue Status */}
        <Card className={isSearching ? 'border-primary/30' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              {isSearching ? 'Searching for Match...' : 'Ready to Play'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSearching ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {Math.floor(queueTime / 60)}:{String(queueTime % 60).padStart(2, '0')}
                    </p>
                    <p className="text-sm text-muted-foreground">Time in queue</p>
                  </div>
                  <Clock className="w-8 h-8 text-muted-foreground" />
                </div>

                <div className="bg-gray-800 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Estimated wait: {queueInfo?.estimatedWait || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Players in queue: {queueInfo?.queueSize || 0}
                  </p>
                </div>

                <Button variant="secondary" onClick={handleLeaveQueue} className="w-full">
                  <X className="w-4 h-4 mr-2" />
                  Leave Queue
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground mb-4">
                  Find opponents for asynchronous card battles
                </p>
                <Button onClick={handleJoinQueue} className="w-full lg:w-auto">
                  <Search className="w-4 h-4 mr-2" />
                  Join Queue
                </Button>
              </div>
            )}

            {foundMatch && (
              <div className="animate-pulse bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <p className="text-green-400 font-bold text-lg">Match Found!</p>
                <p className="text-sm text-muted-foreground mt-1">Redirecting to game...</p>
                <Button variant="outline" onClick={handleCancelMatch} className="mt-3">
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Game Modes */}
        <Card>
          <CardHeader>
            <CardTitle>Available Game Modes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 bg-gray-800 rounded-lg border border-border">
              <h4 className="font-medium text-foreground">Asynchronous Standard</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Turn-based games played over days. 24 hours per turn.
              </p>
              <div className="flex gap-2 mt-3 text-xs text-muted-foreground">
                <span className="px-2 py-1 bg-primary/20 rounded">1v1</span>
                <span className="px-2 py-1 bg-primary/20 rounded">24h turns</span>
                <span className="px-2 py-1 bg-primary/20 rounded">ELO rated</span>
              </div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg border border-border opacity-50">
              <h4 className="font-medium text-foreground">Asynchronous Draft</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Draft a deck then battle asynchronously. Coming soon.
              </p>
              <div className="flex gap-2 mt-3 text-xs text-muted-foreground">
                <span className="px-2 py-1 bg-primary/20 rounded">1v1</span>
                <span className="px-2 py-1 bg-primary/20 rounded">Draft</span>
                <span className="px-2 py-1 bg-primary/20 rounded">Soon</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}