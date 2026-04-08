const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedDecisionRush() {
  const gamesRef = db.collection('games');
  
  // Check if it already exists
  const existing = await gamesRef.where('route', '==', '/games/decision-rush').get();
  if (!existing.empty) {
    console.log('Decision Rush already exists in Firestore.');
    process.exit(0);
  }

  const newGame = {
    title: "Decision Rush",
    description: "Lightning-fast true or false trivia. Mistakes dock your timer. How many can you answer before time is up?",
    icon: "🔥",
    route: "/games/decision-rush",
    color: "yellow",
    category: "challenge",
    isComingSoon: false,
    hasMultiplayer: false,
    order: 11,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await gamesRef.add(newGame);
  console.log('Successfully added Decision Rush to Games library!');
  process.exit(0);
}

seedDecisionRush().catch(err => {
  console.error('Error seeding game:', err);
  process.exit(1);
});
