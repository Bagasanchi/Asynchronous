import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { useToastStore } from '../../store/toastStore'
import { User, Trophy, Clock, Sword, Shield, Edit2, Camera, Check, X, Calendar, Mail } from 'lucide-react'
import { clsx } from 'clsx'

export function ProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { success, error } = useToastStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({ displayName: '', bio: '' })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/users/${user?.id}`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch profile')
      return response.json()
    },
    enabled: !!user,
  })

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['profile', 'stats', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/users/${user?.id}/stats`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    },
    enabled: !!user,
  })

  const { data: recentGames = [], isLoading: isLoadingGames } = useQuery({
    queryKey: ['profile', 'games', user?.id],
    queryFn: async () => {
      const response = await fetch(`/api/users/${user?.id}/games?limit=10`, { credentials: 'include' })
      if (!response.ok) throw new Error('Failed to fetch games')
      return response.json()
    },
    enabled: !!user,
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { displayName?: string; bio?: string }) => {
      return updateProfile(data.displayName || '', data.bio || '')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setIsEditing(false)
      success('Profile Updated', 'Your profile has been updated!')
    },
    onError: (err: Error) => error('Failed to Update', err.message),
  })

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      return uploadAvatar(file)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setAvatarFile(null)
      setAvatarPreview(null)
      success('Avatar Updated', 'Your avatar has been updated!')
    },
    onError: (err: Error) => error('Failed to Upload', err.message),
  })

  useEffect(() => {
    if (profile) {
      setEditData({ displayName: profile.displayName || '', bio: profile.bio || '' })
    }
  }, [profile])

  useEffect(() => {
    if (avatarFile) {
      const reader = new FileReader()
      reader.onload = () => setAvatarPreview(reader.result as string)
      reader.readAsDataURL(avatarFile)
    }
  }, [avatarFile])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditData({ displayName: profile?.displayName || '', bio: profile?.bio || '' })
  }

  const handleSaveEdit = () => {
    updateProfileMutation.mutate(editData)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAvatarFile(e.target.files[0])
    }
  }

  const handleAvatarUpload = () => {
    if (avatarFile) {
      uploadAvatarMutation.mutate(avatarFile)
    }
  }

  const handleAvatarRemove = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-bold text-primary-foreground">
                      {user?.displayName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                {isEditing && (
                  <div className="absolute -bottom-2 -right-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                )}
                {avatarFile && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    <button
                      onClick={handleAvatarUpload}
                      className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-white" />
                    </button>
                    <button
                      onClick={handleAvatarRemove}
                      className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {isEditing ? (
                    <Input
                      value={editData.displayName}
                      onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                      className="text-2xl font-bold"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-foreground">{profile?.displayName || user?.username}</h1>
                  )}
                  <span className="px-2 py-1 text-xs bg-gray-700 text-muted-foreground rounded">
                    Level {profile?.level || 1}
                  </span>
                </div>
                <p className="text-muted-foreground mb-3">@{user?.username}</p>

                {isEditing ? (
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    rows={3}
                    placeholder="Tell us about yourself..."
                  />
                ) : (
                  <p className="text-muted-foreground">{profile?.bio || 'No bio yet'}</p>
                )}

                <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {new Date(user?.createdAt || '').toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Edit Button */}
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button onClick={handleSaveEdit} loading={updateProfileMutation.isPending}>
                      <Check className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="secondary" onClick={handleCancelEdit}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleEdit}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats?.elo || 1200}</p>
              <p className="text-sm text-muted-foreground">ELO Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Sword className="w-8 h-8 mx-auto text-green-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats?.wins || 0}</p>
              <p className="text-sm text-muted-foreground">Wins</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Shield className="w-8 h-8 mx-auto text-red-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats?.losses || 0}</p>
              <p className="text-sm text-muted-foreground">Losses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 mx-auto text-blue-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats?.totalGames || 0}</p>
              <p className="text-sm text-muted-foreground">Total Games</p>
            </CardContent>
          </Card>
        </div>

        {/* More Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <User className="w-8 h-8 mx-auto text-purple-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats?.winRate || 0}%</p>
              <p className="text-sm text-muted-foreground">Win Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto text-orange-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats?.highestFloor || 0}</p>
              <p className="text-sm text-muted-foreground">Highest Floor</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
              <p className="text-2xl font-bold text-foreground">{stats?.tournamentWins || 0}</p>
              <p className="text-sm text-muted-foreground">Tournament Wins</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Games */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingGames ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse h-16 bg-gray-800 rounded" />
                ))}
              </div>
            ) : recentGames.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No recent games</p>
            ) : (
              <div className="space-y-3">
                {recentGames.map((game: any) => (
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
                        game.result === 'win' ? 'bg-green-500/20 text-green-400' :
                        game.result === 'loss' ? 'bg-red-500/20 text-red-400' : 'bg-gray-700 text-muted-foreground'
                      )}>
                        {game.result === 'win' ? 'Win' : game.result === 'loss' ? 'Loss' : game.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(game.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}