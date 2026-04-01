const { auth, db } = require('../firebase/admin');

// Middleware to verify Firebase ID token
const verifyToken = async (req, res, next) => {
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
