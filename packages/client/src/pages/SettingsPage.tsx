import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Input, Switch } from '../../components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Modal, ConfirmModal } from '../../components/ui/Modal'
import { useToastStore } from '../../store/toastStore'
import { Settings, Bell, Moon, Sun, Volume2, VolumeX, Shield, LogOut, User, Key, Mail, Zap } from 'lucide-react'

export function SettingsPage() {
  const { user, logout, updateSettings } = useAuthStore()
  const navigate = useNavigate()
  const { success, error } = useToastStore()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [settings, setSettings] = useState({
    theme: localStorage.getItem('theme') || 'dark',
    notifications: true,
    sound: true,
    animations: true,
    autoEndTurn: false,
  })

  const handleSaveSettings = async () => {
    try {
      await updateSettings(settings)
      localStorage.setItem('theme', settings.theme)
      success('Settings Saved', 'Your preferences have been saved!')
    } catch (err) {
      error('Failed to Save', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      error('Password Mismatch', 'New passwords do not match')
      return
    }
    // In a real app, you would call an API endpoint here
    // For now, we'll just show a success message
    setShowChangePassword(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    success('Password Changed', 'Your password has been changed!')
  }

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, you would call an API endpoint here
    setShowChangeEmail(false)
    setNewEmail('')
    success('Email Changed', 'Your email has been changed!')
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 min-h-screen p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Theme</h3>
                <p className="text-sm text-muted-foreground">Choose your color scheme</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={settings.theme === 'light' ? 'primary' : 'outline'}
                  onClick={() => setSettings({ ...settings, theme: 'light' })}
                  className="w-10 h-10 p-0"
                >
                  <Sun className="w-5 h-5" />
                </Button>
                <Button
                  variant={settings.theme === 'dark' ? 'primary' : 'outline'}
                  onClick={() => setSettings({ ...settings, theme: 'dark' })}
                  className="w-10 h-10 p-0"
                >
                  <Moon className="w-5 h-5" />
                </Button>
                <Button
                  variant={settings.theme === 'system' ? 'primary' : 'outline'}
                  onClick={() => setSettings({ ...settings, theme: 'system' })}
                  className="w-10 h-10 p-0"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Animations</h3>
                <p className="text-sm text-muted-foreground">Enable card and UI animations</p>
              </div>
              <Switch
                checked={settings.animations}
                onCheckedChange={(checked) => setSettings({ ...settings, animations: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Turn Notifications</h3>
                <p className="text-sm text-muted-foreground">Get notified when it's your turn</p>
              </div>
              <Switch
                checked={settings.notifications}
                onCheckedChange={(checked) => setSettings({ ...settings, notifications: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Game Invites</h3>
                <p className="text-sm text-muted-foreground">Receive notifications for game invites</p>
              </div>
              <Switch checked={true} onCheckedChange={() => {}} />
            </div>
          </CardContent>
        </Card>

        {/* Sound */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Sound
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Sound Effects</h3>
                <p className="text-sm text-muted-foreground">Enable game sound effects</p>
              </div>
              <Switch
                checked={settings.sound}
                onCheckedChange={(checked) => setSettings({ ...settings, sound: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Music</h3>
                <p className="text-sm text-muted-foreground">Enable background music</p>
              </div>
              <Switch checked={false} onCheckedChange={() => {}} />
            </div>
          </CardContent>
        </Card>

        {/* Gameplay */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Gameplay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Auto End Turn</h3>
                <p className="text-sm text-muted-foreground">Automatically end turn when no cards can be played</p>
              </div>
              <Switch
                checked={settings.autoEndTurn}
                onCheckedChange={(checked) => setSettings({ ...settings, autoEndTurn: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Confirm Card Play</h3>
                <p className="text-sm text-muted-foreground">Show confirmation before playing cards</p>
              </div>
              <Switch checked={false} onCheckedChange={() => {}} />
            </div>
          </CardContent>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Email</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Button variant="outline" onClick={() => setShowChangeEmail(true)}>
                Change
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Password</h3>
                <p className="text-sm text-muted-foreground">••••••••</p>
              </div>
              <Button variant="outline" onClick={() => setShowChangePassword(true)}>
                Change
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleSaveSettings} className="w-full">
              <Settings className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
            <Button variant="outline" onClick={() => setShowLogoutConfirm(true)} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </CardContent>
        </Card>

        {/* Change Password Modal */}
        <Modal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} title="Change Password" size="md">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="New Password"
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowChangePassword(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Change Password
              </Button>
            </div>
          </form>
        </Modal>

        {/* Change Email Modal */}
        <Modal isOpen={showChangeEmail} onClose={() => setShowChangeEmail(false)} title="Change Email" size="md">
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <Input
              label="New Email"
              type="email"
              placeholder="Enter new email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowChangeEmail(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Change Email
              </Button>
            </div>
          </form>
        </Modal>

        {/* Logout Confirm Modal */}
        <ConfirmModal
          isOpen={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={handleLogout}
          title="Logout"
          message="Are you sure you want to logout? You will need to sign in again to access your account."
          confirmLabel="Logout"
          variant="danger"
        />
      </div>
    </div>
  )
}