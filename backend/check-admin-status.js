const { db } = require('./firebase/admin');

async function checkUser(email) {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (snapshot.empty) {
      console.log(`No user found with email: ${email}`);
      process.exit(0);
    }

    snapshot.forEach(doc => {
      console.log('User Data:', JSON.stringify({ id: doc.id, ...doc.data() }, null, 2));
    });
    process.exit(0);
  } catch (error) {
    console.error('Error checking user:', error.message);
    process.exit(1);
  }
}

checkUser('admin@gmail.com');
