import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import API_BASE_URL from '../config';

const GRID_SIZE = 20;
const CANVAS_SIZE = 400;
const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };

export default function Snake() {
  const { currentUser, userProfile } = useAuth();
  const canvasRef = useRef(null);
  
  // Game State
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState({ x: 5, y: 5 });
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [difficulty, setDifficulty] = useState('medium'); // 'easy', 'medium', 'hard'
  
  // Fetch high score from Firestore on load
  useEffect(() => {
    if (userProfile?.snakeHighScore) {
      setHighScore(userProfile.snakeHighScore);
    }
  }, [userProfile]);
  
  // Difficulty Settings
  const DIFFICULTY_SETTINGS = {
    easy: { speed: 150, multiplier: 1 },
    medium: { speed: 100, multiplier: 2 },
    hard: { speed: 60, multiplier: 3 }
  };

  // Game Loop
  useEffect(() => {
    if (isPaused || isGameOver) return;

    const moveSnake = () => {
      const newSnake = [...snake];
      const head = { x: newSnake[0].x + direction.x, y: newSnake[0].y + direction.y };

      // Wall Collision
      if (head.x < 0 || head.x >= CANVAS_SIZE / GRID_SIZE || head.y < 0 || head.y >= CANVAS_SIZE / GRID_SIZE) {
        return endGame();
      }

      // Self Collision
      if (newSnake.some(segment => segment.x === head.x && segment.y === head.y)) {
        return endGame();
      }

      newSnake.unshift(head);

      // Food Collision
      if (head.x === food.x && head.y === food.y) {
        setScore(prev => prev + (10 * DIFFICULTY_SETTINGS[difficulty].multiplier));
        generateFood(newSnake);
      } else {
        newSnake.pop();
      }

      setSnake(newSnake);
    };

    const gameInterval = setInterval(moveSnake, DIFFICULTY_SETTINGS[difficulty].speed);
    return () => clearInterval(gameInterval);
  }, [snake, direction, isPaused, isGameOver, food, difficulty]);

  // Handle Controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isPaused) {
        if (e.key === ' ' || e.key === 'Enter') setIsPaused(false);
        return;
      }
      
      switch (e.key) {
        case 'ArrowUp': if (direction.y !== 1) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y !== -1) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x !== 1) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x !== -1) setDirection({ x: 1, y: 0 }); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction, isPaused]);

  // Render Loop
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw Grid Lines (Subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < CANVAS_SIZE; i += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CANVAS_SIZE, i); ctx.stroke();
    }

    // Draw Snake
    newSnakePath(ctx, snake);

    // Draw Food
    drawFood(ctx, food);
  }, [snake, food]);

  const newSnakePath = (ctx, segments) => {
    segments.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#00f0ff' : '#00b4d8';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f0ff';
      ctx.beginPath();
      ctx.roundRect(segment.x * GRID_SIZE + 1, segment.y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
  };

  const drawFood = (ctx, pos) => {
    ctx.fillStyle = '#ff006e';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff006e';
    ctx.beginPath();
    ctx.arc(pos.x * GRID_SIZE + GRID_SIZE / 2, pos.y * GRID_SIZE + GRID_SIZE / 2, GRID_SIZE / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  const generateFood = (currentSnake) => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)),
        y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE))
      };
      if (!currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) break;
    }
    setFood(newFood);
  };

  const endGame = async () => {
    setIsGameOver(true);
    const isNewHighScore = score > (userProfile?.snakeHighScore || 0);
    if (score > highScore) setHighScore(score);
    
    if (currentUser) {
      try {
        const earnedXp = Math.floor(score * 2);
        const earnedCoins = Math.floor(score / 5);
        
        const userRef = doc(db, 'users', currentUser.uid);
        const updateData = { 
          score: increment(score), 
          xp: increment(earnedXp), 
          coins: increment(earnedCoins) 
        };
        
        if (isNewHighScore) {
          updateData.snakeHighScore = score;
        }

        await updateDoc(userRef, updateData);
        
        const lbRef = doc(db, 'leaderboard', currentUser.uid);
        await setDoc(lbRef, { 
          username: userProfile.username, 
          avatar: userProfile.avatar || '', 
          score: increment(score), 
          updatedAt: new Date() 
        }, { merge: true });

        updateTaskProgress('play_any');
      } catch (error) { console.error("Error saving snake score:", error); }
    }
  };

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setScore(0);
    setIsGameOver(false);
    setIsPaused(true);
  };

  const updateTaskProgress = async (taskId) => {
    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`${API_BASE_URL}/api/tasks/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ taskId }),
      });
    } catch (error) { console.error('Error updating task progress:', error); }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
      
      <div className="w-full flex justify-between items-center mb-10">
        <Link to="/games" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Exit Arena
        </Link>
        <div className="text-center">
           <h1 className="text-5xl font-black neon-text-cyan tracking-tighter uppercase">NEON SNAKE</h1>
           <p className="text-[10px] text-gray-500 uppercase tracking-[0.5em] mt-1">Retro Refactored</p>
        </div>
        <div className="text-right">
           <div className="text-[10px] text-gray-500 uppercase font-black">Session High</div>
           <div className="text-2xl font-black text-white">{highScore}</div>
        </div>
      </div>

      <div className="relative glass-card p-4 border-cyan-500/20 bg-gray-900/50">
        
        {/* Score Overlay */}
        <div className="absolute -top-12 left-0 flex items-center gap-6">
           <div className="flex flex-col">
              <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest leading-none">Current Score</span>
              <span className="text-3xl font-black text-cyan-400 font-mono tracking-tighter">{score}</span>
           </div>
           <div className="h-8 w-px bg-gray-800"></div>
           <div className="flex flex-col opacity-60">
              <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest leading-none">Difficulty</span>
              <span className="text-lg font-black text-white uppercase tracking-widest">{difficulty}</span>
           </div>
        </div>

        <canvas 
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="rounded-lg outline outline-1 outline-gray-800"
        />

        {/* Start / Pause Overlay */}
        {isPaused && !isGameOver && (
          <div className="absolute inset-4 rounded-lg bg-gray-950/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-10 z-20">
            <div className="text-6xl mb-6 animate-pulse">🐍</div>
            <h2 className="text-3xl font-black text-white mb-2 tracking-tighter">READY TO STRIKE?</h2>
            <p className="text-gray-400 text-sm mb-8">Use arrow keys to slither. Eat neon pellets to grow.</p>
            
            <div className="flex gap-4 mb-8">
               {['easy', 'medium', 'hard'].map(d => (
                 <button 
                  key={d} onClick={() => setDifficulty(d)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${difficulty === d ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'bg-gray-900 text-gray-500 hover:text-white border border-gray-800'}`}
                 >
                   {d}
                 </button>
               ))}
            </div>

            <button 
              onClick={() => setIsPaused(false)}
              className="px-10 py-4 bg-cyan-600 text-white rounded-xl font-black hover:bg-cyan-500 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] uppercase tracking-widest"
            >
              INITIALIZE TRANSMISSION
            </button>
            <p className="text-[10px] text-gray-600 mt-4 font-mono font-bold uppercase tracking-widest animate-pulse">Press SPACE or Click START</p>
          </div>
        )}

        {/* Game Over Overlay */}
        {isGameOver && (
          <div className="absolute inset-4 rounded-lg bg-gray-950/90 backdrop-blur-xl flex flex-col items-center justify-center text-center p-10 z-30 animate-fade-in">
            <div className="text-7xl mb-4">💥</div>
            <h2 className="text-4xl font-black text-red-500 mb-2 tracking-tighter">SYSTEM COLLAPSE</h2>
            <div className="text-6xl font-black text-white mb-8">{score} <span className="text-xs text-gray-500 block uppercase tracking-widest font-bold">TOTAL POINTS</span></div>
            
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 mb-8 w-full">
               <div className="text-xs text-gray-500 uppercase mb-4 tracking-widest font-black">Transmission Rewards Fetched</div>
               <div className="flex justify-around">
                  <div className="flex flex-col"><span className="text-2xl font-black text-purple-400">+{Math.floor(score * 2)}</span><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">XP</span></div>
                  <div className="flex flex-col"><span className="text-2xl font-black text-yellow-400">+{Math.floor(score / 5)}</span><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">COINS</span></div>
               </div>
            </div>

            <div className="flex gap-4 w-full">
              <button 
                onClick={resetGame}
                className="flex-1 px-6 py-4 bg-white text-black rounded-xl font-black hover:bg-gray-200 transition-all uppercase tracking-widest text-sm"
              >
                REBOOT
              </button>
              <Link 
                to="/games"
                className="flex-1 px-6 py-4 bg-gray-800 text-gray-400 border border-gray-700 rounded-xl font-black hover:text-white transition-all uppercase tracking-widest text-sm"
              >
                DISCONNECT
              </Link>
            </div>
          </div>
        )}

        {/* On-Screen Mobile Controls (Visible always to help users) */}
        {!isGameOver && (
          <div className="mt-8 flex flex-col items-center gap-2 lg:opacity-30 hover:opacity-100 transition-opacity">
            <button onClick={() => direction.y !== 1 && setDirection({ x: 0, y: -1 })} className="p-3 bg-gray-800 rounded-lg hover:bg-cyan-500/20 active:scale-95 transition-all">⬆️</button>
            <div className="flex gap-4">
              <button onClick={() => direction.x !== 1 && setDirection({ x: -1, y: 0 })} className="p-3 bg-gray-800 rounded-lg hover:bg-cyan-500/20 active:scale-95 transition-all">⬅️</button>
              <button onClick={() => direction.y !== -1 && setDirection({ x: 0, y: 1 })} className="p-3 bg-gray-800 rounded-lg hover:bg-cyan-500/20 active:scale-95 transition-all">⬇️</button>
              <button onClick={() => direction.x !== -1 && setDirection({ x: 1, y: 0 })} className="p-3 bg-gray-800 rounded-lg hover:bg-cyan-500/20 active:scale-95 transition-all">➡️</button>
            </div>
          </div>
        )}
      </div>

      {/* Retro Scanlines Effect Component */}
      <div className="mt-12 text-center">
         <p className="text-[10px] text-gray-700 font-black tracking-widest uppercase mb-4">Transmission provided by Gamora X Satellite Uplink v2.4</p>
         <div className="flex justify-center gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-1 h-8 bg-gray-900 flex items-end">
                 <div className="w-full bg-cyan-500/20 animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.2}s` }}></div>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
