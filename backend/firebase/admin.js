const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
// IMPORTANT: You need to generate a service account key from your Firebase Console
// Create a backend/.env file and add GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
// Alternatively, parse the JSON from env string:

let db;
let auth;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    // Handle doubly-escaped newlines that might occur from dashboard inputs
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
    console.log('Firebase Admin initialized with projectId: gamora-x');
  }
  
  // Safely assign only if initialization passes
  db = admin.firestore();
  auth = admin.auth();
  
} catch (error) {
  console.error("🔥 CRITICAL FIREBASE INIT ERROR:", error.message);
  console.error("👉 Please ensure FIREBASE_SERVICE_ACCOUNT is a valid JSON string on Render.");
}

module.exports = { admin, db, auth };
