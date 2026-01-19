import { 
  collection, query, where, onSnapshot,
  getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc,
  serverTimestamp, increment, orderBy, writeBatch, arrayUnion,
  limit // ✅ Added missing import
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  User, Campaign, Submission, PayoutRequest, 
  UserStatus, SubmissionStatus, PayoutStatus 
} from '../types'; // Updated path to match usual structure

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
        lockoutUntil: null,
        updatedAt: serverTimestamp()
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update user's pending balance
      const userRef = doc(db, 'users', submissionData.userId);
      await updateDoc(userRef, {
        pendingBalance: increment(submissionData.rewardAmount || 0),
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
  },

  // ✅ Get user pending submissions count
  getUserPendingSubmissions: async (userId: string): Promise<number> => {
    const submissionsRef = collection(db, 'submissions');
    const q = query(
      submissionsRef, 
      where('userId', '==', userId),
      where('status', 'in', [SubmissionStatus.PENDING, SubmissionStatus.VIRAL_CLAIM])
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
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
        requestedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
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
  },

  // ✅ Get user pending payouts
  getUserPendingPayouts: async (userId: string): Promise<PayoutRequest[]> => {
    const payoutsRef = collection(db, 'payouts');
    const q = query(
      payoutsRef, 
      where('userId', '==', userId),
      where('status', '==', PayoutStatus.PENDING)
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
      where('targetUserId', 'in', [userId, null]), 
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
  },

  // ✅ Get unread broadcasts count
  getUnreadBroadcastsCount: async (userId: string): Promise<number> => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) return 0;
      
      const userData = userSnap.data() as User;
      const readIds = userData.readBroadcastIds || [];
      
      const broadcastsRef = collection(db, 'broadcasts');
      const q = query(
        broadcastsRef,
        where('targetUserId', 'in', [userId, null])
      );
      
      const snapshot = await getDocs(q);
      
      let unreadCount = 0;
      snapshot.forEach(doc => {
        if (!readIds.includes(doc.id)) {
          unreadCount++;
        }
      });
      
      return unreadCount;
    } catch (error) {
      console.error('Error getting unread broadcasts count:', error);
      return 0;
    }
  }
};

// ==================== REAL-TIME SYNC MANAGER ====================
export const syncManager = {
  initUserListeners: (userId: string, callbacks: {
    onCampaignsUpdate?: (campaigns: Campaign[]) => void;
    onUserUpdate?: (user: User) => void;
    onSubmissionsUpdate?: (submissions: Submission[]) => void;
    onPayoutsUpdate?: (payouts: PayoutRequest[]) => void;
    onBroadcastsUpdate?: (broadcasts: any[]) => void;
  }) => {
    const unsubscribeFunctions: (() => void)[] = [];
    
    if (callbacks.onCampaignsUpdate) {
      const unsubscribe = campaignHelper.onActiveCampaignsUpdate(callbacks.onCampaignsUpdate);
      unsubscribeFunctions.push(unsubscribe);
    }
    
    if (callbacks.onUserUpdate) {
      const unsubscribe = onSnapshot(doc(db, 'users', userId), (snap) => {
        if (snap.exists()) {
          callbacks.onUserUpdate?.(snap.data() as User);
        }
      });
      unsubscribeFunctions.push(unsubscribe);
    }
    
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
    
    if (callbacks.onPayoutsUpdate) {
      const payoutsRef = collection(db, 'payouts');
      const q = query(payoutsRef, where('userId', '==', userId), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const payouts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PayoutRequest));
        callbacks.onPayoutsUpdate?.(payouts);
      });
      unsubscribeFunctions.push(unsubscribe);
    }
    
    if (callbacks.onBroadcastsUpdate) {
      const broadcastsRef = collection(db, 'broadcasts');
      const q = query(broadcastsRef, where('targetUserId', 'in', [userId, null]), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const broadcasts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callbacks.onBroadcastsUpdate?.(broadcasts);
      });
      unsubscribeFunctions.push(unsubscribe);
    }
    
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }
};

// ==================== ADMIN IMPACT CHECKERS ====================
export const adminImpactChecker = {
  checkAdminImpact: async (userId: string): Promise<{
    statusChanged: boolean;
    balanceUpdated: boolean;
    campaignsUpdated: boolean;
    hasNewBroadcasts: boolean;
  }> => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        return {
          statusChanged: false,
          balanceUpdated: false,
          campaignsUpdated: false,
          hasNewBroadcasts: false
        };
      }
      
      const userData = userSnap.data() as User;
      
      const broadcastsRef = collection(db, 'broadcasts');
      const broadcastsQuery = query(
        broadcastsRef,
        where('targetUserId', 'in', [userId, null]),
        orderBy('timestamp', 'desc'),
        limit(5) // ✅ No longer an error, 'limit' is imported
      );
      
      const broadcastsSnap = await getDocs(broadcastsQuery);
      const latestBroadcasts = broadcastsSnap.docs.map(doc => doc.id);
      const readIds = userData.readBroadcastIds || [];
      const hasUnreadBroadcasts = latestBroadcasts.some(id => !readIds.includes(id));
      
      return {
        statusChanged: userData.status === UserStatus.SUSPENDED || userData.status === UserStatus.BANNED,
        balanceUpdated: userData.walletBalance > 0 || userData.pendingBalance > 0,
        campaignsUpdated: true, 
        hasNewBroadcasts: hasUnreadBroadcasts
      };
    } catch (error) {
      console.error('Error checking admin impact:', error);
      return {
        statusChanged: false,
        balanceUpdated: false,
        campaignsUpdated: false,
        hasNewBroadcasts: false
      };
    }
  }
};
