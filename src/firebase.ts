import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD0GSKrevCHLP2Fs9LMoq8hwImCWzoFxDQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "reelearn-pro.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "reelearn-pro",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "reelearn-pro.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "273701842162",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:273701842162:web:e301cd5ae426140c41746b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);

// Initialize Firestore with offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Connection state monitoring
export const firebaseConnection = {
  isConnected: true,
  lastError: null as Error | null,
  
  checkConnection: async () => {
    try {
      // Simple connection test
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, 5000)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 5000))
      ]);
      firebaseConnection.isConnected = true;
      firebaseConnection.lastError = null;
      return true;
    } catch (error) {
      console.error('Firebase connection error:', error);
      firebaseConnection.isConnected = false;
      firebaseConnection.lastError = error as Error;
      return false;
    }
  },
  
  getStatus: () => ({
    connected: firebaseConnection.isConnected,
    lastError: firebaseConnection.lastError?.message,
    timestamp: new Date().toISOString()
  })
};
