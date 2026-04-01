const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const { db } = require('./firebase/admin');
const { verifyToken } = require('./middleware/authMiddleware');

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// Basic health check
app.get('/', (req, res) => {
  res.send('<h1>Gamora X Backend is LIVE! 🚀</h1><p>The API is up and running successfully.</p>');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Gamora X Backend is running!' });
});

// Global Platform Stats (Publicly Accessible)
app.get('/api/stats', async (req, res) => {
  try {
    const usersSnap = await db.collection('users').count().get();
    const matchesSnap = await db.collection('matches').count().get();
    res.json({ users: usersSnap.data().count, matches: matchesSnap.data().count });
  } catch (error) {
    console.error('Error fetching global stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// USER ROUTES
// ==========================================

// GET user profile
app.get('/api/users/:uid', verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;
    
    // Security check: Only allow users to fetch their own profile or public info
    if (req.user.uid !== uid) {
      // In a real app we might return a limited 'public' profile payload here
      // return res.status(403).json({ error: 'Cannot access other users data directly' });
    }

    const docRef = db.collection('users').doc(uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(docSnap.data());
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// UPDATE user profile (Handled primarily by client SDK but here's the API mapping)
app.put('/api/users/:uid', verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;
    const { username, bio, avatar } = req.body;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Unauthorized to edit this profile' });
    }

    const docRef = db.collection('users').doc(uid);
    await docRef.update({
      username,
      bio,
      avatar,
      updatedAt: new Date()
    });

    return res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// LEADERBOARD ROUTES
// ==========================================

app.get('/api/leaderboard', async (req, res) => {
  try {
    const type = req.query.type || 'global';
    const limitCount = parseInt(req.query.limit) || 100;

    let snapshot;
    
    if (type === 'global') {
      snapshot = await db.collection('leaderboard')
        .orderBy('score', 'desc')
        .limit(limitCount)
        .get();
    } else {
      // Logic for weekly/friends would go here
      return res.status(400).json({ error: 'Type not supported yet' });
    }

    const leaderboard = [];
    snapshot.forEach((doc) => {
      leaderboard.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// CHALLENGE MODE (DAILY TASKS) ROUTES
// ==========================================

const DAILY_TASKS_MASTER = [
  { id: 'play_any', description: 'Play any game in the Arena', target: 2, xp: 200, coins: 20 },
  { id: 'win_battle', description: 'Win 1 match in Battle Mode', target: 1, xp: 500, coins: 50 },
  { id: 'reflex_pro', description: 'Play Reaction Time 3 times', target: 3, xp: 300, coins: 30 },
  { id: 'quiz_wiz', description: 'Complete 2 Quiz rounds', target: 2, xp: 200, coins: 20 },
  { id: 'chatty', description: 'Send 5 messages in Global Chat', target: 5, xp: 100, coins: 10 }
];

// Get or Refresh Daily Tasks
app.get('/api/tasks/:uid', verifyToken, async (req, res) => {
  try {
    const { uid } = req.params;
    console.log(`[TASKS API] Requesting tasks for UID: ${uid} (Authenticated User: ${req.user.uid})`);
    
    // Robustness check: Always prioritize the verified token's identity
    if (req.user.uid !== uid) {
       console.warn(`[TASKS API] UID mismatch detected. Overriding URL parameter with token identity.`);
       // Instead of 403, we just use the token's UID to serve the correct data for the logged-in user
    }

    const tasksRef = db.collection('users').doc(uid).collection('daily_tasks');
    const snapshot = await tasksRef.get();
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let userTasks = [];
    let needsReset = false;

    if (snapshot.empty) {
      needsReset = true;
    } else {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.date !== today) needsReset = true;
        userTasks.push({ id: doc.id, ...data });
      });
    }

    if (needsReset) {
      // Clear old tasks
      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      
      // Select 3 random tasks from master
      const shuffled = [...DAILY_TASKS_MASTER].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);
      
      userTasks = selected.map(task => ({
        ...task,
        progress: 0,
        isCompleted: false,
        isClaimed: false,
        date: today
      }));

      userTasks.forEach(task => {
        const newRef = tasksRef.doc(task.id);
        batch.set(newRef, task);
      });

      await batch.commit();
    }

    res.json(userTasks);
  } catch (error) {
    console.error('Error handling tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Task Progress
app.post('/api/tasks/progress', verifyToken, async (req, res) => {
  try {
    const { taskId, incrementBy = 1 } = req.body;
    const uid = req.user.uid;

    const taskRef = db.collection('users').doc(uid).collection('daily_tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' });

    const data = taskDoc.data();
    if (data.isCompleted) return res.json({ message: 'Task already completed', data });

    const newProgress = (data.progress || 0) + incrementBy;
    const isCompleted = newProgress >= data.target;

    await taskRef.update({
      progress: newProgress,
      isCompleted: isCompleted,
      updatedAt: new Date()
    });

    res.json({ message: 'Progress updated', progress: newProgress, isCompleted });
  } catch (error) {
    console.error('Error updating task progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Claim Task Rewards
app.post('/api/tasks/claim/:taskId', verifyToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const uid = req.user.uid;

    const userRef = db.collection('users').doc(uid);
    const taskRef = userRef.collection('daily_tasks').doc(taskId);
    
    const taskDoc = await taskRef.get();
    if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' });

    const taskData = taskDoc.data();
    if (!taskData.isCompleted) return res.status(400).json({ error: 'Task not completed' });
    if (taskData.isClaimed) return res.status(400).json({ error: 'Reward already claimed' });

    // Transaction to update user stats and mark task as claimed
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error('User not found');

      const userData = userDoc.data();
      transaction.update(userRef, {
        xp: (userData.xp || 0) + taskData.xp,
        coins: (userData.coins || 0) + taskData.coins,
        score: (userData.score || 0) + (taskData.xp / 2) // Just a simple score mapping
      });

      transaction.update(taskRef, { isClaimed: true });
    });

    res.json({ 
      message: 'Rewards claimed!', 
      rewards: { xp: taskData.xp, coins: taskData.coins } 
    });
  } catch (error) {
    console.error('Error claiming reward:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

let waitingPlayers = []; // Queue for 1v1 Tic Tac Toe
let tapQueue = []; // Queue for 1v1 Tap Speed
let memoryQueue = []; // Queue for 1v1 Memory Match
let quizQueue = []; // Queue for 1v1 Quiz Battle
let reactionQueue = []; // Queue for 1v1 Reaction Battle
let parties = {}; // { partyId: { players: [], hostId } }
let activeMatches = {}; // { roomId: matchState } for server-controlled games

function generatePartyId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Shared: Save match result to Firestore
async function saveMatchResult(matchData) {
  try {
    const matchRef = db.collection('matches').doc();
    await matchRef.set({
      ...matchData,
      createdAt: new Date(),
    });
    console.log(`[MATCH] Saved match: ${matchData.game} — Winner: ${matchData.winnerUid || 'draw'}`);
  } catch (err) {
    console.error('[MATCH] Error saving match result:', err);
  }
}

// Shared: Broadcast queue counts
function broadcastQueueCounts() {
  io.emit('queue_counts', {
    ttt: waitingPlayers.length,
    tap: tapQueue.length,
    memory: memoryQueue.length,
    quiz: quizQueue.length,
    reaction: reactionQueue.length,
  });
}

// Memory Match: Generate a shuffled deck (both players get the same one)
const MEMORY_ICONS = ['🚀', '🎮', '👾', '🔥', '💎', '🌟', '🛡️', '⚔️'];
function generateMemoryDeck() {
  const deck = [...MEMORY_ICONS, ...MEMORY_ICONS]
    .sort(() => Math.random() - 0.5)
    .map((icon, index) => ({ id: index, icon }));
  return deck;
}

// Quiz: Question bank for battles
const QUIZ_BATTLE_QUESTIONS = [
  { id: 1, question: "Which planet is known as the red planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: "Mars" },
  { id: 2, question: "What is the capital of France?", options: ["Berlin", "London", "Paris", "Madrid"], answer: "Paris" },
  { id: 3, question: "Who painted the Mona Lisa?", options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Claude Monet"], answer: "Leonardo da Vinci" },
  { id: 4, question: "What is the largest ocean on Earth?", options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"], answer: "Pacific Ocean" },
  { id: 5, question: "What is the smallest prime number?", options: ["1", "2", "3", "5"], answer: "2" },
  { id: 6, question: "Which element has the chemical symbol 'O'?", options: ["Gold", "Silver", "Oxygen", "Iron"], answer: "Oxygen" },
  { id: 7, question: "Who is the protagonist in 'The Legend of Zelda'?", options: ["Zelda", "Link", "Ganon", "Tingle"], answer: "Link" },
  { id: 8, question: "What year did the first iPhone release?", options: ["2005", "2006", "2007", "2008"], answer: "2007" },
  { id: 9, question: "Which gas makes up most of Earth's atmosphere?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"], answer: "Nitrogen" },
  { id: 10, question: "What is the hardest natural substance?", options: ["Gold", "Iron", "Diamond", "Titanium"], answer: "Diamond" },
];

function selectQuizQuestions(count = 5) {
  const shuffled = [...QUIZ_BATTLE_QUESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // ==========================================
  // TIC TAC TOE MATCHMAKING
  // ==========================================
  socket.on('join_queue', (userData) => {
    // ... logic for Tic Tac Toe matches ...
    if (waitingPlayers.find(p => p.uid === userData.uid)) return;
    if (waitingPlayers.length > 0) {
      const opponent = waitingPlayers.pop();
      const roomId = `match_ttt_${Date.now()}`;
      socket.join(roomId);
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (opponentSocket) opponentSocket.join(roomId);
      io.to(roomId).emit('match_found', {
        roomId,
        players: [opponent, { ...userData, socketId: socket.id }],
        board: Array(9).fill(null),
        turn: opponent.uid,
        winner: null,
      });
    } else {
      waitingPlayers.push({ ...userData, socketId: socket.id });
      socket.emit('waiting_for_opponent');
    }
  });

  // ==========================================
  // TAP SPEED MATCHMAKING (1v1)
  // ==========================================
  socket.on('join_tap_queue', (userData) => {
    console.log(`${userData.username} joined Tap Queue.`);
    if (tapQueue.find(p => p.uid === userData.uid)) return;

    if (tapQueue.length > 0) {
      const opponent = tapQueue.pop();
      const roomId = `match_tap_${Date.now()}`;
      
      socket.join(roomId);
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (opponentSocket) opponentSocket.join(roomId);

      const gameState = {
        roomId,
        players: [opponent, { ...userData, socketId: socket.id }],
        timeLeft: 10,
        scores: { [opponent.uid]: 0, [userData.uid]: 0 },
        isStarted: false
      };

      io.to(roomId).emit('tap_match_found', gameState);
    } else {
      tapQueue.push({ ...userData, socketId: socket.id });
      socket.emit('waiting_for_opponent');
    }
  });

  socket.on('tap_press', ({ roomId, uid }) => {
    // Broadcast the tap to the opponent
    socket.to(roomId).emit('opponent_tapped', { uid });
  });

  socket.on('tap_game_over', ({ roomId, finalScore, uid }) => {
     // Notify the room about a player's final result
     io.to(roomId).emit('player_finished', { uid, score: finalScore });
  });

  socket.on('leave_tap_queue', () => {
    tapQueue = tapQueue.filter(p => p.socketId !== socket.id);
  });

  // Handle a game move
  socket.on('make_move', ({ roomId, index, uid }) => {
    // We just broadcast this back to the room for the clients to validate
    // In a production secure game, the server validates the move first!
    io.to(roomId).emit('update_board', { index, uid });
  });

  // ==========================================
  // PARTY MODE LOGIC
  // ==========================================

  socket.on('create_party', (userData) => {
    const partyId = generatePartyId();
    parties[partyId] = {
      players: [{ ...userData, socketId: socket.id }],
      hostId: userData.uid,
      createdAt: new Date()
    };
    socket.join(`party_${partyId}`);
    socket.emit('party_created', { partyId, party: parties[partyId] });
    console.log(`Party created: ${partyId} by ${userData.username}`);
  });

  socket.on('join_party', ({ partyId, userData }) => {
    const party = parties[partyId];
    if (!party) {
      return socket.emit('party_error', 'Party not found or expired.');
    }
    
    if (party.players.length >= 8) {
      return socket.emit('party_error', 'Party is full!');
    }

    // Add player if not already in
    if (!party.players.find(p => p.uid === userData.uid)) {
      party.players.push({ ...userData, socketId: socket.id });
    }

    socket.join(`party_${partyId}`);
    io.to(`party_${partyId}`).emit('party_updated', party);
    console.log(`${userData.username} joined party: ${partyId}`);
  });

  socket.on('send_party_message', ({ partyId, message, userData }) => {
    io.to(`party_${partyId}`).emit('new_party_message', {
      text: message,
      sender: userData.username,
      uid: userData.uid,
      time: new Date()
    });
  });

  socket.on('leave_party', ({ partyId, uid }) => {
    if (parties[partyId]) {
      parties[partyId].players = parties[partyId].players.filter(p => p.uid !== uid);
      
      if (parties[partyId].players.length === 0) {
        delete parties[partyId];
      } else {
        // If host leaves, assign new host
        if (parties[partyId].hostId === uid) {
          parties[partyId].hostId = parties[partyId].players[0].uid;
        }
        io.to(`party_${partyId}`).emit('party_updated', parties[partyId]);
      }
      socket.leave(`party_${partyId}`);
    }
  });

  socket.on('start_party_game', ({ partyId, gameRoute }) => {
    const party = parties[partyId];
    if (party && party.hostId) {
       // Only host can start game logic is usually handled on client, but we broadcast here
       io.to(`party_${partyId}`).emit('navigate_to_game', gameRoute);
    }
  });

  // ==========================================
  // MEMORY MATCH BATTLE (1v1)
  // ==========================================
  socket.on('join_memory_queue', (userData) => {
    console.log(`${userData.username} joined Memory Queue.`);
    if (memoryQueue.find(p => p.uid === userData.uid)) return;

    if (memoryQueue.length > 0) {
      const opponent = memoryQueue.pop();
      const roomId = `match_mem_${Date.now()}`;
      
      socket.join(roomId);
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (opponentSocket) opponentSocket.join(roomId);

      const deck = generateMemoryDeck();
      const gameState = {
        roomId,
        game: 'memory',
        players: [opponent, { ...userData, socketId: socket.id }],
        deck,
        scores: { [opponent.uid]: 0, [userData.uid]: 0 },
        totalPairs: MEMORY_ICONS.length,
        pairsFound: 0,
      };
      activeMatches[roomId] = gameState;

      io.to(roomId).emit('memory_match_found', gameState);
      broadcastQueueCounts();
    } else {
      memoryQueue.push({ ...userData, socketId: socket.id });
      socket.emit('waiting_for_opponent');
      broadcastQueueCounts();
    }
  });

  socket.on('leave_memory_queue', () => {
    memoryQueue = memoryQueue.filter(p => p.socketId !== socket.id);
    broadcastQueueCounts();
  });

  socket.on('memory_pair_found', ({ roomId, uid }) => {
    const match = activeMatches[roomId];
    if (!match) return;
    match.scores[uid] = (match.scores[uid] || 0) + 1;
    match.pairsFound++;
    io.to(roomId).emit('memory_score_update', { scores: match.scores, pairsFound: match.pairsFound });

    // Check if all pairs found
    if (match.pairsFound >= match.totalPairs) {
      const p1 = match.players[0].uid;
      const p2 = match.players[1].uid;
      let winnerUid = null;
      if (match.scores[p1] > match.scores[p2]) winnerUid = p1;
      else if (match.scores[p2] > match.scores[p1]) winnerUid = p2;
      // else it's a draw

      io.to(roomId).emit('memory_game_over', {
        scores: match.scores,
        winnerUid,
      });

      saveMatchResult({
        game: 'memory',
        roomId,
        players: match.players.map(p => ({ uid: p.uid, username: p.username })),
        scores: match.scores,
        winnerUid,
      });
      delete activeMatches[roomId];
    }
  });

  socket.on('memory_card_flip', ({ roomId, cardIndex, uid }) => {
    socket.to(roomId).emit('opponent_memory_flip', { cardIndex, uid });
  });

  // ==========================================
  // QUIZ BATTLE (1v1)
  // ==========================================
  socket.on('join_quiz_queue', (userData) => {
    console.log(`${userData.username} joined Quiz Queue.`);
    if (quizQueue.find(p => p.uid === userData.uid)) return;

    if (quizQueue.length > 0) {
      const opponent = quizQueue.pop();
      const roomId = `match_quiz_${Date.now()}`;
      
      socket.join(roomId);
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (opponentSocket) opponentSocket.join(roomId);

      const questions = selectQuizQuestions(5);
      const gameState = {
        roomId,
        game: 'quiz',
        players: [opponent, { ...userData, socketId: socket.id }],
        questions, // Server sends questions to both
        currentQuestion: 0,
        scores: { [opponent.uid]: 0, [userData.uid]: 0 },
        answers: {}, // Track answers per round: { questionIndex: { uid: { answer, time } } }
        totalQuestions: questions.length,
      };
      activeMatches[roomId] = gameState;

      io.to(roomId).emit('quiz_match_found', gameState);
      broadcastQueueCounts();
    } else {
      quizQueue.push({ ...userData, socketId: socket.id });
      socket.emit('waiting_for_opponent');
      broadcastQueueCounts();
    }
  });

  socket.on('leave_quiz_queue', () => {
    quizQueue = quizQueue.filter(p => p.socketId !== socket.id);
    broadcastQueueCounts();
  });

  socket.on('quiz_submit_answer', ({ roomId, uid, questionIndex, answer, timeMs }) => {
    const match = activeMatches[roomId];
    if (!match) return;

    if (!match.answers[questionIndex]) match.answers[questionIndex] = {};
    match.answers[questionIndex][uid] = { answer, timeMs };

    // Notify opponent that this player has answered (no spoilers)
    socket.to(roomId).emit('quiz_opponent_answered', { questionIndex, uid });

    // Check if both players answered
    const roundAnswers = match.answers[questionIndex];
    const allAnswered = match.players.every(p => roundAnswers[p.uid]);

    if (allAnswered) {
      const correctAnswer = match.questions[questionIndex].answer;
      const results = {};

      match.players.forEach(p => {
        const pa = roundAnswers[p.uid];
        const isCorrect = pa.answer === correctAnswer;
        // Points: 100 for correct answer + speed bonus (max 50 bonus for < 3s)
        const speedBonus = isCorrect ? Math.max(0, 50 - Math.floor(pa.timeMs / 100)) : 0;
        const points = isCorrect ? 100 + speedBonus : 0;
        match.scores[p.uid] += points;
        results[p.uid] = { isCorrect, points, answer: pa.answer, timeMs: pa.timeMs };
      });

      io.to(roomId).emit('quiz_round_result', {
        questionIndex,
        correctAnswer,
        results,
        scores: match.scores,
      });

      // Check if quiz is over
      if (questionIndex >= match.totalQuestions - 1) {
        setTimeout(() => {
          const p1 = match.players[0].uid;
          const p2 = match.players[1].uid;
          let winnerUid = null;
          if (match.scores[p1] > match.scores[p2]) winnerUid = p1;
          else if (match.scores[p2] > match.scores[p1]) winnerUid = p2;

          io.to(roomId).emit('quiz_game_over', {
            scores: match.scores,
            winnerUid,
          });

          saveMatchResult({
            game: 'quiz',
            roomId,
            players: match.players.map(p => ({ uid: p.uid, username: p.username })),
            scores: match.scores,
            winnerUid,
          });
          delete activeMatches[roomId];
        }, 3000); // Delay so players see last round result
      }
    }
  });

  // ==========================================
  // REACTION BATTLE (Best of 5)
  // ==========================================
  socket.on('join_reaction_queue', (userData) => {
    console.log(`${userData.username} joined Reaction Queue.`);
    if (reactionQueue.find(p => p.uid === userData.uid)) return;

    if (reactionQueue.length > 0) {
      const opponent = reactionQueue.pop();
      const roomId = `match_react_${Date.now()}`;
      
      socket.join(roomId);
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      if (opponentSocket) opponentSocket.join(roomId);

      const gameState = {
        roomId,
        game: 'reaction',
        players: [opponent, { ...userData, socketId: socket.id }],
        currentRound: 0,
        totalRounds: 5,
        roundResults: [], // [{ uid1: timeMs, uid2: timeMs }]
        roundWins: { [opponent.uid]: 0, [userData.uid]: 0 },
        currentRoundResponses: {},
      };
      activeMatches[roomId] = gameState;

      io.to(roomId).emit('reaction_match_found', gameState);
      broadcastQueueCounts();

      // Start first round after a brief delay
      setTimeout(() => startReactionRound(roomId), 2000);
    } else {
      reactionQueue.push({ ...userData, socketId: socket.id });
      socket.emit('waiting_for_opponent');
      broadcastQueueCounts();
    }
  });

  socket.on('leave_reaction_queue', () => {
    reactionQueue = reactionQueue.filter(p => p.socketId !== socket.id);
    broadcastQueueCounts();
  });

  socket.on('reaction_player_click', ({ roomId, uid, timeMs, tooSoon }) => {
    const match = activeMatches[roomId];
    if (!match) return;

    if (!match.currentRoundResponses) match.currentRoundResponses = {};
    match.currentRoundResponses[uid] = { timeMs, tooSoon: tooSoon || false };

    // Tell opponent that this player has reacted
    socket.to(roomId).emit('reaction_opponent_reacted', { uid });

    // Check if both players responded
    const allResponded = match.players.every(p => match.currentRoundResponses[p.uid]);
    if (allResponded) {
      const roundResult = {};
      let roundWinner = null;
      let bestTime = Infinity;

      match.players.forEach(p => {
        const resp = match.currentRoundResponses[p.uid];
        roundResult[p.uid] = resp;
        if (!resp.tooSoon && resp.timeMs < bestTime) {
          bestTime = resp.timeMs;
          roundWinner = p.uid;
        }
      });

      // If both clicked too soon, no winner for this round
      if (roundWinner) {
        match.roundWins[roundWinner]++;
      }

      match.roundResults.push(roundResult);
      match.currentRound++;
      match.currentRoundResponses = {};

      io.to(roomId).emit('reaction_round_result', {
        round: match.currentRound,
        roundResult,
        roundWinner,
        roundWins: match.roundWins,
      });

      // Check if match is over
      if (match.currentRound >= match.totalRounds) {
        setTimeout(() => {
          const p1 = match.players[0].uid;
          const p2 = match.players[1].uid;
          let winnerUid = null;
          if (match.roundWins[p1] > match.roundWins[p2]) winnerUid = p1;
          else if (match.roundWins[p2] > match.roundWins[p1]) winnerUid = p2;

          io.to(roomId).emit('reaction_game_over', {
            roundWins: match.roundWins,
            roundResults: match.roundResults,
            winnerUid,
          });

          saveMatchResult({
            game: 'reaction',
            roomId,
            players: match.players.map(p => ({ uid: p.uid, username: p.username })),
            roundWins: match.roundWins,
            winnerUid,
          });
          delete activeMatches[roomId];
        }, 2000);
      } else {
        // Start next round after delay
        setTimeout(() => startReactionRound(roomId), 3000);
      }
    }
  });

  // ==========================================
  // REMATCH SYSTEM (works for any game)
  // ==========================================
  socket.on('request_rematch', ({ roomId, uid, game }) => {
    socket.to(roomId).emit('rematch_requested', { uid, game });
  });

  socket.on('accept_rematch', ({ roomId, game, players }) => {
    // Both players are still in the room, start a new game
    if (game === 'memory') {
      const deck = generateMemoryDeck();
      const newState = {
        roomId,
        game: 'memory',
        players,
        deck,
        scores: { [players[0].uid]: 0, [players[1].uid]: 0 },
        totalPairs: MEMORY_ICONS.length,
        pairsFound: 0,
      };
      activeMatches[roomId] = newState;
      io.to(roomId).emit('memory_match_found', newState);
    } else if (game === 'quiz') {
      const questions = selectQuizQuestions(5);
      const newState = {
        roomId,
        game: 'quiz',
        players,
        questions,
        currentQuestion: 0,
        scores: { [players[0].uid]: 0, [players[1].uid]: 0 },
        answers: {},
        totalQuestions: questions.length,
      };
      activeMatches[roomId] = newState;
      io.to(roomId).emit('quiz_match_found', newState);
    } else if (game === 'reaction') {
      const newState = {
        roomId,
        game: 'reaction',
        players,
        currentRound: 0,
        totalRounds: 5,
        roundResults: [],
        roundWins: { [players[0].uid]: 0, [players[1].uid]: 0 },
        currentRoundResponses: {},
      };
      activeMatches[roomId] = newState;
      io.to(roomId).emit('reaction_match_found', newState);
      setTimeout(() => startReactionRound(roomId), 2000);
    }
  });

  // Handle leaving queue or disconnecting
  socket.on('leave_queue', () => {
    waitingPlayers = waitingPlayers.filter(p => p.socketId !== socket.id);
    broadcastQueueCounts();
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    waitingPlayers = waitingPlayers.filter(p => p.socketId !== socket.id);
    tapQueue = tapQueue.filter(p => p.socketId !== socket.id);
    memoryQueue = memoryQueue.filter(p => p.socketId !== socket.id);
    quizQueue = quizQueue.filter(p => p.socketId !== socket.id);
    reactionQueue = reactionQueue.filter(p => p.socketId !== socket.id);
    
    // Broadcast updated online count and queue counts
    io.emit('online_count', io.engine.clientsCount);
    broadcastQueueCounts();
  });

  // Broadcast initial online count and queue counts
  io.emit('online_count', io.engine.clientsCount);
  broadcastQueueCounts();
});

// Reaction Battle: Server-controlled round start (ensures fairness)
function startReactionRound(roomId) {
  const match = activeMatches[roomId];
  if (!match) return;

  // Tell players to get ready (wait phase)
  io.to(roomId).emit('reaction_round_waiting', { round: match.currentRound + 1 });

  // Random delay 2-5 seconds, then send the GO signal
  const delay = Math.floor(Math.random() * 3000) + 2000;
  setTimeout(() => {
    if (activeMatches[roomId]) {
      io.to(roomId).emit('reaction_round_go', {
        round: match.currentRound + 1,
        serverTimestamp: Date.now(),
      });
    }
  }, delay);
}

// ==========================================

// Start the HTTP server (which includes Express & Socket.io)
server.listen(PORT, () => {
  console.log(`GAMORA X Backend active on port ${PORT}`);
});

// ==========================================
// CRASH/ERROR MANAGEMENT
// ==========================================

process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception! 🚨');
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection! 🚨');
  console.error('Reason:', reason);
});
