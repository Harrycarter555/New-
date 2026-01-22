import { db } from '../firebase';
import { 
  collection, query, orderBy, limit, where, 
  onSnapshot, addDoc, serverTimestamp 
} from 'firebase/firestore';

// Admin can listen to real-time user activities
export const setupAdminRealtimeListeners = (adminId: string, callbacks: {
  onUserActivity?: (userId: string, activity: any) => void;
  onSubmissionCreated?: (submission: any) => void;
  onPayoutRequested?: (payout: any) => void;
}) => {
  const unsubscribers: (() => void)[] = [];

  // Listen to user activities
  if (callbacks.onUserActivity) {
    const activitiesRef = collection(db, 'user_activities');
    const q = query(activitiesRef, orderBy('timestamp', 'desc'), limit(50));
    
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const activity = change.doc.data();
          callbacks.onUserActivity!(activity.userId, activity);
        }
      });
    });
    unsubscribers.push(unsub);
  }

  // Listen to submissions
  if (callbacks.onSubmissionCreated) {
    const submissionsRef = collection(db, 'submissions');
    const q = query(submissionsRef, where('status', '==', 'pending'), orderBy('timestamp', 'desc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callbacks.onSubmissionCreated!(change.doc.data());
        }
      });
    });
    unsubscribers.push(unsub);
  }

  // Return cleanup function
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
};

// User activity logger
export const logUserActivity = async (
  userId: string, 
  username: string,
  type: 'login' | 'verify' | 'withdraw' | 'viral_submit',
  details: any
) => {
  try {
    await addDoc(collection(db, 'user_activities'), {
      userId,
      username,
      type,
      details,
      timestamp: Date.now(),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};
