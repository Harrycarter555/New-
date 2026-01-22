import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, onSnapshot, serverTimestamp, where,
  getDoc, setDoc, increment, arrayUnion, arrayRemove,
  writeBatch, limit
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  User, UserRole, UserStatus, Campaign, Submission, 
  PayoutRequest, Broadcast, UserReport,
  SubmissionStatus, PayoutStatus, Platform
} from '../../types';

// ========== CONNECTION HEALTH CHECK ==========
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    await getDocs(collection(db, 'users'));
    return true;
  } catch (error) {
    console.error('Firebase connection error:', error);
    return false;
  }
};

// ========== ADMIN PANEL SERVICES ==========
export const adminService = {
  // Get all data for admin panel (optimized single query)
  getAdminDashboardData: async () => {
    try {
      const [
        usersSnapshot, 
        campaignsSnapshot, 
        payoutsSnapshot, 
        submissionsSnapshot,
        reportsSnapshot,
        broadcastsSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'payouts'), orderBy('timestamp', 'desc'), limit(50))),
        getDocs(query(collection(db, 'submissions'), orderBy('timestamp', 'desc'), limit(50))),
        getDocs(query(collection(db, 'reports'), orderBy('timestamp', 'desc'))),
        getDocs(query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc')))
      ]);

      return {
        users: usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)),
        campaigns: campaignsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign)),
        payouts: payoutsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest)),
        submissions: submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)),
        reports: reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserReport)),
        broadcasts: broadcastsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Broadcast))
      };
    } catch (error) {
      console.error('Error loading admin data:', error);
      throw error;
    }
  },

  // Real-time admin data listener
  onAdminDataUpdate: (
    callbacks: {
      onUsers?: (users: User[]) => void;
      onCampaigns?: (campaigns: Campaign[]) => void;
      onPayouts?: (payouts: PayoutRequest[]) => void;
      onSubmissions?: (submissions: Submission[]) => void;
      onReports?: (reports: UserReport[]) => void;
      onBroadcasts?: (broadcasts: Broadcast[]) => void;
    }
  ) => {
    const unsubscribers: (() => void)[] = [];

    if (callbacks.onUsers) {
      const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        callbacks.onUsers!(users);
      });
      unsubscribers.push(unsub);
    }

    if (callbacks.onCampaigns) {
      const unsub = onSnapshot(
        query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), 
        (snapshot) => {
          const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
          callbacks.onCampaigns!(campaigns);
        }
      );
      unsubscribers.push(unsub);
    }

    if (callbacks.onPayouts) {
      const unsub = onSnapshot(
        query(collection(db, 'payouts'), orderBy('timestamp', 'desc'), limit(50)),
        (snapshot) => {
          const payouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
          callbacks.onPayouts!(payouts);
        }
      );
      unsubscribers.push(unsub);
    }

    if (callbacks.onSubmissions) {
      const unsub = onSnapshot(
        query(collection(db, 'submissions'), orderBy('timestamp', 'desc'), limit(50)),
        (snapshot) => {
          const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
          callbacks.onSubmissions!(submissions);
        }
      );
      unsubscribers.push(unsub);
    }

    if (callbacks.onReports) {
      const unsub = onSnapshot(
        query(collection(db, 'reports'), orderBy('timestamp', 'desc')),
        (snapshot) => {
          const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserReport));
          callbacks.onReports!(reports);
        }
      );
      unsubscribers.push(unsub);
    }

    if (callbacks.onBroadcasts) {
      const unsub = onSnapshot(
        query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc')),
        (snapshot) => {
          const broadcasts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Broadcast));
          callbacks.onBroadcasts!(broadcasts);
        }
      );
      unsubscribers.push(unsub);
    }

    // Return cleanup function
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  },

  // Admin actions
  approvePayout: async (payoutId: string, adminId: string) => {
    try {
      const payoutRef = doc(db, 'payouts', payoutId);
      const payoutSnap = await getDoc(payoutRef);
      
      if (!payoutSnap.exists()) throw new Error('Payout not found');
      
      const payoutData = payoutSnap.data();
      const userId = payoutData.userId;
      const amount = payoutData.amount || 0;
      
      // Update payout status
      await updateDoc(payoutRef, {
        status: PayoutStatus.APPROVED,
        processedAt: serverTimestamp(),
        processedBy: adminId,
        updatedAt: serverTimestamp()
      });
      
      // Update cashflow
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      await updateDoc(cashflowRef, {
        todaySpent: increment(amount),
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error approving payout:', error);
      throw error;
    }
  },

  approveSubmission: async (submissionId: string, adminId: string) => {
    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);
      
      if (!submissionSnap.exists()) throw new Error('Submission not found');
      
      const submissionData = submissionSnap.data();
      const userId = submissionData.userId;
      const rewardAmount = submissionData.rewardAmount || 0;
      
      // Update submission status
      await updateDoc(submissionRef, {
        status: SubmissionStatus.APPROVED,
        approvedAt: serverTimestamp(),
        approvedBy: adminId,
        updatedAt: serverTimestamp()
      });
      
      // Update user's wallet
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        walletBalance: increment(rewardAmount),
        pendingBalance: increment(-rewardAmount),
        totalEarnings: increment(rewardAmount),
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error approving submission:', error);
      throw error;
    }
  },

  updateCampaign: async (campaignId: string, updates: Partial<Campaign>) => {
    try {
      await updateDoc(doc(db, 'campaigns', campaignId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  },

  updateUserStatus: async (userId: string, status: UserStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }
};

// ========== USER PANEL SERVICES ==========
export const userService = {
  // Get user dashboard data
  getUserDashboardData: async (userId: string) => {
    try {
      const [
        userSnap,
        campaignsSnap,
        submissionsSnap,
        payoutsSnap,
        broadcastsSnap
      ] = await Promise.all([
        getDoc(doc(db, 'users', userId)),
        getDocs(query(collection(db, 'campaigns'), where('active', '==', true), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'submissions'), where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(20))),
        getDocs(query(collection(db, 'payouts'), where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(10))),
        getDocs(query(collection(db, 'broadcasts'), where('targetUserId', 'in', [userId, null]), orderBy('timestamp', 'desc'), limit(10)))
      ]);

      if (!userSnap.exists()) throw new Error('User not found');

      return {
        user: userSnap.data() as User,
        campaigns: campaignsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign)),
        submissions: submissionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)),
        payouts: payoutsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest)),
        broadcasts: broadcastsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Broadcast))
      };
    } catch (error) {
      console.error('Error loading user data:', error);
      throw error;
    }
  },

  // Submit verification
  submitVerification: async (
    userId: string,
    username: string,
    campaignId: string,
    platform: Platform,
    reelUrl: string,
    rewardAmount: number
  ) => {
    try {
      const submissionRef = await addDoc(collection(db, 'submissions'), {
        userId,
        username,
        socialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${username}`,
        campaignId,
        platform,
        status: SubmissionStatus.PENDING,
        timestamp: Date.now(),
        rewardAmount,
        externalLink: reelUrl,
        isViralBonus: false,
        createdAt: serverTimestamp()
      });

      // Update user's pending balance
      await updateDoc(doc(db, 'users', userId), {
        pendingBalance: increment(rewardAmount),
        updatedAt: serverTimestamp()
      });

      return submissionRef.id;
    } catch (error) {
      console.error('Error submitting verification:', error);
      throw error;
    }
  },

  // Request payout
  requestPayout: async (
    userId: string,
    username: string,
    amount: number,
    method: string,
    details: string
  ) => {
    try {
      const payoutRef = await addDoc(collection(db, 'payouts'), {
        userId,
        username,
        amount,
        method,
        details,
        status: PayoutStatus.PENDING,
        timestamp: Date.now(),
        requestedAt: Date.now(),
        createdAt: serverTimestamp()
      });

      // Deduct from user's wallet
      await updateDoc(doc(db, 'users', userId), {
        walletBalance: increment(-amount),
        updatedAt: serverTimestamp()
      });

      return payoutRef.id;
    } catch (error) {
      console.error('Error requesting payout:', error);
      throw error;
    }
  }
};

// ========== CASHFLOW SERVICE ==========
export const cashflowService = {
  getCashflowData: async () => {
    try {
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      const cashflowSnap = await getDoc(cashflowRef);
      
      if (cashflowSnap.exists()) {
        const data = cashflowSnap.data();
        return {
          dailyLimit: data.dailyLimit || 100000,
          todaySpent: data.todaySpent || 0,
          startDate: data.startDate || new Date().toISOString().split('T')[0],
          endDate: data.endDate || new Date().toISOString().split('T')[0]
        };
      } else {
        // Create default cashflow document
        const defaultCashflow = {
          dailyLimit: 100000,
          todaySpent: 0,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          updatedAt: serverTimestamp()
        };
        
        await setDoc(cashflowRef, defaultCashflow);
        return defaultCashflow;
      }
    } catch (error) {
      console.error('Error loading cashflow:', error);
      throw error;
    }
  },

  updateDailyLimit: async (dailyLimit: number) => {
    try {
      await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), {
        dailyLimit,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating daily limit:', error);
      throw error;
    }
  },

  resetTodaySpent: async () => {
    try {
      await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), {
        todaySpent: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error resetting today spent:', error);
      throw error;
    }
  }
};

// ========== BROADCAST SERVICE ==========
export const broadcastService = {
  sendBroadcast: async (
    content: string,
    senderId: string,
    senderName: string,
    targetUserId?: string
  ) => {
    try {
      const broadcastRef = await addDoc(collection(db, 'broadcasts'), {
        content,
        senderId,
        senderName,
        targetUserId: targetUserId || null,
        timestamp: Date.now(),
        readBy: [],
        createdAt: serverTimestamp()
      });
      return broadcastRef.id;
    } catch (error) {
      console.error('Error sending broadcast:', error);
      throw error;
    }
  },

  markAsRead: async (broadcastId: string, userId: string) => {
    try {
      const broadcastRef = doc(db, 'broadcasts', broadcastId);
      await updateDoc(broadcastRef, {
        readBy: arrayUnion(userId),
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error marking broadcast as read:', error);
      throw error;
    }
  }
};
