import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/authStore'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { LobbyPage } from './pages/LobbyPage'
import { GamePage } from './pages/GamePage'
import { MatchmakingPage } from './pages/MatchmakingPage'
import { DailyRunPage } from './pages/DailyRunPage'
import { ClubsPage } from './pages/ClubsPage'
import { ClubDetailPage } from './pages/ClubDetailPage'
import { TournamentsPage } from './pages/TournamentsPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { LeaderboardsPage } from './pages/LeaderboardsPage'
import { ReplaysPage } from './pages/ReplaysPage'
import { ReplayWatchPage } from './pages/ReplayWatchPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    )
  }

  return user ? <Navigate to="/lobby" replace /> : <>{children}</>
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="lobby" element={<LobbyPage />} />
              <Route path="game/:gameId" element={<GamePage />} />
              <Route path="matchmaking" element={<MatchmakingPage />} />
              <Route path="daily-run" element={<DailyRunPage />} />
              <Route path="clubs" element={<ClubsPage />} />
              <Route path="clubs/:clubId" element={<ClubDetailPage />} />
              <Route path="tournaments" element={<TournamentsPage />} />
              <Route path="leaderboards" element={<LeaderboardsPage />} />
              <Route path="replays" element={<ReplaysPage />} />
              <Route path="replays/:replayId" element={<ReplayWatchPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/lobby" replace />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  )
}