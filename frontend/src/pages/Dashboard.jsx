import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import GameCard from '../components/GameCard';
import API_BASE_URL from '../config';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { onlineCount } = useSocket();
  const [dailyTasks, setDailyTasks] = useState([]);

  useEffect(() => {
    if (currentUser) {
      fetchTasks();
    }
  }, [currentUser]);

  const fetchTasks = async () => {
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${currentUser.uid}`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (Array.isArray(data)) {
        setDailyTasks(data);
      } else {
        setDailyTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks for dashboard:', error);
      setDailyTasks([]);
    }
  };

  const completedCount = (Array.isArray(dailyTasks) ? dailyTasks : []).filter(t => t.isCompleted).length;
  const claimedCount = (Array.isArray(dailyTasks) ? dailyTasks : []).filter(t => t.isClaimed).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 mb-2">
            THE ARENA
          </h1>
          <p className="text-gray-400 text-lg">Choose your challenge</p>
          <div className="mt-2 flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full w-max">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></span>
            </span>
            <span className="text-[11px] text-green-400 font-black uppercase tracking-widest leading-none mt-0.5">{onlineCount || 0} PLAYERS LIVE</span>
          </div>
        </div>

        {/* User Stats Summary */}
        {userProfile && (
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto mt-6 md:mt-0">
            {/* LEVEL RING */}
            <div className="ultra-glass flex items-center gap-4 px-5 py-3 border border-purple-500/30 hover:border-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle cx="28" cy="28" r="24" stroke="rgba(168,85,247,0.2)" strokeWidth="4" fill="none" />
                  <circle cx="28" cy="28" r="24" stroke="#a855f7" strokeWidth="4" fill="none" strokeDasharray="150" strokeDashoffset={150 - (150 * 0.65)} strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                </svg>
                <div className="text-xl font-black text-white">{userProfile.level}</div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-purple-400 font-black uppercase tracking-[0.2em]">Rank Level</span>
                <span className="text-xs text-gray-400 font-mono">65% to next</span>
              </div>
            </div>

            {/* SCORE */}
            <div className="ultra-glass flex items-center gap-4 px-5 py-3 border border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 text-2xl drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] border border-cyan-500/20">
                ⭐
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.2em]">Total Score</span>
                <span className="text-xl font-black text-white font-mono">{userProfile.score}</span>
              </div>
            </div>

            {/* COINS */}
            <div className="ultra-glass flex items-center gap-4 px-5 py-3 border border-yellow-500/30 hover:border-yellow-400 hover:shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all">
              <div className="w-12 h-12 relative flex items-center justify-center">
                <div className="absolute inset-0 bg-yellow-500/20 rounded-full blur-md animate-pulse"></div>
                <div className="text-3xl relative z-10 animate-spin-reverse" style={{ animationDuration: '4s' }}>🪙</div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-yellow-400 font-black uppercase tracking-[0.2em]">Treasury</span>
                <span className="text-xl font-black text-white font-mono">{userProfile.coins}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Daily Challenges Widget */}
      <Link to="/challenges" className="block decoration-none">
        <div className="glass-card p-6 border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all flex flex-col md:flex-row justify-between items-center gap-6 group">
          <div className="flex items-center gap-5">
            <div className="text-4xl group-hover:scale-110 transition-transform">🔥</div>
            <div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Daily Challenges</h3>
              <p className="text-sm text-gray-400">Complete tasks to earn bonus Coins and XP</p>
            </div>
          </div>
          
          <div className="flex items-center gap-8 w-full md:w-auto">
             <div className="flex-1 md:w-48 bg-gray-900 h-2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)] transition-all duration-1000"
                  style={{ width: `${(completedCount / 3) * 100}%` }}
                />
             </div>
             <div className="text-right">
                <div className="text-2xl font-black text-yellow-500">{completedCount}/3</div>
                <div className="text-[10px] text-gray-500 uppercase font-bold">Completed</div>
             </div>
             {completedCount > claimedCount && (
               <div className="bg-green-500 text-gray-900 text-[10px] font-black px-2 py-1 rounded animate-bounce">
                 CLAIM READY!
               </div>
             )}
          </div>
        </div>
      </Link>

      {/* Main Game Modes */}
      <section>
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="w-10 h-1 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"></span>
            GAME MODES
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <GameCard
            title="Battle Mode (1v1)"
            description="Classic Tic Tac Toe. Compete for global ranking."
            icon="⚔️"
            route="/games/tic-tac-toe"
            color="purple"
          />
          <GameCard
            title="Party Mode"
            description="Multiplayer rooms! Invite up to 8 friends."
            icon="🎉"
            route="/games/party"
            color="pink"
          />
          <GameCard
            title="Daily Challenges"
            description="Complete tasks to earn bonus Coins and XP."
            icon="🔥"
            route="/challenges"
            color="yellow"
          />
           <GameCard
            title="Global Chat"
            description="Connect with players from around the world."
            icon="💬"
            route="/chat"
            color="cyan"
          />
        </div>
      </section>

      {/* Mini Games Archive */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-500 flex items-center gap-3">
          <span className="w-8 h-1 bg-gray-700 rounded-full"></span>
          Mini-Game Library
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 opacity-80">
          <GameCard
            title="Quiz Master"
            description="Test your knowledge!"
            icon="🎯"
            route="/games/quiz"
            color="cyan"
          />
          <GameCard
            title="Memory Match"
            description="Brain training."
            icon="🧠"
            route="/games/memory"
            color="purple"
          />
          <GameCard
            title="Reaction Time"
            description="Fast green reflexes."
            icon="🚦"
            route="/games/reaction"
            color="pink"
          />
          <GameCard
            title="Tap Speed"
            description="Rapid fire tapping."
            icon="⚡"
            route="/games/tap-speed"
            color="yellow"
          />
        </div>
      </section>
    </div>
  );
}
