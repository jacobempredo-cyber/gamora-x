const { db } = require('./firebase/admin');

const initialGames = [
  {
    title: "Battle Mode (1v1)",
    description: "Classic Tic Tac Toe. Compete for global ranking.",
    icon: "⚔️",
    route: "/games/tic-tac-toe?mode=battle",
    color: "purple",
    category: "battle",
    isComingSoon: false,
    hasMultiplayer: true,
    order: 1
  },
  {
    title: "Party Mode",
    description: "Multiplayer rooms! Invite up to 8 friends.",
    icon: "🎉",
    route: "/games/party",
    color: "pink",
    category: "party",
    isComingSoon: false,
    hasMultiplayer: true,
    order: 2
  },
  {
    title: "Daily Challenges",
    description: "Complete tasks to earn bonus Coins and XP.",
    icon: "🔥",
    route: "/challenges",
    color: "yellow",
    category: "social",
    isComingSoon: false,
    hasMultiplayer: false,
    order: 3
  },
  {
    title: "Global Chat",
    description: "Connect with players from around the world.",
    icon: "💬",
    route: "/chat",
    color: "cyan",
    category: "social",
    isComingSoon: false,
    hasMultiplayer: false,
    order: 4
  },
  {
    title: "Quiz Master",
    description: "Test your knowledge!",
    icon: "🎯",
    route: "/games/quiz",
    color: "cyan",
    category: "arcade",
    isComingSoon: false,
    hasMultiplayer: true,
    order: 5
  },
  {
    title: "Memory Match",
    description: "Brain training.",
    icon: "🧠",
    route: "/games/memory",
    color: "purple",
    category: "arcade",
    isComingSoon: false,
    hasMultiplayer: true,
    order: 6
  },
  {
    title: "Reaction Time",
    description: "Fast green reflexes.",
    icon: "🚦",
    route: "/games/reaction",
    color: "pink",
    category: "arcade",
    isComingSoon: false,
    hasMultiplayer: true,
    order: 7
  },
  {
    title: "Tap Speed",
    description: "Rapid fire tapping.",
    icon: "⚡",
    route: "/games/tap-speed",
    color: "yellow",
    category: "arcade",
    isComingSoon: false,
    hasMultiplayer: true,
    order: 8
  }
];

async function initGames() {
  try {
    const gamesRef = db.collection('games');
    const snapshot = await gamesRef.get();
    
    if (!snapshot.empty) {
      console.log('Games collection already initialized.');
      process.exit(0);
    }

    const batch = db.batch();
    initialGames.forEach(game => {
      const newRef = gamesRef.doc();
      batch.set(newRef, {
        ...game,
        createdAt: new Date()
      });
    });

    await batch.commit();
    console.log('Successfully initialized games collection with default data! 🔥');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing games:', error.message);
    process.exit(1);
  }
}

initGames();
