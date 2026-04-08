import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const DIFFICULTY_SETTINGS = {
  easy: { initialSpawnRate: 1200, minSpawnRate: 600, badChance: 0.2, lifetime: 2500, timeLimit: 45 },
  medium: { initialSpawnRate: 900, minSpawnRate: 400, badChance: 0.35, lifetime: 1800, timeLimit: 60 },
  hard: { initialSpawnRate: 700, minSpawnRate: 250, badChance: 0.5, lifetime: 1200, timeLimit: 90 }
};

export default function SurvivalClick() {
  const { currentUser, userProfile } = useAuth();
  
  const [gameState, setGameState] = useState('idle'); // idle, playing, result
  const [difficulty, setDifficulty] = useState('medium');
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [activeTargets, setActiveTargets] = useState([]);

  // Mutable refs for accurate game loop access
  const loopRef = useRef(null);
  const spawnerRef = useRef(null);
  const timerRef = useRef(null);
  const targetsRef = useRef([]);
  const lastSpawnTimeRef = useRef(0);
  const currentSpawnRateRef = useRef(1000);

  const arenaRef = useRef(null);

  const startGame = (diff) => {
    setDifficulty(diff);
    setScore(0);
    setLives(3);
    setTimeLeft(DIFFICULTY_SETTINGS[diff].timeLimit);
    targetsRef.current = [];
    setActiveTargets([]);
    currentSpawnRateRef.current = DIFFICULTY_SETTINGS[diff].initialSpawnRate;
    setGameState('playing');
  };

  const handleGameOver = useCallback(async (isDeath) => {
    setGameState('result');
    cancelAnimationFrame(loopRef.current);
    clearInterval(timerRef.current);

    if (currentUser && score > 0) {
      try {
        const finalScore = score;
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          score: increment(finalScore),
          xp: increment(Math.floor(finalScore / 3)),
          coins: increment(Math.floor(finalScore / 15)),
        });

        const lbRef = doc(db, 'leaderboard', currentUser.uid);
        await setDoc(lbRef, {
          username: userProfile?.username || currentUser.email.split('@')[0],
          avatar: userProfile?.avatar || '',
          score: increment(finalScore),
          updatedAt: new Date(),
        }, { merge: true });
      } catch (err) {
        console.error("Error saving score:", err);
      }
    }
  }, [currentUser, score, userProfile]);

  useEffect(() => {
    if (lives <= 0 && gameState === 'playing') {
       handleGameOver(true);
    }
  }, [lives, gameState, handleGameOver]);

  // Main Game Loop for Target Expiration and Spawning
  useEffect(() => {
    if (gameState === 'playing' && lives > 0) {
      const config = DIFFICULTY_SETTINGS[difficulty];

      // Second Timer
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleGameOver(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      const gameLoop = (timestamp) => {
        if (lives <= 0) return;
        let stateChanged = false;
        const now = Date.now();

        // 1. Spawning Logic
        if (now - lastSpawnTimeRef.current >= currentSpawnRateRef.current) {
           lastSpawnTimeRef.current = now;
           
           // Make it faster over time
           if (currentSpawnRateRef.current > config.minSpawnRate) {
              currentSpawnRateRef.current -= 10; 
           }

           // Ensure arena exists to get bounds
           const arenaWidth = arenaRef.current ? arenaRef.current.clientWidth - 60 : 300;
           const arenaHeight = arenaRef.current ? arenaRef.current.clientHeight - 60 : 300;

           const isBad = Math.random() < config.badChance;
           
           const newTarget = {
               id: now.toString() + Math.random().toString(),
               type: isBad ? 'bad' : 'good',
               x: 20 + Math.random() * (Math.max(10, arenaWidth - 40)),
               y: 20 + Math.random() * (Math.max(10, arenaHeight - 40)),
               spawnTime: now,
               status: 'active'
           };

           targetsRef.current.push(newTarget);
           stateChanged = true;
        }

        // 2. Expiration Logic
        let missedGood = 0;
        
        targetsRef.current = targetsRef.current.filter(target => {
            if (target.status !== 'active') return false; // Was clicked

            const age = now - target.spawnTime;
            if (age >= config.lifetime) {
                if (target.type === 'good') {
                    missedGood++;
                }
                stateChanged = true;
                return false; // Remove expired
            }
            return true;
        });

        if (missedGood > 0) {
           setLives(l => l - missedGood);
        }

        if (stateChanged) {
            setActiveTargets([...targetsRef.current]);
        }

        loopRef.current = requestAnimationFrame(gameLoop);
      };

      loopRef.current = requestAnimationFrame(gameLoop);

      return () => {
         cancelAnimationFrame(loopRef.current);
         clearInterval(timerRef.current);
      };
    }
  }, [gameState, difficulty, lives, handleGameOver]);


  const handleTargetClick = (e, targetId, type) => {
      e.stopPropagation();
      e.preventDefault();

      if (gameState !== 'playing' || lives <= 0) return;

      const idx = targetsRef.current.findIndex(t => t.id === targetId);
      if (idx !== -1) {
          targetsRef.current[idx].status = 'clicked';
          
          if (type === 'good') {
              // Standard scaling score
              const currentSpeedFactor = (DIFFICULTY_SETTINGS[difficulty].initialSpawnRate / currentSpawnRateRef.current);
              setScore(s => s + Math.floor(10 * currentSpeedFactor));
          } else if (type === 'bad') {
              setLives(l => Math.max(0, l - 1));
          }

          setActiveTargets([...targetsRef.current]);
      }
  };

  const handleArenaClick = (e) => {
      // Optional: penalize clicking empty space? Usually Survival games let empty clicks slide,
      // but maybe penalize score slightly to prevent blind spam clicking.
      if (gameState === 'playing') {
          setScore(s => Math.max(0, s - 2)); 
      }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col items-center min-h-screen select-none">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        ← Back to Library
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 via-blue-500 to-red-500 mb-2 tracking-tighter">
          SURVIVAL CLICK
        </h1>
        <p className="text-gray-400 font-mono italic">Click the good. Dodge the bad. Don't blink.</p>
      </div>

      {gameState === 'idle' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-green-500/20">
          <div className="text-8xl mb-8 animate-bounce flex gap-4">
             <div className="w-16 h-16 rounded-full bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]"></div>
             <div className="w-16 h-16 rounded-lg bg-red-600 rotate-45 shadow-[0_0_20px_rgba(220,38,38,0.6)] flex items-center justify-center text-white text-xs font-black">X</div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Target Practice</h2>
          <div className="text-gray-400 mb-8 space-y-2 text-center text-sm w-3/4">
             <p>Tap the <strong className="text-green-500">Green Orbs</strong> before they disappear!</p>
             <p>AVOID the <strong className="text-red-500">Red Spikes</strong>. Touching them hurts.</p>
             <p className="p-4 bg-gray-900/50 rounded-lg border border-gray-800 text-yellow-500 font-bold">
                 Missing a Green Orb or touching a Red Spike costs 1 Life. You have 3 Lives!
             </p>
             <p className="text-xs text-red-400">Blindly spam-clicking the arena will slowly drain your score.</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {['easy', 'medium', 'hard'].map(lvl => (
              <button
                key={lvl}
                onClick={() => startGame(lvl)}
                className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg ${
                  lvl === 'hard' ? 'bg-red-600 hover:bg-red-500 shadow-red-600/40 text-white' :
                  lvl === 'medium' ? 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/40 text-white' :
                  'bg-green-500 hover:bg-green-400 shadow-green-500/40 text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="w-full flex flex-col items-center max-w-4xl">
          {/* HUD Sidebar / Top Bar */}
          <div className="w-full flex justify-between items-center mb-6 px-6 bg-gray-900/60 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
             <div className="flex flex-col">
               <span className="text-[10px] text-gray-500 font-black uppercase">Vitals</span>
               <div className="flex gap-2">
                 {[...Array(3)].map((_, i) => (
                    <span key={i} className={`text-2xl ${i < lives ? 'text-red-500' : 'text-gray-700'} drop-shadow-md`}>
                       ❤️
                    </span>
                 ))}
               </div>
             </div>
             
             <div className="flex flex-col items-center">
               <span className="text-[10px] text-gray-500 font-black uppercase mb-1">Time Remaining</span>
               <span className={`text-4xl font-black ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                 {timeLeft}s
               </span>
               <span className="text-[8px] mt-1 text-gray-600 uppercase font-black tracking-widest">
                  Pace: {Math.floor((1000 - currentSpawnRateRef.current))} MPH
               </span>
             </div>

             <div className="flex flex-col items-end">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Score</span>
                 <span className="text-3xl font-black text-green-400 leading-none drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">
                    {score}
                 </span>
             </div>
          </div>

          {/* Play Arena */}
          <div 
             ref={arenaRef}
             onClick={handleArenaClick} // spam click penalty
             className="relative w-full aspect-[4/3] max-h-[60vh] bg-black border-4 border-gray-800 rounded-2xl overflow-hidden shadow-2xl cursor-crosshair"
          >
             {/* Subtle grid background for aiming feel */}
             <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

             {/* Render Active Targets */}
             {activeTargets.map(target => (
                 <button
                    key={target.id}
                    onPointerDown={(e) => handleTargetClick(e, target.id, target.type)}
                    className={`absolute flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
                        target.type === 'good' 
                        ? 'w-16 h-16 rounded-full bg-gradient-to-tr from-green-600 to-cyan-400 shadow-[0_0_20px_rgba(34,197,94,0.6)] border-2 border-white animate-pop-in' 
                        : 'w-14 h-14 bg-gradient-to-b from-red-600 to-orange-600 rotate-45 shadow-[0_0_20px_rgba(220,38,38,0.8)] border border-red-300 animate-pop-in z-10'
                    }`}
                    style={{
                        left: `${target.x}px`,
                        top: `${target.y}px`,
                        touchAction: 'none' // Important for fast tapping on mobile
                    }}
                 >
                     {target.type === 'bad' && <span className="text-white text-xs font-black -rotate-45">✖</span>}
                 </button>
             ))}
             
             {/* Visual warning flash when taking damage */}
             <div className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ${lives > 0 && lives < 3 && gameState === 'playing' ? 'bg-red-500/5' : 'opacity-0'}`}></div>
          </div>
        </div>
      )}

      {gameState === 'result' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-green-500/20 animate-fade-in-up mt-8">
          <h2 className="text-5xl font-black text-white mb-2">SURVIVAL {lives > 0 ? 'SUCCESS' : 'FAILED'}</h2>
          <p className="text-gray-500 font-mono text-sm mb-10 text-center">
              {lives > 0 ? `You survived the full ${DIFFICULTY_SETTINGS[difficulty].timeLimit} seconds!` : "Overwhelmed. You ran out of lives."}
          </p>
          
          <div className="grid grid-cols-2 gap-6 w-full mb-10">
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Final Score</div>
              <div className="text-4xl font-black text-white">{score}</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Lives Remaining</div>
              <div className="text-4xl font-black text-red-500">{lives}❤️</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">XP Earned</div>
              <div className="text-4xl font-black text-purple-400">+{Math.floor(score / 3)}⚡</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Coins</div>
              <div className="text-4xl font-black text-yellow-400">+{Math.floor(score / 15)}🪙</div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setGameState('idle')}
              className="px-8 py-3 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-600 transition-all"
            >
              Main Menu
            </button>
            <button
              onClick={() => startGame(difficulty)}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-green-500/20"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pop-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop-in {
           animation: pop-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>
    </div>
  );
}
