import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Modal, ConfirmModal } from '../../components/ui/Modal'
import { useToastStore } from '../../store/toastStore'
import { Users, Plus, Shield, Trophy, Search, Loader2, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

export function ClubsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { success, error } = useToastStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newClubName, setNewClubName] = useState('')
  const [newClubDescription, setNewClubDescription] = useState('')

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const response = await fetch('/api/clubs', { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch clubs')
      return response.json()
    },
    enabled: !!user,
  })

  const createClubMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const response = await fetch('/api/clubs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to create club')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      setShowCreateModal(false)
      setNewClubName('')
      setNewClubDescription('')
      success('Club Created', 'Your club has been created!')
    },
    onError: (err: Error) => error('Failed to Create Club', err.message),
  })

  const joinClubMutation = useMutation({
    mutationFn: async (clubId: string) => {
      const response = await fetch(`/api/clubs/${clubId}/join`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to join club')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      success('Joined Club', 'You have joined the club!')
    },
    onError: (err: Error) => error('Failed to Join Club', err.message),
  })

  const leaveClubMutation = useMutation({
    mutationFn: async (clubId: string) => {
      const response = await fetch(`/api/clubs/${clubId}/leave`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to leave club')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      success('Left Club', 'You have left the club')
    },
    onError: (err: Error) => error('Failed to Leave Club', err.message),
  })

  const handleCreateClub = (e: React.FormEvent) => {
    e.preventDefault()
    createClubMutation.mutate({ name: newClubName, description: newClubDescription })
  }

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">Clubs</h1>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Club
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse card-game bg-card border-border rounded-xl p-5 h-48" />
            ))}
          </div>
        ) : clubs.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">No Clubs Yet</h2>
            <p className="text-muted-foreground mb-6">Create the first club or join one!</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Club
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club: any) => (
              <Card
                key={club.id}
                className="card-game bg-card border border-border rounded-xl p-5 transition-all hover:shadow-lg"
              >
                <CardContent className="p-0">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <Shield className="w-6 h-6 text-primary-foreground" />
                      </div>
                      {club.isMember && (
                        <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
                          Member
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-foreground text-lg mb-1">{club.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{club.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {club.memberCount} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {club.elo || 'Unranked'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {club.isMember ? (
                        <Button
                          variant="secondary"
                          onClick={() => leaveClubMutation.mutate(club.id)}
                          disabled={leaveClubMutation.isPending}
                          className="flex-1"
                        >
                          Leave
                        </Button>
                      ) : (
                        <Button
                          onClick={() => joinClubMutation.mutate(club.id)}
                          disabled={joinClubMutation.isPending}
                          className="flex-1"
                        >
                          Join
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/clubs/${club.id}`)}
                        className="flex-1"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Club Modal */}
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Club" size="md">
          <form onSubmit={handleCreateClub} className="space-y-4">
            <Input
              label="Club Name"
              placeholder="Enter club name"
              value={newClubName}
              onChange={(e) => setNewClubName(e.target.value)}
              required
            />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Description</label>
              <textarea
                className="w-full px-3 py-2 bg-gray-900 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                rows={4}
                placeholder="Enter club description"
                value={newClubDescription}
                onChange={(e) => setNewClubDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createClubMutation.isPending}>
                Create Club
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  )
}