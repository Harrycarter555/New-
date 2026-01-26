// Import Firestore functions from 'firebase/firestore'
import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, onSnapshot, serverTimestamp, where,
  getDoc, setDoc, increment, arrayUnion, arrayRemove,
  writeBatch, limit, getCountFromServer, Timestamp
} from 'firebase/firestore';

// Import Auth functions from 'firebase/auth'
import { getAuth } from 'firebase/auth';

// Import App functions from 'firebase/app'
import { getApp } from 'firebase/app';

import { db } from '../../firebase';
import { 
  User, UserRole, UserStatus, Campaign, Submission, 
  PayoutRequest, Broadcast, UserReport,
  SubmissionStatus, PayoutStatus, Platform
} from '../../types';

// ========== CONNECTION CHECK ==========
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    console.log('🔍 Checking Firebase connection...');
    
    // Check if Firestore db object is available
    if (!db) {
      console.error('❌ Firestore db not initialized');
      return false;
    }
    
    // Use a dedicated test collection that everyone can access
    const testRef = doc(db, '_test', 'connection');
    
    // Write test (allowed for everyone in rules)
    await setDoc(testRef, {
      timestamp: Date.now(),
      test: 'connection_check',
      status: 'success'
    }, { merge: true });
    
    console.log('✅ Firebase connection test passed');
    return true;
    
  } catch (error: any) {
    console.error('🔥 Firebase connection error:', {
      code: error.code,
      message: error.message
    });
    
    // Even if error, check if it's a permissions issue or real connection issue
    if (error.code === 'permission-denied') {
      // This means Firebase IS connected but we don't have permission
      // Which is okay for connection check
      console.log('⚠️ Firebase connected but permissions restricted');
      return true;
    }
    
    // Real connection issues
    if (error.code === 'unavailable' || error.code === 'failed-precondition') {
      return false;
    }
    
    // For other errors, assume connected
    return true;
  }
};

// ========== INITIALIZATION SERVICE ==========
export const initializationService = {
  initializeCollections: async () => {
    try {
      console.log('Initializing Firestore collections...');
      
      // First ensure we have a logged in user (admin)
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        console.log('No user logged in, skipping initialization');
        return { success: false, error: 'User not authenticated' };
      }
      
      const batch = writeBatch(db);
      let created = false;

      // Check and create cashflow document
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      const cashflowSnap = await getDoc(cashflowRef);
      
      if (!cashflowSnap.exists()) {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setFullYear(today.getFullYear() + 1);
        
        batch.set(cashflowRef, {
          dailyLimit: 100000,
          todaySpent: 0,
          startDate: today.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        created = true;
      }

      // Check and create config document
      const configRef = doc(db, 'config', 'app-config');
      const configSnap = await getDoc(configRef);
      
      if (!configSnap.exists()) {
        batch.set(configRef, {
          minWithdrawal: 100,
          dailyLimit: 100000,
          appName: 'ReelEarn Pro',
          version: '1.0.0',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        created = true;
      }

      // Initialize default admin user if not exists
      const adminRef = doc(db, 'users', 'admin-001');
      const adminSnap = await getDoc(adminRef);
      
      if (!adminSnap.exists()) {
        batch.set(adminRef, {
          id: 'admin-001',
          username: 'admin',
          email: 'admin@reelearn.com',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          walletBalance: 0,
          pendingBalance: 0,
          totalEarnings: 0,
          joinedAt: Date.now(),
          lastLoginAt: Date.now(),
          readBroadcastIds: [],
          securityKey: 'admin123',
          savedSocialUsername: '',
          payoutMethod: 'UPI',
          payoutDetails: '',
          createdBy: 'system',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        created = true;
      }

      if (created) {
        await batch.commit();
        console.log('✅ Collections initialized successfully');
      } else {
        console.log('✅ Collections already exist');
      }

      return { success: true, initialized: created };
    } catch (error: any) {
      console.error('Error initializing collections:', error);
      return { success: false, error: error.message };
    }
  }
};

// ========== CORE DATA FETCHING FUNCTIONS ==========
const fetchUsers = async (): Promise<User[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username || '',
        email: data.email || '',
        role: data.role || UserRole.USER,
        status: data.status || UserStatus.ACTIVE,
        walletBalance: Number(data.walletBalance) || 0,
        pendingBalance: Number(data.pendingBalance) || 0,
        totalEarnings: Number(data.totalEarnings) || 0,
        joinedAt: data.joinedAt || Date.now(),
        lastLoginAt: data.lastLoginAt || Date.now(),
        readBroadcastIds: data.readBroadcastIds || [],
        securityKey: data.securityKey || '',
        savedSocialUsername: data.savedSocialUsername || '',
        payoutMethod: data.payoutMethod,
        payoutDetails: data.payoutDetails,
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
        updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
      } as User;
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

const fetchCampaigns = async (): Promise<Campaign[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Untitled Campaign',
        description: data.description || '',
        videoUrl: data.videoUrl || '',
        thumbnailUrl: data.thumbnailUrl || '',
        caption: data.caption || '',
        hashtags: data.hashtags || '',
        audioName: data.audioName || '',
        goalViews: Number(data.goalViews) || 0,
        goalLikes: Number(data.goalLikes) || 0,
        basicPay: Number(data.basicPay) || 0,
        viralPay: Number(data.viralPay) || 0,
        active: Boolean(data.active),
        bioLink: data.bioLink || '',
        createdBy: data.createdBy || '',
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
        updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
      } as Campaign;
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return [];
  }
};

const fetchSubmissions = async (): Promise<Submission[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, 'submissions'), orderBy('timestamp', 'desc')));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || '',
        username: data.username || '',
        socialUsername: data.socialUsername || '',
        campaignId: data.campaignId || '',
        campaignTitle: data.campaignTitle || '',
        platform: data.platform || Platform.INSTAGRAM,
        status: data.status || SubmissionStatus.PENDING,
        timestamp: data.timestamp || Date.now(),
        rewardAmount: Number(data.rewardAmount) || 0,
        externalLink: data.externalLink || '',
        isViralBonus: data.isViralBonus || false,
        approvedAt: data.approvedAt,
        rejectedAt: data.rejectedAt,
        rejectionReason: data.rejectionReason,
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
        updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
      } as Submission;
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
};

