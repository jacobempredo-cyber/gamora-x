const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedPrediction() {
  const gamesRef = db.collection('games');
  
  // Check if it already exists
  const existing = await gamesRef.where('route', '==', '/games/prediction').get();
  if (!existing.empty) {
    console.log('Prediction Strike already exists in Firestore.');
    process.exit(0);
  }

  const newGame = {
    title: "Prediction Strike",
    description: "Predict where the randomly moving ball stopped after turning invisible! Test your intuition.",
    icon: "🔮",
    route: "/games/prediction",
    color: "violet",
    category: "arcade",
    isComingSoon: false,
    hasMultiplayer: false,
    order: 15,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await gamesRef.add(newGame);
  console.log('Successfully added Prediction Strike to Games library!');
  process.exit(0);
}

seedPrediction().catch(err => {
  console.error('Error seeding game:', err);
  process.exit(1);
});
