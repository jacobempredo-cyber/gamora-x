const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedSurvivalClick() {
  const gamesRef = db.collection('games');
  
  // Check if it already exists
  const existing = await gamesRef.where('route', '==', '/games/survival-click').get();
  if (!existing.empty) {
    console.log('Survival Click already exists in Firestore.');
    process.exit(0);
  }

  const newGame = {
    title: "Survival Click",
    description: "Tap the green orbs. Dodge the red spikes. Missing an orb or touching a spike costs a life. Survive as long as you can!",
    icon: "🎯",
    route: "/games/survival-click",
    color: "green",
    category: "arcade",
    isComingSoon: false,
    hasMultiplayer: false,
    order: 12,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await gamesRef.add(newGame);
  console.log('Successfully added Survival Click to Games library!');
  process.exit(0);
}

seedSurvivalClick().catch(err => {
  console.error('Error seeding game:', err);
  process.exit(1);
});
