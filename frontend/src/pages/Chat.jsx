import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';

export default function Chat() {
  const { currentUser, userProfile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  
  const bottomRef = useRef(null);

  useEffect(() => {
    // Listen to global chat messages
    const q = query(
      collection(db, 'global_chat'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setLoading(false);
      
      // Auto-scroll to bottom
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !userProfile) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'global_chat'), {
        text: msgText,
        uid: currentUser.uid,
        username: userProfile.username,
        avatar: userProfile.avatar || '',
        level: userProfile.level,
        timestamp: serverTimestamp()
      });
      // Daily Task: Chatty
      updateTaskProgress('chatty');
    } catch (error) {
      console.error("Error sending message:", error);
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

  const formatTime = (firebaseTimestamp) => {
    if (!firebaseTimestamp) return '';
    const date = firebaseTimestamp.toDate();
    return format(date, 'HH:mm');
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      
      <div className="mb-6">
        <h1 className="text-4xl font-bold neon-text-blue mb-2 tracking-wider">GLOBAL CHAT</h1>
        <p className="text-gray-400">Talk with players in the arena</p>
      </div>

      <div className="glass-card flex-1 flex flex-col border-cyan-500/20 overflow-hidden relative">
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {loading ? (
             <div className="flex justify-center py-10 text-cyan-500">
               <div className="w-8 h-8 rounded-full border-t-2 border-b-2 border-cyan-500 animate-spin"></div>
             </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              Be the first to say hello! 👋
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.uid === currentUser?.uid;
              
              return (
                <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 overflow-hidden border-2 ${isMe ? 'border-cyan-500' : 'border-purple-500'}`}>
                      {msg.avatar ? (
                        <img src={msg.avatar} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center font-bold text-white ${isMe ? 'bg-cyan-700' : 'bg-purple-700'}`}>
                          {msg.username?.charAt(0)}
                        </div>
                      )}
                    </div>
                    
                    {/* Message Content */}
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className={`font-bold text-sm ${isMe ? 'text-cyan-400' : 'text-purple-400'}`}>
                          {msg.username} <span className="text-xs text-gray-500 ml-1">Lvl {msg.level}</span>
                        </span>
                        <span className="text-xs text-gray-600">{formatTime(msg.timestamp)}</span>
                      </div>
                      
                      <div className={`px-4 py-2 rounded-2xl ${
                        isMe 
                          ? 'bg-cyan-600 text-white rounded-tr-none' 
                          : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                    
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gray-900/80 border-t border-cyan-500/20">
          <form onSubmit={sendMessage} className="flex gap-4">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-6 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 text-white w-12 h-12 rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_15px_rgba(0,240,255,0.3)]"
            >
              <svg className="w-5 h-5 -mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
