// src/utils/firebaseState.ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase"; // tumhara firebase config file
import { AppState } from "../types";

const STATE_REF = doc(db, "appState", "main_state");

export async function loadAppState(): Promise<AppState | null> {
  try {
    const snap = await getDoc(STATE_REF);
    if (snap.exists()) {
      return snap.data() as AppState;
    }
  } catch (err) {
    console.error("Firebase load error:", err);
  }
  return null;
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await setDoc(STATE_REF, state, { merge: true });
  } catch (err) {
    console.error("Firebase save error:", err);
  }
}
