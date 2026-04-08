import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import GameCard from '../components/GameCard';
import API_BASE_URL from '../config';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  const { onlineCount } = useSocket();
  const [dailyTasks, setDailyTasks] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchTasks();
    }
    
    // Real-time games listener
    const q = query(collection(db, 'games'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedGames = [];
      snapshot.forEach(doc => {
        fetchedGames.push({ id: doc.id, ...doc.data() });
      });
      setGames(fetchedGames);
      setLoading(false);
    }, (error) => {
      console.error("Dashboard real-time sync failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const fetchTasks = async () => {
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${currentUser.uid}`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setDailyTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching tasks dashboard:', error);
    }
  };

  const completedCount = dailyTasks.filter(t => t.isCompleted).length;
  const claimedCount = dailyTasks.filter(t => t.isClaimed).length;

  // Filter games by categories
  const mainModes = games.filter(g => g.category === 'battle' || g.category === 'party');
  const miniGames = games.filter(g => g.category === 'arcade' || g.category === 'challenge' || g.category === 'chill');
  const socialModes = games.filter(g => g.category === 'social');
  const otherModes = games.filter(g => !['battle', 'party', 'arcade', 'challenge', 'chill', 'social'].includes(g.category));

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12">
      {/* Header section... */}
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
            <span className="text-[11px] text-green-400 font-black uppercase tracking-widest mt-0.5">{onlineCount || 0} PLAYERS LIVE</span>
          </div>
        </div>

        {/* User Stats Summary */}
        {userProfile && (
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto mt-6 md:mt-0">
             {/* LEVEL */}
             <div className="ultra-glass flex items-center gap-4 px-5 py-3 border border-purple-500/30">
                <div className="text-xl font-black text-white">{userProfile.level}</div>
                <div className="flex flex-col"><span className="text-[10px] text-purple-400 uppercase tracking-[0.2em]">Rank</span></div>
             </div>
             {/* SCORE */}
             <div className="ultra-glass flex items-center gap-4 px-5 py-3 border border-cyan-500/30">
                <div className="text-xl font-black text-white">{userProfile.score}</div>
                <div className="flex flex-col"><span className="text-[10px] text-cyan-400 uppercase tracking-[0.2em]">Score</span></div>
             </div>
             {/* COINS */}
             <div className="ultra-glass flex items-center gap-4 px-5 py-3 border border-yellow-500/30">
                <div className="text-xl font-black text-white">{userProfile.coins}</div>
                <div className="flex flex-col"><span className="text-[10px] text-yellow-400 uppercase tracking-[0.2em]">Coins</span></div>
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
                <div className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" style={{ width: `${(completedCount / 3) * 100}%` }} />
             </div>
             <div className="text-right"><div className="text-2xl font-black text-yellow-500">{completedCount}/3</div></div>
          </div>
        </div>
      </Link>

      {loading ? (
        <div className="py-20 flex justify-center"><div className="w-12 h-12 rounded-full border-t-2 border-purple-500 animate-spin"></div></div>
      ) : (
        <>
          {/* Main Game Modes */}
          <section>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="w-10 h-1 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"></span>
                GAME MODES
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {mainModes.map(game => (
                <GameCard key={game.id} {...game} />
              ))}
              {socialModes.map(game => (
                <GameCard key={game.id} {...game} />
              ))}
            </div>
          </section>

          {/* Mini Games Archive */}
          {miniGames.length > 0 && (
            <section>
                <h2 className="text-2xl font-bold mb-6 text-gray-500 flex items-center gap-3">
                <span className="w-8 h-1 bg-gray-700 rounded-full"></span>
                Mini-Game Library
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 opacity-80">
                {miniGames.map(game => (
                    <GameCard key={game.id} {...game} />
                ))}
                </div>
            </section>
          )}

          {/* Other/Experimental Games */}
          {otherModes.length > 0 && (
            <section>
                <h2 className="text-2xl font-bold mb-6 text-gray-700 flex items-center gap-3 italic">
                <span className="w-8 h-1 bg-gray-900 rounded-full"></span>
                Experimental & Other
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 opacity-60">
                {otherModes.map(game => (
                    <GameCard key={game.id} {...game} />
                ))}
                </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
