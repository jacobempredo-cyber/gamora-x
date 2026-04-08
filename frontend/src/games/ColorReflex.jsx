import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, updateDoc, increment, setDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';

// Full color palette
const ALL_COLORS = [
  { name: 'RED',    hex: '#ef4444', value: 'red'    },
  { name: 'BLUE',   hex: '#3b82f6', value: 'blue'   },
  { name: 'GREEN',  hex: '#22c55e', value: 'green'  },
  { name: 'YELLOW', hex: '#eab308', value: 'yellow' },
  { name: 'PURPLE', hex: '#a855f7', value: 'purple' },
  { name: 'ORANGE', hex: '#f97316', value: 'orange' },
  { name: 'PINK',   hex: '#ec4899', value: 'pink'   },
  { name: 'CYAN',   hex: '#06b6d4', value: 'cyan'   },
  { name: 'LIME',   hex: '#84cc16', value: 'lime'   },
  { name: 'TEAL',   hex: '#14b8a6', value: 'teal'   },
];

const DIFFICULTY = {
  easy:   { poolSize: 4, questionTime: 5, pointsPerCorrect: 10, penalty: 0,   label: 'Easy',   rounds: 10 },
  medium: { poolSize: 7, questionTime: 4, pointsPerCorrect: 20, penalty: 5,   label: 'Medium', rounds: 12 },
  hard:   { poolSize: 10, questionTime: 3, pointsPerCorrect: 40, penalty: 15, label: 'Hard',   rounds: 15 },
};

// Fisher-Yates shuffle
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Generate a full non-repeating round queue
const generateQueue = (pool) => {
  const used = new Set();
  const queue = [];

  const shuffledWords = shuffle(pool);

  for (const wordColor of shuffledWords) {
    let attempts = 0;
    let displayColor;
    do {
      displayColor = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    } while (
      (displayColor.value === wordColor.value || used.has(`${wordColor.value}-${displayColor.value}`))
      && attempts < 20
    );

    used.add(`${wordColor.value}-${displayColor.value}`);
    queue.push({
      word:         wordColor.name,
      displayColor: displayColor.hex,
      correctValue: displayColor.value,
      correctName:  displayColor.name,
      options:      shuffle(pool),
    });
  }
  return queue;
};

