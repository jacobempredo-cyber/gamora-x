import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { auth, db } from '../firebase/config';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loading = authLoading; // Compatibility with existing usages

  // Sign up
  const register = useCallback(async (email, password, username) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user profile in Firestore
    const userRef = doc(db, 'users', user.uid);
    const profileData = {
      uid: user.uid,
      email: user.email,
      username: username,
      avatar: '',
      score: 0,
      level: 1,
      xp: 0,
      coins: 0,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      isOnline: true
    };
    
    await setDoc(userRef, profileData);
    setUserProfile(profileData);
    return userCredential;
  }, []);

  // Log in
  const login = useCallback((email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  }, []);

  // Google Login
  const loginWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const profileData = {
        uid: user.uid,
        email: user.email,
        username: user.displayName || user.email.split('@')[0],
        avatar: user.photoURL || '',
        score: 0,
        level: 1,
        xp: 0,
        coins: 0,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        isOnline: true
      };
      await setDoc(userRef, profileData);
      setUserProfile(profileData);
    } else {
      setUserProfile(userSnap.data());
    }

    return userCredential;
  }, []);

  const logout = useCallback(async () => {
    console.log('[AUTH] Logout initiated...');
    try {
      // Fire and forget the status update so it doesn't block logout
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        updateDoc(userRef, { isOnline: false, lastActive: serverTimestamp() }).catch(() => {});
      }
    } catch (e) {}
    
    // Direct signout
    return signOut(auth).then(() => {
      console.log('[AUTH] Sign out successful');
      window.location.href = '/'; // Force redirect to landing page
    });
  }, []);

  useEffect(() => {
    console.log('[AUTH] Initializing state listener...');
    let unsubscribeProfile = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      console.log('[AUTH] User state changed:', user ? 'Logged In' : 'Logged Out');
      
      if (unsubscribeProfile) unsubscribeProfile();

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        
        // High-Reliability Fetch: Try Backend API first, then fallback to direct Firestore
        const fetchProfile = async () => {
          try {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/users/${user.uid}`, {
              headers: { Authorization: `Bearer ${idToken}` }
            });
            
            if (response.ok) {
              const data = await response.json();
              setUserProfile(data);
              console.log('[AUTH] Profile synced via Backend API');
              return true;
            }
          } catch (err) {
            console.warn('[AUTH] Backend API fetch failed, trying direct Firestore...');
          }

          // Fallback to direct Firestore (even if "offline", it might return cached data)
          try {
            const snap = await getDoc(userRef);
            if (snap.exists()) {
              setUserProfile(snap.data());
              return true;
            } else {
              // Auto-creation for "real app" feel
              const newProfile = {
                uid: user.uid,
                username: user.email.split('@')[0],
                email: user.email,
                avatar: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.uid}`,
                level: 1,
                xp: 0,
                coins: 100,
                isAdmin: false,
                isOnline: true,
                createdAt: new Date().toISOString()
              };
              await setDoc(userRef, newProfile);
              setUserProfile(newProfile);
              return true;
            }
          } catch (err) {
            console.error('[AUTH] Direct Firestore fetch failed:', err.message);
          }
          return false;
        };

        // Create a promise wrapper with a timeout to prevent splash hang
        const profileSyncWithTimeout = Promise.race([
          fetchProfile(),
          new Promise(resolve => setTimeout(() => {
            console.warn('[AUTH] Profile sync timed out, continuing anyway...');
            resolve(false);
          }, 3500)) // 3.5s timeout for initial splash
        ]);

        await profileSyncWithTimeout;
        setProfileLoading(false);
        setAuthLoading(false);
        // Real-time listener
        unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.data());
          }
        }, (err) => console.error('[AUTH] Snapshot error:', err));
      } else {
        setUserProfile(null);
        setProfileLoading(false);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = useMemo(() => ({
    currentUser,
    userProfile,
    loading,
    authLoading,
    profileLoading,
    login,
    register,
    loginWithGoogle,
    logout
  }), [currentUser, userProfile, loading, authLoading, profileLoading, logout]);

  if (loading && !currentUser) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0d0221] z-[9999]">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 border-t-4 border-b-4 border-cyan-500 rounded-full animate-spin"></div>
          <div className="absolute inset-2 border-r-4 border-l-4 border-purple-500 rounded-full animate-spin-reverse opacity-70"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-2xl animate-pulse text-white font-black">GX</span>
          </div>
        </div>
        <div className="text-cyan-400 font-black tracking-[0.5em] animate-pulse text-sm uppercase">Initializing Arena</div>
        <div className="mt-4 w-48 h-1 bg-gray-900 rounded-full overflow-hidden border border-white/5 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
          <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 animate-loading-bar"></div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
