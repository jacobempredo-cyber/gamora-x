import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const LEVEL_CONFIG = {
  easy: { size: 6, blinkInterval: 1200, time: 45, baseReward: 50 },
  medium: { size: 8, blinkInterval: 900, time: 60, baseReward: 100 },
  hard: { size: 10, blinkInterval: 600, time: 90, baseReward: 150 }
};

export default function PathEscape() {
  const { currentUser, userProfile } = useAuth();
  
  const [gameState, setGameState] = useState('idle'); // idle, playing, result
  const [difficulty, setDifficulty] = useState('medium');
  const [grid, setGrid] = useState([]);
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [retries, setRetries] = useState(0);
  const [blinkerState, setBlinkerState] = useState(true);

  const gameTimerRef = useRef(null);
  const blinkTimerRef = useRef(null);

  const generateGrid = (diff) => {
    const { size } = LEVEL_CONFIG[diff];
    const newGrid = [];
    
    // Initialize empty grid
    for(let y = 0; y < size; y++) {
        const row = [];
        for(let x = 0; x < size; x++) {
            row.push({ type: 'void' });
        }
        newGrid.push(row);
    }
    
    newGrid[0][0] = { type: 'start' };
    newGrid[size-1][size-1] = { type: 'exit' };

    // Carve a guaranteed safe path (mostly safe, maybe a few blinkers)
    let cx = 0; let cy = 0;
    while(cx < size - 1 || cy < size - 1) {
        if (cx === size - 1) cy++;
        else if (cy === size - 1) cx++;
        else Math.random() > 0.5 ? cx++ : cy++;
        
        if (!(cx === size-1 && cy === size-1)) {
            newGrid[cy][cx] = { type: Math.random() > 0.8 ? 'blinker' : 'safe', inverted: false };
        }
    }

    // Fill the rest randomly
    for(let y = 0; y < size; y++) {
        for(let x = 0; x < size; x++) {
            if (newGrid[y][x].type === 'void') {
                const r = Math.random();
                if (diff === 'easy') {
                    if (r < 0.4) newGrid[y][x] = { type: 'safe' };
                    else if (r < 0.6) newGrid[y][x] = { type: 'blinker', inverted: Math.random() > 0.5 };
                } else if (diff === 'medium') {
                    if (r < 0.3) newGrid[y][x] = { type: 'safe' };
                    else if (r < 0.7) newGrid[y][x] = { type: 'blinker', inverted: Math.random() > 0.5 };
                } else {
                    if (r < 0.2) newGrid[y][x] = { type: 'safe' };
                    else if (r < 0.8) newGrid[y][x] = { type: 'blinker', inverted: Math.random() > 0.5 };
                }
            }
        }
    }
    
    return newGrid;
  };

  const startLevel = (diff) => {
    setDifficulty(diff);
    const newGrid = generateGrid(diff);
    setGrid(newGrid);
    setPlayerPos({ x: 0, y: 0 });
    setTimeLeft(LEVEL_CONFIG[diff].time);
    setScore(0);
    setRetries(0);
    setBlinkerState(true);
    setGameState('playing');
  };

  // Blinker Tick
  useEffect(() => {
    if (gameState === 'playing') {
      blinkTimerRef.current = setInterval(() => {
        setBlinkerState(prev => !prev);
      }, LEVEL_CONFIG[difficulty].blinkInterval);
      
      return () => clearInterval(blinkTimerRef.current);
    }
  }, [gameState, difficulty]);

  // Main Timer
  useEffect(() => {
    if (gameState === 'playing') {
      gameTimerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleGameOver(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(gameTimerRef.current);
    }
  }, [gameState]);

  // Check Death by Blinker Phase Change
  useEffect(() => {
    if (gameState === 'playing') {
      const cell = grid[playerPos.y]?.[playerPos.x];
      if (cell && cell.type === 'blinker') {
        const isSolid = cell.inverted ? !blinkerState : blinkerState;
        if (!isSolid) {
          // Fell through!
          handleResetToStart();
        }
      }
    }
  }, [blinkerState]); // Check every time blinkers switch

  const handleResetToStart = () => {
    setPlayerPos({ x: 0, y: 0 });
    setRetries(prev => prev + 1);
    // Visual feedback could be added here
  };

  const handleGameOver = async (isWin) => {
    setGameState('result');
    clearInterval(gameTimerRef.current);
    clearInterval(blinkTimerRef.current);

    let finalScore = 0;
    if (isWin) {
      const config = LEVEL_CONFIG[difficulty];
      const timeBonus = timeLeft * 2;
      const retryPenalty = retries * 15;
      finalScore = Math.max(10, config.baseReward + timeBonus - retryPenalty);
    }
    setScore(finalScore);

    if (currentUser && finalScore > 0) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          score: increment(finalScore),
          xp: increment(Math.floor(finalScore / 2)),
          coins: increment(Math.floor(finalScore / 10)),
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
  };

  const attemptMove = useCallback((dx, dy) => {
    if (gameState !== 'playing') return;
    
    setPlayerPos(prev => {
      const nx = prev.x + dx;
      const ny = prev.y + dy;
      const { size } = LEVEL_CONFIG[difficulty];
      
      // Bounds check
      if (nx < 0 || nx >= size || ny < 0 || ny >= size) return prev;
      
      const cell = grid[ny][nx];
      
      // Check hazards
      if (cell.type === 'void') return prev; // Cannot move into void
      
      if (cell.type === 'blinker') {
        const isSolid = cell.inverted ? !blinkerState : blinkerState;
        if (!isSolid) return prev; // Cannot move if it's currently invisible
      }
      
      // Win check
      if (cell.type === 'exit') {
        setTimeout(() => handleGameOver(true), 50); // slight delay for visual
        return { x: nx, y: ny };
      }
      
      return { x: nx, y: ny };
    });
  }, [gameState, grid, difficulty, blinkerState]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['ArrowUp', 'w', 'W'].includes(e.key)) attemptMove(0, -1);
      if (['ArrowDown', 's', 'S'].includes(e.key)) attemptMove(0, 1);
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) attemptMove(-1, 0);
      if (['ArrowRight', 'd', 'D'].includes(e.key)) attemptMove(1, 0);
      
      // Prevent scrolling with arrows
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && gameState === 'playing') {
          e.preventDefault();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attemptMove, gameState]);

  // Click/Touch controls (Click adjacent tile)
  const handleTileClick = (x, y) => {
    const dx = x - playerPos.x;
    const dy = y - playerPos.y;
    // Only allow adjacent cardinal moves
    if ((Math.abs(dx) === 1 && dy === 0) || (Math.abs(dy) === 1 && dx === 0)) {
        attemptMove(dx, dy);
    }
  };

  const getCellClasses = (cell, x, y) => {
    let classes = "w-full h-full rounded transition-all duration-300 relative overflow-hidden ";
    
    if (cell.type === 'start') classes += "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)] ";
    else if (cell.type === 'exit') classes += "bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] animate-pulse ";
    else if (cell.type === 'void') classes += "bg-transparent border border-gray-800/30 ";
    else if (cell.type === 'safe') classes += "bg-cyan-900/50 border border-cyan-500/20 ";
    else if (cell.type === 'blinker') {
      const isSolid = cell.inverted ? !blinkerState : blinkerState;
      if (isSolid) {
          classes += "bg-pink-500/80 shadow-[0_0_20px_rgba(236,72,153,0.6)] border border-pink-400 ";
      } else {
          classes += "bg-pink-500/5 border border-pink-500/10 opacity-30 ";
      }
    }

    if (x === playerPos.x && y === playerPos.y) {
        classes += " ring-4 ring-white shadow-[0_0_30px_rgba(255,255,255,1)] z-10 scale-110 ";
    }
    
    return classes;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col items-center min-h-screen">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        ← Back to Library
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 mb-2 tracking-tighter">
          PATH ESCAPE
        </h1>
        <p className="text-gray-400 font-mono italic">Time your moves. Don't fall into the void. ⏱️</p>
      </div>

      {gameState === 'idle' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-cyan-500/20">
          <div className="text-8xl mb-8 animate-pulse text-cyan-400">🏁</div>
          <h2 className="text-3xl font-bold text-white mb-4">Escape the Grid</h2>
          <div className="text-gray-400 mb-8 space-y-2 text-center text-sm w-3/4">
             <p>Navigate from the <span className="text-green-500 font-bold">Start</span> to the <span className="text-yellow-500 font-bold">Exit</span>.</p>
             <p>Beware of <span className="text-pink-500 font-bold">Pink</span> tiles, they blink in and out of existence!</p>
             <p>Use <strong>WASD</strong>, <strong>Arrow Keys</strong>, or <strong>Click adjacent tiles</strong> to move.</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {['easy', 'medium', 'hard'].map(lvl => (
              <button
                key={lvl}
                onClick={() => startLevel(lvl)}
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
          {/* HUD */}
          <div className="w-full flex justify-between items-center mb-8 px-6 bg-gray-900/60 p-4 rounded-2xl border border-white/5 backdrop-blur-md max-w-3xl">
             <div className="flex flex-col">
               <span className="text-[10px] text-gray-500 font-black uppercase">Retries</span>
               <span className="text-2xl font-black text-red-400 leading-none">{retries}</span>
             </div>
             
             <div className="flex flex-col items-center">
               <span className="text-[10px] text-gray-500 font-black uppercase mb-1">Time Left</span>
               <span className={`text-4xl font-black ${timeLeft < 10 ? 'text-red-500 animate-bounce' : 'text-cyan-400'}`}>
                 {timeLeft}s
               </span>
             </div>

             <div className="flex flex-col items-end">
                 <span className="text-[10px] text-gray-500 font-black uppercase">Intensity</span>
                 <span className="text-xl font-black text-white leading-none uppercase">{difficulty}</span>
             </div>
          </div>

          {/* Grid Container */}
          <div 
             className="glass-card p-4 border-white/10 shadow-2xl shadow-cyan-900/20 max-w-full overflow-hidden"
             style={{ touchAction: 'none' }} // Prevent scroll on mobile touch
          >
             <div 
                className="grid gap-1.5 md:gap-2"
                style={{
                   gridTemplateColumns: `repeat(${LEVEL_CONFIG[difficulty].size}, minmax(0, 1fr))`,
                   width: 'min(80vw, 500px)',
                   height: 'min(80vw, 500px)'
                }}
             >
                {grid.map((row, y) => 
                   row.map((cell, x) => (
                       <div 
                         key={`${x}-${y}`} 
                         className="relative"
                         onClick={() => handleTileClick(x, y)}
                       >
                           <div className={getCellClasses(cell, x, y)}>
                               {/* Player Avatar */}
                               {x === playerPos.x && y === playerPos.y && (
                                  <div className="absolute inset-0 flex items-center justify-center text-xl md:text-3xl filter drop-shadow-md z-20">
                                      {userProfile?.avatar || '🤠'}
                                  </div>
                               )}
                           </div>
                       </div>
                   ))
                )}
             </div>
          </div>
          
          <div className="mt-8 text-gray-500 text-sm font-black uppercase tracking-widest text-center animate-pulse">
              Tip: Study the blinking patterns before moving
          </div>
        </div>
      )}

      {gameState === 'result' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-cyan-500/20 animate-fade-in-up">
          <h2 className="text-5xl font-black text-white mb-2">RUN COMPLETE</h2>
          <p className="text-gray-500 font-mono text-sm mb-10">
              {score > 0 ? "You escaped the grid successfully." : "You ran out of time in the void."}
          </p>
          
          <div className="grid grid-cols-2 gap-6 w-full mb-10">
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Final Score</div>
              <div className="text-4xl font-black text-white">{score}</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Retries Used</div>
              <div className="text-4xl font-black text-red-500">{retries}</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">XP Earned</div>
              <div className="text-4xl font-black text-purple-400">+{Math.floor(score / 2)}⚡</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Coins</div>
              <div className="text-4xl font-black text-yellow-400">+{Math.floor(score / 10)}🪙</div>
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
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-cyan-500/20"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
