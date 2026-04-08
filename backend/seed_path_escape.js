const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedPathEscape() {
  const gamesRef = db.collection('games');
  
  // Check if it already exists
  const existing = await gamesRef.where('route', '==', '/games/path-escape').get();
  if (!existing.empty) {
    console.log('Path Escape already exists in Firestore.');
    process.exit(0);
  }

  const newGame = {
    title: "Path Escape",
    description: "Navigate a dangerous grid. Time your movements to avoid falling into the void. Speed and strategy are essential.",
    icon: "🏁",
    route: "/games/path-escape",
    color: "cyan",
    category: "challenge",
    isComingSoon: false,
    hasMultiplayer: false,
    order: 9,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await gamesRef.add(newGame);
  console.log('Successfully added Path Escape to Games library!');
  process.exit(0);
}

seedPathEscape().catch(err => {
  console.error('Error seeding game:', err);
  process.exit(1);
});
