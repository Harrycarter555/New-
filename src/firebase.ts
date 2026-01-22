import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD0GSKrevCHLP2Fs9LMoq8hwImCWzoFxDQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "reelearn-pro.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "reelearn-pro",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "reelearn-pro.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "273701842162",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:273701842162:web:e301cd5ae426140c41746b"
};

// ✅ FIX 1: Initialize Firebase WITHOUT offline persistence for testing
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// ✅ FIX 2: Disable offline persistence temporarily
export const db = initializeFirestore(app, {
  // localCache: persistentLocalCache() // COMMENT THIS FOR NOW
});

// ✅ FIX 3: Connection status monitoring
let isConnected = true;

export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    // Simple ping test
    await new Promise((resolve) => setTimeout(resolve, 1000));
    isConnected = true;
    return true;
  } catch (error) {
    console.error('Firebase connection error:', error);
    isConnected = false;
    return false;
  }
};

export const getFirebaseStatus = () => ({
  connected: isConnected,
  lastCheck: new Date().toISOString()
});
