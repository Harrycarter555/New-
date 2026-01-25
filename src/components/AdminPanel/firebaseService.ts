import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, onSnapshot, serverTimestamp, where,
  getDoc, setDoc, increment, arrayUnion, arrayRemove,
  writeBatch, limit, getCountFromServer
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  User, UserRole, UserStatus, Campaign, Submission, 
  PayoutRequest, Broadcast, UserReport,
  SubmissionStatus, PayoutStatus, Platform
} from '../../types';

// ========== CONNECTION CHECK ==========
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    await getDocs(query(collection(db, 'users'), limit(1)));
    return true;
  } catch (error) {
    console.error('Firebase connection error:', error);
    return false;
  }
};

// ========== INITIALIZATION SERVICE ==========
export const initializationService = {
  initializeCollections: async () => {
    try {
      console.log('Initializing Firestore collections...');
      
      const collections = ['users', 'campaigns', 'submissions', 'payouts', 'reports', 'broadcasts'];
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        created = true;
      }

      if (created) {
        await batch.commit();
        console.log('Collections initialized successfully');
      }

      return { success: true, initialized: created };
    } catch (error) {
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
    const snapshot = await getDocs(collection(db, 'campaigns'));
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
        timestamp: data.timestamp?.toDate?.().getTime() || Date.now(),
        rewardAmount: Number(data.rewardAmount) || 0,
        externalLink: data.externalLink || '',
        approvedAt: data.approvedAt?.toDate?.().getTime(),
        rejectedAt: data.rejectedAt?.toDate?.().getTime(),
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now()
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
        timestamp: data.timestamp?.toDate?.().getTime() || Date.now(),
        processedAt: data.processedAt?.toDate?.().getTime(),
        processedBy: data.processedBy,
        upiId: data.upiId,
        accountDetails: data.accountDetails,
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now()
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
        message: data.message || '',
        status: data.status || 'open',
        timestamp: data.timestamp?.toDate?.().getTime() || Date.now(),
        resolvedAt: data.resolvedAt?.toDate?.().getTime(),
        resolvedBy: data.resolvedBy,
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now()
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
        timestamp: data.timestamp?.toDate?.().getTime() || Date.now(),
        readBy: data.readBy || [],
        createdAt: data.createdAt?.toDate?.().getTime() || Date.now()
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
      const unsub = onSnapshot(collection(db, 'campaigns'), (snapshot) => {
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
      const unsub = onSnapshot(collection(db, 'submissions'), (snapshot) => {
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
            timestamp: data.timestamp?.toDate?.().getTime() || Date.now(),
            rewardAmount: Number(data.rewardAmount) || 0,
            externalLink: data.externalLink || '',
            approvedAt: data.approvedAt?.toDate?.().getTime(),
            rejectedAt: data.rejectedAt?.toDate?.().getTime(),
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now()
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
      const unsub = onSnapshot(collection(db, 'payouts'), (snapshot) => {
        const payouts = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            username: data.username || '',
            amount: Number(data.amount) || 0,
            method: data.method || 'UPI',
            status: data.status || PayoutStatus.PENDING,
            timestamp: data.timestamp?.toDate?.().getTime() || Date.now(),
            processedAt: data.processedAt?.toDate?.().getTime(),
            processedBy: data.processedBy,
            upiId: data.upiId,
            accountDetails: data.accountDetails,
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now()
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
      const unsub = onSnapshot(collection(db, 'reports'), (snapshot) => {
        const reports = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId || '',
            username: data.username || '',
            message: data.message || '',
            status: data.status || 'open',
            timestamp: data.timestamp?.toDate?.().getTime() || Date.now(),
            resolvedAt: data.resolvedAt?.toDate?.().getTime(),
            resolvedBy: data.resolvedBy,
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now()
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
      const unsub = onSnapshot(collection(db, 'broadcasts'), (snapshot) => {
        const broadcasts = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            content: data.content || '',
            senderId: data.senderId || '',
            senderName: data.senderName || 'Admin',
            targetUserId: data.targetUserId,
            timestamp: data.timestamp?.toDate?.().getTime() || Date.now(),
            readBy: data.readBy || [],
            createdAt: data.createdAt?.toDate?.().getTime() || Date.now()
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
  updateUserStatus: async (userId: string, status: UserStatus): Promise<boolean> => {
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
  },

  approvePayout: async (payoutId: string, adminId: string) => {
    try {
      const payoutRef = doc(db, 'payouts', payoutId);
      const payoutSnap = await getDoc(payoutRef);
      
      if (!payoutSnap.exists()) throw new Error('Payout not found');
      
      const payoutData = payoutSnap.data();
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

  rejectPayout: async (payoutId: string, adminId: string) => {
    try {
      await updateDoc(doc(db, 'payouts', payoutId), {
        status: PayoutStatus.REJECTED,
        processedAt: serverTimestamp(),
        processedBy: adminId,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error rejecting payout:', error);
      throw error;
    }
  },

  rejectSubmission: async (submissionId: string, adminId: string) => {
    try {
      await updateDoc(doc(db, 'submissions', submissionId), {
        status: SubmissionStatus.REJECTED,
        rejectedAt: serverTimestamp(),
        rejectedBy: adminId,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error rejecting submission:', error);
      throw error;
    }
  },

  resolveReport: async (reportId: string, resolverId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: resolverId,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error resolving report:', error);
      throw error;
    }
  },

  deleteReport: async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      return true;
    } catch (error) {
      console.error('Error deleting report:', error);
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

  deleteCampaign: async (campaignId: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'campaigns', campaignId));
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  },

  createCampaign: async (campaignData: Omit<Campaign, 'id' | 'createdAt'>, creatorId: string): Promise<string> => {
    try {
      const campaignRef = await addDoc(collection(db, 'campaigns'), {
        ...campaignData,
        createdBy: creatorId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      return campaignRef.id;
    } catch (error) {
      console.error('Error creating campaign:', error);
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
  },

  getUsers: async (): Promise<User[]> => {
    return fetchUsers();
  }
};

// ========== COMPATIBILITY EXPORTS ==========
// For backward compatibility
export const userService = {
  getUsers: fetchUsers,
  updateUserStatus: adminService.updateUserStatus,
};

export const campaignService = {
  getCampaigns: fetchCampaigns,
  createCampaign: adminService.createCampaign,
  updateCampaign: adminService.updateCampaign,
  toggleCampaignStatus: adminService.toggleCampaignStatus,
  deleteCampaign: adminService.deleteCampaign,
};

export const submissionService = {
  getSubmissions: fetchSubmissions,
  approveSubmission: adminService.approveSubmission,
  rejectSubmission: adminService.rejectSubmission,
};

export const payoutService = {
  getPayouts: fetchPayouts,
  approvePayout: adminService.approvePayout,
  rejectPayout: adminService.rejectPayout,
};

export const reportService = {
  getReports: fetchReports,
  resolveReport: adminService.resolveReport,
  deleteReport: adminService.deleteReport,
};
