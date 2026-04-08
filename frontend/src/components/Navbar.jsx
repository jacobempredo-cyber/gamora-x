import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png.png';

export default function Navbar() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  if (!currentUser) return null;

  const isAdminPage = location.pathname === '/admin';
  const isAdminUser = userProfile?.isAdmin || userProfile?.role === 'admin';

  return (
    <nav className="sticky top-0 z-50 w-full px-6 py-3 flex flex-wrap justify-between items-center border-b border-white/5 bg-[#0d0221]/80 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-8">
        <Link to="/dashboard" className="flex items-center decoration-none">
          <img src={logo} alt="Gamora X" className="h-[70px] md:h-[90px] w-auto object-contain" />
        </Link>
        <div className="hidden md:flex gap-8">
          {!isAdminPage ? (
            <>
              <Link to="/games" className="relative group text-gray-300 hover:text-cyan-400 font-medium transition-colors py-1">
                GAMES
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-cyan-400 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link to="/multiplayer" className="relative group text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 font-bold transition-all py-1">
                MULTIPLAYER
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-purple-400 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link to="/leaderboard" className="relative group text-gray-300 hover:text-purple-400 font-medium transition-colors py-1">
                LEADERBOARD
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-purple-400 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link to="/social" className="relative group text-gray-300 hover:text-yellow-400 font-medium transition-colors py-1">
                SOCIAL
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-yellow-400 group-hover:w-full transition-all duration-300"></span>
              </Link>
              <Link to="/chat" className="relative group text-gray-300 hover:text-pink-400 font-medium transition-colors py-1">
                GLOBAL CHAT
                <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-pink-400 group-hover:w-full transition-all duration-300"></span>
              </Link>
              {isAdminUser && (
                <Link to="/admin" className="relative group px-3 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-500 hover:bg-red-500 hover:text-white font-black text-[10px] tracking-widest transition-all animate-pulse hover:animate-none">
                  SYSTEM ADMIN
                </Link>
              )}
            </>
          ) : (
            <Link to="/dashboard" className="relative group text-cyan-400 hover:text-white font-black text-xs tracking-widest transition-colors py-1 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              RETURN TO ARENA
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {currentUser && !userProfile && (
          <Link to="/profile" className="hidden sm:flex items-center gap-4 bg-gray-900/40 rounded-full px-4 py-2 border border-white/10 hover:border-cyan-500/50 transition-all cursor-pointer decoration-none animate-pulse">
            <div className="flex flex-col text-right">
              <span className="text-sm font-bold text-gray-400">{currentUser.displayName || currentUser.email.split('@')[0]}</span>
              <span className="text-[10px] text-cyan-500 uppercase tracking-tighter italic">Syncing Profile...</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center text-sm text-gray-600 font-bold">
               <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </Link>
        )}

        {userProfile && (
          <div className="flex items-center gap-3">
            <Link to="/profile" className="hidden sm:flex items-center gap-4 bg-gray-900/50 rounded-full px-4 py-2 border border-purple-500/30 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all cursor-pointer decoration-none group">
              <div className="flex flex-col text-right">
                <span className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-wide">{userProfile.username}</span>
                <span className="text-[10px] text-purple-400 font-mono tracking-widest">LVL {userProfile.level}</span>
              </div>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center font-bold text-white border-2 border-white/20 group-hover:border-cyan-400 transition-colors">
                {userProfile.avatar ? (
                  <img src={userProfile.avatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  userProfile.username?.charAt(0).toUpperCase()
                )}
              </div>
            </Link>
            
            <button 
              onClick={handleLogout}
              className="p-2.5 text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/30 rounded-xl transition-all hover:bg-red-500/10 group"
              title="Logout"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
