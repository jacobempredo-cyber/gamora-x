import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCyFpocwOH56FsVKpnGzHw-jm9TQVfMbKc",
  authDomain: "gamora-x.firebaseapp.com",
  projectId: "gamora-x",
  storageBucket: "gamora-x.firebasestorage.app",
  messagingSenderId: "908238251897",
  appId: "1:908238251897:web:65e560168b1b06b504b1a8",
  measurementId: "G-4CJ8CMDFB4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Try initializing analytics only in browser environments that support it
let analytics = null;
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch(e) {
    console.warn("Analytics not supported in this environment");
  }
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export { analytics };
export default app;
