import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import toast, { Toaster } from 'react-hot-toast';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [games, setGames] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [decisionQs, setDecisionQs] = useState([]);
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'games', 'quizzes', 'decision'
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: 0, onlineUsers: 0, totalCoins: 0 });

  // Decision Rush Form State
  const [drForm, setDrForm] = useState({
    question: '',
    answer: true,
    difficulty: 'easy'
  });

  // Quiz Form State
  const [quizForm, setQuizForm] = useState({
    question: '',
    options: ['', '', '', ''],
    answer: '',
    difficulty: 'easy',
    category: 'general'
  });

  // Game Form State
  const [gameForm, setGameForm] = useState({
    title: '',
    description: '',
    icon: '',
    image: '',
    route: '',
    color: 'cyan',
    category: 'arcade',
    isComingSoon: false,
    hasMultiplayer: true,
    order: 0
  });

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else if (activeTab === 'games') fetchGames();
    else if (activeTab === 'quizzes') fetchQuizzes();
    else if (activeTab === 'decision') fetchDecisionQs();
  }, [activeTab]);

  const fetchDecisionQs = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'decisionQuestions'));
      const fetched = [];
      snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() }));
      setDecisionQs(fetched.sort((a, b) => (a.difficulty || '').localeCompare(b.difficulty || '')));
    } catch (err) {
      toast.error('Failed to load Decision Rush questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDecisionQ = async (e) => {
    e.preventDefault();
    if (!drForm.question.trim()) { toast.error('Question cannot be empty'); return; }
    try {
      await addDoc(collection(db, 'decisionQuestions'), {
        question: drForm.question.trim(),
        answer: drForm.answer === true || drForm.answer === 'true',
        difficulty: drForm.difficulty,
        createdAt: serverTimestamp()
      });
      toast.success('Decision Rush question added! 🔥');
      setDrForm({ question: '', answer: true, difficulty: 'easy' });
      fetchDecisionQs();
    } catch (err) {
      toast.error('Failed to add question');
    }
  };

  const deleteDecisionQ = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await deleteDoc(doc(db, 'decisionQuestions', id));
      toast.success('Question deleted');
      fetchDecisionQs();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'quizzes'));
      const fetched = [];
      snapshot.forEach(doc => fetched.push({ id: doc.id, ...doc.data() }));
      setQuizzes(fetched);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      toast.error("Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuiz = async (e) => {
    e.preventDefault();
    if (quizForm.options.some(opt => !opt) || !quizForm.answer) {
      toast.error("Please fill all options and the correct answer");
      return;
    }
    try {
      if (editingQuizId) {
        await updateDoc(doc(db, 'quizzes', editingQuizId), {
          ...quizForm,
          difficulty: quizForm.difficulty.toLowerCase()
        });
        toast.success("Question updated!");
        setEditingQuizId(null);
      } else {
        await addDoc(collection(db, 'quizzes'), {
          ...quizForm,
          difficulty: quizForm.difficulty.toLowerCase(),
          createdAt: serverTimestamp()
        });
        toast.success("Question added!");
      }
      setQuizForm({
        question: '',
        options: ['', '', '', ''],
        answer: '',
        difficulty: 'easy',
        category: 'general'
      });
      fetchQuizzes();
    } catch (err) {
      toast.error(editingQuizId ? "Failed to update question" : "Failed to add question");
    }
  };

  const editQuiz = (quiz) => {
    setEditingQuizId(quiz.id);
    setQuizForm({
      question: quiz.question,
      options: quiz.options,
      answer: quiz.answer,
      difficulty: quiz.difficulty,
      category: quiz.category
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelQuizEdit = () => {
    setEditingQuizId(null);
    setQuizForm({
      question: '',
      options: ['', '', '', ''],
      answer: '',
      difficulty: 'easy',
      category: 'general'
    });
  };

  const deleteQuiz = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await deleteDoc(doc(db, 'quizzes', id));
      toast.success("Question deleted");
      fetchQuizzes();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const initializeDefaultQuizzes = async () => {
    const defaults = [
      { question: "What is the capital of France?", options: ["Paris", "London", "Berlin", "Rome"], answer: "Paris", difficulty: "easy", category: "general" },
      { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: "Mars", difficulty: "easy", category: "general" },
      { question: "Who painted the Mona Lisa?", options: ["Van Gogh", "Picasso", "Da Vinci", "Dali"], answer: "Da Vinci", difficulty: "medium", category: "general" },
      { question: "What is the chemical symbol for gold?", options: ["Gd", "Ag", "Au", "Fe"], answer: "Au", difficulty: "medium", category: "science" },
      { question: "How many bones are in the adult human body?", options: ["206", "210", "195", "200"], answer: "206", difficulty: "hard", category: "science" }
    ];
    try {
      for (const q of defaults) {
        await addDoc(collection(db, 'quizzes'), { ...q, createdAt: serverTimestamp() });
      }
      toast.success("Default questions added!");
      fetchQuizzes();
    } catch (err) {
      toast.error("Migration failed");
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    try {
      let date;
      if (timestamp.toDate) date = timestamp.toDate();
      else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
      else if (timestamp.getTime) date = timestamp;
      else date = new Date(timestamp);

      if (isNaN(date.getTime())) return 'Never';

      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return 'Just now';
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return date.toLocaleDateString();
    } catch (e) {
      return 'Never';
    }
  };

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

  const fetchGames = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'games'));
      const fetchedGames = [];
      snapshot.forEach(doc => {
        fetchedGames.push({ id: doc.id, ...doc.data() });
      });
      setGames(fetchedGames.sort((a, b) => (a.order || 0) - (b.order || 0)));
    } catch (error) {
      console.error("Error fetching games:", error);
      toast.error("Failed to load games");
    } finally {
      setLoading(false);
    }
  };

  const handleAddGame = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'games'), {
        ...gameForm,
        createdAt: serverTimestamp()
      });
      toast.success("Game added successfully!");
      setGameForm({
        title: '',
        description: '',
        icon: '',
        image: '',
        route: '',
        color: 'cyan',
        category: 'arcade',
        isComingSoon: false,
        hasMultiplayer: true,
        order: games.length
      });
      fetchGames();
    } catch (error) {
      console.error("Error adding game:", error);
      toast.error("Failed to add game");
    }
  };

  const deleteGame = async (gameId, title) => {
    if (!window.confirm(`Are you sure you want to delete ${title}?`)) return;
    try {
      await deleteDoc(doc(db, 'games', gameId));
      toast.success(`${title} deleted!`);
      fetchGames();
    } catch (error) {
      console.error("Error deleting game:", error);
      toast.error("Failed to delete game");
    }
  };

  const initializeDefaultGames = async () => {
    const initialGames = [
      { title: "Battle Mode (1v1)", description: "Classic Tic Tac Toe. Compete for global ranking.", icon: "⚔️", route: "/games/tic-tac-toe?mode=battle", color: "purple", category: "battle", isComingSoon: false, hasMultiplayer: true, order: 1 },
      { title: "Party Mode", description: "Multiplayer rooms! Invite up to 8 friends.", icon: "🎉", route: "/games/party", color: "pink", category: "battle", isComingSoon: false, hasMultiplayer: true, order: 2 },
      { title: "Quiz Master", description: "Test your knowledge!", icon: "🎯", route: "/games/quiz", color: "cyan", category: "arcade", isComingSoon: false, hasMultiplayer: true, order: 3 },
      { title: "Memory Match", description: "Brain training.", icon: "🧠", route: "/games/memory", color: "purple", category: "arcade", isComingSoon: false, hasMultiplayer: true, order: 4 },
      { title: "Reaction Time", description: "Fast green reflexes.", icon: "🚦", route: "/games/reaction", color: "pink", category: "arcade", isComingSoon: false, hasMultiplayer: true, order: 5 },
      { title: "Tap Speed", description: "Rapid fire tapping.", icon: "⚡", route: "/games/tap-speed", color: "yellow", category: "arcade", isComingSoon: false, hasMultiplayer: true, order: 6 }
    ];

    try {
      for (const game of initialGames) {
        await addDoc(collection(db, 'games'), { ...game, createdAt: serverTimestamp() });
      }
      toast.success("Default games initialized!");
      fetchGames();
    } catch (error) {
      console.error("Error initializing games:", error);
      toast.error("Migration failed");
    }
  };

  const grantRewards = async (userId, username, amount) => {
    try {
      const userRef = doc(db, 'users', userId);
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const currentCoins = user.coins || 0;
      const currentXp = user.xp || 0;

      await updateDoc(userRef, {
        coins: currentCoins + amount,
        xp: currentXp + (amount * 10)
      });

      toast.success(`Granted ${amount} Coins to ${username}!`);
      fetchUsers();
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
      
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-orange-500 mb-2">
            SYSTEM OVERSEER
          </h1>
          <p className="text-gray-400 text-lg">Platform Administration & Analytics</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap bg-gray-900 border border-gray-800 rounded-lg p-1 gap-1">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-5 py-2 rounded-md font-bold transition-all ${activeTab === 'users' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-white'}`}
          >
            Players
          </button>
          <button 
            onClick={() => setActiveTab('games')}
            className={`px-5 py-2 rounded-md font-bold transition-all ${activeTab === 'games' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-white'}`}
          >
            Games
          </button>
          <button 
            onClick={() => setActiveTab('quizzes')}
            className={`px-5 py-2 rounded-md font-bold transition-all ${activeTab === 'quizzes' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-gray-400 hover:text-white'}`}
          >
            Quiz Master
          </button>
          <button 
            onClick={() => setActiveTab('decision')}
            className={`px-5 py-2 rounded-md font-bold transition-all ${activeTab === 'decision' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-gray-400 hover:text-white'}`}
          >
            ⚡ Decision Rush
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <>
          {/* Analytics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="glass-card p-6 border-red-500/30">
              <div className="text-sm text-gray-400 uppercase tracking-widest mb-2">Total Registered</div>
              <div className="text-4xl font-bold text-white">{stats.totalUsers}</div>
            </div>
            <div className="glass-card p-6 border-red-500/30">
              <div className="text-sm text-gray-400 uppercase tracking-widest mb-2">Currently Online</div>
              <div className="text-4xl font-bold text-green-400">{stats.onlineUsers}</div>
            </div>
            <div className="glass-card p-6 border-red-500/30">
              <div className="text-sm text-gray-400 uppercase tracking-widest mb-2">Economy Total</div>
              <div className="text-4xl font-bold text-yellow-500">{stats.totalCoins.toLocaleString()}</div>
            </div>
          </div>

          <div className="glass-card border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
              <h2 className="text-xl font-bold text-white">Player Management</h2>
              <button 
                onClick={fetchUsers}
                className="px-4 py-2 border border-gray-600 rounded bg-gray-800 text-gray-300 hover:text-white text-sm"
              >
                Refresh Data
              </button>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-red-500 animate-spin border-t-transparent"></div></div>
              ) : (
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="bg-gray-800 text-gray-300 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">Player</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Last Seen</th>
                      <th className="px-6 py-4">Level</th>
                      <th className="px-6 py-4">Coins</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold ${user.isAdmin ? 'border-2 border-red-500' : ''}`}>
                            {user.username?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-white font-bold">{user.username} {user.isAdmin && <span className="text-[10px] bg-red-500/20 text-red-500 px-1 rounded ml-1">ADMIN</span>}</div>
                            <div className="text-xs">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.isOnline ? (
                            <span className="text-green-500 flex items-center gap-2">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                              Online
                            </span>
                          ) : (
                            <span>Offline</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs">{formatTimeAgo(user.lastSeen)}</td>
                        <td className="px-6 py-4 font-bold text-white">{user.level} <span className="text-[10px] text-gray-500 block">{user.xp} XP</span></td>
                        <td className="px-6 py-4 text-yellow-500 font-mono">{user.coins}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => grantRewards(user.id, user.username, 1000)} className="p-1 hover:text-yellow-500">🪙+</button>
                          <button onClick={() => deleteUserRecord(user.id, user.username)} disabled={user.isAdmin} className="p-1 hover:text-red-500">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : activeTab === 'games' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Add Game Form */}
          <div className="glass-card p-8 border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Forge New Game</h2>
            <form onSubmit={handleAddGame} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Game Title</label>
                <input 
                  type="text" required value={gameForm.title} 
                  onChange={e => setGameForm({...gameForm, title: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Description</label>
                <textarea 
                  required value={gameForm.description} 
                  onChange={e => setGameForm({...gameForm, description: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Icon (Emoji)</label>
                  <input 
                    type="text" value={gameForm.icon} 
                    onChange={e => setGameForm({...gameForm, icon: e.target.value})}
                    placeholder="🎮"
                    className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Category</label>
                  <select 
                    value={gameForm.category} 
                    onChange={e => setGameForm({...gameForm, category: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                  >
                    <option value="arcade">Arcade</option>
                    <option value="battle">Battle</option>
                    <option value="social">Social</option>
                    <option value="party">Party</option>
                    <option value="challenge">Challenge</option>
                    <option value="chill">Chill</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Color Theme</label>
                  <select 
                    value={gameForm.color} 
                    onChange={e => setGameForm({...gameForm, color: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                  >
                    <option value="cyan">Cyan</option>
                    <option value="purple">Purple</option>
                    <option value="pink">Pink</option>
                    <option value="yellow">Yellow</option>
                  </select>
                </div>
                <div>
                    <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Display Order</label>
                    <input 
                        type="number" value={gameForm.order} 
                        onChange={e => setGameForm({...gameForm, order: parseInt(e.target.value)})}
                        className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                    />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Image URL (Optional)</label>
                <input 
                  type="text" value={gameForm.image} 
                  onChange={e => setGameForm({...gameForm, image: e.target.value})}
                  placeholder="https://..."
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Route Path</label>
                <input 
                  type="text" required value={gameForm.route} 
                  onChange={e => setGameForm({...gameForm, route: e.target.value})}
                  placeholder="/games/new-game"
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                />
              </div>
              <div className="flex gap-10 py-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={gameForm.isComingSoon} onChange={e => setGameForm({...gameForm, isComingSoon: e.target.checked})} className="w-5 h-5 accent-red-500" />
                  <span className="text-sm font-bold text-gray-300 uppercase">Coming Soon</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={gameForm.hasMultiplayer} onChange={e => setGameForm({...gameForm, hasMultiplayer: e.target.checked})} className="w-5 h-5 accent-red-500" />
                  <span className="text-sm font-bold text-gray-300 uppercase">1v1 Battle</span>
                </label>
              </div>
              <button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-lg shadow-lg shadow-red-600/30 transition-all uppercase tracking-widest mt-6"
              >
                Assemble Game
              </button>
            </form>
          </div>

          {/* Game List Display */}
          <div className="lg:col-span-2">
            <div className="glass-card border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                <h2 className="text-xl font-bold text-white">Platform Game Library</h2>
                <div className="flex gap-2">
                  {games.length === 0 && (
                    <button onClick={initializeDefaultGames} className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded">INIT DEFAULTS</button>
                  )}
                  <button onClick={fetchGames} className="px-4 py-2 border border-gray-600 rounded bg-gray-800 text-gray-300 text-xs font-bold">RELOAD</button>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-red-500 animate-spin border-t-transparent"></div></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {games.map(game => (
                      <div key={game.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-center group">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl">{game.icon}</div>
                          <div>
                            <div className="text-white font-bold">{game.title}</div>
                            <div className="text-[10px] text-gray-500 font-mono">{game.route}</div>
                            <div className="flex gap-2 mt-1">
                                <span className={`w-2 h-2 rounded-full ${game.color === 'cyan' ? 'bg-cyan-500' : game.color === 'purple' ? 'bg-purple-500' : game.color === 'pink' ? 'bg-pink-500' : 'bg-yellow-500'}`}></span>
                                <span className="text-[8px] text-gray-400 uppercase tracking-widest">{game.category}</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteGame(game.id, game.title)}
                          className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center transition-opacity hover:bg-red-500 hover:text-white"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {!loading && games.length === 0 && (
                  <div className="text-center py-20 text-gray-500">No games found in the database.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'quizzes' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Add Quiz Form */}
          <div className="glass-card p-8 border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Quiz Forge</h2>
            <form onSubmit={handleAddQuiz} className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Question</label>
                <textarea 
                  required value={quizForm.question} 
                  onChange={e => setQuizForm({...quizForm, question: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                  placeholder="The capital of Gamora is..."
                />
              </div>
              <div className="space-y-3">
                <label className="block text-xs uppercase font-bold text-gray-500">Options</label>
                {quizForm.options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="w-8 h-10 flex items-center justify-center font-bold text-gray-600">{String.fromCharCode(65 + idx)}</span>
                    <input 
                      type="text" required value={opt} 
                      onChange={e => {
                        const newOpts = [...quizForm.options];
                        newOpts[idx] = e.target.value;
                        setQuizForm({...quizForm, options: newOpts});
                      }}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded p-2 text-white focus:border-red-500 outline-none text-sm"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Correct Answer</label>
                <select 
                  value={quizForm.answer} 
                  onChange={e => setQuizForm({...quizForm, answer: e.target.value})}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                  required
                >
                  <option value="">Select Correct Option</option>
                  {quizForm.options.map((opt, idx) => opt && (
                    <option key={idx} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Difficulty</label>
                  <select 
                    value={quizForm.difficulty} 
                    onChange={e => setQuizForm({...quizForm, difficulty: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Category</label>
                  <input 
                    type="text" required value={quizForm.category} 
                    onChange={e => setQuizForm({...quizForm, category: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-red-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-6">
                <button 
                  type="submit" 
                  className={`flex-1 text-white font-black py-4 rounded-lg shadow-lg transition-all uppercase tracking-widest ${editingQuizId ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/30' : 'bg-red-600 hover:bg-red-500 shadow-red-600/30'}`}
                >
                  {editingQuizId ? 'Update Question' : 'Save Question'}
                </button>
                {editingQuizId && (
                  <button 
                    type="button" 
                    onClick={cancelQuizEdit}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-black py-4 rounded-lg transition-all uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Quiz List Display */}
          <div className="lg:col-span-2 space-y-10">
            <div className="glass-card border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                <h2 className="text-xl font-bold text-white">Quiz Database</h2>
                <div className="flex gap-2">
                   {quizzes.length === 0 && (
                    <button onClick={initializeDefaultQuizzes} className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded">INIT DEFAULT QUIZ</button>
                   )}
                   <button onClick={fetchQuizzes} className="px-4 py-2 border border-gray-600 rounded bg-gray-800 text-gray-300 text-xs font-bold">RELOAD</button>
                </div>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-red-500 animate-spin border-t-transparent"></div></div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {quizzes.map(q => (
                      <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 relative group">
                        <div className="flex justify-between items-start mb-4 pr-10">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${q.difficulty === 'easy' ? 'bg-green-500/20 text-green-500' : q.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'}`}>
                                {q.difficulty}
                              </span>
                              <span className="text-[10px] text-gray-500 font-bold uppercase">{q.category}</span>
                            </div>
                            <h3 className="text-lg font-bold text-white leading-tight">{q.question}</h3>
                          </div>
                          <div className="absolute top-6 right-6 flex gap-2 transition-opacity">
                            <button 
                              onClick={() => editQuiz(q)}
                              className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center hover:bg-cyan-500 hover:text-white"
                              title="Edit Question"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => deleteQuiz(q.id)}
                              className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white"
                              title="Delete Question"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {q.options.map((opt, i) => (
                            <div key={i} className={`text-xs p-2 rounded ${opt === q.answer ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-gray-800 text-gray-500 border border-transparent'}`}>
                              {String.fromCharCode(65 + i)}. {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!loading && quizzes.length === 0 && (
                  <div className="text-center py-20 text-gray-500">No questions found in the quiz database.</div>
                )}
              </div>
            </div>

            {/* Top Performers Summary (Admin Leaderboard) */}
            <div className="glass-card border-gray-700 p-6">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <span className="text-yellow-500">🏆</span> Top Performers (Solo Hub)
                </h3>
                <div className="space-y-3">
                    {users.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map((u, i) => (
                        <div key={u.id} className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-800">
                           <div className="flex items-center gap-3">
                               <span className="text-gray-600 font-mono text-xs w-4">#{i+1}</span>
                               <span className="text-white font-bold">{u.username}</span>
                           </div>
                           <div className="text-cyan-400 font-bold">{u.score?.toLocaleString()} <span className="text-[10px] text-gray-600">PTS</span></div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'decision' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Add Decision Rush Question Form */}
          <div className="glass-card p-8 border-orange-500/20">
            <h2 className="text-2xl font-bold text-white mb-2">⚡ Decision Rush</h2>
            <p className="text-gray-500 text-xs uppercase tracking-widest mb-6">Add True / False questions</p>
            <form onSubmit={handleAddDecisionQ} className="space-y-5">
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Statement / Question</label>
                <textarea
                  required
                  rows={3}
                  value={drForm.question}
                  onChange={e => setDrForm({ ...drForm, question: e.target.value })}
                  placeholder="e.g. The sun is a star"
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-orange-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Correct Answer</label>
                <select
                  value={String(drForm.answer)}
                  onChange={e => setDrForm({ ...drForm, answer: e.target.value === 'true' })}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-orange-500 outline-none"
                >
                  <option value="true">✅ TRUE</option>
                  <option value="false">❌ FALSE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-2">Difficulty</label>
                <select
                  value={drForm.difficulty}
                  onChange={e => setDrForm({ ...drForm, difficulty: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white focus:border-orange-500 outline-none"
                >
                  <option value="easy">🟢 Easy</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-black py-4 rounded-lg shadow-lg shadow-orange-500/30 transition-all uppercase tracking-widest"
              >
                Add Question 🔥
              </button>
            </form>
          </div>

          {/* Question List */}
          <div className="lg:col-span-2">
            <div className="glass-card border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                <div>
                  <h2 className="text-xl font-bold text-white">Decision Rush Questions</h2>
                  <p className="text-xs text-gray-500 mt-1">{decisionQs.length} question{decisionQs.length !== 1 ? 's' : ''} in database</p>
                </div>
                <button onClick={fetchDecisionQs} className="px-4 py-2 border border-gray-600 rounded bg-gray-800 text-gray-300 text-xs font-bold hover:text-white">RELOAD</button>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-orange-500 animate-spin border-t-transparent"></div></div>
                ) : decisionQs.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="text-4xl mb-4 opacity-30">⚡</div>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No questions yet.</p>
                    <p className="text-gray-600 text-xs mt-2">Add your first question using the form on the left.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {decisionQs.map(q => (
                      <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                              q.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
                              q.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>{q.difficulty}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              q.answer ? 'bg-green-500/10 text-green-500 border border-green-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'
                            }`}>{q.answer ? '✅ TRUE' : '❌ FALSE'}</span>
                          </div>
                          <p className="text-white font-bold text-sm leading-snug truncate">{q.question}</p>
                        </div>
                        <button
                          onClick={() => deleteDecisionQ(q.id)}
                          className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                        >🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
