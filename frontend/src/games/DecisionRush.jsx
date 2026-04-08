import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, updateDoc, increment, setDoc, collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

// Fallback pool if Firestore has no questions for selected difficulty
const FALLBACK_POOL = [
  { text: "7 is greater than 5", isTrue: true },
  { text: "The sky is green", isTrue: false },
  { text: "Water boils at 100°C", isTrue: true },
  { text: "Sharks are mammals", isTrue: false },
  { text: "Earth has one moon", isTrue: true },
  { text: "Light travels faster than sound", isTrue: true },
  { text: "The sun orbits the Earth", isTrue: false },
  { text: "Jupiter is the largest planet", isTrue: true },
  { text: "Diamonds are made of carbon", isTrue: true },
  { text: "Zero is an even number", isTrue: true },
];

const DIFFICULTY_SETTINGS = {
  easy:   { startSeconds: 45, correctBonus: 0,   penalty: 2, pointsPerCorrect: 10 },
  medium: { startSeconds: 30, correctBonus: 0.5, penalty: 3, pointsPerCorrect: 20 },
  hard:   { startSeconds: 15, correctBonus: 1,   penalty: 5, pointsPerCorrect: 40 },
};

export default function DecisionRush() {
  const { currentUser, userProfile } = useAuth();

  const [gameState, setGameState]       = useState('idle'); // idle | loading | playing | result
  const [difficulty, setDifficulty]     = useState('medium');
  const [timeLeft, setTimeLeft]         = useState(0);
  const [score, setScore]               = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [feedback, setFeedback]         = useState(null);
  const [remainingPool, setRemainingPool] = useState([]);
  const [loadError, setLoadError]       = useState(null);

  const timerRef = useRef(null);

  // ── Load questions from Firestore ───────────────────────────────────────────
  const loadQuestions = async (diff) => {
    setGameState('loading');
    setLoadError(null);
    try {
      const snapshot = await getDocs(collection(db, 'decisionQuestions'));
      let questions = snapshot.docs.map(d => {
        const data = d.data();
        return { text: data.question, isTrue: data.answer };
      });

      // Filter by difficulty
      const filtered = snapshot.docs
        .filter(d => d.data().difficulty === diff)
        .map(d => ({ text: d.data().question, isTrue: d.data().answer }));

      // Use difficulty-filtered questions if available, else all, else fallback
      const pool = filtered.length > 0
        ? filtered
        : questions.length > 0
          ? questions
          : FALLBACK_POOL;

      // Shuffle
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled;
    } catch (err) {
      console.error('Error loading questions:', err);
      setLoadError('Failed to load questions. Using built-in fallback.');
      return [...FALLBACK_POOL].sort(() => Math.random() - 0.5);
    }
  };

  const startGame = async (diff) => {
    clearInterval(timerRef.current);
    setDifficulty(diff);
    setScore(0);
    setCorrectAnswers(0);
    setFeedback(null);

    const pool = await loadQuestions(diff);

    setRemainingPool(pool.slice(1));
    setCurrentQuestion(pool[0]);
    setTimeLeft(DIFFICULTY_SETTINGS[diff].startSeconds * 1000);
    setGameState('playing');
  };

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'playing') {
      let lastTick = Date.now();
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const delta = now - lastTick;
        lastTick = now;
        setTimeLeft(prev => {
          const next = prev - delta;
          if (next <= 0) {
            handleGameOver();
            return 0;
          }
          return next;
        });
      }, 50);
      return () => clearInterval(timerRef.current);
    }
  }, [gameState]);

  const handleGameOver = useCallback(async () => {
    setGameState('result');
    clearInterval(timerRef.current);

    if (currentUser && score > 0) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          score: increment(score),
          xp: increment(Math.floor(score / 3)),
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

  const nextQuestion = useCallback(() => {
    setRemainingPool(prev => {
      if (prev.length === 0) {
        // reshuffle fallback when pool exhausted
        const reshuffled = [...FALLBACK_POOL].sort(() => Math.random() - 0.5);
        setCurrentQuestion(reshuffled[0]);
        return reshuffled.slice(1);
      }
      setCurrentQuestion(prev[0]);
      return prev.slice(1);
    });
  }, []);

  const handleAnswer = useCallback((answerKey) => {
    if (gameState !== 'playing' || !currentQuestion) return;
    const isCorrect = currentQuestion.isTrue === answerKey;
    const settings = DIFFICULTY_SETTINGS[difficulty];

    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
      setScore(prev => prev + settings.pointsPerCorrect);
      setTimeLeft(prev => prev + settings.correctBonus * 1000);
      showFeedback('correct');
    } else {
      setTimeLeft(prev => Math.max(0, prev - settings.penalty * 1000));
      showFeedback('wrong');
    }
    nextQuestion();
  }, [gameState, currentQuestion, difficulty, nextQuestion]);

  const showFeedback = (status) => {
    setFeedback(status);
    setTimeout(() => setFeedback(null), 300);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (gameState !== 'playing') return;
      if (e.key === 'ArrowLeft')  handleAnswer(false);
      if (e.key === 'ArrowRight') handleAnswer(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAnswer, gameState]);

  const timeSeconds    = Math.max(0, timeLeft / 1000).toFixed(1);
  const timePercentage = Math.min(100, (timeLeft / (DIFFICULTY_SETTINGS[difficulty]?.startSeconds * 1000)) * 100);

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col items-center min-h-screen">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        ← Back to Library
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-yellow-500 mb-2 tracking-tighter">
          DECISION RUSH
        </h1>
        <p className="text-gray-400 font-mono italic">Think fast. Mistakes cost time.</p>
      </div>

      {/* ── IDLE ─────────────────────────────────────────────────────────────── */}
      {gameState === 'idle' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-red-500/20">
          <div className="text-8xl mb-8 border-4 border-red-500 p-6 rounded-full text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse">
            T/F
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Rapid Fire Trivia</h2>
          <div className="text-gray-400 mb-8 space-y-2 text-center text-sm w-3/4">
            <p>A statement will appear.</p>
            <p>Press <span className="text-green-500 font-bold">YES</span> or <span className="text-red-500 font-bold">NO</span> as fast as possible.</p>
            <p className="p-4 bg-gray-900/50 rounded-lg border border-gray-800 text-yellow-500 font-bold">
              Mistakes instantly deduct time!
            </p>
            <p className="text-xs text-gray-600">
              Desktop: <code className="bg-black/50 px-1 rounded">← Left (NO)</code> / <code className="bg-black/50 px-1 rounded">Right → (YES)</code>
            </p>
            <p className="text-xs text-purple-400 font-bold mt-2">🔥 Questions loaded from live database</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {['easy', 'medium', 'hard'].map(lvl => (
              <button
                key={lvl}
                onClick={() => startGame(lvl)}
                className={`px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg ${
                  lvl === 'hard'   ? 'bg-red-600 hover:bg-red-500 shadow-red-600/40 text-white' :
                  lvl === 'medium' ? 'bg-orange-500 hover:bg-orange-400 shadow-orange-500/40 text-black' :
                                    'bg-yellow-400 hover:bg-yellow-300 shadow-yellow-400/40 text-black'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LOADING ──────────────────────────────────────────────────────────── */}
      {gameState === 'loading' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center justify-center gap-6 border-red-500/20">
          <div className="w-14 h-14 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
          <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Loading Questions from Database…</p>
          {loadError && <p className="text-yellow-400 text-xs font-bold">{loadError}</p>}
        </div>
      )}

      {/* ── PLAYING ──────────────────────────────────────────────────────────── */}
      {gameState === 'playing' && (
        <div className="w-full flex flex-col items-center max-w-2xl">
          {/* Time bar */}
          <div className="w-full bg-gray-900 border border-gray-800 rounded-full h-4 mb-4 overflow-hidden">
            <div
              className={`h-full transition-all duration-75 ${timeLeft < 5000 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-yellow-500 to-red-500'}`}
              style={{ width: `${timePercentage}%` }}
            />
          </div>

          {/* Stats */}
          <div className="w-full flex justify-between items-center mb-8 px-6 bg-gray-900/60 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 font-black uppercase">Intensity</span>
              <span className="text-xl font-black text-white leading-none uppercase">{difficulty}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-5xl font-black tracking-tighter ${timeLeft < 5000 ? 'text-red-500' : 'text-yellow-400'}`}>
                {timeSeconds}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-500 font-black uppercase">Score</span>
              <span className="text-2xl font-black text-white leading-none">{score}</span>
            </div>
          </div>

          {/* Question card */}
          <div className={`w-full aspect-video glass-card flex items-center justify-center p-12 text-center transition-all duration-150 ${
            feedback === 'correct' ? 'bg-green-500/10 border-green-500/50 scale-[1.02]' :
            feedback === 'wrong'   ? 'bg-red-500/10 border-red-500/50' :
            'border-white/10 shadow-2xl'
          }`}>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight select-none">
              {currentQuestion?.text}
            </h2>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-6 w-full mt-8">
            <button
              onClick={() => handleAnswer(false)}
              className="bg-gray-800 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-black text-4xl py-10 rounded-2xl transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] active:scale-95"
              style={{ touchAction: 'manipulation' }}
            >
              ❌ NO
            </button>
            <button
              onClick={() => handleAnswer(true)}
              className="bg-gray-800 border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white font-black text-4xl py-10 rounded-2xl transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.2)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] active:scale-95"
              style={{ touchAction: 'manipulation' }}
            >
              ✅ YES
            </button>
          </div>
        </div>
      )}

      {/* ── RESULT ───────────────────────────────────────────────────────────── */}
      {gameState === 'result' && (
        <div className="glass-card w-full max-w-2xl p-12 flex flex-col items-center border-red-500/20 animate-fade-in-up mt-8">
          <h2 className="text-6xl font-black text-red-500 mb-2">TIME'S UP</h2>
          <p className="text-gray-500 font-mono text-sm mb-10">Evaluation complete.</p>

          <div className="grid grid-cols-2 gap-6 w-full mb-10">
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Final Score</div>
              <div className="text-4xl font-black text-white">{score}</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">Correct</div>
              <div className="text-4xl font-black text-green-500">{correctAnswers}</div>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-2xl border border-white/5 text-center">
              <div className="text-gray-500 text-[10px] font-black uppercase mb-1">XP Earned</div>
              <div className="text-4xl font-black text-purple-400">+{Math.floor(score / 3)}⚡</div>
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
              className="px-8 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-red-500/20"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .shake { animation: shake 0.15s ease-in-out; }
      `}</style>
    </div>
  );
}
