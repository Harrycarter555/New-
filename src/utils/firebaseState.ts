import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { AppState } from "../types";

const STATE_REF = doc(db, "appState", "main_state");
const CACHE_KEY = "app_state_cache";
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Check cache first
const getCachedState = (): AppState | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TIMEOUT) {
      return data;
    }
  } catch (err) {
    console.error("Cache read error:", err);
  }
  return null;
};

// Save to cache
const setCachedState = (state: AppState) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: state,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.error("Cache write error:", err);
  }
};

export async function loadAppState(): Promise<AppState | null> {
  // Try cache first
  const cached = getCachedState();
  if (cached) return cached;

  try {
    const snap = await getDoc(STATE_REF);
    if (snap.exists()) {
      const state = snap.data() as AppState;
      setCachedState(state); // Cache the loaded state
      return state;
    }
  } catch (err) {
    console.error("Firebase load error:", err);
  }
  return null;
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await setDoc(STATE_REF, state, { merge: true });
    setCachedState(state); // Update cache
  } catch (err) {
    console.error("Firebase save error:", err);
  }
}
