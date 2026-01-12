// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Tumhare Firebase project ke config se replace kar dena
const firebaseConfig = {
  apiKey: "AIzaSyD3AGmLFFuUkIzpW0O3YyrgBbkhe98f-wg",
  authDomain: "reelearn-505d9.firebaseapp.com",
  projectId: "reelearn-505d9",
  storageBucket: "reelearn-505d9.appspot.com",
  messagingSenderId: "207249486424",
  appId: "1:207249486424:web:63461de258102164f8102d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
