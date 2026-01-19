import { 
  collection, query, where, onSnapshot,
  getDocs, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, increment, orderBy, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  User, Campaign, Submission, PayoutRequest, 
  UserStatus, SubmissionStatus, PayoutStatus 
} from './types';

// ==================== SHARED CAMPAIGN SERVICE ====================
export const campaignHelper = {
  // ✅ Get ALL campaigns (Admin ke liye)
  getAllCampaigns: async (): Promise<Campaign[]> => {
    const campaignsRef = collection(db, 'campaigns');
    const q = query(campaignsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Campaign));
  },

  // ✅ Get only ACTIVE campaigns (User ke liye)
  getActiveCampaigns: async (): Promise<Campaign[]> => {
    const campaignsRef = collection(db, 'campaigns');
    const q = query(
      campaignsRef, 
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Campaign));
  },

  // ✅ Real-time listener for USER (active campaigns only)
  onActiveCampaignsUpdate: (callback: (campaigns: Campaign[]) => void) => {
    const campaignsRef = collection(db, 'campaigns');
    const q = query(
      campaignsRef, 
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const campaignsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Campaign));
      callback(campaignsData);
    });
  },

  // ✅ Real-time listener for ADMIN (all campaigns)
  onAllCampaignsUpdate: (callback: (campaigns: Campaign[]) => void) => {
    const campaignsRef = collection(db, 'campaigns');
    const q = query(campaignsRef, orderBy('createdAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const campaignsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Campaign));
      callback(campaignsData);
    });
  }
};

// ==================== USER AUTH & STATUS SERVICE ====================
export const userAuthHelper = {
  // ✅ Check if user can login (admin suspend check)
  canUserLogin: async (userId: string): Promise<{ canLogin: boolean; user?: User }> => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return { canLogin: false };
      }
      
      const userData = userSnap.data() as User;
      
      // Check if user is suspended
      if (userData.status === UserStatus.SUSPENDED || userData.status === UserStatus.BANNED) {
        return { 
          canLogin: false, 
          user: userData 
        };
      }
      
      // Update last login
      await updateDoc(userRef, {
        lastLoginAt: Date.now(),
        failedAttempts: 0,
        lockoutUntil: null
      });
      
      return { canLogin: true, user: userData };
    } catch (error) {
      console.error('Error checking user login:', error);
      return { canLogin: false };
    }
  },

  // ✅ Real-time user status listener
  onUserStatusUpdate: (userId: string, callback: (user: User | null) => void) => {
    const userRef = doc(db, 'users', userId);
    
    return onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as User);
      } else {
        callback(null);
      }
    });
  }
};

// ==================== USER SUBMISSION SERVICE ====================
export const userSubmissionHelper = {
  // ✅ Create new submission (User side)
  createSubmission: async (submissionData: Omit<Submission, 'id'>): Promise<string> => {
    try {
      const submissionRef = await addDoc(collection(db, 'submissions'), {
        ...submissionData,
        createdAt: serverTimestamp()
      });
      
      // Update user's pending balance
      const userRef = doc(db, 'users', submissionData.userId);
      await updateDoc(userRef, {
        pendingBalance: increment(submissionData.rewardAmount),
        updatedAt: serverTimestamp()
      });
      
      return submissionRef.id;
    } catch (error) {
      console.error('Error creating submission:', error);
      throw error;
    }
  },

  // ✅ Get user submissions
  getUserSubmissions: async (userId: string): Promise<Submission[]> => {
    const submissionsRef = collection(db, 'submissions');
    const q = query(
      submissionsRef, 
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Submission));
  }
};

// ==================== USER WALLET SERVICE ====================
export const userWalletHelper = {
  // ✅ Request payout (User side)
  requestPayout: async (payoutData: Omit<PayoutRequest, 'id'>): Promise<string> => {
    try {
      const payoutRef = await addDoc(collection(db, 'payouts'), {
        ...payoutData,
        timestamp: serverTimestamp(),
        requestedAt: Date.now()
      });
      
      return payoutRef.id;
    } catch (error) {
      console.error('Error requesting payout:', error);
      throw error;
    }
  },

  // ✅ Get user payouts
  getUserPayouts: async (userId: string): Promise<PayoutRequest[]> => {
    const payoutsRef = collection(db, 'payouts');
    const q = query(
      payoutsRef, 
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as PayoutRequest));
  }
};

// ==================== BROADCAST SERVICE ====================
export const broadcastHelper = {
  // ✅ Get user broadcasts
  getUserBroadcasts: async (userId: string): Promise<any[]> => {
    const broadcastsRef = collection(db, 'broadcasts');
    const q = query(
      broadcastsRef,
      where('targetUserId', 'in', [userId, null]), // Specific ya broadcast
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },

  // ✅ Mark broadcast as read
  markAsRead: async (broadcastId: string, userId: string): Promise<void> => {
    const broadcastRef = doc(db, 'broadcasts', broadcastId);
    await updateDoc(broadcastRef, {
      readBy: arrayUnion(userId),
      updatedAt: serverTimestamp()
    });
  }
};

// ==================== REAL-TIME SYNC MANAGER ====================
export const syncManager = {
  // ✅ Initialize all real-time listeners for a user
  initUserListeners: (userId: string, callbacks: {
    onCampaignsUpdate?: (campaigns: Campaign[]) => void;
    onUserUpdate?: (user: User) => void;
    onSubmissionsUpdate?: (submissions: Submission[]) => void;
    onPayoutsUpdate?: (payouts: PayoutRequest[]) => void;
    onBroadcastsUpdate?: (broadcasts: any[]) => void;
  }) => {
    const unsubscribeFunctions = [];
    
    // Campaigns listener
    if (callbacks.onCampaignsUpdate) {
      const unsubscribe = campaignHelper.onActiveCampaignsUpdate(callbacks.onCampaignsUpdate);
      unsubscribeFunctions.push(unsubscribe);
    }
    
    // User status listener
    if (callbacks.onUserUpdate) {
      const unsubscribe = onSnapshot(doc(db, 'users', userId), (snap) => {
        if (snap.exists()) {
          callbacks.onUserUpdate?.(snap.data() as User);
        }
      });
      unsubscribeFunctions.push(unsubscribe);
    }
    
    // Submissions listener
    if (callbacks.onSubmissionsUpdate) {
      const submissionsRef = collection(db, 'submissions');
      const q = query(submissionsRef, where('userId', '==', userId), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const submissions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Submission));
        callbacks.onSubmissionsUpdate?.(submissions);
      });
      unsubscribeFunctions.push(unsubscribe);
    }
    
    // Return cleanup function
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }
};
