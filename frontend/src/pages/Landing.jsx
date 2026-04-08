import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../config';
import bgImage from '../assets/background.png';
import xEmblem from '../assets/gamora_x_emblem.png';
import logo from '../assets/logo.png.png';

// Animated counter hook
function useCounter(end, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  return count;
}

const FEATURES = [
  {
    icon: '⚔️',
    title: 'Real-time 1v1 Duels',
    desc: 'Challenge players worldwide in lightning-fast Tap Speed battles and Tic Tac Toe with live matchmaking.',
    color: 'from-cyan-500 to-blue-600',
    glow: 'shadow-[0_0_30px_rgba(0,240,255,0.2)]',
    border: 'border-cyan-500/20',
  },
  {
    icon: '🏆',
    title: 'Live Leaderboards',
    desc: 'Climb the Hall of Fame in real time. Every match, every tap — your score updates instantly.',
    color: 'from-yellow-400 to-orange-500',
    glow: 'shadow-[0_0_30px_rgba(234,179,8,0.2)]',
    border: 'border-yellow-500/20',
  },
  {
    icon: '🎮',
    title: '6+ Mini-Games',
    desc: 'Tap Speed, Tic Tac Toe, Memory Cards, Quiz Blitz, Reaction Test & Party Mode — all in one arena.',
    color: 'from-purple-500 to-pink-600',
    glow: 'shadow-[0_0_30px_rgba(168,85,247,0.2)]',
    border: 'border-purple-500/20',
  },
  {
    icon: '👾',
    title: 'Social Hub',
    desc: 'Build your crew, send friend requests, challenge friends to battles and chat in the Global Arena.',
    color: 'from-green-400 to-emerald-600',
    glow: 'shadow-[0_0_30px_rgba(74,222,128,0.2)]',
    border: 'border-green-500/20',
  },
  {
    icon: '🎯',
    title: 'Daily Challenges',
    desc: 'Complete fresh objectives every day to earn XP, coins and level up your arena rank.',
    color: 'from-red-400 to-rose-600',
    glow: 'shadow-[0_0_30px_rgba(248,113,113,0.2)]',
    border: 'border-red-500/20',
  },
  {
    icon: '⚡',
    title: 'XP & Progression',
    desc: 'Every win and challenge earns you XP, coins and exclusive rewards. Level up and unlock your legend.',
    color: 'from-indigo-400 to-violet-600',
    glow: 'shadow-[0_0_30px_rgba(129,140,248,0.2)]',
    border: 'border-indigo-500/20',
  },
];

const GAMES = [
  { name: 'Tap Speed', emoji: '⚡', color: 'text-yellow-400' },
  { name: 'Tic Tac Toe', emoji: '❌', color: 'text-cyan-400' },
  { name: 'Memory Cards', emoji: '🃏', color: 'text-purple-400' },
  { name: 'Quiz Blitz', emoji: '🧠', color: 'text-green-400' },
  { name: 'Reaction Test', emoji: '🎯', color: 'text-red-400' },
  { name: 'Party Mode', emoji: '🎉', color: 'text-pink-400' },
];

