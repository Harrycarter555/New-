// src/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD3AGmLFFuUkIzpW0O3YyrgBbkhe98f-wg',
  authDomain: 'reelearn-505d9.firebaseapp.com',
  projectId: 'reelearn-505d9',
  storageBucket: 'reelearn-505d9.appspot.com',
  messagingSenderId: '207249486424',
  appId: '1:207249486424:web:63461de258102164f8102d',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
