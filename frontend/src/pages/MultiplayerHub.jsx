import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';

const MULTIPLAYER_GAMES = [
  {
    id: 'tic-tac-toe',
    title: 'Tic Tac Toe',
    description: 'Classic 1v1 turn-based battle. Outsmart your opponent!',
    icon: '⚔️',
    route: '/games/tic-tac-toe',
    color: 'purple',
    gradient: 'from-purple-500 to-pink-500',
    borderColor: 'border-purple-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]',
    queueKey: 'ttt',
    battleType: 'Turn-Based',
  },
  {
    id: 'tap-speed',
    title: 'Tap Speed',
    description: 'Race to tap faster than your opponent in 10 seconds!',
    icon: '⚡',
    route: '/games/tap-speed',
    color: 'yellow',
    gradient: 'from-yellow-500 to-orange-500',
    borderColor: 'border-yellow-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(234,179,8,0.3)]',
    queueKey: 'tap',
    battleType: 'Speed Race',
  },
  {
    id: 'memory-match',
    title: 'Memory Battle',
    description: 'Same board, race to find the most pairs before your opponent!',
    icon: '🧠',
    route: '/games/memory',
    color: 'purple',
    gradient: 'from-violet-500 to-purple-600',
    borderColor: 'border-violet-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(139,92,246,0.3)]',
    queueKey: 'memory',
    battleType: 'Pair Race',
  },
  {
    id: 'quiz',
    title: 'Quiz Duel',
    description: 'Same questions, speed bonuses. Prove your knowledge!',
    icon: '🎯',
    route: '/games/quiz',
    color: 'cyan',
    gradient: 'from-cyan-500 to-blue-500',
    borderColor: 'border-cyan-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(6,182,212,0.3)]',
    queueKey: 'quiz',
    battleType: 'Speed + Knowledge',
  },
  {
    id: 'reaction',
    title: 'Reaction Duel',
    description: 'Best of 5 rounds. Server-timed for fairness. Fastest wins!',
    icon: '🚦',
    route: '/games/reaction',
    color: 'pink',
    gradient: 'from-pink-500 to-rose-500',
    borderColor: 'border-pink-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(236,72,153,0.3)]',
    queueKey: 'reaction',
    battleType: 'Best of 5',
  },
];

export default function MultiplayerHub() {
  const { socket, onlineCount } = useSocket();
  const [queueCounts, setQueueCounts] = useState({});

  useEffect(() => {
    if (!socket) return;
    socket.on('queue_counts', (counts) => {
      setQueueCounts(counts);
    });
    return () => socket.off('queue_counts');
  }, [socket]);

  const totalInQueue = Object.values(queueCounts).reduce((sum, c) => sum + c, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 mb-3 tracking-tight">
          MULTIPLAYER ARENA
        </h1>
        <p className="text-gray-400 text-xl mb-6">Challenge real players in real-time battles</p>

        <div className="flex justify-center gap-8">
          <div className="flex items-center gap-2 bg-gray-900/60 px-4 py-2 rounded-full border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-green-400 text-sm font-bold">{onlineCount} Online</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-900/60 px-4 py-2 rounded-full border border-purple-500/20">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
            <span className="text-purple-400 text-sm font-bold">{totalInQueue} In Queue</span>
          </div>
        </div>
      </div>

      {/* Multiplayer Info Banner */}
      <div className="glass-card p-6 border-purple-500/10 mb-10 bg-gradient-to-r from-purple-500/5 to-cyan-500/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-2xl shadow-lg">
              🏆
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">2x Rewards in Multiplayer</h3>
              <p className="text-gray-400 text-sm">Win battles to earn double XP, coins, and score. Rematch to keep going!</p>
            </div>
          </div>
          <Link
            to="/games/party"
            className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg font-bold hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] transition-all whitespace-nowrap"
          >
            🎉 Party Mode
          </Link>
        </div>
      </div>

      {/* Game Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MULTIPLAYER_GAMES.map((game) => {
          const queueCount = queueCounts[game.queueKey] || 0;
          return (
            <Link
              key={game.id}
              to={game.route}
              className={`glass-card p-6 ${game.borderColor} hover:${game.glowColor} transition-all group relative overflow-hidden`}
            >
              {/* Background glow effect */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-gradient-to-br ${game.gradient} opacity-5 group-hover:opacity-15 transition-opacity blur-3xl`}></div>

              <div className="relative z-10">
                {/* Header with icon and queue indicator */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${game.gradient} flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform`}>
                    {game.icon}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${game.gradient} text-white font-black uppercase tracking-wider`}>
                      {game.battleType}
                    </span>
                    {queueCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-bold animate-pulse">
                        {queueCount} waiting
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-all">
                  {game.title}
                </h3>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">{game.description}</p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">1v1 Battle</span>
                  <span className={`text-sm font-bold group-hover:translate-x-1 transition-transform text-gray-400 group-hover:text-white`}>
                    Play →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* How It Works Section */}
      <div className="mt-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-8">HOW MULTIPLAYER WORKS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="glass-card p-6 border-cyan-500/10">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-white font-bold mb-2">1. Find Match</h3>
            <p className="text-gray-400 text-sm">Click "1v1 Battle" in any game. We'll match you with a real player instantly.</p>
          </div>
          <div className="glass-card p-6 border-purple-500/10">
            <div className="text-4xl mb-4">⚔️</div>
            <h3 className="text-white font-bold mb-2">2. Battle</h3>
            <p className="text-gray-400 text-sm">Compete in real-time via Socket.io. Every move and action is synced live.</p>
          </div>
          <div className="glass-card p-6 border-pink-500/10">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-white font-bold mb-2">3. Win & Rematch</h3>
            <p className="text-gray-400 text-sm">Earn 2x rewards for wins. Hit Rematch to challenge the same opponent again!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