export default function Landing() {
  const { currentUser, userProfile, profileLoading } = useAuth();
  const navigate = useNavigate();
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);

  // If user is already logged in, redirect to appropriate dashboard
  useEffect(() => {
    if (!profileLoading && currentUser && userProfile) {
      const isAdmin = userProfile.isAdmin || userProfile.role === 'admin';
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [currentUser, userProfile, profileLoading, navigate]);

  // Trigger counters when stats section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const [trueUsers, setTrueUsers] = useState(0);
  const [trueMatches, setTrueMatches] = useState(0);

  // Fetch real counts from Backend API (bypasses Firestore auth rules)
  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/stats`);
        if (response.ok) {
          const data = await response.json();
          setTrueUsers(data.users || 0);
          setTrueMatches(data.matches || 0);
        }
      } catch (e) {
        console.error("Failed to fetch landing stats from backend", e);
      }
    }
    fetchStats();
  }, []);

  const players = useCounter(trueUsers, 2000, statsVisible);
  const matches = useCounter(trueMatches, 2200, statsVisible);
  const games = useCounter(6, 1000, statsVisible);

  return (
    <div 
      className="min-h-screen bg-[#060b14] text-white overflow-x-hidden"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(6, 11, 20, 0.85), rgba(6, 11, 20, 0.95)), url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* ======= BACKGROUND GRID & MESH ======= */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[#060b14] mesh-bg mix-blend-screen opacity-50"></div>
        <div 
          className="absolute inset-0 z-[-1]" 
          style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }}
        ></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full filter blur-[120px]"></div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full filter blur-[120px]"></div>
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-yellow-500/8 rounded-full filter blur-[120px]"></div>
      </div>

      {/* ======= NAVBAR ======= */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-[#060b14]/80 backdrop-blur-xl border-b border-white/5">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="Gamora X" className="h-[70px] md:h-[90px] w-auto object-contain" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">Features</a>
          <a href="#games" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">Games</a>
          <a href="#stats" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">Stats</a>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login" className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-white transition-colors">
            Login
          </Link>
          <Link
            to="/register"
            className="px-5 py-2 text-sm font-mono font-bold uppercase tracking-widest bg-gradient-to-r from-cyan-500 to-purple-600 clip-hex hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)]"
          >
            START
          </Link>
        </div>
      </nav>

      {/* ======= HERO ======= */}
      <section className="relative z-10 min-h-screen flex flex-col justify-center px-6 md:px-12 pt-28 pb-10">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 flex-grow items-center gap-12">
          
          {/* Left Side: Copy */}
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-bold mb-8 animate-fade-in-up uppercase tracking-widest">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              SYSTEM_LIVE: Players Battling Now
            </div>

            <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-[0.9] animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <span className="block text-white glow-text">YOUR ARENA.</span>
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500">YOUR LEGEND.</span>
            </h1>

            <p className="text-gray-400 font-mono text-sm md:text-base max-w-lg mb-10 leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              &gt; INITIALIZING COMBAT PROTOCOL...<br/>
              A real-time multiplayer gaming platform. Battle opponents, climb leaderboards, and build your crew in a dark-neon arena.
            </p>

            <div className="flex flex-wrap items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <Link
                to="/register"
                className="px-10 py-5 bg-cyan-500 text-gray-900 clip-hex font-mono font-black text-lg tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:text-white"
              >
                ENTER THE ARENA _
              </Link>
              <a
                href="#games"
                className="px-8 py-5 ultra-glass clip-hex font-mono font-bold text-sm tracking-widest uppercase text-gray-300 hover:text-white transition-all hover:bg-white/10"
              >
                GAMES_LIST
              </a>
            </div>
          </div>

          {/* Right Side: 3D Asset */}
          <div className="relative flex justify-center items-center h-[500px] animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            {/* Pulsing Backlight */}
            <div className="absolute w-64 h-64 bg-cyan-500/30 rounded-full blur-[100px] animate-pulse"></div>
            {/* The 3D Emblem Image */}
            <img src={xEmblem} alt="Gamora X Emblem" className="relative z-10 w-[80%] max-w-lg animate-spin-reverse drop-shadow-[0_0_40px_rgba(168,85,247,0.5)] hover:scale-105 transition-transform duration-500" />
          </div>
        </div>

        {/* Hero Preview Cards - Docked at bottom */}
        <div className="mt-16 relative w-full max-w-7xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <div className="relative ultra-glass p-2">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {GAMES.map((game) => (
                <div key={game.name} className="bg-black/30 border border-white/5 rounded-xl p-4 text-center hover:bg-white/10 hover:border-white/10 transition-all group cursor-default">
                  <div className="text-3xl mb-2 group-hover:scale-110 transition-transform">{game.emoji}</div>
                  <div className={`text-xs font-bold ${game.color} mb-1 font-mono uppercase tracking-tight`}>{game.name}</div>
                  <div className="text-[10px] text-gray-400 font-mono tracking-widest">{game.players} ON</div>
                </div>
              ))}
            </div>
          </div>
          {/* Fade out at the bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#060b14] to-transparent pointer-events-none rounded-b-3xl"></div>
        </div>
      </section>

      {/* ======= STATS ======= */}
      <section id="stats" ref={statsRef} className="relative z-10 py-20 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Registered Players', value: players, suffix: '', prefix: '', color: 'text-cyan-400' },
            { label: 'Total Matches', value: matches, suffix: '', prefix: '', color: 'text-purple-400' },
            { label: 'Mini-Games', value: games, suffix: '', prefix: '', color: 'text-yellow-400' },
          ].map((stat) => (
            <div key={stat.label} className="ultra-glass p-8 text-center transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:scale-[1.02]">
              <div className={`text-5xl font-black ${stat.color} mb-2 tabular-nums tracking-tighter`}>
                {stat.prefix}{stat.value.toLocaleString()}{stat.suffix}
              </div>
              <div className="text-gray-400 text-xs font-mono font-bold uppercase tracking-[0.2em]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ======= FEATURES ======= */}
      <section id="features" className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest mb-4">
              Platform Features
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              Everything You Need to{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">Dominate</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">A complete multiplayer gaming ecosystem built for serious players.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`group relative p-6 ultra-glass hover:${f.glow} transition-all duration-300 cursor-default overflow-hidden`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none`}></div>
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-black text-white mb-2 tracking-tight uppercase font-mono">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed font-mono">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= GAMES ======= */}
      <section id="games" className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold uppercase tracking-widest mb-4">
              The Game Library
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
              6 Games.{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-400">Infinite Battles.</span>
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">From solo practice to live 1v1 duels — pick your battleground.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {GAMES.map((game, i) => (
              <div
                key={game.name}
                className="group relative ultra-glass p-6 transition-all duration-300 flex items-center gap-5 cursor-default hover:scale-[1.02]"
              >
                <div className="text-5xl group-hover:scale-110 transition-transform duration-300">{game.emoji}</div>
                <div>
                  <div className={`text-lg font-black ${game.color} tracking-tight uppercase font-mono`}>{game.name}</div>
                  <div className="text-gray-400 text-xs font-mono">LIVE_MATCHMAKING</div>
                </div>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400 font-mono text-xl animate-pulse">&gt;</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======= CTA ======= */}
      <section className="relative z-10 py-32 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative ultra-glass p-12 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] login-card-glow">
            {/* Glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-cyan-500/20 rounded-full filter blur-[80px] pointer-events-none"></div>
            <div className="absolute -bottom-20 right-1/4 w-56 h-56 bg-purple-500/20 rounded-full filter blur-[80px] pointer-events-none"></div>

            <div className="relative">
              <div className="text-6xl mb-6">🎮</div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 animate-text-expand">
                READY TO ENTER THE{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">ARENA?</span>
              </h2>
              <p className="text-gray-400 font-mono text-sm max-w-lg mx-auto mb-10">
                &gt; AWAITING NEW CHALLENGER...<br />
                &gt; YOUR LEGEND STARTS TODAY.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6">
                <Link
                  to="/register"
                  className="px-10 py-4 bg-cyan-500 text-gray-900 clip-hex font-mono font-black tracking-widest text-lg hover:text-white transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:shadow-[0_0_30px_rgba(0,240,255,0.6)]"
                >
                  CREATE_ACCOUNT
                </Link>
                <Link
                  to="/login"
                  className="px-10 py-4 ultra-glass clip-hex font-mono font-bold tracking-widest text-lg hover:bg-white/10 transition-all text-gray-300 hover:text-white"
                >
                  LOGIN_SYSTEM
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======= FOOTER ======= */}
      <footer className="relative z-10 border-t border-white/5 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img src={logo} alt="Gamora X" className="h-[50px] md:h-[60px] w-auto object-contain" />
          </div>
          <p className="text-gray-600 text-sm">© 2026 Gamora X. All rights reserved. Built for legends.</p>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <Link to="/login" className="hover:text-white transition-colors">Login</Link>
            <Link to="/register" className="hover:text-white transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
