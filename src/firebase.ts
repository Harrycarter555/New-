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

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ✅ Offline Cache Enable kiya taaki loading na ho
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