const fetchPayouts = async (): Promise<PayoutRequest[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, 'payouts'), orderBy('timestamp', 'desc')));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || '',
        username: data.username || '',
        amount: Number(data.amount) || 0,
        method: data.method || 'UPI',
        status: data.status || PayoutStatus.PENDING,
        timestamp: data.timestamp || Date.now(),
        upiId: data.upiId || '',
        accountDetails: data.accountDetails || '',
        requestedAt: data.requestedAt || Date.now(),
        processedAt: data.processedAt,
        processedBy: data.processedBy,
        rejectionReason: data.rejectionReason,
        holdReason: data.holdReason,
        holdAt: data.holdAt,
        heldBy: data.heldBy,
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
        updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
      } as PayoutRequest;
    });
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return [];
  }
};

const fetchReports = async (): Promise<UserReport[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, 'reports'), orderBy('timestamp', 'desc')));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || '',
        username: data.username || '',
        email: data.email || '',
        message: data.message || '',
        category: data.category || 'other',
        status: data.status || 'open',
        timestamp: data.timestamp || Date.now(),
        resolvedAt: data.resolvedAt,
        resolvedBy: data.resolvedBy,
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
        updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
      } as UserReport;
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return [];
  }
};

const fetchBroadcasts = async (): Promise<Broadcast[]> => {
  try {
    const snapshot = await getDocs(query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc')));
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        content: data.content || '',
        senderId: data.senderId || '',
        senderName: data.senderName || 'Admin',
        targetUserId: data.targetUserId,
        type: data.type || 'broadcast',
        timestamp: data.timestamp || Date.now(),
        readBy: data.readBy || [],
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
        updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
      } as Broadcast;
    });
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    return [];
  }
};

