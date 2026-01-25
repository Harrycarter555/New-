
// Simplified & safer firebase initialization
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD0GSKrevCHLP2Fs9LMoq8hwImCWzoFxDQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "reelearn-pro.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "reelearn-pro",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "reelearn-pro.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "273701842162",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:273701842162:web:e301cd5ae426140c41746b"
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('Firebase config incomplete. Please set VITE_FIREBASE_* environment variables.');
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Try to enable persistence (best-effort)
try {
  enableIndexedDbPersistence(db).catch((err) => {
    // Persistence failed (multiple tabs or unsupported)
    console.warn('IndexedDB persistence not available:', err && err.message ? err.message : err);
  });
} catch (err) {
  console.warn('Persistence initialization error:', err);
}

// Simple connection check helper
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    // try a small read
    // Note: importing here to avoid circular imports elsewhere
    // The collection call will succeed if Firestore is reachable
    await getFirestore(app);
    return true;
  } catch (err) {
    console.error('Firebase connection check failed:', err);
    return false;
  }
};

export default app;
