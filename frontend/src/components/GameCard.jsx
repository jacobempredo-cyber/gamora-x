import React from 'react';
import { Link } from 'react-router-dom';

export default function GameCard({ title, description, icon, route, color = 'cyan', isComingSoon = false, hasMultiplayer = false }) {
  
  const colorClasses = {
    cyan: 'border-cyan-500/30 hover:shadow-[0_0_25px_rgba(0,240,255,0.6)] hover:border-cyan-400 group-hover:text-cyan-400',
    purple: 'border-purple-500/30 hover:shadow-[0_0_25px_rgba(176,38,255,0.6)] hover:border-purple-400 group-hover:text-purple-400',
    pink: 'border-pink-500/30 hover:shadow-[0_0_25px_rgba(236,72,153,0.6)] hover:border-pink-400 group-hover:text-pink-400',
    yellow: 'border-yellow-500/30 hover:shadow-[0_0_25px_rgba(234,179,8,0.6)] hover:border-yellow-400 group-hover:text-yellow-400'
  };

  const bgGradient = {
    cyan: 'from-cyan-500/10 to-transparent',
    purple: 'from-purple-500/10 to-transparent',
    pink: 'from-pink-500/10 to-transparent',
    yellow: 'from-yellow-500/10 to-transparent'
  };

  const cardContent = (
    <div className={`glass-card relative overflow-hidden h-full p-6 transition-all duration-300 border ${colorClasses[color]} bg-gradient-to-b ${bgGradient[color]} group hover:scale-[1.03] hover:z-10`}>
      
      {/* Background Graphic Detail */}
      <div className="absolute -bottom-8 -right-8 text-[160px] font-black text-white/[0.02] select-none pointer-events-none z-0 transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500">
        X
      </div>
      
      {isComingSoon && (
        <div className="absolute top-4 right-[-30px] bg-red-500 text-white text-xs font-bold px-10 py-1 rotate-45 shadow-lg">
          COMING SOON
        </div>
      )}

      {hasMultiplayer && !isComingSoon && (
        <div className="absolute top-3 right-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
          ⚔️ 1v1
        </div>
      )}

      <div className="flex flex-col h-full z-10 relative">
        <div className={`text-5xl mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:text-${color}-400`}>
          {icon}
        </div>
        
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        
        <p className="text-gray-400 text-sm flex-grow">
          {description}
        </p>
        
        {!isComingSoon && (
          <div className="mt-6 flex items-center text-sm font-bold text-gray-300 group-hover:text-white transition-colors">
            PLAY NOW 
            <svg className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );

  if (isComingSoon) {
    return (
      <div className="block h-full opacity-70 cursor-not-allowed grayscale-[50%]">
        {cardContent}
      </div>
    );
  }

  return (
    <Link to={route} className="block h-full group text-decoration-none">
      {cardContent}
    </Link>
  );
}
