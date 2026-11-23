import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { useToastStore } from '../../store/toastStore'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, RotateCcw, Maximize, Minimize, Clock, Users, BookOpen } from 'lucide-react'
import { clsx } from 'clsx'

export function ReplayWatchPage() {
  const { replayId } = useParams<{ replayId: string }>()
  const navigate = useNavigate()
  const { error } = useToastStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTurn, setCurrentTurn] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const videoRef = useRef<HTMLDivElement>(null)

  const { data: replay, isLoading } = useQuery({
    queryKey: ['replays', replayId],
    queryFn: async () => {
      const response = await fetch(`/api/replays/${replayId}`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch replay')
      return response.json()
    },
    enabled: !!replayId,
  })

  const { data: replayData, isLoading: isLoadingData } = useQuery({
    queryKey: ['replays', replayId, 'data'],
    queryFn: async () => {
      const response = await fetch(`/api/replays/${replayId}/data`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch replay data')
      return response.json()
    },
    enabled: !!replayId,
  })

  useEffect(() => {
    if (!replay || !replayData) return

    const controlsTimeout = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)

    return () => clearTimeout(controlsTimeout)
  }, [isPlaying, replay, replayData])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying(!isPlaying)
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        setCurrentTurn(t => Math.max(0, t - 1))
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        setCurrentTurn(t => Math.min((replayData?.turns?.length || 1) - 1, t + 1))
      } else if (e.code === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, isFullscreen, replayData])

  const togglePlay = () => setIsPlaying(!isPlaying)
  const previousTurn = () => setCurrentTurn(t => Math.max(0, t - 1))
  const nextTurn = () => setCurrentTurn(t => Math.min((replayData?.turns?.length || 1) - 1, t + 1))
  const reset = () => setCurrentTurn(0)
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  if (isLoading || isLoadingData) {
    return (
      <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
        <div className="max-w-6xl mx-auto animate-pulse space-y-6">
          <div className="h-8 bg-gray-800 rounded w-1/3" />
          <div className="bg-gray-800 rounded-lg p-6 h-96" />
        </div>
      </div>
    )
  }

  if (!replay || !replayData) {
    return (
      <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Replay Not Found</h1>
          <p className="text-muted-foreground">This replay doesn't exist or you don't have access</p>
          <Button onClick={() => navigate('/replays')} className="mt-6">
            Back to Replays
          </Button>
        </div>
      </div>
    )
  }

  const currentTurnData = replayData.turns?.[currentTurn]
  const totalTurns = replayData.turns?.length || 1
  const progress = (currentTurn / (totalTurns - 1)) * 100

  return (
    <div className="bg-gray-950 min-h-screen p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Replay Info */}
        <Card className="mb-6 bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Replay: Game #{replay.id.slice(-6)}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {replay.players?.map((p: any) => p.username).join(' vs ')}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{replay.duration} turns</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{replay.players?.length || 2} players</span>
                </div>
                <span className={clsx(
                  'text-xs font-medium px-2 py-1 rounded-full',
                  replay.result === 'win' ? 'bg-green-500/20 text-green-400' :
                  replay.result === 'loss' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-muted-foreground'
                )}>
                  {replay.result === 'win' ? 'Win' : replay.result === 'loss' ? 'Loss' : replay.result}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Replay Player */}
        <div
          className={clsx(
            'relative bg-gray-900 rounded-xl overflow-hidden',
            isFullscreen ? 'fixed inset-0 z-50' : 'aspect-video'
          )}
          ref={videoRef}
          onClick={() => setShowControls(!showControls)}
        >
          {/* Game Board Display */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">Turn {currentTurn + 1} of {totalTurns}</p>
              {currentTurnData && (
                <div className="bg-gray-800 rounded-lg p-4 max-w-md">
                  <p className="text-sm text-muted-foreground mb-1">
                    Player {currentTurnData.playerIndex + 1}'s turn
                  </p>
                  <p className="text-foreground font-medium">
                    {currentTurnData.action}
                  </p>
                  {currentTurnData.card && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Card: {currentTurnData.card.name}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Controls Overlay */}
          {(showControls || !isPlaying) && (
            <div className="absolute inset-0 bg-black/50 flex flex-col justify-between p-4">
              {/* Top Controls */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => navigate('/replays')} className="text-white">
                  Back
                </Button>
                <Button variant="ghost" onClick={toggleFullscreen} className="text-white">
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </Button>
              </div>

              {/* Center Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button variant="ghost" onClick={reset} className="text-white">
                  <RotateCcw className="w-6 h-6" />
                </Button>
                <Button variant="ghost" onClick={previousTurn} className="text-white">
                  <SkipBack className="w-6 h-6" />
                </Button>
                <Button
                  onClick={togglePlay}
                  className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                </Button>
                <Button variant="ghost" onClick={nextTurn} className="text-white">
                  <SkipForward className="w-6 h-6" />
                </Button>
                <Button variant="ghost" onClick={() => setSpeed(s => (s % 3) + 1)} className="text-white">
                  {speed}x
                </Button>
              </div>

              {/* Bottom Controls */}
              <div className="flex items-center gap-4">
                <span className="text-white text-sm">
                  {formatTime(currentTurn * 5)}
                </span>
                <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-white text-sm">
                  {formatTime((totalTurns - 1) * 5)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Turn List */}
        <Card className="mt-6 bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Turn History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {replayData.turns?.map((turn: any, index: number) => (
                <div
                  key={index}
                  className={clsx(
                    'p-3 rounded-lg cursor-pointer transition-colors',
                    index === currentTurn ? 'bg-primary/20 border border-primary/30' : 'bg-gray-800/50 hover:bg-gray-800'
                  )}
                  onClick={() => setCurrentTurn(index)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">Turn {index + 1}</p>
                      <p className="text-sm text-muted-foreground">
                        Player {turn.playerIndex + 1}: {turn.action}
                      </p>
                    </div>
                    {turn.card && (
                      <span className="text-xs bg-gray-700 text-muted-foreground px-2 py-1 rounded">
                        {turn.card.name}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}