export default function ColorReflex() {
  const { currentUser, userProfile } = useAuth();

  const [gameState, setGameState]     = useState('idle');
  const [difficulty, setDifficulty]   = useState('medium');
  const [score, setScore]             = useState(0);
  const [streak, setStreak]           = useState(0);
  const [maxStreak, setMaxStreak]     = useState(0);
  const [questionTime, setQuestionTime] = useState(4);
  const [timeLeft, setTimeLeft]       = useState(4);
  const [currentQ, setCurrentQ]       = useState(null);
  const [queueRef, setQueueRef]       = useState([]);
  const [roundNum, setRoundNum]       = useState(0);
  const [totalRounds, setTotalRounds] = useState(12);
  const [feedback, setFeedback]       = useState(null); // 'correct' | 'wrong' | 'timeout'
  const [answered, setAnswered]       = useState(false);

  const timerRef   = useRef(null);
  const streakRef  = useRef(0);
  const maxRef     = useRef(0);

  // ─── Start game ───────────────────────────────────────────────────────────
  const startGame = (diff) => {
    const cfg  = DIFFICULTY[diff];
    const pool = ALL_COLORS.slice(0, cfg.poolSize);
    const q    = generateQueue(pool);

    setDifficulty(diff);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    streakRef.current = 0;
    maxRef.current    = 0;
    setRoundNum(1);
    setTotalRounds(cfg.rounds);
    setQuestionTime(cfg.questionTime);
    setTimeLeft(cfg.questionTime);
    setQueueRef(q.slice(1));
    setCurrentQ(q[0]);
    setFeedback(null);
    setAnswered(false);
    setGameState('playing');
  };

  // ─── Per-question countdown ───────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== 'playing' || answered) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.05) {
          clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 0.05;
      });
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [gameState, currentQ, answered]);

  const handleTimeout = useCallback(() => {
    clearInterval(timerRef.current);
    setAnswered(true);
    streakRef.current = 0;
    setStreak(0);
    setFeedback('timeout');
    setTimeout(() => advanceQuestion(), 800);
  }, []);

  // ─── Handle a color button click ─────────────────────────────────────────
  const handleChoice = useCallback((choiceValue) => {
    if (gameState !== 'playing' || answered || !currentQ) return;
    clearInterval(timerRef.current);
    setAnswered(true);

    if (choiceValue === currentQ.correctValue) {
      const newStreak = streakRef.current + 1;
      streakRef.current = newStreak;
      if (newStreak > maxRef.current) maxRef.current = newStreak;
      setStreak(newStreak);
      setMaxStreak(maxRef.current);

      const cfg = DIFFICULTY[difficulty];
      const streakBonus = Math.floor(newStreak / 3) * 10;
      setScore(prev => prev + cfg.pointsPerCorrect + streakBonus);
      setFeedback('correct');
    } else {
      streakRef.current = 0;
      setStreak(0);
      setScore(prev => Math.max(0, prev - DIFFICULTY[difficulty].penalty));
      setFeedback('wrong');
    }

    setTimeout(() => advanceQuestion(), 500);
  }, [gameState, answered, currentQ, difficulty]);

  const advanceQuestion = useCallback(() => {
    setQueueRef(prev => {
      if (prev.length === 0 || roundNum >= totalRounds) {
        endGame();
        return prev;
      }
      setCurrentQ(prev[0]);
      setRoundNum(r => r + 1);
      setFeedback(null);
      setAnswered(false);
      setTimeLeft(DIFFICULTY[difficulty].questionTime);
      return prev.slice(1);
    });
  }, [roundNum, totalRounds, difficulty]);

  const endGame = useCallback(async () => {
    setGameState('result');
    clearInterval(timerRef.current);

    if (currentUser && score > 0) {
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
        console.error('Error saving score:', err);
      }
    }
  }, [currentUser, score, userProfile]);

  // Keyboard support (1-4 / 1-7 / 1-10)
  useEffect(() => {
    const onKey = (e) => {
      if (gameState !== 'playing' || !currentQ || answered) return;
      const idx = parseInt(e.key) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < currentQ.options.length) {
        handleChoice(currentQ.options[idx].value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState, currentQ, answered, handleChoice]);

  const timePct = (timeLeft / questionTime) * 100;
  const cfg     = DIFFICULTY[difficulty];
  const pool    = ALL_COLORS.slice(0, cfg.poolSize);

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col items-center min-h-screen">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-6 flex items-center gap-2 transition-colors text-sm font-bold">
        ← Back to Library
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-2 tracking-tighter">
          COLOR REFLEX
        </h1>
        <p className="text-gray-400 font-mono italic text-sm">Don't read the word — click the INK COLOR! 🧠</p>
      </div>

      {/* ── IDLE ──────────────────────────────────────────────────────────── */}
      {gameState === 'idle' && (
        <div className="glass-card w-full max-w-2xl p-10 flex flex-col items-center border-purple-500/20">
          <div className="text-7xl mb-6 animate-pulse">🧠</div>
          <h2 className="text-2xl font-bold text-white mb-3">Brain Teaser Ready</h2>
          <p className="text-gray-400 mb-4 text-center text-sm max-w-md leading-relaxed">
            You'll see a word like <span style={{ color: '#ef4444' }} className="font-black">BLUE</span> — but its ink color is <span style={{ color: '#ef4444' }} className="font-black">RED</span>.
            Click the <strong>ink color</strong>, <em>not the word!</em>
          </p>

          <div className="grid grid-cols-3 gap-4 w-full mb-2 px-4 text-xs text-gray-500 text-center font-bold uppercase tracking-widest">
            <div>🟢 Easy<br/><span className="text-white">4 colors • 5s/q • 10 rounds</span></div>
            <div>🟡 Medium<br/><span className="text-white">7 colors • 4s/q • 12 rounds</span></div>
            <div>🔴 Hard<br/><span className="text-white">10 colors • 3s/q • 15 rounds</span></div>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mt-6">
            {['easy', 'medium', 'hard'].map(lvl => (
              <button
                key={lvl}
                onClick={() => startGame(lvl)}
                className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 ${
                  lvl === 'hard'   ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]' :
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

      {/* ── PLAYING ───────────────────────────────────────────────────────── */}
      {gameState === 'playing' && currentQ && (
        <div className="w-full flex flex-col items-center max-w-3xl gap-4">
          {/* Stats bar */}
          <div className="w-full flex justify-between items-center bg-gray-900/60 px-6 py-3 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="text-center">
              <div className="text-[10px] text-gray-500 font-black uppercase">Difficulty</div>
              <div className="text-sm font-black text-white uppercase">{difficulty}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 font-black uppercase mb-1">Round</div>
              <div className="text-lg font-black text-white">{roundNum} / {totalRounds}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 font-black uppercase">Streak</div>
              <div className="text-lg font-black text-purple-400">{streak}🔥</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 font-black uppercase">Score</div>
              <div className="text-xl font-black text-white">{score}</div>
            </div>
          </div>

          {/* Per-question timer bar */}
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div
              className={`h-full rounded-full transition-all duration-50 ${timePct < 30 ? 'bg-red-500' : timePct < 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${timePct}%` }}
            />
          </div>

          {/* Question card */}
          <div className={`w-full glass-card p-12 flex flex-col items-center justify-center border relative overflow-hidden transition-all duration-200 ${
            feedback === 'correct' ? 'border-green-500/50 bg-green-500/5' :
            feedback === 'wrong'   ? 'border-red-500/50 bg-red-500/5' :
            feedback === 'timeout' ? 'border-yellow-500/50 bg-yellow-500/5' :
            'border-white/10'
          }`}
            style={{ minHeight: '180px' }}
          >
            <span className="absolute top-3 left-4 text-[10px] text-gray-600 font-black uppercase tracking-widest">
              Click the INK color →
            </span>

            {/* Feedback icon */}
            {feedback && (
              <div className="absolute top-3 right-4 text-2xl">
                {feedback === 'correct' ? '✅' : feedback === 'wrong' ? '❌' : '⏱️'}
              </div>
            )}

            <h2
              className="text-8xl md:text-9xl font-black select-none tracking-tighter"
              style={{ color: currentQ.displayColor }}
            >
              {currentQ.word}
            </h2>

            {feedback === 'timeout' && (
              <p className="text-yellow-400 text-sm font-bold mt-2 uppercase tracking-widest">
                Too slow! Answer was <span style={{ color: currentQ.displayColor }}>{currentQ.correctName}</span>
              </p>
            )}
            {feedback === 'wrong' && (
              <p className="text-red-400 text-sm font-bold mt-2 uppercase tracking-widest">
                Wrong! It was <span style={{ color: currentQ.displayColor }}>{currentQ.correctName}</span>
              </p>
            )}
          </div>

          {/* Color buttons */}
          <div className={`grid gap-3 w-full ${
            currentQ.options.length <= 4  ? 'grid-cols-2 md:grid-cols-4' :
            currentQ.options.length <= 7  ? 'grid-cols-3 md:grid-cols-7' :
            'grid-cols-5'
          }`}>
            {currentQ.options.map((opt, idx) => (
              <button
                key={opt.value}
                onClick={() => handleChoice(opt.value)}
                disabled={answered}
                className="relative h-16 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg overflow-hidden group"
                style={{ backgroundColor: opt.hex }}
                title={`Press ${idx + 1}`}
              >
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                <span className="relative z-10 text-white font-black text-xs uppercase tracking-wider drop-shadow-md">
                  {opt.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── RESULT ────────────────────────────────────────────────────────── */}
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
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Best Streak</div>
              <div className="text-4xl font-black text-purple-400">{maxStreak}🔥</div>
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
              onClick={() => startGame(difficulty)}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-purple-500/20"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
