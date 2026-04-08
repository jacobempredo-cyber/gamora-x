const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedTargetCombo() {
  const gamesRef = db.collection('games');
  
  // Check if it already exists
  const existing = await gamesRef.where('route', '==', '/games/target-combo').get();
  if (!existing.empty) {
    console.log('Target Combo already exists in Firestore.');
    process.exit(0);
  }

  const newGame = {
    title: "Target Combo",
    description: "Fast-paced aim trainer. Hit targets quickly to build your multiplier and score big!",
    icon: "🎯",
    route: "/games/target-combo",
    color: "orange",
    category: "arcade",
    isComingSoon: false,
    hasMultiplayer: false,
    order: 7, // Place it after Tap Speed
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await gamesRef.add(newGame);
  console.log('Successfully added Target Combo to Games library!');
  process.exit(0);
}

seedTargetCombo().catch(err => {
  console.error('Error seeding game:', err);
  process.exit(1);
});
