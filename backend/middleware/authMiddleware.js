const { auth, db } = require('../firebase/admin');

// Middleware to verify Firebase ID token
const verifyToken = async (req, res, next) => {
  // Safety check for Firebase Auth
  if (!auth) {
    console.warn("[AUTH MIDDLEWARE] Firebase Auth not initialized. Request rejected.");
    return res.status(503).json({ 
      error: 'Backend Service Unavailable', 
      details: 'Firebase Auth is not configured on the server. Please check .env' 
    });
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Missing or invalid token format.' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken; // Attach user info to the request object
    next();
  } catch (error) {
    console.error('Error verifying token in middleware:', error.message);
    return res.status(403).json({ 
      error: 'Unauthorized. Token expired or invalid.',
      details: error.message 
    });
  }
};

// Middleware to verify if the user is an administrator
const verifyAdmin = async (req, res, next) => {
  try {
    // verifyToken must run BEFORE verifyAdmin
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized. User context missing.' });
    }

    // Safety check for Firestore
    if (!db) {
       console.warn("[ADMIN MIDDLEWARE] Firestore not initialized. Admin check failed.");
       return res.status(503).json({ 
         error: 'Backend Service Unavailable', 
         details: 'Firestore is not configured on the server.' 
       });
    }

    const userDoc = await db.collection('users').doc(req.user.uid).get();
    
    if (!userDoc.exists || !userDoc.data().isAdmin) {
      return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
    }

    next();
  } catch (error) {
    console.error('Error verifying admin status:', error);
    return res.status(500).json({ error: 'Internal server error checking permissions.' });
  }
};

module.exports = { verifyToken, verifyAdmin };
