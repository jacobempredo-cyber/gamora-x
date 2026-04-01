import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function NotificationManager() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [activeInvite, setActiveInvite] = useState(null);

  useEffect(() => {
    if (!currentUser) return;

    // Listen for pending game invites sent TO the current user
    const q = query(
      collection(db, 'game_invites'),
      where('toUid', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.forEach((changeDoc) => {
        if (!changeDoc.exists()) return;
        const invite = { id: changeDoc.id, ...changeDoc.data() };
        
        // Ensure timestamp exists and is a Firebase Timestamp
        if (!invite.timestamp || typeof invite.timestamp.toDate !== 'function') return;

        const now = new Date().getTime();
        const inviteTime = invite.timestamp.toDate().getTime();
        
        // Only show if it's new (within last 30 seconds)
        if (now - inviteTime < 30000) {
          setActiveInvite(invite);
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAccept = async () => {
    if (!activeInvite) return;
    try {
      await updateDoc(doc(db, 'game_invites', activeInvite.id), {
        status: 'accepted'
      });
      
      const gameRoute = activeInvite.gameType === 'tic-tac-toe' ? '/games/tic-tac-toe' : '/games';
      toast.success("Joined match!");
      setActiveInvite(null);
      navigate(gameRoute);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDecline = async () => {
    if (!activeInvite) return;
    try {
      await updateDoc(doc(db, 'game_invites', activeInvite.id), {
        status: 'declined'
      });
      setActiveInvite(null);
    } catch (error) {
      console.error(error);
    }
  };

  if (!activeInvite) return null;

  return (
    <div className="fixed top-20 right-8 z-[100] animate-fade-in-right">
      <div className="glass-card p-6 border-cyan-500 w-80 bg-gray-900 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-cyan-500 rounded-full flex items-center justify-center text-2xl">
            ⚔️
          </div>
          <div>
            <h4 className="text-white font-bold uppercase tracking-tight">Game Invite!</h4>
            <p className="text-gray-400 text-xs">From <span className="text-cyan-400">{activeInvite.fromUsername}</span></p>
          </div>
        </div>
        
        <p className="text-sm text-gray-300 mb-6 font-mono">
          Wants to play <span className="text-purple-400 uppercase">{activeInvite.gameType}</span> with you.
        </p>

        <div className="flex gap-3">
          <button 
            onClick={handleAccept}
            className="flex-1 bg-cyan-500 text-gray-900 font-bold py-2 rounded hover:bg-cyan-400 transition-colors"
          >
            JOIN
          </button>
          <button 
            onClick={handleDecline}
            className="flex-1 bg-transparent border border-gray-600 text-gray-400 py-2 rounded hover:text-white transition-colors"
          >
            DECLINE
          </button>
        </div>
      </div>
    </div>
  );
}
