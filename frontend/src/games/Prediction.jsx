import React, { useState, useEffect, useRef } from 'react';

export default function Prediction() {
  const [gameState, setGameState] = useState('start'); // start, playing, predicting, result, gameover
  const [score, setScore] = useState(0);
  const [roundsLeft, setRoundsLeft] = useState(5);

  const containerRef = useRef(null);
  const containerSize = useRef({ width: 0, height: 0 });

  const ballPos = useRef({ x: 0, y: 0 });
  const ballVel = useRef({ vx: 0, vy: 0 });
  const animationRef = useRef(null);
  const visibilityTimerRef = useRef(null);
  const stopTimerRef = useRef(null);
  const gameStateRef = useRef('start');

  const [visiblePos, setVisiblePos] = useState({ x: 0, y: 0 });
  const [isBallVisible, setIsBallVisible] = useState(true);
  const [guessPos, setGuessPos] = useState(null);
  const [actualPos, setActualPos] = useState(null);
  const [distance, setDistance] = useState(null);
  const [roundScore, setRoundScore] = useState(null);

  const BALL_SIZE = 28;
  const SPEED = 6;
  const INVISIBLE_DURATION = 1000;

  const updateSize = () => {
    if (containerRef.current) {
      containerSize.current = {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      };
    }
  };

  useEffect(() => {
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationRef.current);
      clearTimeout(visibilityTimerRef.current);
      clearTimeout(stopTimerRef.current);
    };
  }, []);

  const setGS = (state) => {
    gameStateRef.current = state;
    setGameState(state);
  };

  const startGame = () => {
    setScore(0);
    setRoundsLeft(5);
    beginRound(5);
  };

  const beginRound = (rounds) => {
    cancelAnimationFrame(animationRef.current);
    clearTimeout(visibilityTimerRef.current);
    clearTimeout(stopTimerRef.current);

    updateSize();
    setGS('playing');
    setIsBallVisible(true);
    setGuessPos(null);
    setActualPos(null);
    setDistance(null);
    setRoundScore(null);

    const { width, height } = containerSize.current;

    ballPos.current = {
      x: BALL_SIZE + Math.random() * (width - BALL_SIZE * 3),
      y: BALL_SIZE + Math.random() * (height - BALL_SIZE * 3),
    };

    const angle = Math.random() * Math.PI * 2;
    ballVel.current = {
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED,
    };

    setVisiblePos({ ...ballPos.current });

    const visibleTime = 2000 + Math.random() * 3000;

    visibilityTimerRef.current = setTimeout(() => {
      setIsBallVisible(false);
      stopTimerRef.current = setTimeout(() => {
        cancelAnimationFrame(animationRef.current);
        setGS('predicting');
      }, INVISIBLE_DURATION);
    }, visibleTime);

    const loop = () => {
      if (gameStateRef.current !== 'playing') return;
      const { width, height } = containerSize.current;

      ballPos.current.x += ballVel.current.vx;
      ballPos.current.y += ballVel.current.vy;

      if (ballPos.current.x <= 0) { ballPos.current.x = 0; ballVel.current.vx *= -1; }
      else if (ballPos.current.x >= width - BALL_SIZE) { ballPos.current.x = width - BALL_SIZE; ballVel.current.vx *= -1; }

      if (ballPos.current.y <= 0) { ballPos.current.y = 0; ballVel.current.vy *= -1; }
      else if (ballPos.current.y >= height - BALL_SIZE) { ballPos.current.y = height - BALL_SIZE; ballVel.current.vy *= -1; }

      setVisiblePos({ ...ballPos.current });
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
  };

  const handleContainerClick = (e) => {
    if (gameStateRef.current !== 'predicting') return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const actualCX = ballPos.current.x + BALL_SIZE / 2;
    const actualCY = ballPos.current.y + BALL_SIZE / 2;

    const dist = Math.sqrt(Math.pow(x - actualCX, 2) + Math.pow(y - actualCY, 2));

    let rScore = 0;
    if (dist < BALL_SIZE / 2) {
      rScore = 1000;
    } else if (dist < 400) {
      rScore = Math.floor(1000 - ((dist - BALL_SIZE / 2) / (400 - BALL_SIZE / 2)) * 1000);
      rScore = Math.max(0, rScore);
    }

    setGuessPos({ x, y });
    setActualPos({ x: actualCX, y: actualCY });
    setDistance(Math.round(dist));
    setRoundScore(rScore);
    setScore(prev => prev + rScore);
    setGS('result');
  };

  const nextRound = () => {
    if (roundsLeft <= 1) {
      setGS('gameover');
    } else {
      const next = roundsLeft - 1;
      setRoundsLeft(next);
      beginRound(next);
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', padding: '8px 16px', boxSizing: 'border-box', gap: '8px' }}>
      {/* Compact Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(17,24,39,0.8)',
        border: '1px solid rgba(109,40,217,0.3)',
        borderRadius: '12px',
        padding: '8px 16px',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{
            fontSize: '1.1rem',
            fontWeight: 900,
            background: 'linear-gradient(to right, #a78bfa, #e879f9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>🔮 Prediction Strike</h1>
          <p style={{ color: '#6b7280', fontSize: '0.65rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
            Predict the ball's final location!
          </p>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#a78bfa', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Score</p>
            <p style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 900, margin: 0 }}>{score}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#f472b6', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>Rounds</p>
            <p style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 900, margin: 0 }}>{roundsLeft}</p>
          </div>
        </div>
      </div>

      {/* Game Canvas */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '16px',
          background: 'rgba(10,6,20,0.9)',
          border: '1px solid rgba(109,40,217,0.2)',
          cursor: gameState === 'predicting' ? 'crosshair' : 'default',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* START SCREEN */}
        {gameState === 'start' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 10,
          }}>
            <div style={{ textAlign: 'center', padding: '24px', maxWidth: '360px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔮</div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '10px' }}>How to Play</h2>
              <p style={{ color: '#d1d5db', fontSize: '0.85rem', fontWeight: 600, marginBottom: '20px', lineHeight: 1.6 }}>
                Watch the orb bounce. It will suddenly <span style={{ color: '#a78bfa' }}>vanish</span> and keep moving for <b>1 second</b> before stopping.
                <br />Click where you think it stopped!
              </p>
              <button
                onClick={startGame}
                style={{
                  width: '100%', padding: '12px', background: 'linear-gradient(to right, #7c3aed, #c026d3)',
                  border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 900,
                  fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                  cursor: 'pointer', boxShadow: '0 0 20px rgba(139,92,246,0.5)',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => e.target.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.target.style.transform = 'scale(1)'}
              >
                Start Game
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER SCREEN */}
        {gameState === 'gameover' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', zIndex: 20,
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏆</div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', background: 'linear-gradient(to right, #fde047, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Game Over
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '20px' }}>
              Final Score: <span style={{ color: '#fff', fontSize: '1.5rem' }}>{score}</span>
            </p>
            <button
              onClick={startGame}
              style={{
                padding: '10px 32px', background: 'linear-gradient(to right, #7c3aed, #c026d3)',
                border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 900,
                fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em',
                cursor: 'pointer', boxShadow: '0 0 20px rgba(139,92,246,0.5)',
              }}
            >
              Play Again
            </button>
          </div>
        )}

        {/* PREDICTING HINT */}
        {gameState === 'predicting' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 0,
          }}>
            <p style={{ color: 'rgba(109,40,217,0.15)', fontSize: '3rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              WHERE IS IT?
            </p>
          </div>
        )}

        {/* THE BALL */}
        {(gameState === 'playing' || gameState === 'predicting') && (
          <div
            style={{
              position: 'absolute',
              width: BALL_SIZE,
              height: BALL_SIZE,
              left: visiblePos.x,
              top: visiblePos.y,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #e879f9 0%, #7c3aed 100%)',
              boxShadow: '0 0 16px rgba(167,139,250,0.9), 0 0 30px rgba(139,92,246,0.5)',
              opacity: isBallVisible ? 1 : 0,
              transition: isBallVisible ? 'none' : 'opacity 0.15s ease-out',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />
        )}

        {/* RESULT OVERLAY */}
        {gameState === 'result' && actualPos && guessPos && (
          <>
            {/* Score popup */}
            <div style={{
              position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(17,24,39,0.95)', borderRadius: '30px', padding: '6px 20px',
              border: '1px solid rgba(109,40,217,0.4)', backdropFilter: 'blur(8px)', zIndex: 20,
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <p style={{ color: '#9ca3af', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 2px 0' }}>
                Distance: <span style={{ color: '#fff' }}>{distance}px</span>
              </p>
              <p style={{ color: '#a78bfa', fontSize: '1.1rem', fontWeight: 900, margin: 0 }}>+{roundScore} pts</p>
            </div>

            {/* SVG connecting line */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
              <line
                x1={actualPos.x} y1={actualPos.y}
                x2={guessPos.x} y2={guessPos.y}
                stroke="rgba(248,113,113,0.6)" strokeWidth="2" strokeDasharray="5 4"
              />
            </svg>

            {/* Actual ball */}
            <div style={{
              position: 'absolute',
              width: BALL_SIZE, height: BALL_SIZE,
              left: actualPos.x - BALL_SIZE / 2, top: actualPos.y - BALL_SIZE / 2,
              borderRadius: '50%',
              background: 'rgba(139,92,246,0.5)',
              border: '2px solid #a78bfa',
              pointerEvents: 'none', zIndex: 12,
            }}>
              <span style={{ position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.55rem', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Actual</span>
            </div>

            {/* Guess marker */}
            <div style={{
              position: 'absolute',
              width: 14, height: 14,
              left: guessPos.x - 7, top: guessPos.y - 7,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.6)',
              border: '2px solid #ef4444',
              pointerEvents: 'none', zIndex: 12,
            }}>
              <span style={{ position: 'absolute', top: '-18px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.55rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Guess</span>
            </div>

            {/* Next round button */}
            <button
              onClick={nextRound}
              style={{
                position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
                background: '#fff', color: '#000', border: 'none', borderRadius: '30px',
                padding: '8px 28px', fontWeight: 900, fontSize: '0.8rem',
                textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer', zIndex: 30,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.target.style.background = '#e5e7eb'}
              onMouseLeave={e => e.target.style.background = '#fff'}
            >
              {roundsLeft <= 1 ? 'Finish Game' : 'Next Round →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
