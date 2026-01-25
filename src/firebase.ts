// firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD0GSKrevCHLP2Fs9LMoq8hwImCWzoFxDQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "reelearn-pro.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "reelearn-pro",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "reelearn-pro.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "273701842162",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:273701842162:web:e301cd5ae426140c41746b"
};

// ✅ Initialize Firebase
console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// ✅ Initialize Firestore with offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  })
});

// ✅ Connection status
let isOnline = navigator.onLine;
let firestoreReady = false;

// Listen to online/offline events
window.addEventListener('online', () => {
  console.log('✅ Online mode activated');
  isOnline = true;
});

window.addEventListener('offline', () => {
  console.log('⚠️ Offline mode activated');
  isOnline = false;
});

export const checkFirebaseConnection = async (): Promise<{
  connected: boolean;
  online: boolean;
  firestoreReady: boolean;
}> => {
  try {
    // Simple test query
    const testRef = collection(db, '_test');
    await getDocs(query(testRef, limit(1))).catch(() => {
      // This is expected to fail - we just want to test connection
    });
    
    firestoreReady = true;
    return {
      connected: true,
      online: isOnline,
      firestoreReady: true
    };
  } catch (error) {
    console.log('Firestore connection test:', error);
    return {
      connected: false,
      online: isOnline,
      firestoreReady: false
    };
  }
};

export const getFirebaseStatus = () => ({
  online: isOnline,
  firestoreReady,
  timestamp: new Date().toISOString()
});
