import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png.png';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleNavigation(user) {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists() && (userDoc.data().isAdmin || userDoc.data().role === 'admin')) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error("Navigation error:", err);
      navigate('/dashboard');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (password !== passwordConfirm) {
      return setError('Passwords do not match');
    }

    try {
      setError('');
      setLoading(true);
      await register(email, password, username);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to create an account. ' + err.message);
      console.error(err);
    }
    setLoading(false);
  }

  async function handleGoogleLogin() {
    try {
      setError('');
      setLoading(true);
      const userCredential = await loginWithGoogle();
      await handleNavigation(userCredential.user);
    } catch (err) {
      setError('Failed to sign in with Google. Check if popups are blocked.');
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden bg-[#0a0a0f]">
      {/* Subtle Tech Noise / Grid Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: 0.04
        }}
      ></div>
      <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSIjMmQzNzQ4IiBmaWxsLW9wYWNpdHk9IjAuMSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNMCAwaDQwdjQwSDBWMHptMjAgMjBWMGgyMHYyMEgyMHoiLz48L2c+PC9zdmc+')] opacity-20 z-0"></div>

      {/* Animated background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob animation-delay-2000"></div>

      <div className="relative p-10 max-w-md w-full z-10 mx-4 bg-[#0d1117]/60 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] login-card-glow">
        <div className="flex justify-center mb-6">
          <img src={logo} alt="Gamora X" className="h-[120px] md:h-[150px] w-auto object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:scale-105 transition-transform duration-300" />
        </div>
        <p className="text-center text-purple-400 font-mono tracking-[0.3em] uppercase text-xs mb-8 opacity-80">CREATE_IDENTITY</p>

        {error && <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded mb-6 text-center text-xs">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 ml-1">Username</label>
            <input
              type="text" required
              className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all duration-300 text-white font-mono text-sm"
              placeholder="PlayerOne"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 ml-1">Email_Address</label>
            <input
              type="email" required
              className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all duration-300 text-white font-mono text-sm"
              placeholder="player@gamora.x"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 ml-1">Password</label>
              <input
                type="password" required
                className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all duration-300 text-white font-mono tracking-widest text-sm"
                placeholder="••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1 ml-1">Confirm</label>
              <input
                type="password" required
                className="w-full px-4 py-3 bg-black/40 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all duration-300 text-white font-mono tracking-widest text-sm"
                placeholder="••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-4 bg-purple-600 text-white rounded-lg font-black tracking-widest uppercase hover:bg-purple-500 transition-all duration-300 shadow-[0_0_20px_rgba(147,51,234,0.4)] hover:shadow-[0_0_30px_rgba(147,51,234,0.7)] hover:scale-[1.02] active:scale-[0.98] mt-2"
          >
            INITIALIZE RECORD
          </button>
        </form>

        <div className="relative my-8">
           <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
           <div className="relative flex justify-center text-[10px]"><span className="bg-[#0d1117] px-4 text-gray-600 font-bold tracking-[0.3em] uppercase">OR_USE_Datalink</span></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3 px-4 bg-white/5 border border-white/10 text-white rounded-lg font-bold hover:bg-white/10 transition-all duration-300 flex items-center justify-center gap-3 text-sm group"
        >
          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign up with Google
        </button>

        <div className="mt-8 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium ml-1 transition-colors">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