// ========== ADMIN SERVICE ==========
export const adminService = {
  // Get all admin dashboard data
  getAdminDashboardData: async () => {
    try {
      console.log('🔄 Loading admin dashboard data...');
      
      // Load all data in parallel
      const [users, campaigns, payouts, submissions, reports, broadcasts] = await Promise.all([
        fetchUsers(),
        fetchCampaigns(),
        fetchPayouts(),
        fetchSubmissions(),
        fetchReports(),
        fetchBroadcasts()
      ]);

      console.log(`✅ Admin data loaded:
        Users: ${users.length}
        Campaigns: ${campaigns.length}
        Submissions: ${submissions.length}
        Payouts: ${payouts.length}
        Reports: ${reports.length}
        Broadcasts: ${broadcasts.length}
      `);

      return {
        users,
        campaigns,
        payouts,
        submissions,
        reports,
        broadcasts
      };
    } catch (error) {
      console.error('Error loading admin dashboard data:', error);
      // Return empty data on error
      return {
        users: [],
        campaigns: [],
        payouts: [],
        submissions: [],
        reports: [],
        broadcasts: []
      };
    }
  },

  // Real-time listeners
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

    // Users listener
    if (callbacks.onUsers) {
      const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
        const users = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            username: data.username || '',
            email: data.email || '',
            role: data.role || UserRole.USER,
            status: data.status || UserStatus.ACTIVE,
            walletBalance: Number(data.walletBalance) || 0,
            pendingBalance: Number(data.pendingBalance) || 0,
            totalEarnings: Number(data.totalEarnings) || 0,
            joinedAt: data.joinedAt || Date.now(),
            lastLoginAt: data.lastLoginAt || Date.now(),
            readBroadcastIds: data.readBroadcastIds || [],
            securityKey: data.securityKey || '',
            savedSocialUsername: data.savedSocialUsername || '',
            payoutMethod: data.payoutMethod,
            payoutDetails: data.payoutDetails,
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
            updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
          } as User;
        });
        callbacks.onUsers!(users);
      }, (error) => {
        console.error('Users listener error:', error);
      });
      unsubscribers.push(unsub);
    }

    // Campaigns listener
    if (callbacks.onCampaigns) {
      const unsub = onSnapshot(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), (snapshot) => {
        const campaigns = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || 'Untitled Campaign',
            description: data.description || '',
            videoUrl: data.videoUrl || '',
            thumbnailUrl: data.thumbnailUrl || '',
            caption: data.caption || '',
            hashtags: data.hashtags || '',
            audioName: data.audioName || '',
            goalViews: Number(data.goalViews) || 0,
            goalLikes: Number(data.goalLikes) || 0,
            basicPay: Number(data.basicPay) || 0,
            viralPay: Number(data.viralPay) || 0,
            active: Boolean(data.active),
            bioLink: data.bioLink || '',
            createdBy: data.createdBy || '',
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
            updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
          } as Campaign;
        });
        callbacks.onCampaigns!(campaigns);
      }, (error) => {
        console.error('Campaigns listener error:', error);
      });
      unsubscribers.push(unsub);
    }

    // Submissions listener
    if (callbacks.onSubmissions) {
      const unsub = onSnapshot(query(collection(db, 'submissions'), orderBy('timestamp', 'desc')), (snapshot) => {
        const submissions = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            username: data.username || '',
            socialUsername: data.socialUsername || '',
            campaignId: data.campaignId || '',
            campaignTitle: data.campaignTitle || '',
            platform: data.platform || Platform.INSTAGRAM,
            status: data.status || SubmissionStatus.PENDING,
            timestamp: data.timestamp || Date.now(),
            rewardAmount: Number(data.rewardAmount) || 0,
            externalLink: data.externalLink || '',
            isViralBonus: data.isViralBonus || false,
            approvedAt: data.approvedAt,
            rejectedAt: data.rejectedAt,
            rejectionReason: data.rejectionReason,
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
            updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
          } as Submission;
        });
        callbacks.onSubmissions!(submissions);
      }, (error) => {
        console.error('Submissions listener error:', error);
      });
      unsubscribers.push(unsub);
    }

    // Payouts listener
    if (callbacks.onPayouts) {
      const unsub = onSnapshot(query(collection(db, 'payouts'), orderBy('timestamp', 'desc')), (snapshot) => {
        const payouts = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            username: data.username || '',
            amount: Number(data.amount) || 0,
            method: data.method || 'UPI',
            status: data.status || PayoutStatus.PENDING,
            timestamp: data.timestamp || Date.now(),
            upiId: data.upiId || '',
            accountDetails: data.accountDetails || '',
            requestedAt: data.requestedAt || Date.now(),
            processedAt: data.processedAt,
            processedBy: data.processedBy,
            rejectionReason: data.rejectionReason,
            holdReason: data.holdReason,
            holdAt: data.holdAt,
            heldBy: data.heldBy,
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
            updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
          } as PayoutRequest;
        });
        callbacks.onPayouts!(payouts);
      }, (error) => {
        console.error('Payouts listener error:', error);
      });
      unsubscribers.push(unsub);
    }

    // Reports listener
    if (callbacks.onReports) {
      const unsub = onSnapshot(query(collection(db, 'reports'), orderBy('timestamp', 'desc')), (snapshot) => {
        const reports = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            username: data.username || '',
            email: data.email || '',
            message: data.message || '',
            category: data.category || 'other',
            status: data.status || 'open',
            timestamp: data.timestamp || Date.now(),
            resolvedAt: data.resolvedAt,
            resolvedBy: data.resolvedBy,
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
            updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
          } as UserReport;
        });
        callbacks.onReports!(reports);
      }, (error) => {
        console.error('Reports listener error:', error);
      });
      unsubscribers.push(unsub);
    }

    // Broadcasts listener
    if (callbacks.onBroadcasts) {
      const unsub = onSnapshot(query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc')), (snapshot) => {
        const broadcasts = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            content: data.content || '',
            senderId: data.senderId || '',
            senderName: data.senderName || 'Admin',
            targetUserId: data.targetUserId,
            type: data.type || 'broadcast',
            timestamp: data.timestamp || Date.now(),
            readBy: data.readBy || [],
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
            updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
          } as Broadcast;
        });
        callbacks.onBroadcasts!(broadcasts);
      }, (error) => {
        console.error('Broadcasts listener error:', error);
      });
      unsubscribers.push(unsub);
    }

    // Return cleanup function
    return () => {
      unsubscribers.forEach(unsub => {
        try {
          unsub();
        } catch (error) {
          console.error('Error unsubscribing:', error);
        }
      });
    };
  },

  // Admin actions
  updateUserStatus: async (userId: string, status: UserStatus, reason?: string): Promise<boolean> => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status,
        statusReason: reason || '',
        updatedAt: serverTimestamp()
      });

      // Log the action
      await addDoc(collection(db, 'logs'), {
        type: 'admin_action',
        action: 'update_user_status',
        userId,
        newStatus: status,
        reason,
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  },

  // Approve payout with cashflow check
  approvePayout: async (payoutId: string, adminId: string) => {
    try {
      const payoutRef = doc(db, 'payouts', payoutId);
      const payoutSnap = await getDoc(payoutRef);
      
      if (!payoutSnap.exists()) throw new Error('Payout not found');
      
      const payoutData = payoutSnap.data();
      const amount = payoutData.amount || 0;
      const userId = payoutData.userId;
      
      // Check cashflow
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      const cashflowSnap = await getDoc(cashflowRef);
      
      if (cashflowSnap.exists()) {
        const cashflowData = cashflowSnap.data();
        const remaining = cashflowData.dailyLimit - cashflowData.todaySpent;
        
        if (amount > remaining) {
          throw new Error(`Daily limit exceeded. Remaining: ₹${remaining}`);
        }
      }
      
      // Update payout status
      await updateDoc(payoutRef, {
        status: PayoutStatus.APPROVED,
        processedAt: Date.now(),
        processedBy: adminId,
        updatedAt: serverTimestamp()
      });
      
      // Update cashflow
      await updateDoc(cashflowRef, {
        todaySpent: increment(amount),
        updatedAt: serverTimestamp()
      });
      
      // Update user's wallet balance
      await updateDoc(doc(db, 'users', userId), {
        walletBalance: increment(-amount),
        updatedAt: serverTimestamp()
      });
      
      // Log the action
      await addDoc(collection(db, 'logs'), {
        type: 'payout',
        action: 'approve',
        payoutId,
        userId,
        amount,
        adminId,
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error approving payout:', error);
      throw error;
    }
  },

  // Reject payout
  rejectPayout: async (payoutId: string, adminId: string, reason?: string) => {
    try {
      const payoutRef = doc(db, 'payouts', payoutId);
      const payoutSnap = await getDoc(payoutRef);
      
      if (!payoutSnap.exists()) throw new Error('Payout not found');
      
      const payoutData = payoutSnap.data();
      const amount = payoutData.amount || 0;
      const userId = payoutData.userId;
      
      // Update payout status
      await updateDoc(payoutRef, {
        status: PayoutStatus.REJECTED,
        rejectionReason: reason || '',
        processedAt: Date.now(),
        processedBy: adminId,
        updatedAt: serverTimestamp()
      });
      
      // Return amount to user's wallet
      await updateDoc(doc(db, 'users', userId), {
        walletBalance: increment(amount),
        updatedAt: serverTimestamp()
      });
      
      // Log the action
      await addDoc(collection(db, 'logs'), {
        type: 'payout',
        action: 'reject',
        payoutId,
        userId,
        amount,
        reason,
        adminId,
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error rejecting payout:', error);
      throw error;
    }
  },

  // Hold payout
  holdPayout: async (payoutId: string, adminId: string, reason: string) => {
    try {
      await updateDoc(doc(db, 'payouts', payoutId), {
        status: PayoutStatus.HOLD,
        holdReason: reason,
        holdAt: Date.now(),
        heldBy: adminId,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error holding payout:', error);
      throw error;
    }
  },

  // Release hold on payout
  releasePayoutHold: async (payoutId: string, adminId: string) => {
    try {
      await updateDoc(doc(db, 'payouts', payoutId), {
        status: PayoutStatus.PENDING,
        holdReason: null,
        holdAt: null,
        heldBy: null,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error releasing payout hold:', error);
      throw error;
    }
  },

  // Approve submission and pay user
  approveSubmission: async (submissionId: string, adminId: string) => {
    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);
      
      if (!submissionSnap.exists()) throw new Error('Submission not found');
      
      const submissionData = submissionSnap.data();
      const userId = submissionData.userId;
      const rewardAmount = submissionData.rewardAmount || 0;
      const isViralBonus = submissionData.isViralBonus || false;
      
      // Update submission status
      await updateDoc(submissionRef, {
        status: SubmissionStatus.APPROVED,
        approvedAt: Date.now(),
        approvedBy: adminId,
        updatedAt: serverTimestamp()
      });
      
      // Update user's wallet balance
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        walletBalance: increment(rewardAmount),
        pendingBalance: increment(-rewardAmount),
        totalEarnings: increment(rewardAmount),
        updatedAt: serverTimestamp()
      });
      
      // Log the action
      await addDoc(collection(db, 'logs'), {
        type: 'submission',
        action: 'approve',
        submissionId,
        userId,
        amount: rewardAmount,
        isViralBonus,
        adminId,
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error approving submission:', error);
      throw error;
    }
  },

  // Reject submission
  rejectSubmission: async (submissionId: string, adminId: string, reason?: string) => {
    try {
      const submissionRef = doc(db, 'submissions', submissionId);
      const submissionSnap = await getDoc(submissionRef);
      
      if (!submissionSnap.exists()) throw new Error('Submission not found');
      
      const submissionData = submissionSnap.data();
      const userId = submissionData.userId;
      const rewardAmount = submissionData.rewardAmount || 0;
      
      // Update submission status
      await updateDoc(submissionRef, {
        status: SubmissionStatus.REJECTED,
        rejectionReason: reason || '',
        rejectedAt: Date.now(),
        rejectedBy: adminId,
        updatedAt: serverTimestamp()
      });
      
      // Remove from user's pending balance
      await updateDoc(doc(db, 'users', userId), {
        pendingBalance: increment(-rewardAmount),
        updatedAt: serverTimestamp()
      });
      
      // Log the action
      await addDoc(collection(db, 'logs'), {
        type: 'submission',
        action: 'reject',
        submissionId,
        userId,
        amount: rewardAmount,
        reason,
        adminId,
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error rejecting submission:', error);
      throw error;
    }
  },

  // Resolve report
  resolveReport: async (reportId: string, resolverId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved',
        resolvedAt: Date.now(),
        resolvedBy: resolverId,
        updatedAt: serverTimestamp()
      });
      
      return true;
    } catch (error) {
      console.error('Error resolving report:', error);
      throw error;
    }
  },

  // Delete report
  deleteReport: async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      return true;
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  },

  // Update campaign
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

  // Toggle campaign status
  toggleCampaignStatus: async (campaignId: string, currentStatus: boolean): Promise<void> => {
    try {
      await updateDoc(doc(db, 'campaigns', campaignId), {
        active: !currentStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error toggling campaign status:', error);
      throw error;
    }
  },

  // Delete campaign
  deleteCampaign: async (campaignId: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'campaigns', campaignId));
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  },

  // Create campaign
  createCampaign: async (campaignData: Omit<Campaign, 'id' | 'createdAt'>, creatorId: string): Promise<string> => {
    try {
      const campaignRef = await addDoc(collection(db, 'campaigns'), {
        ...campaignData,
        active: true,
        createdBy: creatorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return campaignRef.id;
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  },

  // User payout request (for user-side)
  requestPayout: async (
    userId: string,
    username: string,
    amount: number,
    method: string,
    details: string,
    upiId?: string
  ): Promise<string> => {
    try {
      // Check if user has sufficient balance
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) throw new Error('User not found');
      
      const userData = userSnap.data();
      if (userData.walletBalance < amount) {
        throw new Error('Insufficient balance');
      }
      
      // Deduct from user's wallet
      await updateDoc(userRef, {
        walletBalance: increment(-amount),
        updatedAt: serverTimestamp()
      });
      
      // Create payout request
      const payoutRef = await addDoc(collection(db, 'payouts'), {
        userId,
        username,
        amount,
        method,
        upiId: upiId || '',
        accountDetails: details,
        status: PayoutStatus.PENDING,
        timestamp: Date.now(),
        requestedAt: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return payoutRef.id;
    } catch (error) {
      console.error('Error requesting payout:', error);
      throw error;
    }
  },

  // Submit report (for user-side)
  submitReport: async (
    userId: string,
    username: string,
    email: string,
    message: string,
    category: string
  ): Promise<string> => {
    try {
      const reportRef = await addDoc(collection(db, 'reports'), {
        userId,
        username,
        email,
        message,
        category,
        status: 'open',
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return reportRef.id;
    } catch (error) {
      console.error('Error submitting report:', error);
      throw error;
    }
  },

  // Create submission (for user-side)
  createSubmission: async (
    userId: string,
    username: string,
    socialUsername: string,
    campaignId: string,
    campaignTitle: string,
    platform: Platform,
    rewardAmount: number,
    externalLink: string,
    isViralBonus: boolean = false
  ): Promise<string> => {
    try {
      const submissionRef = await addDoc(collection(db, 'submissions'), {
        userId,
        username,
        socialUsername,
        campaignId,
        campaignTitle,
        platform,
        status: isViralBonus ? SubmissionStatus.VIRAL_CLAIM : SubmissionStatus.PENDING,
        rewardAmount,
        externalLink,
        isViralBonus,
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update user's pending balance
      await updateDoc(doc(db, 'users', userId), {
        pendingBalance: increment(rewardAmount),
        updatedAt: serverTimestamp()
      });
      
      return submissionRef.id;
    } catch (error) {
      console.error('Error creating submission:', error);
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
          startDate: data.startDate || '',
          endDate: data.endDate || ''
        };
      } else {
        // Create default
        const today = new Date();
        const endDate = new Date(today);
        endDate.setFullYear(today.getFullYear() + 1);
        
        const defaultCashflow = {
          dailyLimit: 100000,
          todaySpent: 0,
          startDate: today.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(cashflowRef, defaultCashflow);
        return defaultCashflow;
      }
    } catch (error) {
      console.error('Error loading cashflow:', error);
      // Return defaults
      return {
        dailyLimit: 100000,
        todaySpent: 0,
        startDate: '',
        endDate: ''
      };
    }
  },

  updateDailyLimit: async (dailyLimit: number) => {
    try {
      if (dailyLimit < 1000) throw new Error('Minimum daily limit is ₹1000');
      
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
      const today = new Date();
      const endDate = new Date(today);
      endDate.setFullYear(today.getFullYear() + 1);
      
      await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), {
        todaySpent: 0,
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error resetting today spent:', error);
      throw error;
    }
  },

  // Add to today's spent (for payouts)
  addToTodaySpent: async (amount: number) => {
    try {
      await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), {
        todaySpent: increment(amount),
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error adding to today spent:', error);
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
      const broadcastData: any = {
        content,
        senderId,
        senderName,
        type: targetUserId ? 'targeted' : 'broadcast',
        timestamp: Date.now(),
        readBy: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (targetUserId) {
        broadcastData.targetUserId = targetUserId;
      }

      const broadcastRef = await addDoc(collection(db, 'broadcasts'), broadcastData);
      
      // Log the broadcast
      await addDoc(collection(db, 'logs'), {
        type: 'broadcast',
        action: 'send',
        broadcastId: broadcastRef.id,
        senderId,
        targetUserId: targetUserId || 'all',
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      });

      return broadcastRef.id;
    } catch (error) {
      console.error('Error sending broadcast:', error);
      throw error;
    }
  },

  // Send to multiple users
  sendToMultipleUsers: async (
    content: string,
    senderId: string,
    senderName: string,
    userIds: string[]
  ) => {
    try {
      const batch = writeBatch(db);
      const broadcastIds = [];

      for (const userId of userIds) {
        const broadcastRef = doc(collection(db, 'broadcasts'));
        const broadcastData = {
          content,
          senderId,
          senderName,
          targetUserId: userId,
          type: 'targeted',
          timestamp: Date.now(),
          readBy: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.set(broadcastRef, broadcastData);
        broadcastIds.push(broadcastRef.id);
      }

      await batch.commit();

      // Log the batch broadcast
      await addDoc(collection(db, 'logs'), {
        type: 'broadcast',
        action: 'send_batch',
        senderId,
        userCount: userIds.length,
        timestamp: Date.now(),
        createdAt: serverTimestamp()
      });

      return broadcastIds;
    } catch (error) {
      console.error('Error sending to multiple users:', error);
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

      // Update user's read broadcast IDs
      await updateDoc(doc(db, 'users', userId), {
        readBroadcastIds: arrayUnion(broadcastId),
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error marking broadcast as read:', error);
      throw error;
    }
  },

  deleteBroadcast: async (broadcastId: string) => {
    try {
      await deleteDoc(doc(db, 'broadcasts', broadcastId));
      return true;
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      throw error;
    }
  },

  getBroadcastsForUser: async (userId: string): Promise<Broadcast[]> => {
    try {
      const q = query(
        collection(db, 'broadcasts'),
        where('targetUserId', 'in', [null, userId]),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          content: data.content || '',
          senderId: data.senderId || '',
          senderName: data.senderName || 'Admin',
          targetUserId: data.targetUserId,
          type: data.type || 'broadcast',
          timestamp: data.timestamp || Date.now(),
          readBy: data.readBy || [],
          createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
          updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
        } as Broadcast;
      });
    } catch (error) {
      console.error('Error fetching broadcasts for user:', error);
      return [];
    }
  }
};

// ========== STATS SERVICE ==========
export const statsService = {
  getDashboardStats: async () => {
    try {
      const [users, campaigns, payouts, submissions, reports, cashflowData] = await Promise.all([
        fetchUsers(),
        fetchCampaigns(),
        fetchPayouts(),
        fetchSubmissions(),
        fetchReports(),
        cashflowService.getCashflowData()
      ]);

      const regularUsers = users.filter(u => u.role !== UserRole.ADMIN);
      const totalUsers = regularUsers.length;
      const activeUsers = regularUsers.filter(u => u.status === UserStatus.ACTIVE).length;
      const totalBalance = regularUsers.reduce((sum, u) => sum + (u.walletBalance || 0), 0);
      const totalPending = regularUsers.reduce((sum, u) => sum + (u.pendingBalance || 0), 0);
      const totalEarnings = regularUsers.reduce((sum, u) => sum + (u.totalEarnings || 0), 0);
      
      const pendingPayouts = payouts.filter(p => p.status === PayoutStatus.PENDING).length;
      const pendingPayoutsAmount = payouts.filter(p => p.status === PayoutStatus.PENDING)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const holdPayouts = payouts.filter(p => p.status === PayoutStatus.HOLD).length;
      const holdPayoutsAmount = payouts.filter(p => p.status === PayoutStatus.HOLD)
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const openReports = reports.filter(r => r.status === 'open').length;
      const activeCampaigns = campaigns.filter(c => c.active).length;
      
      const pendingSubmissions = submissions.filter(s => 
        s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM
      ).length;
      
      const pendingSubmissionsAmount = submissions.filter(s => 
        s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM
      ).reduce((sum, s) => sum + (s.rewardAmount || 0), 0);

      const cashflowRemaining = Math.max(0, cashflowData.dailyLimit - cashflowData.todaySpent);
      const pendingCashflow = totalPending + pendingPayoutsAmount + pendingSubmissionsAmount;

      return {
        totalUsers,
        activeUsers,
        totalBalance,
        totalPending,
        totalEarnings,
        pendingPayouts,
        pendingPayoutsAmount,
        holdPayouts,
        holdPayoutsAmount,
        openReports,
        activeCampaigns,
        pendingSubmissions,
        pendingSubmissionsAmount,
        cashflowRemaining,
        pendingCashflow,
        dailyLimit: cashflowData.dailyLimit,
        todaySpent: cashflowData.todaySpent
      };
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalBalance: 0,
        totalPending: 0,
        totalEarnings: 0,
        pendingPayouts: 0,
        pendingPayoutsAmount: 0,
        holdPayouts: 0,
        holdPayoutsAmount: 0,
        openReports: 0,
        activeCampaigns: 0,
        pendingSubmissions: 0,
        pendingSubmissionsAmount: 0,
        cashflowRemaining: 100000,
        pendingCashflow: 0,
        dailyLimit: 100000,
        todaySpent: 0
      };
    }
  }
};

// ========== CAMPAIGN SERVICE ==========
export const campaignService = {
  getAllCampaigns: async () => {
    return fetchCampaigns();
  },
  
  getActiveCampaigns: async () => {
    const campaigns = await fetchCampaigns();
    return campaigns.filter(c => c.active);
  },
  
  getCampaignById: async (campaignId: string) => {
    try {
      const campaignDoc = await getDoc(doc(db, 'campaigns', campaignId));
      if (campaignDoc.exists()) {
        const data = campaignDoc.data();
        return {
          id: campaignDoc.id,
          ...data
        } as Campaign;
      }
      return null;
    } catch (error) {
      console.error('Error getting campaign by ID:', error);
      return null;
    }
  },
  
  createCampaign: adminService.createCampaign,
  updateCampaign: adminService.updateCampaign,
  deleteCampaign: adminService.deleteCampaign,
  toggleCampaignStatus: adminService.toggleCampaignStatus
};

// ========== USER SERVICE ==========
export const userService = {
  getAllUsers: async () => {
    return fetchUsers();
  },
  
  getUserById: async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          id: userDoc.id,
          ...data
        } as User;
      }
      return null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  },
  
  updateUserStatus: adminService.updateUserStatus,
  
  updateUserWallet: async (userId: string, amount: number, type: 'add' | 'deduct') => {
    try {
      const incrementValue = type === 'add' ? amount : -amount;
      await updateDoc(doc(db, 'users', userId), {
        walletBalance: increment(incrementValue),
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating user wallet:', error);
      throw error;
    }
  },
  
  updateUserProfile: async (userId: string, updates: Partial<User>) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }
};

// ========== PAYOUT SERVICE ==========
export const payoutService = {
  getAllPayouts: async () => {
    return fetchPayouts();
  },
  
  getPayoutById: async (payoutId: string) => {
    try {
      const payoutDoc = await getDoc(doc(db, 'payouts', payoutId));
      if (payoutDoc.exists()) {
        const data = payoutDoc.data();
        return {
          id: payoutDoc.id,
          ...data
        } as PayoutRequest;
      }
      return null;
    } catch (error) {
      console.error('Error getting payout by ID:', error);
      return null;
    }
  },
  
  getPayoutsByUserId: async (userId: string) => {
    const payouts = await fetchPayouts();
    return payouts.filter(p => p.userId === userId);
  },
  
  approvePayout: adminService.approvePayout,
  rejectPayout: adminService.rejectPayout,
  holdPayout: adminService.holdPayout,
  releasePayoutHold: adminService.releasePayoutHold,
  requestPayout: adminService.requestPayout
};

// ========== SUBMISSION SERVICE ==========
export const submissionService = {
  getAllSubmissions: async () => {
    return fetchSubmissions();
  },
  
  getSubmissionById: async (submissionId: string) => {
    try {
      const submissionDoc = await getDoc(doc(db, 'submissions', submissionId));
      if (submissionDoc.exists()) {
        const data = submissionDoc.data();
        return {
          id: submissionDoc.id,
          ...data
        } as Submission;
      }
      return null;
    } catch (error) {
      console.error('Error getting submission by ID:', error);
      return null;
    }
  },
  
  getSubmissionsByUserId: async (userId: string) => {
    const submissions = await fetchSubmissions();
    return submissions.filter(s => s.userId === userId);
  },
  
  getSubmissionsByCampaignId: async (campaignId: string) => {
    const submissions = await fetchSubmissions();
    return submissions.filter(s => s.campaignId === campaignId);
  },
  
  approveSubmission: adminService.approveSubmission,
  rejectSubmission: adminService.rejectSubmission,
  createSubmission: adminService.createSubmission
};

// ========== REPORT SERVICE ==========
export const reportService = {
  getAllReports: async () => {
    return fetchReports();
  },
  
  getReportById: async (reportId: string) => {
    try {
      const reportDoc = await getDoc(doc(db, 'reports', reportId));
      if (reportDoc.exists()) {
        const data = reportDoc.data();
        return {
          id: reportDoc.id,
          ...data
        } as UserReport;
      }
      return null;
    } catch (error) {
      console.error('Error getting report by ID:', error);
      return null;
    }
  },
  
  getReportsByUserId: async (userId: string) => {
    const reports = await fetchReports();
    return reports.filter(r => r.userId === userId);
  },
  
  resolveReport: adminService.resolveReport,
  deleteReport: adminService.deleteReport,
  submitReport: adminService.submitReport
};

// ========== EXPORT ALL SERVICES ==========
export {
  checkFirebaseConnection,
  initializationService,
  adminService,
  cashflowService,
  broadcastService,
  statsService,
  campaignService,
  userService,
  payoutService,
  submissionService,
  reportService
};
