import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../config';
import { useSocket } from '../context/SocketContext';
import { doc, updateDoc, increment, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Quiz() {
  const { currentUser, userProfile } = useAuth();
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();
  const gameModeParam = searchParams.get('mode'); // 'solo' or 'battle'
  const difficultyParam = searchParams.get('difficulty'); // 'easy', 'medium', 'hard'

  // Mode & Selection
  const [mode, setMode] = useState(null); // null, 'solo', 'battle'
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null); // 'easy', 'medium', 'hard'

  // Auto-join battle if parameter present
  useEffect(() => {
    if (gameModeParam === 'battle' && socket && currentUser && !isMatchmaking && !mode) {
      joinQueue(difficultyParam || 'medium');
    }
  }, [gameModeParam, socket, currentUser]);

  // Solo state
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  // Battle state
  const [matchData, setMatchData] = useState(null);
  const [battleQuestions, setBattleQuestions] = useState([]);
  const [battleQuestionIndex, setBattleQuestionIndex] = useState(0);
  const [battleScores, setBattleScores] = useState({});
  const [battleOver, setBattleOver] = useState(false);
  const [battleWinner, setBattleWinner] = useState(null);
  const [myAnswer, setMyAnswer] = useState(null);
  const [opponentAnswered, setOpponentAnswered] = useState(false);
  const [roundResult, setRoundResult] = useState(null);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchFromOpponent, setRematchFromOpponent] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef(null);

  // Difficulty Multipliers
  const MULTIPLIER = {
    easy: { score: 10, xp: 50, coins: 5, color: 'text-green-400', border: 'border-green-500/30' },
    medium: { score: 20, xp: 100, coins: 10, color: 'text-yellow-400', border: 'border-yellow-500/30' },
    hard: { score: 30, xp: 150, coins: 20, color: 'text-red-400', border: 'border-red-500/30' }
  };

  // Solo Timer Logic
  useEffect(() => {
    if (mode === 'solo' && !isGameOver && !feedback && questions.length > 0) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleSoloAnswer('__timeout__');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [mode, currentQuestionIndex, isGameOver, feedback, questions]);

  // Socket Listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('quiz_match_found', (data) => {
      setIsMatchmaking(false);
      setMatchData(data);
      setBattleQuestions(data.questions);
      setBattleQuestionIndex(0);
      setBattleScores(data.scores);
      setBattleOver(false);
      setBattleWinner(null);
      setMyAnswer(null);
      setOpponentAnswered(false);
      setRoundResult(null);
      setRematchRequested(false);
      setRematchFromOpponent(false);
      setQuestionStartTime(Date.now());
      setTimeLeft(15);
      setMode('battle');
      updateTaskProgress('play_any');
    });

    socket.on('quiz_opponent_answered', () => {
      setOpponentAnswered(true);
    });

    socket.on('quiz_round_result', ({ questionIndex, correctAnswer, results, scores }) => {
      setRoundResult({ questionIndex, correctAnswer, results });
      setBattleScores(scores);
      setTimeout(() => {
        setRoundResult(null);
        setMyAnswer(null);
        setOpponentAnswered(false);
        setBattleQuestionIndex(prev => prev + 1);
        setQuestionStartTime(Date.now());
        setTimeLeft(15);
      }, 3000);
    });

    socket.on('quiz_game_over', ({ scores, winnerUid }) => {
      setBattleScores(scores);
      setBattleOver(true);
      setBattleWinner(winnerUid);
      if (winnerUid === currentUser?.uid) giveMultiplayerRewards(true);
      else if (winnerUid) giveMultiplayerRewards(false);
    });

    socket.on('rematch_requested', ({ game }) => {
      if (game === 'quiz') setRematchFromOpponent(true);
    });

    socket.on('waiting_for_opponent', () => {
      setIsMatchmaking(true);
    });

    return () => {
      socket.off('quiz_match_found');
      socket.off('quiz_opponent_answered');
      socket.off('quiz_round_result');
      socket.off('quiz_game_over');
      socket.off('rematch_requested');
      socket.off('waiting_for_opponent');
    };
  }, [socket, currentUser]);

  // Battle Timer Logic
  useEffect(() => {
    if (mode === 'battle' && !battleOver && !roundResult && matchData && battleQuestionIndex < battleQuestions.length) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (!myAnswer) submitBattleAnswer('__timeout__');
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [mode, battleQuestionIndex, battleOver, roundResult, matchData, myAnswer]);

  // Handlers: Solo
  const startSoloGame = async (difficulty) => {
    setLoading(true);
    setSelectedDifficulty(difficulty);
    try {
      const qRef = collection(db, 'quizzes');
      const q = query(qRef, where('difficulty', '==', difficulty.toLowerCase()));
      const snapshot = await getDocs(q);
      let fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (fetched.length === 0) {
        toast.error(`No ${difficulty} questions found in database!`);
        setSelectedDifficulty('selecting');
        return;
      }

      fetched = fetched.sort(() => Math.random() - 0.5).slice(0, 10);
      setQuestions(fetched);
      setCurrentQuestionIndex(0);
      setScore(0);
      setIsGameOver(false);
      setShowResult(false);
      setFeedback(null);
      setTimeLeft(10);
      setMode('solo');
    } catch (err) {
      console.error(err);
      toast.error("Failed to load questions");
      setSelectedDifficulty('selecting');
    } finally {
      setLoading(false);
    }
  };

  const handleSoloAnswer = (option) => {
    if (feedback || isGameOver) return;
    clearInterval(timerRef.current);
    const currentQ = questions[currentQuestionIndex];
    
    if (option === currentQ.answer) {
      const pts = MULTIPLIER[selectedDifficulty].score;
      setScore(prev => prev + pts);
      setFeedback('correct');
    } else {
      setFeedback('wrong');
    }

    setTimeout(() => {
      if (currentQuestionIndex + 1 < questions.length) {
        setCurrentQuestionIndex(prev => prev + 1);
        setFeedback(null);
        setTimeLeft(10);
      } else {
        endSoloGame();
      }
    }, 1000);
  };

  const endSoloGame = async () => {
    setIsGameOver(true);
    setShowResult(true);
    if (currentUser) {
      try {
        const mult = MULTIPLIER[selectedDifficulty];
        const earnedXp = Math.floor(score * mult.xp / mult.score);
        const earnedCoins = Math.floor(score * mult.coins / mult.score);
        
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { 
          score: increment(score * 10), 
          xp: increment(earnedXp), 
          coins: increment(earnedCoins) 
        });
        
        const lbRef = doc(db, 'leaderboard', currentUser.uid);
        await setDoc(lbRef, { 
          username: userProfile.username, 
          avatar: userProfile.avatar || '', 
          score: increment(score * 10), 
          updatedAt: new Date() 
        }, { merge: true });

        updateTaskProgress('quiz_wiz');
        updateTaskProgress('play_any');
      } catch (error) { console.error("Error saving quiz score:", error); }
    }
  };

  const resetSoloGame = () => {
    setMode(null);
    setSelectedDifficulty(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setScore(0);
    setIsGameOver(false);
    setShowResult(false);
    setFeedback(null);
  };

  // Handlers: Battle
  const joinQueue = (difficulty = 'medium') => {
    if (!socket) return;
    setIsMatchmaking(true);
    socket.emit('join_quiz_queue', {
      uid: currentUser.uid,
      username: userProfile?.username || currentUser.email.split('@')[0],
      avatar: userProfile?.avatar || '',
      difficulty: difficulty.toLowerCase()
    });
  };


  const cancelMatchmaking = () => {
    socket.emit('leave_quiz_queue');
    setIsMatchmaking(false);
  };

  const submitBattleAnswer = (answer) => {
    if (myAnswer) return;
    const timeMs = Date.now() - questionStartTime;
    setMyAnswer(answer);
    clearInterval(timerRef.current);
    socket.emit('quiz_submit_answer', {
      roomId: matchData.roomId,
      uid: currentUser.uid,
      questionIndex: battleQuestionIndex,
      answer,
      timeMs,
    });
  };

  const requestRematch = () => {
    setRematchRequested(true);
    socket.emit('request_rematch', { roomId: matchData.roomId, uid: currentUser.uid, game: 'quiz' });
  };

  const acceptRematch = () => {
    socket.emit('accept_rematch', { 
      roomId: matchData.roomId, 
      game: 'quiz', 
      players: matchData.players,
      difficulty: matchData.difficulty || 'medium'
    });
  };


  const giveMultiplayerRewards = async (isWin) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        score: increment(isWin ? 1000 : 300),
        xp: increment(isWin ? 500 : 150),
        coins: increment(isWin ? 50 : 10),
      });
      const lbRef = doc(db, 'leaderboard', currentUser.uid);
      await setDoc(lbRef, {
        username: userProfile.username,
        avatar: userProfile.avatar || '',
        score: increment(isWin ? 1000 : 300),
        updatedAt: new Date(),
      }, { merge: true });
      if (isWin) updateTaskProgress('win_battle');
    } catch (e) { console.error(e); }
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

  // Rendering Helpers
  const opponentInfo = matchData?.players.find(p => p.uid !== currentUser?.uid);
  const myBattleScore = battleScores[currentUser?.uid] || 0;
  const opBattleScore = battleScores[opponentInfo?.uid] || 0;

  // RENDER: Loading
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#0f0a1f]">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-t-4 border-cyan-500 rounded-full animate-spin"></div>
          <div className="text-white absolute inset-0 flex items-center justify-center font-bold">...</div>
        </div>
      </div>
    );
  }

  // RENDER: Matchmaking
  if (isMatchmaking) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold neon-text-cyan mb-2 tracking-wider">QUIZ BATTLE</h1>
          <p className="text-gray-400 text-lg">1v1 Speed & Knowledge</p>
        </div>
        <div className="glass-card w-full p-10 flex flex-col items-center justify-center min-h-[400px] border-cyan-500/20">
          <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-6"></div>
          <h3 className="text-2xl font-bold text-white mb-2">Searching for Opponent...</h3>
          <p className="text-gray-400 mb-8">Finding a quiz challenger</p>
          <button onClick={cancelMatchmaking} className="text-red-400 hover:underline font-bold">CANCEL</button>
        </div>
      </div>
    );
  }

  // RENDER: Mode Selection / Difficulty Selection
  if (!mode) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
        <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Library
        </Link>
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black neon-text-cyan mb-2 tracking-tighter">QUIZ MASTER</h1>
          <p className="text-gray-400 text-lg uppercase tracking-widest">Prove your intelligence</p>
        </div>

        {loading ? (
             <div className="flex flex-col items-center py-20 animate-fade-in">
               <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4"></div>
               <div className="text-cyan-400 font-bold">Loading Questions...</div>
             </div>
        ) : selectedDifficulty === 'selecting' ? (
            <div className="glass-card w-full p-10 border-cyan-500/20 animate-fade-in-up">
                <div className="flex items-center mb-8">
                    <button onClick={() => setSelectedDifficulty(null)} className="text-gray-400 hover:text-white mr-4">
                        ← Back
                    </button>
                    <h2 className="text-2xl font-bold text-white flex-1 text-center pr-8">Select Difficulty</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button onClick={() => startSoloGame('easy')} className="p-6 rounded-2xl bg-gray-900 border-2 border-gray-800 hover:border-green-500 hover:bg-green-500/10 transition-all group">
                        <div className="text-4xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity">🟢</div>
                        <div className="text-xl font-bold text-white">EASY</div>
                        <div className="text-xs text-gray-500 mt-2">10 PTS / ADVENTURE</div>
                    </button>
                    <button onClick={() => startSoloGame('medium')} className="p-6 rounded-2xl bg-gray-900 border-2 border-gray-800 hover:border-yellow-500 hover:bg-yellow-500/10 transition-all group">
                        <div className="text-4xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity">🟡</div>
                        <div className="text-xl font-bold text-white">MEDIUM</div>
                        <div className="text-xs text-gray-500 mt-2">20 PTS / CHALLENGE</div>
                    </button>
                    <button onClick={() => startSoloGame('hard')} className="p-6 rounded-2xl bg-gray-900 border-2 border-gray-800 hover:border-red-500 hover:bg-red-500/10 transition-all group">
                        <div className="text-4xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity">🔴</div>
                        <div className="text-xl font-bold text-white">HARD</div>
                        <div className="text-xs text-gray-500 mt-2">30 PTS / MASTER</div>
                    </button>
                </div>
            </div>
        ) : (
            <div className="glass-card w-full p-10 flex flex-col items-center border-cyan-500/20 animate-fade-in-up">
              <div className="text-6xl mb-6">🎯</div>
              <h2 className="text-3xl font-bold text-white mb-10">Choose Your Path</h2>
              <div className="flex flex-wrap justify-center gap-6">
                 <button onClick={() => setSelectedDifficulty('selecting')} className="px-10 py-5 bg-gray-800 border-2 border-gray-600 rounded-xl text-white font-bold text-xl hover:border-cyan-400 hover:bg-gray-700 transition-all w-64">
                    SOLO PRACTICE
                 </button>
                  <button onClick={() => joinQueue(difficultyParam || 'medium')} className="px-10 py-5 bg-cyan-500 text-gray-900 rounded-xl font-black text-xl hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] w-64">
                    1v1 BATTLE
                  </button>
              </div>
            </div>
        )}
      </div>
    );
  }

  // RENDER: Battle Mode (Abbreviated to save space, but functionally same)
  if (mode === 'battle' && matchData) {
    if (battleOver) {
        return (
          <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
            <h1 className="text-5xl font-black neon-text-cyan mb-8">BATTLE ENDED</h1>
            <div className="glass-card w-full p-10 border-cyan-500/20 text-center">
               <h2 className={`text-4xl font-black mb-10 ${battleWinner === currentUser.uid ? 'text-green-400' : 'text-red-400'}`}>
                {battleWinner === currentUser.uid ? 'VICTORY' : 'DEFEAT'}
               </h2>
               <div className="flex justify-around mb-10">
                 <div><div className="text-gray-500 text-xs">YOU</div><div className="text-4xl font-bold">{myBattleScore}</div></div>
                 <div><div className="text-gray-500 text-xs">OPPONENT</div><div className="text-4xl font-bold">{opBattleScore}</div></div>
               </div>
               <button onClick={resetSoloGame} className="px-10 py-4 bg-cyan-500 text-black font-bold rounded-xl">LEAVE HUB</button>
            </div>
          </div>
        );
    }

    const currentQ = battleQuestions[battleQuestionIndex];
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div className="text-2xl font-bold text-cyan-400">{myBattleScore} pts</div>
                <div className="text-3xl font-black text-white">{timeLeft}s</div>
                <div className="text-2xl font-bold text-pink-400">{opBattleScore} pts</div>
            </div>
            <div className="glass-card p-10 border-cyan-500/20">
                <h3 className="text-2xl font-medium text-white mb-10">{currentQ?.question}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentQ?.options.map((opt, i) => (
                        <button key={i} onClick={() => submitBattleAnswer(opt)} disabled={!!myAnswer} className={`p-4 rounded-xl border ${myAnswer === opt ? 'border-cyan-400 bg-cyan-400/20' : 'border-gray-700 hover:border-gray-500'}`}>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
  }

  // RENDER: Solo Mode
  if (showResult) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
        <div className="glass-card w-full p-12 text-center border-purple-500/20 animate-fade-in">
          <div className="text-6xl mb-6">🏆</div>
          <h1 className="text-5xl font-black text-white mb-4">TRAINING DONE</h1>
          <div className="text-7xl font-black neon-text-purple mb-8">{score} <span className="text-2xl text-gray-500">POINTS</span></div>
          
          <div className="bg-gray-900/80 rounded-2xl p-6 mb-8 border border-gray-700 w-full max-w-md mx-auto">
             <div className="text-xs text-gray-500 uppercase mb-4 tracking-widest">Efficiency Bonus ({selectedDifficulty})</div>
             <div className="flex justify-around">
               <div><div className="text-3xl font-bold text-purple-400">+{Math.floor(score * MULTIPLIER[selectedDifficulty].xp / MULTIPLIER[selectedDifficulty].score)}</div><div className="text-[10px] text-gray-500">XP</div></div>
               <div><div className="text-3xl font-bold text-yellow-400">+{Math.floor(score * MULTIPLIER[selectedDifficulty].coins / MULTIPLIER[selectedDifficulty].score)}</div><div className="text-[10px] text-gray-500">COINS</div></div>
             </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button onClick={() => startSoloGame(selectedDifficulty)} className="px-10 py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition-all">RETRY LEVEL</button>
            <button onClick={resetSoloGame} className="px-10 py-4 border border-gray-700 text-gray-400 rounded-xl hover:border-white hover:text-white transition-all">EXIT</button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIndex];
  if (!currentQ) return null;

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className={`px-4 py-1 rounded-full border text-xs font-black uppercase tracking-widest ${MULTIPLIER[selectedDifficulty].color} ${MULTIPLIER[selectedDifficulty].border}`}>
            {selectedDifficulty}
          </div>
          <div className="text-gray-500 text-sm font-mono">Q {currentQuestionIndex + 1}/10</div>
        </div>
        <div className={`text-3xl font-black transition-all ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
          0:{timeLeft.toString().padStart(2, '0')}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500 uppercase font-black">Score</div>
          <div className="text-2xl font-black text-cyan-400">{score}</div>
        </div>
      </div>

      <div className="w-full h-1 bg-gray-800 rounded-full mb-12 overflow-hidden">
        <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${((currentQuestionIndex + 1) / 10) * 100}%` }}></div>
      </div>

      <div className="glass-card w-full p-12 border-cyan-500/20 relative animate-fade-in-up">
        {feedback && (
          <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-sm transition-all ${feedback === 'correct' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
             <div className={`text-6xl font-black ${feedback === 'correct' ? 'text-green-500' : 'text-red-500'}`}>
               {feedback === 'correct' ? 'CORRECT' : 'WRONG'}
             </div>
          </div>
        )}
        <h2 className="text-3xl font-bold text-white mb-12 text-center leading-tight">{currentQ.question}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentQ.options.map((opt, idx) => (
            <button
              key={idx}
              disabled={!!feedback}
              onClick={() => handleSoloAnswer(opt)}
              className={`p-6 rounded-2xl border-2 transition-all text-left flex items-center gap-4 group ${feedback ? 'cursor-not-allowed opacity-50' : 'border-gray-800 hover:border-cyan-500 hover:bg-cyan-500/5'}`}
            >
              <span className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:text-cyan-400 group-hover:border-cyan-400 transition-colors">
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="text-xl font-medium text-gray-200">{opt}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
