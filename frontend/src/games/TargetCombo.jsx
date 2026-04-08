import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const SPAWN_INTERVALS = { easy: 800, medium: 500, hard: 350 };
const TARGET_SIZES = { easy: 60, medium: 45, hard: 30 };
const TARGET_LIFESPAN = { easy: 2000, medium: 1500, hard: 1000 };

export default function TargetCombo() {
  const { currentUser, userProfile } = useAuth();
  
  // Game State
  const [gameState, setGameState] = useState('idle'); // idle, playing, result
  const [difficulty, setDifficulty] = useState('medium');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [targets, setTargets] = useState([]);
  const [hits, setHits] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  
  const arenaRef = useRef(null);
  const gameTimerRef = useRef(null);
  const spawnTimerRef = useRef(null);

  const startLevel = (diff) => {
    setDifficulty(diff);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTimeLeft(30);
    setHits(0);
    setTotalClicks(0);
    setTargets([]);
    setGameState('playing');
  };

  const spawnTarget = useCallback(() => {
    if (gameState !== 'playing' || !arenaRef.current) return;

    const arena = arenaRef.current.getBoundingClientRect();
    const size = TARGET_SIZES[difficulty];
    const margin = 20;

    const newTarget = {
      id: Date.now() + Math.random(),
      x: Math.random() * (arena.width - size - margin * 2) + margin,
      y: Math.random() * (arena.height - size - margin * 2) + margin,
      size: size,
      createdAt: Date.now()
    };

    setTargets(prev => [...prev, newTarget]);

    // Target expires
    setTimeout(() => {
      setTargets(prev => {
        const targetExists = prev.find(t => t.id === newTarget.id);
        if (targetExists) {
          setCombo(0); // Reset combo if target expires
          return prev.filter(t => t.id !== newTarget.id);
        }
        return prev;
      });
    }, TARGET_LIFESPAN[difficulty]);
  }, [gameState, difficulty]);

  // Main Game Loop
  useEffect(() => {
    if (gameState === 'playing') {
      // Countdown timer
      gameTimerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Spawning loop
      spawnTimerRef.current = setInterval(spawnTarget, SPAWN_INTERVALS[difficulty]);

      return () => {
        clearInterval(gameTimerRef.current);
        clearInterval(spawnTimerRef.current);
      };
    }
  }, [gameState, difficulty, spawnTarget]);

  const endGame = async () => {
    setGameState('result');
    clearInterval(gameTimerRef.current);
    clearInterval(spawnTimerRef.current);

    if (currentUser) {
      try {
        const finalReward = Math.floor(score / 10);
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          score: increment(score),
          xp: increment(Math.floor(score / 2)),
          coins: increment(Math.floor(score / 20)),
        });

        const lbRef = doc(db, 'leaderboard', currentUser.uid);
        await setDoc(lbRef, {
          username: userProfile?.username || currentUser.email.split('@')[0],
          avatar: userProfile?.avatar || '',
          score: increment(score),
          updatedAt: new Date(),
        }, { merge: true });
      } catch (err) {
        console.error("Error saving score:", err);
      }
    }
  };

  const handleArenaClick = (e) => {
    if (gameState !== 'playing') return;
    setTotalClicks(prev => prev + 1);
    
    // If the click wasn't on a target (handled below), it's a miss
    // Note: We use e.stopPropagation on the target click to prevent this
    setCombo(0);
  };

  const handleTargetClick = (e, targetId) => {
    if (gameState !== 'playing') return;
    e.stopPropagation(); // Prevent arena click (miss)

    setHits(prev => prev + 1);
    setTotalClicks(prev => prev + 1);
    
    // Calculate Score
    const newCombo = combo + 1;
    setCombo(newCombo);
    if (newCombo > maxCombo) setMaxCombo(newCombo);

    const basePoints = difficulty === 'hard' ? 20 : difficulty === 'medium' ? 15 : 10;
    const comboBonus = Math.floor(newCombo / 5) * 5;
    const gainedScore = basePoints + comboBonus;

    setScore(prev => prev + gainedScore);
    setTargets(prev => prev.filter(t => t.id !== targetId));
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col items-center min-h-screen">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        ← Back to Library
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 mb-2 tracking-tighter">
          TARGET COMBO
        </h1>
        <p className="text-gray-400 font-mono italic">Don't break the chain! 🔥</p>
      </div>

      {gameState === 'idle' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-orange-500/20">
          <div className="text-7xl mb-8 animate-bounce">🔥</div>
          <h2 className="text-3xl font-bold text-white mb-2">Ready to Aim?</h2>
          <p className="text-gray-400 mb-10 text-center text-sm">Hit targets quickly to build your combo. One miss or let a target expire and your combo resets!</p>
          
          <div className="flex flex-wrap justify-center gap-4">
            {['easy', 'medium', 'hard'].map(lvl => (
              <button
                key={lvl}
                onClick={() => startLevel(lvl)}
                className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
                  lvl === 'hard' ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]' :
                  lvl === 'medium' ? 'bg-orange-500 hover:bg-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]' :
                  'bg-green-500 hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="w-full flex flex-col items-center">
          {/* Stats Bar */}
          <div className="w-full flex justify-between items-center mb-6 px-4 bg-gray-900/60 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 font-black uppercase">Score</span>
              <span className="text-3xl font-black text-white leading-none">{score}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black text-orange-500 animate-pulse">
                {timeLeft}s
              </span>
            </div>

            <div className="flex gap-8">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-500 font-black uppercase">Combo</span>
                    <span className={`text-3xl font-black leading-none ${combo > 10 ? 'text-red-500 scale-110 shadow-red-500' : 'text-orange-400'} transition-all`}>
                        {combo}x
                    </span>
                </div>
            </div>
          </div>

          {/* Game Arena */}
          <div 
            ref={arenaRef}
            onClick={handleArenaClick}
            className="relative w-full aspect-video bg-gray-900/80 rounded-3xl border-2 border-orange-500/20 shadow-[inset_0_0_50px_rgba(249,115,22,0.1)] overflow-hidden cursor-crosshair"
          >
            {/* Grid overlay for texture */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #f97316 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            
            {targets.map(target => (
              <div
                key={target.id}
                onClick={(e) => handleTargetClick(e, target.id)}
                className="absolute rounded-full cursor-pointer group flex items-center justify-center"
                style={{
                  left: target.x,
                  top: target.y,
                  width: target.size,
                  height: target.size,
                  background: 'radial-gradient(circle, #fb923c, #ef4444)',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)',
                  animation: 'scale-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
              >
                <div className="w-1/2 h-1/2 rounded-full bg-white opacity-20 group-hover:opacity-40 transition-opacity"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {gameState === 'result' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-orange-500/20 animate-fade-in-up">
          <h2 className="text-5xl font-black text-white mb-8">ARENA CLEAR!</h2>
          
          <div className="grid grid-cols-2 gap-6 w-full mb-10">
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Final Score</div>
              <div className="text-4xl font-black text-white">{score}</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Max Combo</div>
              <div className="text-4xl font-black text-orange-500">{maxCombo}🔥</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Accuracy</div>
              <div className="text-4xl font-black text-cyan-400">
                {totalClicks > 0 ? Math.round((hits / totalClicks) * 100) : 0}%
              </div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Reward</div>
              <div className="text-4xl font-black text-yellow-400">+{Math.floor(score / 20)}🪙</div>
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
              onClick={() => startLevel(difficulty)}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scale-in {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}
