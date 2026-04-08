import React, { useState, useEffect } from 'react';
import GameCard from '../components/GameCard';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function Games() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const q = query(collection(db, 'games'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedGames = [];
      snapshot.forEach(doc => {
        fetchedGames.push({ id: doc.id, ...doc.data() });
      });
      setGames(fetchedGames);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Dynamically generate tabs based on categories present in the database
  const categories = ['all', ...new Set(games.map(g => g.category).filter(Boolean))];
  
  const filteredGames = filter === 'all' 
    ? games 
    : filter === 'multiplayer'
      ? games.filter(game => game.hasMultiplayer)
      : games.filter(game => game.category === filter);

  const getTabLabel = (cat) => {
    switch(cat) {
        case 'all': return 'All Games';
        case 'multiplayer': return '⚔️ Multiplayer';
        case 'battle': return 'Battle';
        case 'arcade': return 'Arcade';
        case 'social': return 'Social';
        case 'party': return 'Party';
        case 'challenge': return 'Challenge';
        case 'chill': return 'Chill';
        default: return cat.charAt(0).toUpperCase() + cat.slice(1);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      
      <div className="mb-12 text-center md:text-left">
        <h1 className="text-5xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 mb-2 tracking-tighter">
          GAMES LIBRARY
        </h1>
        <p className="text-gray-400 text-lg uppercase tracking-widest font-bold opacity-60">Browse and play our collection of mini-games</p>
      </div>

      <div className="glass-card p-4 md:p-6 border-purple-500/20 mb-12 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 min-w-max">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-6 py-2.5 rounded-xl font-black transition-all uppercase tracking-widest text-xs border ${
                filter === cat
                  ? 'bg-purple-500 text-white shadow-[0_0_20px_rgba(176,38,255,0.4)] border-purple-400'
                  : 'bg-gray-900/50 text-gray-500 border-gray-800 hover:text-white hover:border-gray-600'
              }`}
            >
              {getTabLabel(cat)}
            </button>
          ))}
          <button
              onClick={() => setFilter('multiplayer')}
              className={`px-6 py-2.5 rounded-xl font-black transition-all uppercase tracking-widest text-xs border ${
                filter === 'multiplayer'
                  ? 'bg-pink-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)] border-pink-400'
                  : 'bg-gray-900/50 text-gray-500 border-gray-800 hover:text-white hover:border-gray-600'
              }`}
            >
              {getTabLabel('multiplayer')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin"></div>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Syncing Database...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
          {filteredGames.length > 0 ? (
            filteredGames.map((game) => (
              <GameCard
                key={game.id}
                id={game.id}
                title={game.title}
                description={game.description}
                icon={game.icon}
                route={game.route}
                color={game.color}
                isComingSoon={game.isComingSoon}
                hasMultiplayer={game.hasMultiplayer}
                image={game.image}
              />
            ))
          ) : (
            <div className="col-span-full glass-card p-20 text-center border-gray-800">
              <div className="text-6xl mb-6 opacity-20">🎮</div>
              <p className="text-gray-400 text-xl font-bold uppercase tracking-widest">No games found in this category.</p>
              <button onClick={() => setFilter('all')} className="mt-6 text-purple-400 hover:underline font-black uppercase text-sm">View All Games</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
