const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
// IMPORTANT: You need to generate a service account key from your Firebase Console
// Create a backend/.env file and add GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
// Alternatively, parse the JSON from env string:

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized from ENV JSON');
  } else {
    // Force project ID if default init is ambiguous in local dev
    admin.initializeApp({
      projectId: 'gamora-x' 
    });
    console.log('Firebase Admin initialized with projectId: gamora-x');
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error.message);
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
