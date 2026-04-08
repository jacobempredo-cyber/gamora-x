const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
// IMPORTANT: You need to generate a service account key from your Firebase Console
// Create a backend/.env file and add GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
// Alternatively, parse the JSON from env string:


try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized from ENV JSON');
  } else {
    // Force project ID if default init is ambiguous in local dev
    admin.initializeApp({
      projectId: 'gamora-x' 
    });
    console.log('Firebase Admin initialized with projectId: gamora-x (Limited Credentials)');
  }
} catch (error) {
  if (!error.message.includes('already exists')) {
    console.error("🔥 FIREBASE ADMIN INIT ERROR:", error.message);
  }
}

// Safely export services (they will be defined even if app init was limited)
const db = admin.apps.length > 0 ? admin.firestore() : null;
const auth = admin.apps.length > 0 ? admin.auth() : null;

if (!db) {
  console.warn("⚠️ Firestore DB is NULL. Backend API will fail on database routes.");
}

module.exports = { admin, db, auth };
