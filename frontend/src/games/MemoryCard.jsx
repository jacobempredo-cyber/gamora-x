import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../config';
import { useSocket } from '../context/SocketContext';
import { doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Link } from 'react-router-dom';

const CARD_ICONS = ['🚀', '🎮', '👾', '🔥', '💎', '🌟', '🛡️', '⚔️'];

export default function MemoryCard() {
  const { currentUser, userProfile } = useAuth();
  const { socket } = useSocket();

  // Mode selection
  const [mode, setMode] = useState(null); // null, 'solo', 'battle'
  const [isMatchmaking, setIsMatchmaking] = useState(false);

  // Solo state
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [solved, setSolved] = useState([]);
  const [moves, setMoves] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Battle state
  const [matchData, setMatchData] = useState(null);
  const [battleCards, setBattleCards] = useState([]);
  const [battleFlipped, setBattleFlipped] = useState([]);
  const [battleSolved, setBattleSolved] = useState([]);
  const [battleScores, setBattleScores] = useState({});
  const [battleOver, setBattleOver] = useState(false);
  const [battleWinner, setBattleWinner] = useState(null);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [rematchFromOpponent, setRematchFromOpponent] = useState(false);

  // Socket listeners for battle mode
  useEffect(() => {
    if (!socket) return;

    socket.on('memory_match_found', (data) => {
      setIsMatchmaking(false);
      setMatchData(data);
      setBattleCards(data.deck);
      setBattleFlipped([]);
      setBattleSolved([]);
      setBattleScores(data.scores);
      setBattleOver(false);
      setBattleWinner(null);
      setRematchRequested(false);
      setRematchFromOpponent(false);
      setMode('battle');
      updateTaskProgress('play_any');
    });

    socket.on('opponent_memory_flip', ({ cardIndex }) => {
      // Show the opponent's flip briefly
      setBattleFlipped(prev => [...prev, cardIndex]);
      setTimeout(() => {
        setBattleFlipped(prev => prev.filter(i => i !== cardIndex));
      }, 800);
    });

    socket.on('memory_score_update', ({ scores, pairsFound }) => {
      setBattleScores(scores);
    });

    socket.on('memory_game_over', ({ scores, winnerUid }) => {
      setBattleScores(scores);
      setBattleOver(true);
      setBattleWinner(winnerUid);
      
      // Award 2x rewards for multiplayer win
      if (winnerUid === currentUser?.uid) {
        giveMultiplayerRewards(true);
      } else if (winnerUid) {
        giveMultiplayerRewards(false);
      }
    });

    socket.on('rematch_requested', ({ game }) => {
      if (game === 'memory') setRematchFromOpponent(true);
    });

    socket.on('waiting_for_opponent', () => {
      setIsMatchmaking(true);
    });

    return () => {
      socket.off('memory_match_found');
      socket.off('opponent_memory_flip');
      socket.off('memory_score_update');
      socket.off('memory_game_over');
      socket.off('rematch_requested');
      socket.off('waiting_for_opponent');
    };
  }, [socket, currentUser]);

  const giveMultiplayerRewards = async (isWin) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const baseScore = 200;
      const earnedXp = isWin ? baseScore * 2 : baseScore;
      const earnedCoins = isWin ? 40 : 10;

      await updateDoc(userRef, {
        score: increment(isWin ? baseScore * 2 : baseScore),
        xp: increment(earnedXp),
        coins: increment(earnedCoins),
      });

      const lbRef = doc(db, 'leaderboard', currentUser.uid);
      await setDoc(lbRef, {
        username: userProfile.username,
        avatar: userProfile.avatar || '',
        score: increment(isWin ? baseScore * 2 : baseScore),
        updatedAt: new Date(),
      }, { merge: true });

      if (isWin) updateTaskProgress('win_battle');
    } catch (e) {
      console.error(e);
    }
  };

  // SOLO MODE LOGIC
  const initializeGame = () => {
    const deck = [...CARD_ICONS, ...CARD_ICONS]
      .sort(() => Math.random() - 0.5)
      .map((icon, index) => ({ id: index, icon }));
    setCards(deck);
    setFlipped([]);
    setSolved([]);
    setMoves(0);
    setIsGameOver(false);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (flipped.length === 2) {
      const match = cards[flipped[0]].icon === cards[flipped[1]].icon;
      if (match) {
        setSolved((prev) => [...prev, flipped[0], flipped[1]]);
        setFlipped([]);
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
      setMoves((prev) => prev + 1);
    }
  }, [flipped, cards]);

  useEffect(() => {
    if (solved.length === cards.length && cards.length > 0) {
      handleSoloWin();
    }
  }, [solved, cards]);

  const handleCardClick = (index) => {
    if (flipped.length === 2 || flipped.includes(index) || solved.includes(index)) return;
    setFlipped((prev) => [...prev, index]);
  };

  const handleSoloWin = async () => {
    setIsPlaying(false);
    setIsGameOver(true);
    const baseScore = 200;
    const penalty = (moves - 8) * 5;
    const finalScore = Math.max(10, baseScore - penalty);
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          score: increment(finalScore),
          xp: increment(finalScore),
          coins: increment(Math.floor(finalScore / 10)),
        });
        const lbRef = doc(db, 'leaderboard', currentUser.uid);
        const lbSnap = await getDoc(lbRef);
        if (lbSnap.exists()) {
          await updateDoc(lbRef, { score: increment(finalScore), updatedAt: new Date() });
        } else {
          await setDoc(lbRef, { username: userProfile.username, avatar: userProfile.avatar || '', score: finalScore, updatedAt: new Date() });
        }
        updateTaskProgress('play_any');
      } catch (error) {
        console.error("Error saving score:", error);
      }
    }
  };

  // BATTLE MODE LOGIC
  const joinQueue = () => {
    if (!socket || !userProfile) return;
    setIsMatchmaking(true);
    socket.emit('join_memory_queue', {
      uid: currentUser.uid,
      username: userProfile.username,
      avatar: userProfile.avatar || '',
    });
  };

  const cancelMatchmaking = () => {
    socket.emit('leave_memory_queue');
    setIsMatchmaking(false);
  };

  const handleBattleCardClick = (index) => {
    if (battleSolved.includes(index) || battleFlipped.includes(index)) return;
    if (battleFlipped.length >= 2) return;

    // Emit the flip to opponent
    socket.emit('memory_card_flip', {
      roomId: matchData.roomId,
      cardIndex: index,
      uid: currentUser.uid,
    });

    const newFlipped = [...battleFlipped, index];
    setBattleFlipped(newFlipped);

    if (newFlipped.length === 2) {
      const card1 = battleCards[newFlipped[0]];
      const card2 = battleCards[newFlipped[1]];
      
      if (card1.icon === card2.icon) {
        // Found a pair!
        setBattleSolved(prev => [...prev, newFlipped[0], newFlipped[1]]);
        setBattleFlipped([]);
        socket.emit('memory_pair_found', {
          roomId: matchData.roomId,
          uid: currentUser.uid,
        });
      } else {
        setTimeout(() => setBattleFlipped([]), 1000);
      }
    }
  };

  const requestRematch = () => {
    setRematchRequested(true);
    socket.emit('request_rematch', {
      roomId: matchData.roomId,
      uid: currentUser.uid,
      game: 'memory',
    });
  };

  const acceptRematch = () => {
    socket.emit('accept_rematch', {
      roomId: matchData.roomId,
      game: 'memory',
      players: matchData.players,
    });
  };

  const updateTaskProgress = async (taskId) => {
    try {
      const idToken = await currentUser.getIdToken();
      await fetch(`${API_BASE_URL}/api/tasks/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ taskId }),
      });
    } catch (error) {
      console.error('Error updating task progress:', error);
    }
  };

  const opponentInfo = matchData?.players.find(p => p.uid !== currentUser?.uid);
  const myScore = battleScores[currentUser?.uid] || 0;
  const opponentScore = battleScores[opponentInfo?.uid] || 0;

  // MODE SELECTION SCREEN
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
          <h1 className="text-5xl font-bold neon-text-purple mb-2 tracking-wider">MEMORY MATCH</h1>
          <p className="text-gray-400 text-lg">Find the matching pairs</p>
        </div>
        <div className="glass-card w-full p-10 flex flex-col items-center justify-center min-h-[400px] border-purple-500/20">
          <div className="text-6xl mb-8">🧠</div>
          <h2 className="text-2xl font-bold text-white mb-8">Select Your Mode</h2>
          <div className="flex flex-wrap justify-center gap-6">
            <button
              onClick={() => { setMode('solo'); initializeGame(); }}
              className="px-8 py-4 bg-gray-800 border-2 border-gray-600 rounded-xl text-white font-bold hover:border-purple-400 hover:bg-purple-400/10 transition-all w-48"
            >
              SOLO PRACTICE
            </button>
            <button
              onClick={joinQueue}
              className="px-8 py-4 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-400 transition-all w-48 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            >
              1v1 BATTLE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MATCHMAKING
  if (isMatchmaking) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold neon-text-purple mb-2 tracking-wider">MEMORY MATCH</h1>
          <p className="text-gray-400 text-lg">1v1 Battle Mode</p>
        </div>
        <div className="glass-card w-full p-10 flex flex-col items-center justify-center min-h-[400px] border-purple-500/20">
          <div className="w-20 h-20 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-6"></div>
          <h3 className="text-2xl font-bold text-white mb-2">Searching for Opponent...</h3>
          <p className="text-gray-400 mb-8">Finding a memory master to challenge</p>
          <button onClick={cancelMatchmaking} className="text-red-400 hover:underline font-bold">CANCEL</button>
        </div>
      </div>
    );
  }

  // BATTLE MODE
  if (mode === 'battle' && matchData) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
        <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Library
        </Link>

        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold neon-text-purple mb-1 tracking-wider">MEMORY BATTLE</h1>
          <p className="text-gray-400">Race to find the most pairs!</p>
        </div>

        {/* Versus header */}
        <div className="flex w-full justify-between items-center mb-6 px-4 max-w-2xl bg-gray-900/40 p-4 rounded-xl border border-gray-700">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${myScore >= opponentScore ? 'border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'border-gray-600'}`}>
              <div className="w-full h-full bg-purple-900 flex items-center justify-center text-white font-bold">
                {userProfile?.username?.charAt(0) || '?'}
              </div>
            </div>
            <span className="font-bold text-white text-sm">{userProfile?.username} (You)</span>
            <span className="text-3xl font-black text-purple-400">{myScore}</span>
            <span className="text-[10px] text-gray-500 uppercase">Pairs</span>
          </div>

          <div className="text-2xl font-black text-gray-600 italic">VS</div>

          <div className="flex flex-col items-center gap-1">
            <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${opponentScore >= myScore ? 'border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'border-gray-600'}`}>
              <div className="w-full h-full bg-pink-900 flex items-center justify-center text-white font-bold">
                {opponentInfo?.username?.charAt(0) || '?'}
              </div>
            </div>
            <span className="font-bold text-white text-sm">{opponentInfo?.username}</span>
            <span className="text-3xl font-black text-pink-400">{opponentScore}</span>
            <span className="text-[10px] text-gray-500 uppercase">Pairs</span>
          </div>
        </div>

        {/* Battle over */}
        {battleOver ? (
          <div className="glass-card w-full p-10 flex flex-col items-center border-purple-500/20 animate-fade-in-up">
            <h2 className={`text-4xl font-black mb-4 ${battleWinner === currentUser.uid ? 'neon-text-purple' : battleWinner === null ? 'text-gray-400' : 'text-red-500'}`}>
              {battleWinner === currentUser.uid ? '🎉 VICTORY!' : battleWinner === null ? '🤝 DRAW' : '💀 DEFEAT'}
            </h2>

            <div className="bg-gray-900/50 rounded-lg p-6 mb-6 border border-gray-700 w-full max-w-sm">
              <div className="text-sm text-gray-400 mb-4 uppercase tracking-widest text-center">Rewards Earned (2x Multiplayer)</div>
              <div className="flex justify-around">
                <div className="text-center">
                  <span className="text-purple-400 font-bold text-2xl block">+{battleWinner === currentUser.uid ? 400 : 200}</span>
                  <span className="text-xs text-gray-500">XP</span>
                </div>
                <div className="text-center">
                  <span className="text-yellow-400 font-bold text-2xl block">+{battleWinner === currentUser.uid ? 40 : 10}</span>
                  <span className="text-xs text-gray-500">COINS</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              {rematchFromOpponent ? (
                <button onClick={acceptRematch} className="px-8 py-3 bg-green-500 text-white rounded-lg font-bold hover:bg-green-400 transition-all animate-pulse">
                  ACCEPT REMATCH
                </button>
              ) : rematchRequested ? (
                <button disabled className="px-8 py-3 bg-gray-700 text-gray-400 rounded-lg font-bold cursor-not-allowed">
                  REMATCH SENT...
                </button>
              ) : (
                <button onClick={requestRematch} className="px-8 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-400 transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                  REMATCH
                </button>
              )}
              <button
                onClick={() => { setMode(null); setMatchData(null); setBattleOver(false); }}
                className="px-8 py-3 border border-gray-600 text-gray-300 rounded-lg font-bold hover:border-white hover:text-white transition-all"
              >
                LEAVE
              </button>
            </div>
          </div>
        ) : (
          /* The Battle Board */
          <div className="glass-card w-full p-6 border-purple-500/20">
            <div className="grid grid-cols-4 gap-3 w-full max-w-md mx-auto">
              {battleCards.map((card, index) => {
                const isFlippedByMe = battleFlipped.includes(index);
                const isSolved = battleSolved.includes(index);
                const showIcon = isFlippedByMe || isSolved;
                return (
                  <div
                    key={index}
                    onClick={() => !battleOver && handleBattleCardClick(index)}
                    className={`aspect-square flex items-center justify-center rounded-xl cursor-pointer transition-all duration-300
                      ${showIcon
                        ? 'bg-purple-500/20 border-2 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                        : 'bg-gray-800 border border-gray-700 hover:border-gray-500 hover:bg-gray-700'
                      }
                      ${isSolved ? 'opacity-60 scale-95' : ''}
                    `}
                  >
                    <div className={`text-4xl transition-opacity duration-300 ${showIcon ? 'opacity-100' : 'opacity-0'}`}>
                      {card.icon}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // SOLO MODE (unchanged from original)
  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Library
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold neon-text-purple mb-2 tracking-wider">MEMORY MATCH</h1>
        <p className="text-gray-400 text-lg">Find the matching pairs with the fewest moves possible</p>
      </div>

      <div className="glass-card w-full p-8 min-h-[500px] border-purple-500/20 relative flex flex-col items-center">
        <div className="flex w-full justify-between items-center mb-8 px-4">
          <div className="text-center">
            <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">Moves</div>
            <div className="text-3xl font-bold text-white">{moves}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400 uppercase tracking-widest mb-1">Pairs Found</div>
            <div className="text-3xl font-bold neon-text-purple">{solved.length / 2} / 8</div>
          </div>
        </div>

        {!isPlaying && !isGameOver ? (
          <div className="flex flex-col items-center justify-center flex-grow">
            <button
              onClick={initializeGame}
              className="px-10 py-4 bg-transparent border-2 border-purple-400 text-purple-400 rounded-lg text-2xl font-bold hover:bg-purple-400 hover:text-gray-900 transition-all shadow-[0_0_20px_rgba(176,38,255,0.3)] hover:shadow-[0_0_30px_rgba(176,38,255,0.6)]"
            >
              START GAME
            </button>
          </div>
        ) : isGameOver ? (
          <div className="flex flex-col items-center justify-center flex-grow animate-fade-in-up text-center">
            <h2 className="text-4xl font-bold text-white mb-2">VICTORY!</h2>
            <p className="text-gray-400 mb-8 text-xl">Completed in {moves} moves</p>

            <div className="bg-gray-900/50 rounded-lg p-6 mb-8 border border-gray-700 w-full max-w-sm">
              <div className="text-sm text-gray-400 mb-4">Rewards Earned</div>
              <div className="flex justify-around items-center">
                <div className="text-center">
                  <span className="text-purple-400 font-bold text-2xl block">+{Math.max(10, 200 - (moves - 8) * 5)}</span>
                  <span className="text-xs text-gray-500 font-bold tracking-wider">SCORE / XP</span>
                </div>
                <div className="w-px h-12 bg-gray-700"></div>
                <div className="text-center">
                  <span className="text-yellow-400 font-bold text-2xl block">+{Math.floor(Math.max(10, 200 - (moves - 8) * 5) / 10)}</span>
                  <span className="text-xs text-gray-500 font-bold tracking-wider">COINS</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button onClick={initializeGame} className="px-8 py-3 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600 transition-all shadow-[0_0_15px_rgba(176,38,255,0.5)]">
                PLAY AGAIN
              </button>
              <button onClick={() => setMode(null)} className="px-8 py-3 border border-gray-600 text-gray-300 rounded-lg font-bold hover:border-white transition-all">
                BACK
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 w-full max-w-md">
            {cards.map((card, index) => {
              const isFlipped = flipped.includes(index) || solved.includes(index);
              return (
                <div
                  key={index}
                  onClick={() => handleCardClick(index)}
                  className={`aspect-square flex items-center justify-center rounded-xl cursor-pointer transition-all duration-300 transform-gpu ${
                    isFlipped
                      ? 'bg-purple-500/20 border-2 border-purple-400 shadow-[0_0_15px_rgba(176,38,255,0.4)] rotate-y-180'
                      : 'bg-gray-800 border border-gray-700 hover:border-gray-500 hover:bg-gray-700'
                  }`}
                  style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
                >
                  <div className={`text-4xl transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0'}`}>
                    {card.icon}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
