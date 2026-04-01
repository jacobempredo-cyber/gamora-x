import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Link } from 'react-router-dom';

export default function TapSpeed() {
  const { currentUser, userProfile } = useAuth();
  const { socket } = useSocket();

  // Mode: 'solo' or 'battle'
  const [mode, setMode] = useState(null); 
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchData, setMatchData] = useState(null);

  const [score, setScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [highScore, setHighScore] = useState(0);

  const timerRef = useRef(null);

  // Socket Listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('tap_match_found', (data) => {
      setIsMatchmaking(false);
      setMatchData(data);
      setMode('battle');
      startBattle();
    });

    socket.on('opponent_tapped', ({ uid }) => {
      setOpponentScore(prev => prev + 1);
    });

    socket.on('player_finished', ({ uid, score: finalScore }) => {
      if (uid !== currentUser.uid) {
        setOpponentScore(finalScore);
      }
    });

    return () => {
      socket.off('tap_match_found');
      socket.off('opponent_tapped');
      socket.off('player_finished');
    };
  }, [socket, currentUser]);

  // Timer Logic
  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isPlaying) {
      endGame();
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, timeLeft]);

  const startSolo = () => {
    setMode('solo');
    setScore(0);
    setTimeLeft(10);
    setIsPlaying(true);
    setIsGameOver(false);
  };

  const startBattle = () => {
    setScore(0);
    setOpponentScore(0);
    setTimeLeft(10);
    setIsPlaying(true);
    setIsGameOver(false);
  };

  const joinQueue = () => {
    if (!socket || !userProfile) return;
    setIsMatchmaking(true);
    socket.emit('join_tap_queue', {
      uid: currentUser.uid,
      username: userProfile.username,
      avatar: userProfile.avatar
    });
  };

  const cancelMatchmaking = () => {
    socket.emit('leave_tap_queue');
    setIsMatchmaking(false);
  };

  const handleTap = () => {
    if (isPlaying && timeLeft > 0) {
      const newScore = score + 1;
      setScore(newScore);
      
      if (mode === 'battle' && matchData) {
        socket.emit('tap_press', { roomId: matchData.roomId, uid: currentUser.uid });
      }
    }
  };

  const endGame = async () => {
    setIsPlaying(false);
    setIsGameOver(true);
    clearInterval(timerRef.current);

    if (mode === 'battle' && matchData) {
      socket.emit('tap_game_over', { 
        roomId: matchData.roomId, 
        finalScore: score, 
        uid: currentUser.uid 
      });
    }

    if (score > highScore) setHighScore(score);
    
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        
        // Multiplayer Win Logic
        let isWin = false;
        if (mode === 'battle') {
           isWin = score > opponentScore;
        }

        const earnedXp = isWin ? score * 2 : score;
        const earnedCoins = isWin ? Math.floor(score / 5) : Math.floor(score / 10);
        
        await updateDoc(userRef, {
          score: increment(isWin ? score * 2 : score),
          xp: increment(earnedXp),
          coins: increment(earnedCoins)
        });
        
        // Update Leaderboard
        const lbRef = doc(db, 'leaderboard', currentUser.uid);
        await setDoc(lbRef, {
          username: userProfile.username,
          avatar: userProfile.avatar || '',
          score: increment(isWin ? score * 2 : score),
          updatedAt: new Date()
        }, { merge: true });
        
        updateTaskProgress('play_any');
      } catch (error) {
        console.error("Error saving score:", error);
      }
    }
  };

  const updateTaskProgress = async (taskId) => {
    try {
      const idToken = await currentUser.getIdToken();
      await fetch('/api/tasks/progress', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}` 
        },
        body: JSON.stringify({ taskId })
      });
    } catch (error) {
      console.error('Error updating task progress:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
      <Link to="/dashboard" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Arena
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold neon-text-yellow mb-2 tracking-wider">
          {mode === 'battle' ? 'TAP BATTLE' : 'TAP SPEED'}
        </h1>
        <p className="text-gray-400 text-lg">
          {mode === 'battle' ? 'Defeat your opponent in real-time!' : 'Test your finger speed in 10 seconds'}
        </p>
      </div>

      <div className="glass-card w-full p-8 flex flex-col items-center justify-center min-h-[450px] border-yellow-500/20 relative overflow-hidden">
        
        {!isPlaying && !isGameOver && !isMatchmaking && (
          <div className="flex flex-col gap-6 items-center">
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-2xl font-bold text-white mb-4">Select Your Mode</h2>
            <div className="flex flex-wrap justify-center gap-6">
              <button 
                onClick={startSolo}
                className="px-8 py-4 bg-gray-800 border-2 border-gray-600 rounded-xl text-white font-bold hover:border-yellow-400 hover:bg-yellow-400/10 transition-all w-48"
              >
                SOLO PRACTICE
              </button>
              <button 
                onClick={joinQueue}
                className="px-8 py-4 bg-yellow-500 text-gray-900 rounded-xl font-bold hover:bg-yellow-400 transition-all w-48 shadow-[0_0_20px_rgba(234,179,8,0.4)]"
              >
                1v1 BATTLE
              </button>
            </div>
          </div>
        )}

        {isMatchmaking && (
          <div className="flex flex-col items-center animate-fade-in">
             <div className="w-20 h-20 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mb-6"></div>
             <h3 className="text-2xl font-bold text-white mb-2">Searching for Opponent...</h3>
             <p className="text-gray-400 mb-8">Matching you with a speed tapper</p>
             <button 
               onClick={cancelMatchmaking}
               className="text-red-400 hover:underline font-bold"
             >
               CANCEL
             </button>
          </div>
        )}

        {isPlaying && (
          <div className="w-full flex flex-col items-center">
             <div className="absolute top-6 left-1/2 -translate-x-1/2 text-4xl font-black text-white bg-gray-900/80 px-6 py-2 rounded-full border border-yellow-500/30">
               {timeLeft}s
             </div>

             <div className="flex w-full justify-between items-center mt-12 mb-12 max-w-2xl">
               <div className="text-center">
                 <div className="text-xs text-gray-400 uppercase mb-2">You</div>
                 <div className="text-6xl font-black neon-text-yellow">{score}</div>
               </div>

               {mode === 'battle' && (
                 <>
                   <div className="text-2xl font-black text-gray-700 italic">VS</div>
                   <div className="text-center">
                     <div className="text-xs text-gray-400 uppercase mb-2">Opponent</div>
                     <div className="text-6xl font-black text-gray-400">{opponentScore}</div>
                   </div>
                 </>
               )}
             </div>

             <button 
               onMouseDown={handleTap}
               onTouchStart={handleTap}
               className="w-56 h-56 rounded-full bg-yellow-400 flex items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.5)] active:scale-95 transition-transform cursor-pointer select-none border-8 border-yellow-500/30 overflow-hidden relative"
             >
               <span className="text-gray-900 text-5xl font-black z-10">TAP!</span>
               {mode === 'battle' && (
                 <div 
                   className="absolute bottom-0 left-0 right-0 bg-yellow-600/30 transition-all duration-300"
                   style={{ height: `${(opponentScore / (score || 1)) * 50}%` }}
                 />
               )}
             </button>
          </div>
        )}

        {isGameOver && (
          <div className="flex flex-col items-center animate-fade-in-up w-full max-w-md">
            <h2 className="text-4xl font-black text-white mb-2 italic">
              {mode === 'battle' 
                ? (score > opponentScore ? '🎉 VICTORY!' : score === opponentScore ? '🤝 DRAW' : '💀 DEFEAT') 
                : 'TIME\'S UP!'}
            </h2>
            
            <div className="w-full bg-gray-900/80 rounded-2xl p-6 border border-gray-700 shadow-2xl mb-8">
              <div className="flex justify-between items-center mb-6">
                <div className="text-center flex-1">
                  <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Your Final</div>
                  <div className="text-4xl font-black text-yellow-400">{score}</div>
                </div>
                {mode === 'battle' && (
                  <>
                    <div className="h-10 w-px bg-gray-700" />
                    <div className="text-center flex-1">
                      <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Opponent</div>
                      <div className="text-4xl font-black text-gray-500">{opponentScore}</div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="pt-4 border-t border-gray-800">
                <div className="text-[10px] text-gray-400 uppercase font-bold mb-3 text-center tracking-widest">Rewards Received</div>
                <div className="flex justify-center gap-8">
                   <div className="flex items-center gap-2">
                     <span className="text-purple-400 font-black">+{mode === 'battle' && score > opponentScore ? score * 2 : score}</span>
                     <span className="text-[10px] text-gray-500 font-bold uppercase">XP</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-yellow-500 font-black">+{mode === 'battle' && score > opponentScore ? Math.floor(score/5) : Math.floor(score/10)}</span>
                     <span className="text-[10px] text-gray-500 font-bold uppercase">Coins</span>
                   </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                setIsGameOver(false);
                setMode(null);
                setScore(0);
                setOpponentScore(0);
                setTimeLeft(10);
              }}
              className="px-8 py-3 bg-cyan-500 text-gray-900 rounded-lg font-bold hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)]"
            >
              BACK TO MODES
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
