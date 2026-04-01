import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import LeaderboardRow from '../components/LeaderboardRow';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('global');
  const { currentUser } = useAuth();

  useEffect(() => {
    setLoading(true);
    
    // Setup real-time listener for top 100
    const lbRef = collection(db, 'leaderboard');
    const q = query(lbRef, orderBy('score', 'desc'), limit(100));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const lbData = [];
      querySnapshot.forEach((doc) => {
        lbData.push({ id: doc.id, ...doc.data() });
      });
      setLeaders(lbData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
      
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 mb-2 tracking-wider">
          HALL OF FAME
        </h1>
        <p className="text-gray-400 text-lg">Top ranked players around the world</p>
      </div>

      <div className="glass-card w-full p-6 border-cyan-500/20">
        
        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('global')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === 'global' 
                ? 'bg-cyan-500 text-gray-900 shadow-[0_0_15px_rgba(0,240,255,0.5)]' 
                : 'bg-transparent text-gray-400 border border-gray-600 hover:text-white'
            }`}
          >
            GLOBAL
          </button>
          
          <button 
            onClick={() => setActiveTab('weekly')}
            className={`px-6 py-2 rounded-full font-bold transition-all opacity-50 cursor-not-allowed ${
              activeTab === 'weekly' 
                ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(176,38,255,0.5)]' 
                : 'bg-transparent text-gray-400 border border-gray-600'
            }`}
            disabled
            title="Coming in Level 2"
          >
            WEEKLY
          </button>
          
          <button 
            onClick={() => setActiveTab('friends')}
            className={`px-6 py-2 rounded-full font-bold transition-all opacity-50 cursor-not-allowed ${
              activeTab === 'friends' 
                ? 'bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]' 
                : 'bg-transparent text-gray-400 border border-gray-600'
            }`}
            disabled
            title="Coming in Level 3"
          >
            FRIENDS
          </button>
        </div>

        {/* Leaderboard List */}
        <div className="w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-cyan-400">
              <svg className="animate-spin h-10 w-10 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Syncing ranks...</p>
            </div>
          ) : leaders.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <div className="text-4xl mb-4">🏆</div>
              <p className="text-xl font-bold">The arena is empty</p>
              <p>Be the first to play and set the high score!</p>
            </div>
          ) : (
            <div className="space-y-2 animate-fade-in-up">
              {leaders.map((player, index) => (
                <LeaderboardRow 
                  key={player.id}
                  rank={index + 1}
                  username={player.username}
                  score={player.score}
                  avatar={player.avatar}
                  isCurrentUser={currentUser?.uid === player.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
