// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

console.log('🔥 Loading Firebase configuration...');

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD0GSKrevCHLP2Fs9LMoq8hwImCWzoFxDQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "reelearn-pro.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "reelearn-pro",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "reelearn-pro.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "273701842162",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:273701842162:web:e301cd5ae426140c41746b"
};

console.log('Firebase Config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});

// Check if config is valid
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
  console.error('❌ Firebase API key is missing or invalid!');
  console.error('Please check your .env file');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log('✅ Firebase initialized successfully!');
console.log('Project:', firebaseConfig.projectId);
