import React from 'react';

export default function LeaderboardRow({ rank, username, score, avatar, isCurrentUser }) {
  
  // Rank visual styling
  let rankStyle = "text-gray-400 font-bold";
  let bgStyle = "bg-gray-800/50 border border-gray-700";
  let badgeStyle = "bg-gray-700 text-gray-400";
  
  if (rank === 1) {
    rankStyle = "text-yellow-400 font-black text-2xl drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]";
    bgStyle = "bg-yellow-500/10 border border-yellow-500/50 shadow-[0_0_15px_rgba(250,204,21,0.15)] scale-[1.02] z-10";
    badgeStyle = "bg-gradient-to-br from-yellow-300 to-yellow-600 text-gray-900 border border-yellow-200";
  } else if (rank === 2) {
    rankStyle = "text-gray-300 font-bold text-xl drop-shadow-[0_0_5px_rgba(209,213,219,0.8)]";
    bgStyle = "bg-gray-400/10 border border-gray-400/50";
    badgeStyle = "bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900 border border-gray-200";
  } else if (rank === 3) {
    rankStyle = "text-amber-600 font-bold text-lg";
    bgStyle = "bg-amber-700/10 border border-amber-700/50";
    badgeStyle = "bg-gradient-to-br from-amber-500 to-amber-700 text-white border border-amber-400";
  }

  if (isCurrentUser) {
    bgStyle += " border-cyan-400/80 shadow-[0_0_15px_rgba(0,240,255,0.3)]";
  }

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 mb-3 ${bgStyle}`}>
      
      <div className="flex items-center gap-4 md:gap-6">
        {/* Rank Badge */}
        <div className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-lg font-bold ${badgeStyle}`}>
          #{rank}
        </div>
        
        {/* Avatar & Info */}
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden bg-gray-700 border-2 border-gray-600 flex-shrink-0">
            {avatar ? (
              <img src={avatar} alt={username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 text-white font-bold text-lg">
                {username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="flex flex-col">
            <span className={`font-bold md:text-lg ${isCurrentUser ? 'text-cyan-400' : 'text-white'}`}>
              {username}
              {isCurrentUser && <span className="ml-2 text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/30">YOU</span>}
            </span>
          </div>
        </div>
      </div>
      
      {/* Score */}
      <div className="text-right flex flex-col justify-center">
        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-0.5 hidden md:block">Score</span>
        <span className={`font-black font-mono text-xl md:text-2xl ${rank <= 3 ? rankStyle : 'text-purple-400'}`}>
          {score.toLocaleString()}
        </span>
      </div>
      
    </div>
  );
}
