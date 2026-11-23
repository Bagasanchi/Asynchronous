import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Modal, ConfirmModal } from '../../components/ui/Modal'
import { useToastStore } from '../../store/toastStore'
import { BookOpen, Play, Trash2, Search, Calendar, Clock, Users, ChevronRight, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

export function ReplaysPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { success, error } = useToastStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [replayToDelete, setReplayToDelete] = useState<string | null>(null)

  const { data: replays = [], isLoading } = useQuery({
    queryKey: ['replays', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/replays', { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch replays')
      return response.json()
    },
    enabled: !!user,
  })

  const deleteReplayMutation = useMutation({
    mutationFn: async (replayId: string) => {
      const response = await fetch(`/api/replays/${replayId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to delete replay')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replays'] })
      setShowDeleteConfirm(false)
      setReplayToDelete(null)
      success('Replay Deleted', 'The replay has been deleted')
    },
    onError: (err: Error) => error('Failed to Delete', err.message),
  })

  const handleDeleteReplay = (replayId: string) => {
    setReplayToDelete(replayId)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = () => {
    if (replayToDelete) {
      deleteReplayMutation.mutate(replayToDelete)
    }
  }

  const filteredReplays = replays.filter((replay: any) => {
    const query = searchQuery.toLowerCase()
    return (
      replay.id.toLowerCase().includes(query) ||
      replay.players?.some((p: any) => p.username.toLowerCase().includes(query)) ||
      replay.result?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">Replays</h1>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search replays..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse card-game bg-card border-border rounded-xl p-5 h-48" />
            ))}
          </div>
        ) : filteredReplays.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">No Replays Found</h2>
            <p className="text-muted-foreground">Your game replays will appear here</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredReplays.map((replay: any) => (
              <Card
                key={replay.id}
                className="card-game bg-card border border-border rounded-xl p-5 transition-all hover:shadow-lg"
              >
                <CardContent className="p-0">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-primary-foreground" />
                      </div>
                      <span className={clsx(
                        'text-xs font-medium px-2 py-1 rounded-full',
                        replay.result === 'win' ? 'bg-green-500/20 text-green-400' :
                        replay.result === 'loss' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-muted-foreground'
                      )}>
                        {replay.result === 'win' ? 'Win' : replay.result === 'loss' ? 'Loss' : replay.result}
                      </span>
                    </div>
                    <h3 className="font-bold text-foreground text-lg mb-1">
                      Game #{replay.id.slice(-6)}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {replay.players?.map((p: any) => p.username).join(' vs ')}
                    </p>
                    <div className="space-y-2 text-xs text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(replay.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>{replay.duration} turns</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3" />
                        <span>{replay.players?.length || 2} players</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => navigate(`/replays/${replay.id}`)}
                        className="flex-1"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Watch
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteReplay(replay.id)}
                        className="w-10 h-10 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirm Modal */}
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleConfirmDelete}
          title="Delete Replay"
          message="Are you sure you want to delete this replay? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
        />
      </div>
    </div>
  )
}