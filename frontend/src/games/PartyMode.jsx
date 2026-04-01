import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function PartyMode() {
  const { currentUser, userProfile } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [inParty, setInParty] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [partyData, setPartyData] = useState(null);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [inputCode, setInputCode] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('party_created', ({ partyId, party }) => {
      setPartyId(partyId);
      setPartyData(party);
      setInParty(true);
      toast.success(`Party Created! Code: ${partyId}`);
    });

    socket.on('party_updated', (updatedParty) => {
      setPartyData(updatedParty);
      setInParty(true);
    });

    socket.on('party_error', (error) => {
      toast.error(error);
    });

    socket.on('new_party_message', (msg) => {
      setChat((prev) => [...prev, msg]);
    });

    socket.on('navigate_to_game', (gameRoute) => {
      toast(`Host is starting the game...`, { icon: '🎮' });
      setTimeout(() => {
        navigate(gameRoute);
      }, 2000);
    });

    return () => {
      socket.off('party_created');
      socket.off('party_updated');
      socket.off('party_error');
      socket.off('new_party_message');
      socket.off('navigate_to_game');
    };
  }, [socket, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const createParty = () => {
    if (socket && userProfile) {
      socket.emit('create_party', {
        uid: currentUser.uid,
        username: userProfile.username,
        avatar: userProfile.avatar || ''
      });
    }
  };

  const joinParty = () => {
    if (!inputCode.trim()) return toast.error('Enter a room code!');
    if (socket && userProfile) {
      socket.emit('join_party', {
        partyId: inputCode.trim().toUpperCase(),
        userData: {
          uid: currentUser.uid,
          username: userProfile.username,
          avatar: userProfile.avatar || ''
        }
      });
    }
  };

  const leaveParty = () => {
    if (socket && partyId) {
      socket.emit('leave_party', { partyId, uid: currentUser.uid });
      setInParty(false);
      setPartyId('');
      setPartyData(null);
      setChat([]);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (socket && partyId) {
      socket.emit('send_party_message', {
        partyId,
        message: message.trim(),
        userData: { uid: currentUser.uid, username: userProfile.username }
      });
      setMessage('');
    }
  };

  const isHost = partyData?.hostId === currentUser.uid;

  if (!inParty) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[70vh]">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold neon-text-pink mb-4 uppercase tracking-tighter">PARTY MODE</h1>
          <p className="text-gray-400 text-xl font-mono">Create or join a private room to play with friends</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
          <button 
            onClick={createParty}
            className="glass-card p-10 flex flex-col items-center justify-center border-pink-500/20 hover:border-pink-500/50 transition-all group"
          >
            <div className="w-20 h-20 bg-pink-500 rounded-2xl flex items-center justify-center text-4xl mb-6 shadow-[0_0_30px_rgba(236,72,153,0.4)] group-hover:scale-110 transition-transform">
              🏠
            </div>
            <h3 className="text-2xl font-bold text-white mb-2 uppercase">Create Party</h3>
            <p className="text-gray-400 text-sm">Start your own private lobby</p>
          </button>

          <div className="glass-card p-10 flex flex-col items-center justify-center border-cyan-500/20 hover:border-cyan-500/50 transition-all">
            <div className="w-20 h-20 bg-cyan-500 rounded-2xl flex items-center justify-center text-4xl mb-6 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
              🔑
            </div>
            <h3 className="text-2xl font-bold text-white mb-4 uppercase">Join Party</h3>
            <input 
              type="text" 
              placeholder="ENTER CODE" 
              maxLength={6}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-center text-xl font-bold text-white mb-4 focus:border-cyan-400 outline-none w-full"
            />
            <button 
              onClick={joinParty}
              className="w-full py-2 bg-cyan-500 text-gray-900 font-bold rounded-lg hover:bg-cyan-400 transition-colors"
            >
              JOIN ROOM
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col md:flex-row gap-8 min-h-[80vh]">
      
      {/* Left: Player List */}
      <div className="flex-1">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-4xl font-bold neon-text-pink mb-1 uppercase">THE LOBBY</h1>
            <div className="flex items-center gap-2">
               <span className="text-gray-400 font-mono">ROOM CODE:</span>
               <span className="text-pink-400 text-2xl font-black bg-pink-400/10 px-3 rounded tracking-widest">{partyId}</span>
            </div>
          </div>
          <button 
            onClick={leaveParty}
            className="px-4 py-2 text-red-400 border border-red-400/30 rounded hover:bg-red-400/10 transition-colors text-sm font-bold uppercase"
          >
            Leave
          </button>
        </div>

        <div className="glass-card p-6 border-white/5 min-h-[400px]">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] mb-6">Players • {partyData?.players.length} / 8</h3>
          <div className="grid grid-cols-2 gap-4">
            {partyData?.players.map((player) => (
              <div key={player.uid} className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-xl border border-white/5 relative group overflow-hidden">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-pink-500/30">
                  <img src={player.avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${player.username}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{player.username}</span>
                    {player.uid === partyData.hostId && (
                      <span className="text-[10px] bg-yellow-500 text-gray-900 px-1.5 rounded font-black uppercase">Host</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono italic">Ready</div>
                </div>
                {/* Visual flare for host */}
                {player.uid === partyData.hostId && (
                   <div className="absolute top-0 right-0 w-8 h-8 bg-yellow-500/10 rounded-bl-full border-b border-l border-yellow-500/20"></div>
                )}
              </div>
            ))}
          </div>
          
          {isHost && partyData?.players.length >= 1 && (
            <div className="mt-12 text-center">
               <button 
                onClick={() => socket.emit('start_party_game', { partyId, gameRoute: '/games/tap-speed' })}
                className="px-12 py-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black rounded-xl hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transition-all active:scale-95"
               >
                 LAUNCH GAME
               </button>
               <p className="text-gray-500 text-xs mt-4 italic font-mono uppercase">Only the host can launch games</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Party Chat */}
      <div className="w-full md:w-80 flex flex-col glass-card border-none bg-black/40 overflow-hidden h-[80vh] md:h-auto">
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <h3 className="font-bold text-sm tracking-widest text-gray-300 uppercase">Party Chat</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chat.length === 0 && (
            <div className="text-center py-10 opacity-30 italic text-sm">No messages yet. Say hi!</div>
          )}
          {chat.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.uid === currentUser.uid ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase">{msg.sender}</span>
              </div>
              <div className={`px-4 py-2 rounded-2xl text-sm max-w-[90%] ${msg.uid === currentUser.uid ? 'bg-pink-500 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={sendMessage} className="p-4 bg-black/30 flex gap-2">
          <input 
            type="text" 
            placeholder="TYPE..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-pink-500 outline-none"
          />
          <button 
            type="submit"
            className="p-2 bg-pink-500 text-white rounded-lg hover:bg-pink-400 transition-colors"
          >
            📨
          </button>
        </form>
      </div>

    </div>
  );
}
