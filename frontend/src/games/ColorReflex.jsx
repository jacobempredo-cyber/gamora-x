import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const COLORS = [
  { name: 'RED', hex: '#ef4444', value: 'red' },
  { name: 'BLUE', hex: '#3b82f6', value: 'blue' },
  { name: 'GREEN', hex: '#22c55e', value: 'green' },
  { name: 'YELLOW', hex: '#eab308', value: 'yellow' },
  { name: 'PURPLE', hex: '#a855f7', value: 'purple' },
  { name: 'ORANGE', hex: '#f97316', value: 'orange' },
  { name: 'CYAN', hex: '#06b6d4', value: 'cyan' },
  { name: 'PINK', hex: '#ec4899', value: 'pink' }
];

export default function ColorReflex() {
  const { currentUser, userProfile } = useAuth();
  
  // Game State
  const [gameState, setGameState] = useState('idle'); // idle, playing, result
  const [difficulty, setDifficulty] = useState('medium');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [lastResult, setLastResult] = useState(null); // 'correct', 'wrong'
  
  const timerRef = useRef(null);

  const startLevel = (diff) => {
    setDifficulty(diff);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setTimeLeft(30);
    setGameState('playing');
    setLastResult(null);
    generateChallenge(diff);
  };

  const generateChallenge = (diff) => {
    const colorPool = diff === 'easy' ? COLORS.slice(0, 4) : 
                     diff === 'medium' ? COLORS.slice(0, 6) : 
                     COLORS;
    
    const wordIndex = Math.floor(Math.random() * colorPool.length);
    let colorIndex = Math.floor(Math.random() * colorPool.length);
    
    // Ensure it's tricky (mismatch) most of the time
    if (Math.random() > 0.2) {
       while (colorIndex === wordIndex) {
         colorIndex = Math.floor(Math.random() * colorPool.length);
       }
    }

    setCurrentChallenge({
      word: colorPool[wordIndex].name,
      displayColor: colorPool[colorIndex].hex,
      correctValue: colorPool[colorIndex].value,
      options: colorPool.sort(() => Math.random() - 0.5)
    });
  };

  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [gameState]);

  const endGame = async () => {
    setGameState('result');
    clearInterval(timerRef.current);

    if (currentUser) {
      try {
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

  const handleChoice = (choiceValue) => {
    if (gameState !== 'playing') return;

    if (choiceValue === currentChallenge.correctValue) {
      // Correct!
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      
      const basePoints = difficulty === 'hard' ? 30 : difficulty === 'medium' ? 20 : 10;
      const streakBonus = Math.floor(newStreak / 5) * 10;
      setScore(prev => prev + basePoints + streakBonus);
      
      setLastResult('correct');
      generateChallenge(difficulty);
    } else {
      // Wrong!
      setStreak(0);
      setLastResult('wrong');
      // Shake effect or feedback
      setTimeout(() => setLastResult(null), 500);
      generateChallenge(difficulty);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col items-center min-h-screen">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        ← Back to Library
      </Link>

      <div className="text-center mb-12">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-2 tracking-tighter">
          COLOR REFLEX
        </h1>
        <p className="text-gray-400 font-mono italic">Don't read the word — identify the COLOR! 👁️</p>
      </div>

      {gameState === 'idle' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-purple-500/20">
          <div className="text-8xl mb-8 animate-pulse">🧠</div>
          <h2 className="text-3xl font-bold text-white mb-2">Brain Teaser Ready</h2>
          <p className="text-gray-400 mb-10 text-center text-sm">
            You will see a word like <span className="text-red-500 font-bold">"BLUE"</span>. 
            Since the color is <span className="text-red-500 font-bold">RED</span>, you must tap the 🔴 <strong>RED</strong> button. 
            Ignore the text!
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            {['easy', 'medium', 'hard'].map(lvl => (
              <button
                key={lvl}
                onClick={() => startLevel(lvl)}
                className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
                  lvl === 'hard' ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]' :
                  lvl === 'medium' ? 'bg-purple-500 hover:bg-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]' :
                  'bg-blue-500 hover:bg-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState === 'playing' && currentChallenge && (
        <div className="w-full flex flex-col items-center">
          {/* Stats Bar */}
          <div className="w-full flex justify-between items-center mb-12 px-6 bg-gray-900/60 p-5 rounded-2xl border border-white/5 backdrop-blur-md max-w-3xl">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 font-black uppercase">Intensity</span>
              <span className="text-2xl font-black text-white leading-none">{difficulty.toUpperCase()}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-gray-500 font-black uppercase mb-1">Time Remaining</span>
              <span className={`text-4xl font-black ${timeLeft < 10 ? 'text-red-500 animate-bounce' : 'text-white'}`}>
                {timeLeft}s
              </span>
            </div>

            <div className="flex flex-col items-end">
                <span className="text-[10px] text-gray-500 font-black uppercase">Streak</span>
                <span className="text-3xl font-black text-purple-400 leading-none">
                    {streak}🔥
                </span>
            </div>
          </div>

          {/* Core Game UI */}
          <div className={`glass-card w-full max-w-3xl p-20 flex flex-col items-center justify-center border-white/10 relative overflow-hidden transition-all duration-300 ${lastResult === 'wrong' ? 'bg-red-500/10 border-red-500/30 shake' : ''}`}>
             <span className="absolute top-4 left-4 text-[10px] text-gray-600 font-black uppercase tracking-widest">Identify color →</span>
             
             <h2 
                className="text-8xl md:text-9xl font-black select-none tracking-tighter transition-all duration-200"
                style={{ color: currentChallenge.displayColor }}
             >
                {currentChallenge.word}
             </h2>

             {/* Feedback Overlay */}
             {lastResult === 'correct' && (
                 <div className="absolute inset-0 bg-green-500/5 flex items-center justify-center pointer-events-none animate-ping-once">
                     <span className="text-green-500 text-6xl font-black">✓</span>
                 </div>
             )}
          </div>

          {/* Color Matrix */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 w-full max-w-3xl">
             {currentChallenge.options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => handleChoice(opt.value)}
                    className="group relative h-20 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg overflow-hidden flex items-center justify-center"
                    style={{ backgroundColor: opt.hex }}
                >
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                    <span className="relative z-10 text-white font-black uppercase tracking-widest text-sm drop-shadow-md">
                        {opt.name}
                    </span>
                </button>
             ))}
          </div>

          {/* Score Counter */}
          <div className="mt-8">
              <span className="text-gray-500 text-xs font-black uppercase">Current Score</span>
              <div className="text-4xl font-black text-white text-center">{score}</div>
          </div>
        </div>
      )}

      {gameState === 'result' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-purple-500/20 animate-fade-in-up">
          <h2 className="text-5xl font-black text-white mb-2">BRAIN SCAN COMPLETE</h2>
          <p className="text-gray-500 font-mono text-sm mb-10">Neural interference processed.</p>
          
          <div className="grid grid-cols-2 gap-6 w-full mb-10">
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Final Score</div>
              <div className="text-4xl font-black text-white">{score}</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Top Streak</div>
              <div className="text-4xl font-black text-purple-500">{maxStreak}🔥</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">XP Gained</div>
              <div className="text-4xl font-black text-cyan-400">+{Math.floor(score / 2)}⚡</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Coins</div>
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
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-purple-500/20"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .shake { animation: shake 0.2s ease-in-out infinite; }
        
        @keyframes ping-once {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-ping-once { animation: ping-once 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
}
