const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedTapRhythm() {
  const gamesRef = db.collection('games');
  
  // Check if it already exists
  const existing = await gamesRef.where('route', '==', '/games/tap-rhythm').get();
  if (!existing.empty) {
    console.log('Tap Rhythm already exists in Firestore.');
    process.exit(0);
  }

  const newGame = {
    title: "Tap Rhythm",
    description: "Feel the beat without the music. Hit the falling notes perfectly when they hit the line to keep your combo alive.",
    icon: "🎹",
    route: "/games/tap-rhythm",
    color: "pink",
    category: "arcade",
    isComingSoon: false,
    hasMultiplayer: false,
    order: 10,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await gamesRef.add(newGame);
  console.log('Successfully added Tap Rhythm to Games library!');
  process.exit(0);
}

seedTapRhythm().catch(err => {
  console.error('Error seeding game:', err);
  process.exit(1);
});
