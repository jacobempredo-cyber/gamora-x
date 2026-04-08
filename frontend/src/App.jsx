import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Games from './pages/Games';
import Chat from './pages/Chat';
import Social from './pages/Social';
import Challenges from './pages/Challenges';
import Admin from './pages/Admin';
import MultiplayerHub from './pages/MultiplayerHub';

// Games
import TapSpeed from './games/TapSpeed';
import MemoryCard from './games/MemoryCard';
import TicTacToe from './games/TicTacToe';
import Quiz from './games/Quiz';
import Reaction from './games/Reaction';
import PartyMode from './games/PartyMode';
import Snake from './games/Snake';
import TargetCombo from './games/TargetCombo';
import ColorReflex from './games/ColorReflex';
import PathEscape from './games/PathEscape';
import TapRhythm from './games/TapRhythm';
import DecisionRush from './games/DecisionRush';






import Navbar from './components/Navbar';
import NotificationManager from './components/NotificationManager';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <NotificationManager />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Landing />} />
              
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/leaderboard" 
                element={
                  <ProtectedRoute>
                    <Leaderboard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/games" 
                element={
                  <ProtectedRoute>
                    <Games />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/chat" 
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/social" 
                element={
                  <ProtectedRoute>
                    <Social />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/challenges" 
                element={
                  <ProtectedRoute>
                    <Challenges />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute requireAdmin={true}>
                    <Admin />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/multiplayer" 
                element={
                  <ProtectedRoute>
                    <MultiplayerHub />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/games/tap-speed" 
                element={
                  <ProtectedRoute>
                    <TapSpeed />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/games/memory" 
                element={
                  <ProtectedRoute>
                    <MemoryCard />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/games/tic-tac-toe" 
                element={
                  <ProtectedRoute>
                    <TicTacToe />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/games/quiz" 
                element={
                  <ProtectedRoute>
                    <Quiz />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/games/reaction" 
                element={
                  <ProtectedRoute>
                    <Reaction />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/games/party" 
                element={
                  <ProtectedRoute>
                    <PartyMode />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/games/snake" 
                element={
                  <ProtectedRoute>
                    <Snake />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/games/target-combo" 
                element={
                  <ProtectedRoute>
                    <TargetCombo />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/games/color-reflex" 
                element={
                  <ProtectedRoute>
                    <ColorReflex />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/games/path-escape" 
                element={
                  <ProtectedRoute>
                    <PathEscape />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/games/tap-rhythm" 
                element={
                  <ProtectedRoute>
                    <TapRhythm />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/games/decision-rush" 
                element={
                  <ProtectedRoute>
                    <DecisionRush />
                  </ProtectedRoute>
                } 
              />





              
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
