import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function TicTacToe() {
  const { currentUser, userProfile } = useAuth();
  const { socket } = useSocket();

  const [gameState, setGameState] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Local derived state
  const isMyTurn = gameState && gameState.turn === currentUser?.uid;
  const myPlayerInfo = gameState && gameState.players.find(p => p.uid === currentUser?.uid);
  const opponentInfo = gameState && gameState.players.find(p => p.uid !== currentUser?.uid);
  
  // Did I join as player 1 (O) or player 2 (X)? Let's just assign based on queue order
  // Actually, Server assigns turn to the opponent of the player that triggered match_found.
  // We'll say the player whose turn it is FIRST is X. Wait, we need a consistent marker.
  // Let's assume Players[0] is X and Players[1] is O.
  const myMarker = gameState && gameState.players[0].uid === currentUser?.uid ? 'X' : 'O';

  useEffect(() => {
    if (!socket) return;

    socket.on('waiting_for_opponent', () => {
      setIsSearching(true);
      setError('');
    });

    socket.on('match_found', (game) => {
      setIsSearching(false);
      setGameState(game);
      // Daily Task: Play any game
      updateTaskProgress('play_any');
    });

    socket.on('update_board', ({ index, uid }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        
        const newBoard = [...prev.board];
        // The marking logic relies on the sender's marker
        const moveMarker = prev.players[0].uid === uid ? 'X' : 'O';
        newBoard[index] = moveMarker;

        // Check winner
        const winLines = [
          [0,1,2], [3,4,5], [6,7,8], // rows
          [0,3,6], [1,4,7], [2,5,8], // cols
          [0,4,8], [2,4,6]           // diagonals
        ];

        let winner = null;
        for (let line of winLines) {
          const [a, b, c] = line;
          if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
            winner = prev.players.find(p => (prev.players[0].uid === p.uid ? 'X' : 'O') === newBoard[a]).uid;
            break;
          }
        }
        
        if (!winner && !newBoard.includes(null)) {
          winner = 'draw';
        }

        const nextTurn = prev.players.find(p => p.uid !== uid).uid;

        const newState = { ...prev, board: newBoard, turn: nextTurn, winner };
        
        // Handle post-game rewards automatically when state updates to winner on client
        // In a real app the server calculates and assigns rewards securely.
        if (winner && winner === currentUser.uid && !prev.winner) {
           giveWinRewards();
        }

        return newState;
      });
    });

    return () => {
      socket.off('waiting_for_opponent');
      socket.off('match_found');
      socket.off('update_board');
    };
  }, [socket, currentUser]);

  const giveWinRewards = async () => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        score: increment(500),
        xp: increment(500),
        coins: increment(50)
      });
      // Daily Task: Win battle
      updateTaskProgress('win_battle');
    } catch (e) {
      console.error(e);
    }
  }

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

  const findMatch = () => {
    if (!socket || !currentUser || !userProfile) return;
    socket.emit('join_queue', {
      uid: currentUser.uid,
      username: userProfile.username,
      avatar: userProfile.avatar,
      level: userProfile.level
    });
  };

  const cancelSearch = () => {
    if (!socket) return;
    socket.emit('leave_queue');
    setIsSearching(false);
  };

  const handleCellClick = (index) => {
    if (!gameState || !isMyTurn || gameState.winner || gameState.board[index]) return;

    socket.emit('make_move', {
      roomId: gameState.roomId,
      index,
      uid: currentUser.uid
    });
  };

  if (!socket) {
    return <div className="p-10 text-center text-gray-400">Connecting to game server...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center">
      <Link to="/games" className="self-start text-cyan-400 hover:text-cyan-300 mb-8 flex items-center gap-2 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Library
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold neon-text-purple mb-2 tracking-wider">BATTLE: TIC TAC TOE</h1>
        <p className="text-gray-400 text-lg">Defeat opponents in real-time</p>
      </div>

      <div className="glass-card w-full p-8 min-h-[500px] border-purple-500/20 flex flex-col items-center relative overflow-hidden">
        
        {!gameState ? (
          <div className="flex flex-col items-center justify-center h-[400px]">
            {isSearching ? (
              <div className="text-center animate-fade-in-up">
                <div className="w-24 h-24 border-t-4 border-b-4 border-purple-500 rounded-full animate-spin mx-auto mb-6"></div>
                <h2 className="text-2xl font-bold text-white mb-2">Searching for Opponent...</h2>
                <p className="text-gray-400 mb-8">Matching you with a player of similar skill</p>
                <button 
                  onClick={cancelSearch}
                  className="px-6 py-2 border border-red-500 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Cancel Search
                </button>
              </div>
            ) : (
              <div className="text-center animate-fade-in-up">
                <div className="text-6xl mb-6">⚔️</div>
                <h2 className="text-3xl font-bold text-white mb-8">Ready to Battle?</h2>
                <button 
                  onClick={findMatch}
                  className="px-10 py-4 bg-purple-600 text-white rounded-lg text-2xl font-bold hover:bg-purple-500 transition-all shadow-[0_0_20px_rgba(176,38,255,0.4)] hover:shadow-[0_0_30px_rgba(176,38,255,0.7)]"
                >
                  FIND MATCH
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center animate-fade-in-up">
            
            {/* Versus Header */}
            <div className="flex w-full justify-between items-center mb-10 px-4 max-w-2xl bg-gray-900/40 p-4 rounded-xl border border-gray-700">
              <div className="flex flex-col items-center gap-2">
                <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${isMyTurn ? 'border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.5)]' : 'border-gray-600'}`}>
                  {myPlayerInfo.avatar ? <img src={myPlayerInfo.avatar} alt="me" /> : <div className="w-full h-full bg-cyan-900 flex items-center justify-center text-white">{myPlayerInfo.username.charAt(0)}</div>}
                </div>
                <span className="font-bold text-white">{myPlayerInfo.username} (You)</span>
                <span className="text-2xl font-black text-cyan-400">{myMarker}</span>
              </div>

              <div className="text-4xl font-black text-gray-500 italic">VS</div>

              <div className="flex flex-col items-center gap-2">
                <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${!isMyTurn ? 'border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'border-gray-600'}`}>
                  {opponentInfo.avatar ? <img src={opponentInfo.avatar} alt="opponent" /> : <div className="w-full h-full bg-pink-900 flex items-center justify-center text-white">{opponentInfo.username.charAt(0)}</div>}
                </div>
                <span className="font-bold text-white">{opponentInfo.username}</span>
                <span className="text-2xl font-black text-pink-400">{myMarker === 'X' ? 'O' : 'X'}</span>
              </div>
            </div>
            
            {/* Status Banner */}
            <div className="h-12 flex items-center justify-center mb-4">
              {gameState.winner ? (
                <div className={`text-2xl font-bold ${gameState.winner === currentUser.uid ? 'neon-text-blue' : gameState.winner === 'draw' ? 'text-gray-400' : 'text-red-500'}`}>
                  {gameState.winner === currentUser.uid ? '🎉 YOU WIN!' : gameState.winner === 'draw' ? '🤝 MATCH DRAW' : '💀 YOU LOSE'}
                </div>
              ) : (
                <div className={`text-xl font-bold ${isMyTurn ? 'text-cyan-400 animate-pulse' : 'text-gray-500'}`}>
                  {isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
                </div>
              )}
            </div>

            {/* The Board */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-md bg-gray-800 p-3 rounded-2xl border border-gray-700 shadow-2xl">
              {gameState.board.map((cell, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCellClick(idx)}
                  disabled={!isMyTurn || cell || gameState.winner}
                  className={`aspect-square flex items-center justify-center rounded-xl text-6xl font-black transition-all duration-200 
                    ${cell ? 'bg-gray-700 cursor-default' : 'bg-gray-900 cursor-pointer'} 
                    ${!cell && isMyTurn && !gameState.winner ? 'hover:bg-gray-700 border border-gray-600 hover:border-cyan-500 hover:shadow-[inset_0_0_15px_rgba(0,240,255,0.2)]' : 'border border-gray-800'}
                    ${cell === 'X' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]' : cell === 'O' ? 'text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]' : ''}
                  `}
                >
                  {cell && <span className="animate-fade-in-up">{cell}</span>}
                </button>
              ))}
            </div>

            {/* Actions */}
            {gameState.winner && (
              <div className="mt-10">
                <button 
                  onClick={() => setGameState(null)}
                  className="px-8 py-3 border border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(176,38,255,0.3)]"
                >
                  LEAVE MATCH
                </button>
              </div>
            )}
            
          </div>
        )}

      </div>
    </div>
  );
}
