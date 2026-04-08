import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function Prediction() {
  const [gameState, setGameState] = useState('start'); // start, playing, predicting, result
  const [score, setScore] = useState(0);
  const [roundsLeft, setRoundsLeft] = useState(5);
  
  // Container refs for calculating boundaries
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Physics state
  const ballPos = useRef({ x: 0, y: 0 });
  const ballVel = useRef({ vx: 0, vy: 0 });
  const animationRef = useRef(null);
  
  // For rendering ball
  const [visiblePos, setVisiblePos] = useState({ x: 0, y: 0 });
  
  const [isBallVisible, setIsBallVisible] = useState(true);
  
  // User guess vs Actual
  const [guessPos, setGuessPos] = useState(null);
  const [actualPos, setActualPos] = useState(null);
  const [distance, setDistance] = useState(null);
  const [roundScore, setRoundScore] = useState(null);

  const BALL_SIZE = 40;
  const SPEED = 8;
  const INVISIBLE_DURATION = 1000; // time it keeps moving after turning invisible

  // Initialize and handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const startGame = () => {
    setScore(0);
    setRoundsLeft(5);
    startRound();
  };

  const startRound = () => {
    setGameState('playing');
    setIsBallVisible(true);
    setGuessPos(null);
    setActualPos(null);
    setDistance(null);
    setRoundScore(null);
    
    // Initial random position
    ballPos.current = {
      x: Math.random() * (containerSize.width - BALL_SIZE),
      y: Math.random() * (containerSize.height - BALL_SIZE)
    };
    
    // Random velocity
    const angle = Math.random() * Math.PI * 2;
    ballVel.current = {
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED
    };

    setVisiblePos({ ...ballPos.current });

    // Schedule invisibility
    const visibleTime = 2000 + Math.random() * 3000; // 2 to 5 seconds
    
    setTimeout(() => {
      if (gameState !== 'playing') return; // in case round ended early
      setIsBallVisible(false); // Ball goes transparent!
      
      // Keep moving for 'INVISIBLE_DURATION' then stop
      setTimeout(() => {
        stopBallAndPredict();
      }, INVISIBLE_DURATION);

    }, visibleTime);

    updatePhysics();
  };

  const updatePhysics = () => {
    if (!containerSize.width || !containerSize.height) return;

    ballPos.current.x += ballVel.current.vx;
    ballPos.current.y += ballVel.current.vy;

    // Bounce off walls
    if (ballPos.current.x <= 0) {
      ballPos.current.x = 0;
      ballVel.current.vx *= -1;
    } else if (ballPos.current.x >= containerSize.width - BALL_SIZE) {
      ballPos.current.x = containerSize.width - BALL_SIZE;
      ballVel.current.vx *= -1;
    }

    if (ballPos.current.y <= 0) {
      ballPos.current.y = 0;
      ballVel.current.vy *= -1;
    } else if (ballPos.current.y >= containerSize.height - BALL_SIZE) {
      ballPos.current.y = containerSize.height - BALL_SIZE;
      ballVel.current.vy *= -1;
    }

    setVisiblePos({ ...ballPos.current });
    animationRef.current = requestAnimationFrame(updatePhysics);
  };

  const stopBallAndPredict = () => {
    cancelAnimationFrame(animationRef.current);
    setGameState('predicting');
  };

  // Cleanup map animation
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleContainerClick = (e) => {
    if (gameState !== 'predicting') return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Actual center of ball
    const actualCenterX = ballPos.current.x + BALL_SIZE / 2;
    const actualCenterY = ballPos.current.y + BALL_SIZE / 2;

    const dist = Math.sqrt(
      Math.pow(x - actualCenterX, 2) + Math.pow(y - actualCenterY, 2)
    );

    // Calculate score based on distance (closer = better)
    // Max distance hypothetically depends on screen size, lets say max score is 1000
    // If distance < 20, perfect score. If distance > 400, 0 score.
    let rScore = 0;
    if (dist < BALL_SIZE/2) {
      rScore = 1000;
    } else if (dist < 400) {
      rScore = Math.floor(1000 - ((dist - BALL_SIZE/2) / (400 - BALL_SIZE/2)) * 1000);
    }
    
    setGuessPos({ x, y });
    setActualPos({ x: actualCenterX, y: actualCenterY });
    setDistance(Math.round(dist));
    setRoundScore(rScore);
    setScore(prev => prev + rScore);
    setGameState('result');
  };

  const nextRound = () => {
    if (roundsLeft <= 1) {
      setGameState('gameover');
    } else {
      setRoundsLeft(prev => prev - 1);
      startRound();
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto min-h-[85vh] flex flex-col">
      <div className="mb-6 flex justify-between items-center bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
        <div>
          <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400">
            PREDICTION STRIKE
          </h1>
          <p className="text-gray-400 text-sm uppercase tracking-widest font-bold">Predict the ball's final location!</p>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-purple-400 text-xs font-bold uppercase tracking-widest">Score</p>
            <p className="text-2xl font-black">{score}</p>
          </div>
          <div className="text-right">
            <p className="text-pink-400 text-xs font-bold uppercase tracking-widest">Rounds</p>
            <p className="text-2xl font-black">{roundsLeft === 6 ? 5 : roundsLeft}</p>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        onClick={handleContainerClick}
        className="flex-1 glass-card border-violet-500/20 relative overflow-hidden backdrop-blur-sm rounded-3xl"
        style={{ cursor: gameState === 'predicting' ? 'crosshair' : 'default' }}
      >
        {gameState === 'start' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 backdrop-blur-sm">
            <div className="text-center p-8 max-w-md">
              <div className="text-6xl mb-6">🔮</div>
              <h2 className="text-3xl font-black mb-4 uppercase">How to Play</h2>
              <p className="text-gray-300 font-bold mb-8">
                Watch the violet orb move. It will suddenly vanish and keep moving in the dark for 1 second before stopping completely.
                <br/><br/>
                Click exactly where you think the orb stopped!
              </p>
              <button 
                onClick={startGame}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl font-black uppercase text-xl tracking-widest hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all transform hover:scale-105"
              >
                Start Game
              </button>
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 backdrop-blur-md">
            <div className="text-6xl mb-6 text-yellow-400">🏆</div>
            <h2 className="text-5xl font-black mb-2 uppercase bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-yellow-600">Game Over</h2>
            <p className="text-gray-300 text-xl font-bold uppercase tracking-widest mb-8">Final Score: <span className="text-white text-3xl">{score}</span></p>
            <button 
              onClick={startGame}
              className="px-10 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl font-black uppercase tracking-widest hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all transform hover:scale-105"
            >
              Play Again
            </button>
          </div>
        )}

        {(gameState === 'playing' || gameState === 'predicting') && (
          <>
            {gameState === 'predicting' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                 <p className="text-gray-600/30 text-6xl font-black uppercase tracking-widest">Where is it?</p>
              </div>
            )}
            
            {/* The Ball */}
            <motion.div 
              className="absolute rounded-full shadow-[0_0_20px_rgba(139,92,246,0.8)] pointer-events-none"
              style={{
                width: BALL_SIZE,
                height: BALL_SIZE,
                left: visiblePos.x,
                top: visiblePos.y,
                background: 'radial-gradient(circle, #d946ef 0%, #8b5cf6 100%)',
                opacity: isBallVisible ? 1 : 0,
                transition: isBallVisible ? 'none' : 'opacity 0.2s ease-out'
              }}
            />
          </>
        )}

        {gameState === 'result' && actualPos && guessPos && (
          <>
            <div className="absolute inset-x-0 top-10 flex justify-center z-20 pointer-events-none animate-fade-in-down">
                <div className="bg-gray-900/90 py-3 px-8 rounded-full border border-gray-700 shadow-2xl backdrop-blur-md">
                    <p className="text-center font-bold uppercase tracking-widest mb-1 text-sm text-gray-400">
                        Distance: <span className="text-white">{distance}px</span>
                    </p>
                    <p className="text-center font-black uppercase text-2xl text-violet-400">
                        +{roundScore} Pts
                    </p>
                </div>
            </div>

            {/* Actual Position (Faded) */}
             <div 
              className="absolute rounded-full pointer-events-none flex items-center justify-center"
              style={{
                width: BALL_SIZE,
                height: BALL_SIZE,
                left: actualPos.x - BALL_SIZE/2,
                top: actualPos.y - BALL_SIZE/2,
                background: 'rgba(139, 92, 246, 0.5)',
                border: '2px solid #a855f7'
              }}
            >
                <span className="text-xs absolute -top-6 text-violet-400 font-bold uppercase">Actual</span>
            </div>

             {/* Guessed Position */}
             <div 
              className="absolute rounded-full pointer-events-none flex items-center justify-center bg-red-500/50 border-2 border-red-500"
              style={{
                width: 16,
                height: 16,
                left: guessPos.x - 8,
                top: guessPos.y - 8,
              }}
            >
                 <span className="text-xs absolute -top-6 text-red-400 font-bold uppercase">Guess</span>
            </div>

            {/* Connecting Line using SVG */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
               <line 
                  x1={actualPos.x} 
                  y1={actualPos.y} 
                  x2={guessPos.x} 
                  y2={guessPos.y} 
                  stroke="rgba(255,100,100, 0.6)" 
                  strokeWidth="2" 
                  strokeDasharray="4 4"
               />
            </svg>

            <button 
              onClick={nextRound}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white text-black px-8 py-3 rounded-full font-black uppercase tracking-widest hover:bg-gray-200 transition-colors z-30"
            >
               {roundsLeft <= 1 ? 'Finish Game' : 'Next Round'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
