const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedColorReflex() {
  const gamesRef = db.collection('games');
  
  // Check if it already exists
  const existing = await gamesRef.where('route', '==', '/games/color-reflex').get();
  if (!existing.empty) {
    console.log('Color Reflex already exists in Firestore.');
    process.exit(0);
  }

  const newGame = {
    title: "Color Reflex",
    description: "The ultimate brain trick! Identify the text color while ignoring the word itself. Speed and focus are key.",
    icon: "🚦",
    route: "/games/color-reflex",
    color: "pink",
    category: "arcade",
    isComingSoon: false,
    hasMultiplayer: false,
    order: 8,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await gamesRef.add(newGame);
  console.log('Successfully added Color Reflex to Games library!');
  process.exit(0);
}

seedColorReflex().catch(err => {
  console.error('Error seeding game:', err);
  process.exit(1);
});
