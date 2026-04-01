import React, { useState, useEffect } from 'react';
import { 
  collection, query, where, getDocs, limit, onSnapshot, 
  addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, setDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export default function Social() {
  const { currentUser } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Online Users (Arena)
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'users'),
      where('isOnline', '==', true),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = [];
      snapshot.forEach(doc => {
        if (doc.id !== currentUser.uid) {
          users.push({ id: doc.id, ...doc.data() });
        }
      });
      setOnlineUsers(users);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 2. Fetch Friend Requests
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'friend_requests'),
      where('toUid', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reqs = [];
      snapshot.forEach(doc => {
        reqs.push({ id: doc.id, ...doc.data() });
      });
      setRequests(reqs);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 3. Fetch Friends List
  useEffect(() => {
    if (!currentUser) return;
    const q = collection(db, 'users', currentUser.uid, 'friends');

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const friendIds = [];
      snapshot.forEach(doc => friendIds.push(doc.id));

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      // Fetch friend profiles to get online status
      const friendProfiles = [];
      for (const fId of friendIds) {
        const fSnap = await getDoc(doc(db, 'users', fId));
        if (fSnap.exists()) {
          friendProfiles.push({ id: fSnap.id, ...fSnap.data() });
        }
      }
      setFriends(friendProfiles);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddFriend = async (targetUser) => {
    try {
      // Check if request already exists
      const q = query(
        collection(db, 'friend_requests'),
        where('fromUid', '==', currentUser.uid),
        where('toUid', '==', targetUser.id)
      );
      const snap = await getDocs(q);
      if (!snap.empty) return toast.error("Request already sent!");

      await addDoc(collection(db, 'friend_requests'), {
        fromUid: currentUser.uid,
        fromUsername: currentUser.displayName || 'User',
        toUid: targetUser.id,
        status: 'pending',
        timestamp: serverTimestamp()
      });

      toast.success(`Friend request sent to ${targetUser.username}!`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to send request.");
    }
  };

  const handleAcceptRequest = async (request) => {
    try {
      // 1. Add to my friends
      await setDoc(doc(db, 'users', currentUser.uid, 'friends', request.fromUid), {
        addedAt: serverTimestamp()
      });

      // 2. Add to their friends (reverse)
      await setDoc(doc(db, 'users', request.fromUid, 'friends', currentUser.uid), {
        addedAt: serverTimestamp()
      });

      // 3. Delete the request
      await deleteDoc(doc(db, 'friend_requests', request.id));

      toast.success("Friend request accepted!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to accept.");
    }
  };

  const handleInviteGame = async (targetUser) => {
    try {
      await addDoc(collection(db, 'game_invites'), {
        fromUid: currentUser.uid,
        fromUsername: currentUser.displayName || 'User',
        toUid: targetUser.id,
        gameType: 'tic-tac-toe',
        status: 'pending',
        timestamp: serverTimestamp()
      });
      toast(`Invited ${targetUser.username} to a match!`, { icon: '⚔️' });
    } catch (error) {
       console.error(error);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Toaster position="top-right" />
      
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400 mb-2 uppercase tracking-tighter">
            Social Hub
          </h1>
          <p className="text-gray-400 text-lg font-mono">Build your crew and dominate the Arena</p>
        </div>
        
        {requests.length > 0 && (
          <div className="bg-pink-500/10 border border-pink-500/30 p-4 rounded-xl animate-bounce">
            <p className="text-pink-400 text-sm font-bold flex items-center gap-2">
              💌 YOU HAVE {requests.length} NEW REQUESTS!
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Column: My Friends */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 border-pink-500/20 h-full">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-4 flex justify-between items-center tracking-widest">
              MY CREW
              <span className="text-[10px] bg-pink-500/20 text-pink-400 px-2 py-1 rounded">
                {friends.filter(f => f.isOnline).length} ONLINE
              </span>
            </h2>
            
            <div className="space-y-4">
              {friends.length === 0 ? (
                <div className="text-center py-10 opacity-30 italic">No friends yet...</div>
              ) : (
                friends.map(friend => (
                  <div key={friend.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full border-2 ${friend.isOnline ? 'border-green-500' : 'border-gray-700'} relative`}>
                        <img src={friend.avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${friend.username}`} alt="" className="w-full h-full rounded-full" />
                        {friend.isOnline && <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-black animate-pulse"></span>}
                      </div>
                      <span className={`font-medium ${friend.isOnline ? 'text-white' : 'text-gray-500'}`}>{friend.username}</span>
                    </div>
                    {friend.isOnline && (
                      <button 
                        onClick={() => handleInviteGame(friend)}
                        className="text-cyan-400 hover:text-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ⚔️
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: Live Users & Requests */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* Requests Section */}
          {requests.length > 0 && (
            <div className="glass-card p-6 border-pink-500/40 bg-pink-500/5">
              <h3 className="text-lg font-bold text-pink-400 mb-4 flex items-center gap-2">
                PEOPLE WANT TO BE YOUR FRIEND
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requests.map(req => (
                  <div key={req.id} className="bg-black/40 p-4 rounded-xl flex items-center justify-between border border-pink-500/20">
                    <span className="font-bold text-white">{req.fromUsername}</span>
                    <button 
                      onClick={() => handleAcceptRequest(req)}
                      className="bg-pink-500 text-white px-4 py-1 rounded-lg text-sm font-bold hover:bg-pink-400"
                    >
                      ACCEPT
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Online Arena Section */}
          <div className="glass-card p-6 border-cyan-500/20">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-4 flex items-center gap-2 tracking-widest">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
              LIVE IN ARENA
            </h2>

            {loading ? (
              <div className="flex justify-center py-20 text-cyan-500">
                <div className="w-8 h-8 rounded-full border-t-2 border-b-2 border-cyan-500 animate-spin"></div>
              </div>
            ) : onlineUsers.length === 0 ? (
              <div className="text-center py-20 opacity-30 italic font-mono uppercase">
                Offline or empty. The arena is quiet...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {onlineUsers.map(user => (
                  <div key={user.id} className="bg-gray-800/20 border border-gray-700/50 p-4 rounded-xl hover:border-cyan-500/50 hover:bg-gray-800/40 transition-all flex items-center justify-between group h-20">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-600 group-hover:border-cyan-400">
                        <img src={user.avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">
                          {user.username}
                        </div>
                        <div className="text-[10px] text-purple-400 font-bold uppercase">Rank: Novice • Level {user.level}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAddFriend(user)}
                      className="bg-cyan-500/10 text-cyan-400 border border-cyan-400/30 px-3 py-1 rounded text-xs font-black hover:bg-cyan-400 hover:text-black transition-all"
                    >
                      BEFRIEND +
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
