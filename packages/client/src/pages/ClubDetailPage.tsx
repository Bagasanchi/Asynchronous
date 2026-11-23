import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Modal, ConfirmModal } from '../../components/ui/Modal'
import { useToastStore } from '../../store/toastStore'
import { Users, Shield, Trophy, MessageSquare, Settings, X, Plus, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

export function ClubDetailPage() {
  const { clubId } = useParams<{ clubId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { success, error } = useToastStore()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [inviteUsername, setInviteUsername] = useState('')

  const { data: club, isLoading } = useQuery({
    queryKey: ['clubs', clubId],
    queryFn: async () => {
      const response = await fetch(`/api/clubs/${clubId}`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch club')
      return response.json()
    },
    enabled: !!clubId,
  })

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['clubs', clubId, 'members'],
    queryFn: async () => {
      const response = await fetch(`/api/clubs/${clubId}/members`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch members')
      return response.json()
    },
    enabled: !!clubId,
  })

  const { data: games = [], isLoading: isLoadingGames } = useQuery({
    queryKey: ['clubs', clubId, 'games'],
    queryFn: async () => {
      const response = await fetch(`/api/clubs/${clubId}/games`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch club games')
      return response.json()
    },
    enabled: !!clubId,
  })

  const inviteMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await fetch(`/api/clubs/${clubId}/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!response.ok) throw new Error('Failed to send invite')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs', clubId] })
      setShowInviteModal(false)
      setInviteUsername('')
      success('Invite Sent', 'Invitation has been sent!')
    },
    onError: (err: Error) => error('Failed to Invite', err.message),
  })

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/clubs/${clubId}/leave`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to leave club')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] })
      navigate('/clubs')
      success('Left Club', 'You have left the club')
    },
    onError: (err: Error) => error('Failed to Leave', err.message),
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    inviteMutation.mutate(inviteUsername)
  }

  const handleLeave = () => {
    leaveMutation.mutate()
    setShowLeaveConfirm(false)
  }

  if (isLoading) {
    return (
      <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
        <div className="max-w-4xl mx-auto animate-pulse space-y-6">
          <div className="h-8 bg-gray-800 rounded w-1/3" />
          <div className="bg-gray-800 rounded-lg p-6 h-96" />
        </div>
      </div>
    )
  }

  if (!club) {
    return (
      <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Club Not Found</h1>
          <p className="text-muted-foreground">This club doesn't exist or you don't have access</p>
          <Button onClick={() => navigate('/clubs')} className="mt-6">
            Back to Clubs
          </Button>
        </div>
      </div>
    )
  }

  const isMember = club.isMember || members.some((m: any) => m.userId === user?.id)
  const isOwner = club.ownerId === user?.id

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Club Header */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Shield className="w-8 h-8 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{club.name}</h1>
                  <p className="text-muted-foreground mt-1">{club.description}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {isOwner && (
                  <Button variant="outline" onClick={() => setShowInviteModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Invite
                  </Button>
                )}
                {isMember && (
                  <Button variant="outline" onClick={() => setShowLeaveConfirm(true)}>
                    <X className="w-4 h-4 mr-2" />
                    Leave
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Club Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-foreground">{members.length}</p>
              <p className="text-sm text-muted-foreground">Members</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-foreground">{club.elo || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">Club ELO</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-foreground">{games.length}</p>
              <p className="text-sm text-muted-foreground">Club Games</p>
            </CardContent>
          </Card>
        </div>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMembers ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-12 bg-gray-800 rounded" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No members yet</p>
            ) : (
              <div className="space-y-3">
                {members.map((member: any) => (
                  <div
                    key={member.userId}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-lg',
                      member.userId === user?.id ? 'bg-primary/10 border border-primary/30' : 'bg-gray-800/50'
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-bold">
                      {member.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{member.username}</p>
                      <p className="text-xs text-muted-foreground">ELO: {member.elo || 1200}</p>
                    </div>
                    {member.userId === club.ownerId && (
                      <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                        Owner
                      </span>
                    )}
                    {member.userId === user?.id && (
                      <span className="px-2 py-1 text-xs bg-primary/20 text-primary rounded">You</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Club Games */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Club Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingGames ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse h-16 bg-gray-800 rounded" />
                ))}
              </div>
            ) : games.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No club games yet</p>
            ) : (
              <div className="space-y-3">
                {games.slice(0, 5).map((game: any) => (
                  <div
                    key={game.id}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 cursor-pointer"
                    onClick={() => navigate(`/game/${game.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        Game #{game.id.slice(-6)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Floor {game.floor} • Turn {game.turnNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'text-xs font-medium px-2 py-1 rounded-full',
                        game.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-muted-foreground'
                      )}>
                        {game.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invite Modal */}
        <Modal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Player" size="md">
          <form onSubmit={handleInvite} className="space-y-4">
            <Input
              label="Username"
              placeholder="Enter username to invite"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={inviteMutation.isPending}>
                Send Invite
              </Button>
            </div>
          </form>
        </Modal>

        {/* Leave Confirm Modal */}
        <ConfirmModal
          isOpen={showLeaveConfirm}
          onClose={() => setShowLeaveConfirm(false)}
          onConfirm={handleLeave}
          title="Leave Club"
          message="Are you sure you want to leave this club? You will need to be re-invited to join again."
          confirmLabel="Leave"
          variant="danger"
        />
      </div>
    </div>
  )
}