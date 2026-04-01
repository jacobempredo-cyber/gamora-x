import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/config';

export default function Profile() {
  const { currentUser, userProfile } = useAuth();
  
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [avatarPreview, setAvatarPreview] = useState(userProfile?.avatar || '');
  const [avatarFile, setAvatarFile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const fileInputRef = useRef(null);

  if (!userProfile) return null;

  const handleAvatarChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const calculateProgress = () => {
    // Arbitrary curve: next level = Level * 1000 XP
    const nextLevelXp = userProfile.level * 1000;
    const progress = Math.min(100, Math.max(0, (userProfile.xp / nextLevelXp) * 100));
    return progress;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      
      let avatarUrl = userProfile.avatar;

      // Handle file upload if a new avatar was selected
      if (avatarFile) {
        const fileRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
        await uploadBytes(fileRef, avatarFile);
        avatarUrl = await getDownloadURL(fileRef);
      }

      await updateDoc(userRef, {
        username,
        bio,
        avatar: avatarUrl
      });
      
      // Update the leaderboard cache
      const lbRef = doc(db, 'leaderboard', currentUser.uid);
      await updateDoc(lbRef, {
        username,
        avatar: avatarUrl
      }).catch(err => console.log("LB doc might not exist yet", err));

      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      
      // The context will automatically pick up the newest snapshot if we wired onSnapshot,
      // but since we just do a fetch on login, let's force a reload for full context refresh,
      // or just assume they see changes locally. Realistically, we'd update AuthContext state here.
      // For MVP, window.location.reload is an easy hack if we didn't add a setProfile hook.
      setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
      console.error(error);
      setMessage({ text: 'Failed to update profile.', type: 'error' });
    }
    
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">PLAYER PROFILE</h1>
        <p className="text-gray-400">Manage your legend</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Avatar & Quick Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-8 flex flex-col items-center border-purple-500/20 text-center">
            
            <div className="relative group mb-6 cursor-pointer">
              <div 
                className="w-40 h-40 rounded-full overflow-hidden border-4 border-gray-800 shadow-[0_0_25px_rgba(176,38,255,0.4)] relative z-10"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center text-5xl font-bold text-white">
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                  <span className="text-white font-medium text-sm">Upload Photo</span>
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
                className="hidden" 
                accept="image/*"
              />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-1">{username}</h2>
            <p className="text-gray-400 mb-6 font-mono">{currentUser.email}</p>

            <div className="w-full bg-gray-900 rounded-full h-4 mb-2 overflow-hidden border border-gray-700">
              <div 
                className="bg-gradient-to-r from-purple-500 to-cyan-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${calculateProgress()}%` }}
              ></div>
            </div>
            <div className="w-full flex justify-between text-xs text-gray-400 font-bold tracking-wider mb-6">
              <span>LVL {userProfile.level}</span>
              <span>{userProfile.xp} / {userProfile.level * 1000} XP</span>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">SCORE</div>
                <div className="text-2xl font-bold neon-text-blue">{userProfile.score}</div>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 p-4 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">COINS</div>
                <div className="text-2xl font-bold text-yellow-400">🪙 {userProfile.coins}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Form */}
        <div className="lg:col-span-2">
          <div className="glass-card p-8 border-cyan-500/20 h-full">
            <h3 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-4">Edit Profile</h3>
            
            {message.text && (
              <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-500/20 border border-green-500 text-green-400' : 'bg-red-500/20 border border-red-500 text-red-400'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-400 text-white"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
                <textarea
                  rows="4"
                  className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-400 text-white resize-none"
                  placeholder="Tell us about your gaming style..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                ></textarea>
              </div>

              <div className="pt-4 border-t border-gray-700 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-cyan-500 text-gray-900 rounded-lg font-bold hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(0,240,255,0.4)] disabled:opacity-50"
                >
                  {loading ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
