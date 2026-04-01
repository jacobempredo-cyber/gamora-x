import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import API_BASE_URL from '../config';

export default function Challenges() {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, [currentUser]);

  const fetchTasks = async () => {
    if (!currentUser) return;
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/tasks/${currentUser.uid}`, {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load daily tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (taskId) => {
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/tasks/claim/${taskId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}` 
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to claim');

      toast.success(data.message);
      fetchTasks();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-t-4 border-b-4 border-yellow-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500 mb-2 italic tracking-tighter">
          DAILY CHALLENGES
        </h1>
        <p className="text-gray-400 text-lg">Complete goals to earn XP and Coins. Resets every 24 hours.</p>
      </div>

      <div className="space-y-6">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            className={`glass-card p-6 border-l-4 transition-all ${
              task.isClaimed 
                ? 'border-gray-600 opacity-60' 
                : task.isCompleted 
                  ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]' 
                  : 'border-yellow-500'
            }`}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-white uppercase tracking-wide">{task.description}</h3>
                  {task.isCompleted && !task.isClaimed && (
                     <span className="bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded animate-pulse">READY</span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm mb-4">
                  <div className="flex items-center gap-1 text-purple-400 font-bold">
                    <span>✨</span> {task.xp} XP
                  </div>
                  <div className="flex items-center gap-1 text-yellow-400 font-bold">
                    <span>🪙</span> {task.coins} Coins
                  </div>
                </div>

                {/* Progress Bar */}
                {!task.isClaimed && (
                  <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${
                        task.isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-yellow-500 to-orange-500'
                      }`}
                      style={{ width: `${Math.min((task.progress / task.target) * 100, 100)}%` }}
                    />
                  </div>
                )}
                <div className="mt-2 text-xs font-mono text-gray-500 flex justify-between uppercase">
                  <span>{task.isClaimed ? 'Completed & Claimed' : 'Progress'}</span>
                  <span>{task.isClaimed ? '---' : `${task.progress} / ${task.target}`}</span>
                </div>
              </div>

              <div className="w-full md:w-auto">
                {task.isClaimed ? (
                  <div className="px-6 py-2 bg-gray-800 text-gray-500 rounded-lg text-sm font-bold uppercase border border-white/5">
                    Claimed
                  </div>
                ) : task.isCompleted ? (
                  <button 
                    onClick={() => claimReward(task.id)}
                    className="w-full md:w-auto px-8 py-3 bg-green-600 text-white font-black rounded-lg hover:bg-green-500 transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)] active:scale-95 uppercase"
                  >
                    Claim Rewards
                  </button>
                ) : (
                  <div className="px-6 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg text-sm font-bold uppercase italic">
                    In Progress
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-20 bg-gray-900/30 rounded-2xl border border-dashed border-gray-700">
             <p className="text-gray-500 italic">No tasks available right now. Check back later!</p>
          </div>
        )}
      </div>

      <div className="mt-12 p-6 glass-card bg-blue-500/5 border-blue-500/10 flex gap-4 items-start">
        <span className="text-2xl">💡</span>
        <p className="text-sm text-gray-400 leading-relaxed">
          Daily challenges reset every day at midnight. Make sure to claim your rewards before they expire! Your progress in any game mode counts towards these goals.
        </p>
      </div>
    </div>
  );
}
