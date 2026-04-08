const { db } = require('./firebase/admin');

async function checkAdmins() {
  try {
    const adminsSnapshot = await db.collection('users').where('isAdmin', '==', true).get();
    
    if (adminsSnapshot.empty) {
      console.log('No admins found in the "users" collection.');
    } else {
      console.log(`Found ${adminsSnapshot.size} admin(s):`);
      adminsSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- UID: ${doc.id}, Username: ${data.username || 'N/A'}, Email: ${data.email || 'N/A'}`);
      });
    }
    process.exit(0);
  } catch (error) {
    console.error('Error querying admins:', error.message);
    process.exit(1);
  }
}

checkAdmins();
