import React, { useState } from 'react';
import GameCard from '../components/GameCard';

export default function Games() {
  const [filter, setFilter] = useState('all');

  // Hardcoded games list for MVP/Level 2. In a real app, this might come from the backend database.
  const gamesList = [
    {
      id: 'tap-speed',
      title: 'Tap Speed',
      description: 'Test your reflexes! Tap as fast as you can in 10 seconds.',
      icon: '⚡',
      route: '/games/tap-speed',
      color: 'yellow',
      category: 'challenge',
      isComingSoon: false,
      hasMultiplayer: true
    },
    {
      id: 'memory-match',
      title: 'Memory Match',
      description: 'Find the matching pairs before time runs out.',
      icon: '🧠',
      route: '/games/memory',
      color: 'purple',
      category: 'challenge',
      isComingSoon: false,
      hasMultiplayer: true
    },
    {
      id: 'quiz',
      title: 'Quiz Master',
      description: 'Answer trivia questions to earn XP and level up.',
      icon: '🎯',
      route: '/games/quiz',
      color: 'cyan',
      category: 'chill',
      isComingSoon: false,
      hasMultiplayer: true
    },
    {
      id: 'reaction',
      title: 'Reaction Time',
      description: 'Click when the screen turns green. Be quick!',
      icon: '🚦',
      route: '/games/reaction',
      color: 'pink',
      category: 'challenge',
      isComingSoon: false,
      hasMultiplayer: true
    },
    {
      id: 'tic-tac-toe',
      title: 'Tic Tac Toe',
      description: 'Classic 1v1 action. Play against friends!',
      icon: '⚔️',
      route: '/games/tic-tac-toe',
      color: 'purple',
      category: 'battle',
      isComingSoon: false,
      hasMultiplayer: true
    },
    {
      id: 'party-mode',
      title: 'Party Mode',
      description: 'Multiplayer mayhem with up to 8 friends.',
      icon: '🎉',
      route: '/games/party',
      color: 'pink',
      category: 'party',
      isComingSoon: false,
      hasMultiplayer: false
    }
  ];

  const filteredGames = filter === 'all' 
    ? gamesList 
    : filter === 'multiplayer'
      ? gamesList.filter(game => game.hasMultiplayer)
      : gamesList.filter(game => game.category === filter);

  const tabs = [
    { id: 'all', label: 'All Games' },
    { id: 'multiplayer', label: '⚔️ Multiplayer' },
    { id: 'challenge', label: 'Challenge' },
    { id: 'chill', label: 'Chill' },
    { id: 'battle', label: 'Battle' },
    { id: 'party', label: 'Party' }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      
      <div className="mb-12">
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 mb-2">
          GAMES LIBRARY
        </h1>
        <p className="text-gray-400 text-lg">Browse and play our collection of mini-games</p>
      </div>

      <div className="glass-card p-6 border-purple-500/20 mb-8">
        <div className="flex flex-wrap gap-4 justify-center md:justify-start">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-6 py-2 rounded-full font-bold transition-all ${
                filter === tab.id
                  ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(176,38,255,0.5)]'
                  : 'bg-transparent text-gray-400 border border-gray-600 hover:text-white hover:border-purple-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredGames.length > 0 ? (
          filteredGames.map((game) => (
            <GameCard
              key={game.id}
              title={game.title}
              description={game.description}
              icon={game.icon}
              route={game.route}
              color={game.color}
              isComingSoon={game.isComingSoon}
              hasMultiplayer={game.hasMultiplayer}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-20">
            <p className="text-gray-400 text-xl">No games found in this category.</p>
          </div>
        )}
      </div>

    </div>
  );
}
