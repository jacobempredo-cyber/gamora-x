import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

// Configuration
const LANES = 4;
const KEYS = ['d', 'f', 'j', 'k'];
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308']; // Red, Blue, Green, Yellow

const LEVEL_CONFIG = {
  easy: { fallDuration: 2500, spawnRate: 800, time: 30 },
  medium: { fallDuration: 1800, spawnRate: 500, time: 45 },
  hard: { fallDuration: 1200, spawnRate: 300, time: 60 }
};

const HIT_WINDOW_MS = 150; // milliseconds before/after the exact target time

export default function TapRhythm() {
  const { currentUser, userProfile } = useAuth();
  
  const [gameState, setGameState] = useState('idle'); // idle, playing, result
  const [difficulty, setDifficulty] = useState('medium');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [activeNotes, setActiveNotes] = useState([]);
  const [feedback, setFeedback] = useState(null); // { text, color, id }

  const gameTimerRef = useRef(null);
  const spawnerRef = useRef(null);
  const gameLoopRef = useRef(null);
  const notesRef = useRef([]); // Mutable ref for accurate access inside the loop and event listeners
  const hitKeysRef = useRef(new Set()); // To prevent holding down keys

  const targetLineY = 85; // Percentage down the screen (0 to 100)

  const startGame = (diff) => {
    setDifficulty(diff);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTimeLeft(LEVEL_CONFIG[diff].time);
    setActiveNotes([]);
    notesRef.current = [];
    setFeedback(null);
    setGameState('playing');
  };

  // Main Game Loop for Cleanup and Timers
  useEffect(() => {
    if (gameState === 'playing') {
      const config = LEVEL_CONFIG[difficulty];
      
      // Spawner
      spawnerRef.current = setInterval(() => {
        const lane = Math.floor(Math.random() * LANES);
        const newNote = {
          id: Date.now() + Math.random().toString(),
          lane,
          spawnTime: Date.now(),
          targetTime: Date.now() + config.fallDuration,
          status: 'falling'
        };
        notesRef.current = [...notesRef.current, newNote];
        updateNotesState();
      }, config.spawnRate);

      // Level Timer
      gameTimerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleGameOver();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Animation Loop for missed notes
      const loop = () => {
        const now = Date.now();
        let changed = false;

        notesRef.current = notesRef.current.map(note => {
          if (note.status === 'falling' && now > note.targetTime + HIT_WINDOW_MS) {
            handleMiss();
            changed = true;
            return { ...note, status: 'missed' };
          }
          return note;
        }).filter(note => {
             // Clean up notes that have fallen way past the screen
            return now < note.targetTime + 1000;
        });

        if (changed) updateNotesState();
        gameLoopRef.current = requestAnimationFrame(loop);
      };
      
      gameLoopRef.current = requestAnimationFrame(loop);

      return () => {
        clearInterval(spawnerRef.current);
        clearInterval(gameTimerRef.current);
        cancelAnimationFrame(gameLoopRef.current);
      };
    }
  }, [gameState, difficulty]);

  // Make sure React state matches ref for rendering
  const updateNotesState = useCallback(() => {
    setActiveNotes([...notesRef.current]);
  }, []);

  const handleMiss = useCallback(() => {
    setCombo(0);
    showFeedback('MISS', '#ef4444');
  }, []);

  const handleHit = useCallback((laneIndex) => {
    if (gameState !== 'playing') return;

    const now = Date.now();
    // Find the oldest falling note in this lane
    const noteIndex = notesRef.current.findIndex(n => n.lane === laneIndex && n.status === 'falling');

    if (noteIndex !== -1) {
      const note = notesRef.current[noteIndex];
      const diff = Math.abs(now - note.targetTime);

      if (diff <= HIT_WINDOW_MS) {
        // Hit!
        const isPerfect = diff <= HIT_WINDOW_MS / 3;
        
        notesRef.current[noteIndex].status = 'hit';
        updateNotesState();
        
        setCombo(prev => {
            const next = prev + 1;
            setMaxCombo(m => Math.max(m, next));
            return next;
        });

        setScore(prev => prev + (isPerfect ? 20 : 10) + Math.floor(combo / 5) * 5);
        showFeedback(isPerfect ? 'PERFECT' : 'GOOD', isPerfect ? '#a855f7' : '#3b82f6');
      } else if (now > note.targetTime + HIT_WINDOW_MS) {
          // It's a completely missed note that animation loop hasn't caught yet
      } else {
        // Pressed too early
        handleMiss();
        notesRef.current[noteIndex].status = 'missed'; // Mark as missed so they don't spam
        updateNotesState();
      }
    } else {
        // Pressed a lane with no notes nearby
        handleMiss();
    }
  }, [gameState, combo, handleMiss, updateNotesState]);

  const showFeedback = (text, color) => {
      setFeedback({ text, color, id: Date.now() });
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameState !== 'playing') return;
      const key = e.key.toLowerCase();
      const laneIndex = KEYS.indexOf(key);
      
      if (laneIndex !== -1 && !hitKeysRef.current.has(key)) {
        hitKeysRef.current.add(key);
        handleHit(laneIndex);
      }
    };

    const handleKeyUp = (e) => {
        hitKeysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, handleHit]);

  const handleGameOver = async () => {
    setGameState('result');
    clearInterval(spawnerRef.current);
    clearInterval(gameTimerRef.current);
    cancelAnimationFrame(gameLoopRef.current);

    if (currentUser && score > 0) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          score: increment(score),
          xp: increment(Math.floor(score / 2)),
          coins: increment(Math.floor(score / 15)),
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

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col items-center min-h-screen">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        ← Back to Library
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-2 tracking-tighter">
          TAP RHYTHM
        </h1>
        <p className="text-gray-400 font-mono italic">Feel the beat. Hit the glowing notes.</p>
      </div>

      {gameState === 'idle' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-purple-500/20">
          <div className="text-8xl mb-8 animate-pulse text-pink-400">🎹</div>
          <h2 className="text-3xl font-bold text-white mb-4">Arcade Rhythm</h2>
          <div className="text-gray-400 mb-8 space-y-2 text-center text-sm w-3/4">
             <p>Notes will fall down 4 lanes. Tap the corresponding lane when the note hits the target bar!</p>
             <p className="p-4 bg-gray-900/50 rounded-lg border border-gray-800">
                <strong>Controls:</strong> Use keys <span className="text-white font-bold px-2 border border-gray-600 rounded mx-1">D</span> 
                <span className="text-white font-bold px-2 border border-gray-600 rounded mx-1">F</span> 
                <span className="text-white font-bold px-2 border border-gray-600 rounded mx-1">J</span> 
                <span className="text-white font-bold px-2 border border-gray-600 rounded mx-1">K</span> or click the lanes.
             </p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {['easy', 'medium', 'hard'].map(lvl => (
              <button
                key={lvl}
                onClick={() => startGame(lvl)}
                className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${
                  lvl === 'hard' ? 'bg-pink-500 hover:bg-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.4)]' :
                  lvl === 'medium' ? 'bg-purple-500 hover:bg-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]' :
                  'bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
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
          {/* Stats Header */}
          <div className="w-full flex justify-between items-center mb-8 px-6 bg-gray-900/60 p-4 rounded-2xl border border-white/5 backdrop-blur-md max-w-3xl">
             <div className="flex flex-col">
               <span className="text-[10px] text-gray-500 font-black uppercase">Score</span>
               <span className="text-2xl font-black text-white leading-none">{score}</span>
             </div>
             
             <div className="flex flex-col items-center">
               <span className="text-[10px] text-gray-500 font-black uppercase mb-1">Time Left</span>
               <span className={`text-4xl font-black ${timeLeft < 10 ? 'text-red-500 animate-bounce' : 'text-cyan-400'}`}>
                 {timeLeft}s
               </span>
             </div>

             <div className="flex flex-col items-end">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Combo</span>
                 <span className={`text-3xl font-black leading-none ${combo >= 10 ? 'text-pink-500' : 'text-purple-400'}`}>
                    x{combo}
                 </span>
             </div>
          </div>

          {/* Game Board */}
          <div className="relative w-full max-w-[600px] h-[500px] border-x-4 border-b-4 border-gray-800 bg-gray-900/80 rounded-b-2xl overflow-hidden shadow-2xl flex">
              
              {/* Feedback Text Overlay */}
              {feedback && (
                  <div 
                    key={feedback.id} 
                    className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none animate-fade-out-up"
                  >
                      <span className="text-5xl md:text-7xl font-black tracking-widest italic drop-shadow-2xl" style={{ color: feedback.color }}>
                          {feedback.text}
                      </span>
                  </div>
              )}

              {/* Target Line */}
              <div 
                 className="absolute w-full h-16 bg-white/5 border-y-2 border-white/20 z-10 flex"
                 style={{ top: `${targetLineY}%` }}
              >
                  {/* Glowing hit indicator areas */}
              </div>

              {/* Lanes */}
              {[...Array(LANES)].map((_, laneIndex) => (
                  <div 
                    key={laneIndex} 
                    className="flex-1 border-r border-gray-800/50 last:border-r-0 relative group"
                    onPointerDown={(e) => {
                        e.preventDefault();
                        handleHit(laneIndex);
                    }}
                    style={{ touchAction: 'none' }}
                  >
                      {/* Key Hint */}
                      <div className="absolute bottom-2 w-full text-center z-20 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                          <span className="text-white font-bold text-xl uppercase px-3 py-1 bg-black/50 rounded border border-gray-600">
                             {KEYS[laneIndex]}
                          </span>
                      </div>

                      {/* Notes within this lane */}
                      {activeNotes.filter(n => n.lane === laneIndex).map(note => {
                          // Calculate position (0% at top, targetLineY% at targetTime)
                          const now = Date.now();
                          const flightTime = LEVEL_CONFIG[difficulty].fallDuration;
                          const elapsed = now - note.spawnTime;
                          const progress = elapsed / flightTime; // 1 when at target Line
                          const yPercent = progress * targetLineY;

                          if (note.status !== 'falling' && note.status !== 'missed') return null; // Hidden if hit

                          return (
                              <div
                                  key={note.id}
                                  className={`absolute w-3/4 left-[12.5%] h-8 rounded shadow-lg transition-opacity ${note.status === 'missed' ? 'opacity-20 grayscale' : 'opacity-100'}`}
                                  style={{
                                      top: `${yPercent}%`,
                                      backgroundColor: COLORS[note.lane],
                                      boxShadow: note.status === 'falling' ? `0 0 15px ${COLORS[note.lane]}` : 'none'
                                  }}
                              />
                          );
                      })}

                      {/* Action Feedback Area (bottom glow) */}
                      <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-white/10 to-transparent opacity-0 group-active:opacity-100 transition-opacity pointer-events-none z-10"></div>
                  </div>
              ))}
          </div>
        </div>
      )}

      {gameState === 'result' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-purple-500/20 animate-fade-in-up mt-8">
          <h2 className="text-5xl font-black text-white mb-2">TRACK COMPLETE</h2>
          <p className="text-gray-500 font-mono text-sm mb-10">
              Rhythm evaluation generated.
          </p>
          
          <div className="grid grid-cols-2 gap-6 w-full mb-10">
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Final Score</div>
              <div className="text-4xl font-black text-white">{score}</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Max Combo</div>
              <div className="text-4xl font-black text-pink-500">x{maxCombo}</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">XP Earned</div>
              <div className="text-4xl font-black text-purple-400">+{Math.floor(score / 2)}⚡</div>
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
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-purple-500/20"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-out-up {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-50px) scale(1.2); }
        }
        .animate-fade-out-up {
           animation: fade-out-up 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
