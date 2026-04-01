import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import toast, { Toaster } from 'react-hot-toast';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: 0, onlineUsers: 0, totalCoins: 0 });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const fetchedUsers = [];
      let onlineCount = 0;
      let coinSum = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        fetchedUsers.push({ id: doc.id, ...data });
        if (data.isOnline) onlineCount++;
        if (data.coins) coinSum += data.coins;
      });

      setUsers(fetchedUsers);
      setStats({
        totalUsers: fetchedUsers.length,
        onlineUsers: onlineCount,
        totalCoins: coinSum
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users data");
    } finally {
      setLoading(false);
    }
  };

  const grantRewards = async (userId, username, amount) => {
    try {
      const userRef = doc(db, 'users', userId);
      // Wait, we need to increment. For simplicity in admin, let's just fetch existing and add, or use increment.
      // Easiest is to find them in the `users` state array and update directly
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const currentCoins = user.coins || 0;
      const currentXp = user.xp || 0;

      await updateDoc(userRef, {
        coins: currentCoins + amount,
        xp: currentXp + (amount * 10) // arbitrarily tie xp to admin coin grants
      });

      toast.success(`Granted ${amount} Coins to ${username}!`);
      fetchUsers(); // Refresh list to show new info
    } catch (error) {
      console.error("Error granting rewards", error);
      toast.error("Failed to grant rewards");
    }
  };

  const deleteUserRecord = async (userId, username) => {
    if (!window.confirm(`Are you SURE you want to delete ${username}'s profile data? This cannot be undone.`)) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
      await deleteDoc(doc(db, 'leaderboard', userId));
      toast.success(`Deleted data for ${username}`);
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user data");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Toaster position="top-right" />
      
      <div className="mb-10">
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500 mb-2">
          SYSTEM OVERSEER
        </h1>
        <p className="text-gray-400 text-lg">Platform Administration & Analytics</p>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="glass-card p-6 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <div className="text-sm text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Total Registered
          </div>
          <div className="text-4xl font-bold text-white">{stats.totalUsers}</div>
        </div>
        
        <div className="glass-card p-6 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <div className="text-sm text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Currently Online
          </div>
          <div className="text-4xl font-bold text-green-400">{stats.onlineUsers}</div>
        </div>

        <div className="glass-card p-6 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
          <div className="text-sm text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="text-yellow-400">🪙</span>
            Economy Total
          </div>
          <div className="text-4xl font-bold text-yellow-500">{stats.totalCoins.toLocaleString()}</div>
        </div>
      </div>

      {/* User Management Table */}
      <div className="glass-card border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Player Management
          </h2>
          <button 
            onClick={fetchUsers}
            className="px-4 py-2 border border-gray-600 rounded bg-gray-800 text-gray-300 hover:text-white hover:border-gray-400 transition-colors text-sm"
          >
            Refresh Data
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
             <div className="flex justify-center py-20 text-red-500">
               <div className="w-8 h-8 rounded-full border-t-2 border-b-2 border-red-500 animate-spin"></div>
             </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="text-xs text-gray-300 uppercase bg-gray-800/80 border-b border-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-4">Player</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                  <th scope="col" className="px-6 py-4">Level / XP</th>
                  <th scope="col" className="px-6 py-4">Coins</th>
                  <th scope="col" className="px-6 py-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-xs ${user.isAdmin ? 'border-2 border-red-500' : ''}`}>
                        {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-full" alt="" /> : (user.username ? user.username.charAt(0).toUpperCase() : 'U')}
                      </div>
                      <div className="flex flex-col">
                        <span>{user.username || 'Unknown User'} {user.isAdmin && <span className="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">ADMIN</span>}</span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isOnline ? (
                        <span className="text-green-400 flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full"></span> Online</span>
                      ) : (
                        <span className="text-gray-500">Offline</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white font-bold text-lg mb-0.5">{user.level}</div>
                      <div className="text-xs text-purple-400">{user.xp?.toLocaleString() || 0} XP</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-yellow-400 text-lg">
                      {user.coins?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                       <button 
                         onClick={() => grantRewards(user.id, user.username, 1000)}
                         className="px-3 py-1.5 rounded bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-gray-900 border border-yellow-500/30 transition-colors"
                         title="Grant 1000 Coins"
                       >
                         +🪙
                       </button>
                       <button 
                         onClick={() => deleteUserRecord(user.id, user.username)}
                         className="px-3 py-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 transition-colors"
                         title="Nuke Account Data"
                         disabled={user.isAdmin}
                       >
                         🗑️
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
