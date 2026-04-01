const { db } = require('./firebase/admin');

async function promoteToAdmin(uid) {
  if (!uid) {
    console.error("Please provide a UID: node promote-admin.js YOUR_UID_HERE");
    process.exit(1);
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`User with UID ${uid} not found in Firestore. Creating new admin document...`);
      await userRef.set({
        uid: uid,
        isAdmin: true,
        username: 'Admin User',
        createdAt: new Date()
      });
    } else {
      await userRef.update({
        isAdmin: true
      });
    }

    console.log(`\nSUCCESS: User ${uid} has been promoted to Administrator! 🔥\n`);
    process.exit(0);
  } catch (error) {
    console.error("Error promoting user:", error.message);
    process.exit(1);
  }
}

const uidArg = process.argv[2];
promoteToAdmin(uidArg);
