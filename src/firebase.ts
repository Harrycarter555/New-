// FIXED FIREBASE CONFIG
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache,
  collection,
  getDocs,
  query,
  limit,
  serverTimestamp
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD0GSKrevCHLP2Fs9LMoq8hwImCWzoFxDQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "reelearn-pro.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "reelearn-pro",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "reelearn-pro.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "273701842162",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:273701842162:web:e301cd5ae426140c41746b"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// ✅ Initialize Firestore with offline persistence (FIXED CACHE SIZE)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export { serverTimestamp };

// ✅ Real-time connection status
let isOnline = navigator.onLine;

export const checkFirebaseConnection = async () => {
  try {
    const testRef = collection(db, '_test');
    await getDocs(query(testRef, limit(1)));
    return { connected: true, online: isOnline };
  } catch (error) {
    return { connected: false, online: isOnline };
  }
};
