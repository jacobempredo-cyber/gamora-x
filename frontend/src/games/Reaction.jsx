import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../config';
import { useSocket } from '../context/SocketContext';
import { doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Link, useSearchParams } from 'react-router-dom';

export default function Reaction() {
  const { currentUser, userProfile } = useAuth();
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();
  const gameModeParam = searchParams.get('mode'); // 'solo' or 'battle'

  // Mode
  const [mode, setMode] = useState(null); // null, 'solo', 'battle'
  const [isMatchmaking, setIsMatchmaking] = useState(false);

  // Solo state
  const [gameState, setGameState] = useState('idle');
  const [startTime, setStartTime] = useState(0);
  const [reactionTime, setReactionTime] = useState(0);
  const timerRef = useRef(null);

  // Battle state
  const [matchData, setMatchData] = useState(null);
  const [battlePhase, setBattlePhase] = useState('waiting'); // waiting, countdown, ready, go, clicked, round-result, game-over
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(5);
  const [roundWins, setRoundWins] = useState({});
  const [roundResults, setRoundResults] = useState([]);
  const [myRoundTime, setMyRoundTime] = useState(null);
  const [opponentReacted, setOpponentReacted] = useState(false);
  const [lastRoundResult, setLastRoundResult] = useState(null);
  const [battleWinner, setBattleWinner] = useState(null);
  const [goTimestamp, setGoTimestamp] = useState(0);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchFromOpponent, setRematchFromOpponent] = useState(false);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('reaction_match_found', (data) => {
      setIsMatchmaking(false);
      setMatchData(data);
      setCurrentRound(0);
      setTotalRounds(data.totalRounds);
      setRoundWins(data.roundWins);
      setRoundResults([]);
      setBattlePhase('waiting');
      setBattleWinner(null);
      setRematchRequested(false);
      setRematchFromOpponent(false);
      setMode('battle');
      updateTaskProgress('play_any');
    });

    socket.on('reaction_round_waiting', ({ round }) => {
      setCurrentRound(round);
      setBattlePhase('countdown');
      setMyRoundTime(null);
      setOpponentReacted(false);
      setLastRoundResult(null);
    });

    socket.on('reaction_round_go', ({ serverTimestamp }) => {
      setBattlePhase('go');
      setGoTimestamp(serverTimestamp);
    });

    socket.on('reaction_opponent_reacted', () => {
      setOpponentReacted(true);
    });

    socket.on('reaction_round_result', ({ round, roundResult, roundWinner, roundWins: newRoundWins }) => {
      setRoundWins(newRoundWins);
      setLastRoundResult({ roundResult, roundWinner });
      setBattlePhase('round-result');
      setRoundResults(prev => [...prev, roundResult]);
    });

    socket.on('reaction_game_over', ({ roundWins: finalWins, winnerUid }) => {
      setRoundWins(finalWins);
      setBattleWinner(winnerUid);
      setBattlePhase('game-over');

      if (winnerUid === currentUser?.uid) {
        giveMultiplayerRewards(true);
      } else if (winnerUid) {
        giveMultiplayerRewards(false);
      }
    });

    socket.on('rematch_requested', ({ game }) => {
      if (game === 'reaction') setRematchFromOpponent(true);
    });

    socket.on('waiting_for_opponent', () => {
      setIsMatchmaking(true);
    });

    return () => {
      socket.off('reaction_match_found');
      socket.off('reaction_round_waiting');
      socket.off('reaction_round_go');
      socket.off('reaction_opponent_reacted');
      socket.off('reaction_round_result');
      socket.off('reaction_game_over');
      socket.off('rematch_requested');
      socket.off('waiting_for_opponent');
    };
  }, [socket, currentUser]);



  const giveMultiplayerRewards = async (isWin) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const baseXp = isWin ? 600 : 200;
      const baseCoins = isWin ? 60 : 15;
      await updateDoc(userRef, {
        score: increment(isWin ? 1200 : 400),
        xp: increment(baseXp),
        coins: increment(baseCoins),
      });
      const lbRef = doc(db, 'leaderboard', currentUser.uid);
      await setDoc(lbRef, {
        username: userProfile.username,
        avatar: userProfile.avatar || '',
        score: increment(isWin ? 1200 : 400),
        updatedAt: new Date(),
      }, { merge: true });
      if (isWin) updateTaskProgress('win_battle');
    } catch (e) {
      console.error(e);
    }
  };

  // SOLO LOGIC
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const startSoloGame = () => {
    setGameState('waiting');
    const delay = Math.floor(Math.random() * 3000) + 2000;
    timerRef.current = setTimeout(() => {
      setGameState('ready');
      setStartTime(Date.now());
    }, delay);
  };

  const handleSoloInteraction = () => {
    if (gameState === 'waiting') {
      clearTimeout(timerRef.current);
      setGameState('too-soon');
    } else if (gameState === 'ready') {
      const timeMs = Date.now() - startTime;
      setReactionTime(timeMs);
      setGameState('result');
      submitSoloScore(timeMs);
    } else if (gameState === 'idle' || gameState === 'too-soon' || gameState === 'result') {
      startSoloGame();
    }
  };

  const submitSoloScore = async (timeMs) => {
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const points = Math.max(0, 1000 - timeMs);
        await updateDoc(userRef, {
          score: increment(points),
          xp: increment(Math.floor(points / 10)),
          coins: increment(Math.floor(points / 100)),
        });
        const lbRef = doc(db, 'leaderboard', currentUser.uid);
        const lbSnap = await getDoc(lbRef);
        if (lbSnap.exists()) {
          await updateDoc(lbRef, { score: increment(points), updatedAt: new Date() });
        } else {
          await setDoc(lbRef, { username: userProfile.username, avatar: userProfile.avatar || '', score: points, updatedAt: new Date() });
        }
        updateTaskProgress('reflex_pro');
        updateTaskProgress('play_any');
      } catch (error) { console.error("Error saving reaction score:", error); }
    }
  };

  // BATTLE LOGIC
  const joinQueue = () => {
    if (!socket) {
      alert("Connecting to game server... Please wait a moment.");
      return;
    }
    
    const diff = difficultyParam || 'medium';
    setIsMatchmaking(true);
    socket.emit('join_reaction_queue', {
      uid: currentUser.uid,
      username: userProfile?.username || currentUser.displayName || currentUser.email.split('@')[0],
      avatar: userProfile?.avatar || currentUser.photoURL || '',
      difficulty: diff
    });
  };

  const cancelMatchmaking = () => {
    socket.emit('leave_reaction_queue');
    setIsMatchmaking(false);
  };

  const handleBattleClick = () => {
    if (battlePhase === 'countdown') {
      // Too soon!
      socket.emit('reaction_player_click', {
        roomId: matchData.roomId,
        uid: currentUser.uid,
        timeMs: 9999,
        tooSoon: true,
      });
      setMyRoundTime('TOO SOON');
      setBattlePhase('clicked');
    } else if (battlePhase === 'go') {
      const timeMs = Date.now() - goTimestamp;
      socket.emit('reaction_player_click', {
        roomId: matchData.roomId,
        uid: currentUser.uid,
        timeMs,
        tooSoon: false,
      });
      setMyRoundTime(timeMs);
      setBattlePhase('clicked');
    }
  };

  const requestRematch = () => {
    setRematchRequested(true);
    socket.emit('request_rematch', { roomId: matchData.roomId, uid: currentUser.uid, game: 'reaction' });
  };

  const acceptRematch = () => {
    socket.emit('accept_rematch', { roomId: matchData.roomId, game: 'reaction', players: matchData.players });
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

  const opponentInfo = matchData?.players.find(p => p.uid !== currentUser?.uid);
  const myWins = roundWins[currentUser?.uid] || 0;
  const opWins = roundWins[opponentInfo?.uid] || 0;

  // ==========================================
  // RENDER: Matchmaking
  // ==========================================
  if (isMatchmaking) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold neon-text-pink mb-2 tracking-wider">REACTION DUEL</h1>
          <p className="text-gray-400 text-lg">Best of 5 Rounds</p>
        </div>
        <div className="glass-card w-full p-10 flex flex-col items-center justify-center min-h-[400px] border-pink-500/20">
          <div className="w-20 h-20 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin mb-6"></div>
          <h3 className="text-2xl font-bold text-white mb-2">Searching for Opponent...</h3>
          <p className="text-gray-400 mb-8">Finding a challenger with fast reflexes</p>
          <button onClick={cancelMatchmaking} className="text-red-400 hover:underline font-bold">CANCEL</button>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Mode Selection
  // ==========================================
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
          <h1 className="text-5xl font-bold neon-text-pink mb-2 tracking-wider uppercase">Reaction Time</h1>
          <p className="text-gray-400 text-lg italic font-mono">Test your nervous system</p>
        </div>
        <div className="glass-card w-full p-10 flex flex-col items-center justify-center min-h-[400px] border-pink-500/20">
          <div className="text-6xl mb-8">🚦</div>
          <h2 className="text-2xl font-bold text-white mb-8">Select Your Mode</h2>
          <div className="flex flex-wrap justify-center gap-6">
            {(!gameModeParam || gameModeParam === 'solo') && (
              <button
                onClick={() => setMode('solo')}
                className="px-8 py-4 bg-gray-800 border-2 border-gray-600 rounded-xl text-white font-bold hover:border-pink-400 hover:bg-pink-400/10 transition-all w-48"
              >
                SOLO PRACTICE
              </button>
            )}
            {(!gameModeParam || gameModeParam === 'battle') && (
              <button
                onClick={joinQueue}
                className="px-8 py-4 bg-pink-500 text-white rounded-xl font-bold hover:bg-pink-400 transition-all w-48 shadow-[0_0_20px_rgba(236,72,153,0.4)]"
              >
                1v1 BATTLE
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: Battle Mode
  // ==========================================
  if (mode === 'battle' && matchData) {
    // Game Over screen
    if (battlePhase === 'game-over') {
      return (
        <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold neon-text-pink mb-2">REACTION DUEL RESULTS</h1>
          </div>
          <div className="glass-card w-full p-10 flex flex-col items-center border-pink-500/20 animate-fade-in-up">
            <h2 className={`text-4xl font-black mb-6 ${battleWinner === currentUser.uid ? 'neon-text-pink' : battleWinner === null ? 'text-gray-400' : 'text-red-500'}`}>
              {battleWinner === currentUser.uid ? '🎉 VICTORY!' : battleWinner === null ? '🤝 DRAW' : '💀 DEFEAT'}
            </h2>

            <div className="flex w-full justify-around items-center mb-8 max-w-md">
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase mb-1">You</div>
                <div className="text-5xl font-black text-pink-400">{myWins}</div>
                <div className="text-[10px] text-gray-500">ROUNDS WON</div>
              </div>
              <div className="text-xl font-black text-gray-700 italic">VS</div>
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase mb-1">{opponentInfo?.username}</div>
                <div className="text-5xl font-black text-cyan-400">{opWins}</div>
                <div className="text-[10px] text-gray-500">ROUNDS WON</div>
              </div>
            </div>

            {/* Round breakdown */}
            <div className="w-full max-w-md mb-8">
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 text-center">Round Breakdown</div>
              <div className="space-y-2">
                {roundResults.map((result, i) => {
                  const myResult = result[currentUser.uid];
                  const opResult = result[opponentInfo?.uid];
                  return (
                    <div key={i} className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2 border border-gray-800">
                      <span className="text-gray-400 text-sm">R{i + 1}</span>
                      <span className={`font-bold ${myResult?.tooSoon ? 'text-yellow-400' : 'text-white'}`}>
                        {myResult?.tooSoon ? 'TOO SOON' : `${myResult?.timeMs}ms`}
                      </span>
                      <span className="text-gray-600 text-xs">vs</span>
                      <span className={`font-bold ${opResult?.tooSoon ? 'text-yellow-400' : 'text-white'}`}>
                        {opResult?.tooSoon ? 'TOO SOON' : `${opResult?.timeMs}ms`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-6 mb-6 border border-gray-700 w-full max-w-sm">
              <div className="text-sm text-gray-400 mb-4 uppercase tracking-widest text-center">Rewards (2x Multiplayer)</div>
              <div className="flex justify-around">
                <div className="text-center">
                  <span className="text-purple-400 font-bold text-2xl block">+{battleWinner === currentUser.uid ? 600 : 200}</span>
                  <span className="text-xs text-gray-500">XP</span>
                </div>
                <div className="text-center">
                  <span className="text-yellow-400 font-bold text-2xl block">+{battleWinner === currentUser.uid ? 60 : 15}</span>
                  <span className="text-xs text-gray-500">COINS</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              {rematchFromOpponent ? (
                <button onClick={acceptRematch} className="px-8 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-400 transition-all animate-pulse">ACCEPT REMATCH</button>
              ) : rematchRequested ? (
                <button disabled className="px-8 py-3 bg-gray-700 text-gray-400 rounded-lg font-bold cursor-not-allowed">REMATCH SENT...</button>
              ) : (
                <button onClick={requestRematch} className="px-8 py-3 bg-pink-500 text-white rounded-lg font-bold hover:bg-pink-400 transition-all shadow-[0_0_15px_rgba(236,72,153,0.4)]">REMATCH</button>
              )}
              <button onClick={() => { setMode(null); setMatchData(null); }} className="px-8 py-3 border border-gray-600 text-gray-300 rounded-lg font-bold hover:border-white hover:text-white transition-all">LEAVE</button>
            </div>
          </div>
        </div>
      );
    }

    // Active Battle
    const getBattleBg = () => {
      if (battlePhase === 'countdown') return 'bg-red-500/20 border-red-500/50';
      if (battlePhase === 'go') return 'bg-green-500 border-green-400 shadow-[0_0_50px_rgba(34,197,94,0.4)]';
      if (battlePhase === 'clicked') return 'bg-cyan-500/20 border-cyan-500/50';
      if (battlePhase === 'round-result') return 'bg-gray-800/50 border-gray-600';
      return 'bg-gray-800/30 border-gray-700';
    };

    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold neon-text-pink mb-1">REACTION DUEL</h1>
          <p className="text-gray-400">Round {currentRound} of {totalRounds}</p>
        </div>

        {/* Score bar */}
        <div className="flex w-full justify-between items-center mb-6 px-4 max-w-2xl bg-gray-900/40 p-3 rounded-xl border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-pink-900 flex items-center justify-center text-white text-xs font-bold">
              {userProfile?.username?.charAt(0)}
            </div>
            <span className="font-bold text-white text-sm">{userProfile?.username}</span>
            <div className="flex gap-1">
              {Array.from({ length: totalRounds }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i < myWins ? 'bg-pink-400' : 'bg-gray-700'}`}></div>
              ))}
            </div>
          </div>
          <div className="text-sm font-black text-gray-600">VS</div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {Array.from({ length: totalRounds }).map((_, i) => (
                <div key={i} className={`w-3 h-3 rounded-full ${i < opWins ? 'bg-cyan-400' : 'bg-gray-700'}`}></div>
              ))}
            </div>
            <span className="font-bold text-white text-sm">{opponentInfo?.username}</span>
            <div className="w-8 h-8 rounded-full bg-cyan-900 flex items-center justify-center text-white text-xs font-bold">
              {opponentInfo?.username?.charAt(0)}
            </div>
          </div>
        </div>

        {/* Round Result */}
        {battlePhase === 'round-result' && lastRoundResult ? (
          <div className="glass-card w-full p-10 flex flex-col items-center justify-center min-h-[400px] border-pink-500/20 animate-fade-in-up">
            <h3 className="text-2xl font-bold text-white mb-2">Round {currentRound} Result</h3>
            {lastRoundResult.roundWinner ? (
              <div className={`text-3xl font-black mb-6 ${lastRoundResult.roundWinner === currentUser.uid ? 'text-green-400' : 'text-red-400'}`}>
                {lastRoundResult.roundWinner === currentUser.uid ? '✓ You Won This Round!' : '✗ Opponent Won This Round'}
              </div>
            ) : (
              <div className="text-3xl font-black text-yellow-400 mb-6">Both Too Soon!</div>
            )}
            <div className="flex w-full justify-around max-w-md">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">You</div>
                <div className={`text-3xl font-black ${lastRoundResult.roundResult[currentUser.uid]?.tooSoon ? 'text-yellow-400' : 'text-white'}`}>
                  {lastRoundResult.roundResult[currentUser.uid]?.tooSoon ? 'TOO SOON' : `${lastRoundResult.roundResult[currentUser.uid]?.timeMs}ms`}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">{opponentInfo?.username}</div>
                <div className={`text-3xl font-black ${lastRoundResult.roundResult[opponentInfo?.uid]?.tooSoon ? 'text-yellow-400' : 'text-white'}`}>
                  {lastRoundResult.roundResult[opponentInfo?.uid]?.tooSoon ? 'TOO SOON' : `${lastRoundResult.roundResult[opponentInfo?.uid]?.timeMs}ms`}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* The reaction zone */
          <div
            onClick={handleBattleClick}
            className={`glass-card w-full p-8 flex flex-col items-center justify-center min-h-[400px] border-2 transition-all duration-300 cursor-pointer select-none active:scale-95 ${getBattleBg()}`}
          >
            {battlePhase === 'waiting' && (
              <>
                <h2 className="text-4xl font-black text-white mb-4">GET READY</h2>
                <p className="text-gray-400">Round starting soon...</p>
              </>
            )}
            {battlePhase === 'countdown' && (
              <>
                <h2 className="text-5xl font-black text-red-400 mb-4 animate-pulse">WAIT...</h2>
                <p className="text-gray-300 text-xl">Don't click yet!</p>
              </>
            )}
            {battlePhase === 'go' && (
              <>
                <h2 className="text-6xl font-black text-white mb-4">CLICK NOW!</h2>
                <p className="text-green-200 text-xl">GO GO GO!</p>
              </>
            )}
            {battlePhase === 'clicked' && (
              <>
                <h2 className="text-4xl font-black text-cyan-400 mb-4">
                  {myRoundTime === 'TOO SOON' ? '⚠️ TOO SOON!' : `${myRoundTime}ms`}
                </h2>
                <p className="text-gray-400">{opponentReacted ? 'Waiting for results...' : 'Waiting for opponent...'}</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: Solo Mode
  // ==========================================
  const soloConfig = {
    idle: { bg: 'bg-dark', text: 'REACTION SPEED', sub: 'Wait for green, then click as fast as you can.', prompt: 'Click to Start' },
    waiting: { bg: 'bg-red-500/20 border-red-500/50', text: 'WAIT FOR GREEN...', sub: 'Get ready!', prompt: 'WAIT!' },
    ready: { bg: 'bg-green-500 border-green-400 shadow-[0_0_50px_rgba(34,197,94,0.4)]', text: 'CLICK NOW!', sub: 'GO GO GO!', prompt: 'CLICK!' },
    'too-soon': { bg: 'bg-yellow-500/30 border-yellow-500/50', text: 'TOO SOON!', sub: 'Wait until it turns green next time.', prompt: 'Try Again' },
    result: { bg: 'bg-cyan-500/20 border-cyan-500/50', text: `${reactionTime}ms`, sub: 'Great job! Can you beat it?', prompt: 'Play Again' },
  };

  const current = soloConfig[gameState];

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Arena
      </Link>

      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold neon-text-pink mb-2 tracking-wider uppercase">Reaction Time</h1>
        <p className="text-gray-400 text-lg italic font-mono tracking-tighter">Test your nervous system response speed</p>
      </div>

      <div
        onClick={handleSoloInteraction}
        className={`glass-card w-full p-8 flex flex-col items-center justify-center min-h-[500px] border-2 transition-all duration-300 cursor-pointer select-none active:scale-95 ${current.bg}`}
      >
        <h2 className="text-6xl font-black text-white mb-4 text-center">{current.text}</h2>
        <p className="text-xl text-gray-300 mb-12 text-center opacity-80">{current.sub}</p>
        <div className="text-sm font-bold uppercase tracking-[1em] text-white/40 animate-pulse">{current.prompt}</div>
      </div>

      {gameState === 'result' && (
        <div className="mt-8 flex gap-8 animate-fade-in-down">
          <div className="text-center p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-widest">XP Gained</div>
            <div className="text-2xl font-bold text-purple-400">+{Math.floor(Math.max(0, 1000 - reactionTime) / 10)}</div>
          </div>
          <div className="text-center p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-widest">Coins Gained</div>
            <div className="text-2xl font-bold text-yellow-400">+{Math.floor(Math.max(0, 1000 - reactionTime) / 100)}</div>
          </div>
          <button onClick={() => setMode(null)} className="text-center p-4 bg-gray-900 rounded-lg border border-gray-800 hover:border-white transition-all cursor-pointer">
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-widest">Mode</div>
            <div className="text-lg font-bold text-white">← Back</div>
          </button>
        </div>
      )}
    </div>
  );
}
