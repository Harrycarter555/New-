// firestore-service.ts
import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, onSnapshot, serverTimestamp, where,
  getDoc, setDoc, increment, arrayUnion, arrayRemove,
  writeBatch, limit, getCountFromServer
} from 'firebase/firestore';
import { db, checkFirebaseConnection } from '../../firebase';
import { 
  User, UserRole, UserStatus, Campaign, Submission, 
  PayoutRequest, Broadcast, UserReport,
  SubmissionStatus, PayoutStatus, Platform
} from '../../types';

// ========== INITIALIZATION SERVICE ==========
export const initializationService = {
  // Check if collections exist and create if missing
  initializeCollections: async (): Promise<{
    success: boolean;
    collectionsCreated: string[];
    message: string;
  }> => {
    try {
      console.log('🔧 Starting Firestore initialization...');
      const collectionsToCheck = [
        'users', 'campaigns', 'submissions', 'payouts', 'reports', 'broadcasts', 'config', 'cashflow'
      ];
      const createdCollections: string[] = [];

      const batch = writeBatch(db);

      // 1. Check and create config collection
      try {
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
          createdCollections.push('config');
          console.log('✅ Created config collection');
        }
      } catch (error) {
        console.log('Config check skipped');
      }

      // 2. Check and create cashflow collection
      try {
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
            totalSpent: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          createdCollections.push('cashflow');
          console.log('✅ Created cashflow collection');
        }
      } catch (error) {
        console.log('Cashflow check skipped');
      }

      // 3. Check other collections
      for (const collectionName of ['users', 'campaigns', 'submissions', 'payouts', 'reports', 'broadcasts']) {
        try {
          const colRef = collection(db, collectionName);
          const countSnapshot = await getCountFromServer(colRef);
          
          if (countSnapshot.data().count === 0) {
            console.log(`⚠️ Collection ${collectionName} is empty`);
          } else {
            console.log(`✅ Collection ${collectionName} has ${countSnapshot.data().count} documents`);
          }
        } catch (error: any) {
          if (error.code === 'failed-precondition') {
            console.log(`⚠️ Collection ${collectionName} might need indexes`);
          }
          console.log(`Collection ${collectionName} check:`, error.message);
        }
      }

      // Commit batch if we created anything
      if (createdCollections.length > 0) {
        await batch.commit();
        console.log('✅ Batch commit successful');
      }

      return {
        success: true,
        collectionsCreated: createdCollections,
        message: createdCollections.length > 0 
          ? `Created ${createdCollections.length} collections` 
          : 'All collections already exist'
      };
    } catch (error: any) {
      console.error('❌ Initialization failed:', error);
      return {
        success: false,
        collectionsCreated: [],
        message: `Initialization failed: ${error.message}`
      };
    }
  },

  // Health check
  healthCheck: async () => {
    try {
      const connection = await checkFirebaseConnection();
      const initResult = await initializationService.initializeCollections();
      
      return {
        firebase: connection,
        initialization: initResult,
        timestamp: Date.now(),
        status: connection.connected ? 'healthy' : 'unhealthy'
      };
    } catch (error) {
      return {
        firebase: { connected: false, online: false, firestoreReady: false },
        initialization: { success: false, collectionsCreated: [], message: 'Health check failed' },
        timestamp: Date.now(),
        status: 'failed'
      };
    }
  }
};

// ========== ADMIN SERVICE WITH RETRY LOGIC ==========
export const adminService = {
  // Get all data with retry mechanism
  getAdminDashboardData: async (maxRetries = 3): Promise<{
    users: User[];
    campaigns: Campaign[];
    payouts: PayoutRequest[];
    submissions: Submission[];
    reports: UserReport[];
    broadcasts: Broadcast[];
    cashflow: { dailyLimit: number; todaySpent: number };
    stats: any;
  }> => {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Admin data attempt ${attempt}/${maxRetries}`);
        
        // First check connection
        const connection = await checkFirebaseConnection();
        if (!connection.connected && attempt === 1) {
          console.log('⚠️ Offline mode - using cached data if available');
          // In offline mode, we can return empty arrays or cached data
          return {
            users: [],
            campaigns: [],
            payouts: [],
            submissions: [],
            reports: [],
            broadcasts: [],
            cashflow: { dailyLimit: 100000, todaySpent: 0 },
            stats: this.getDefaultStats()
          };
        }

        // Load data in parallel with timeout
        const loadPromises = [
          this.getUsers(),
          this.getCampaigns(),
          this.getPayouts(),
          this.getSubmissions(),
          this.getReports(),
          this.getBroadcasts(),
          cashflowService.getCashflowData()
        ];

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Data loading timeout')), 10000);
        });

        const results = await Promise.race([
          Promise.all(loadPromises),
          timeoutPromise
        ]) as [User[], Campaign[], PayoutRequest[], Submission[], UserReport[], Broadcast[], any];

        const [users, campaigns, payouts, submissions, reports, broadcasts, cashflow] = results;
        
        // Calculate statistics
        const stats = this.calculateStats(users, campaigns, payouts, submissions, reports, cashflow);

        console.log(`✅ Admin data loaded successfully:
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
          broadcasts,
          cashflow,
          stats
        };

      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // If all retries failed, return empty data with error
    console.error('❌ All retries failed, returning empty data');
    return {
      users: [],
      campaigns: [],
      payouts: [],
      submissions: [],
      reports: [],
      broadcasts: [],
      cashflow: { dailyLimit: 100000, todaySpent: 0 },
      stats: this.getDefaultStats(),
      error: lastError?.message || 'Unknown error'
    };
  },

  // Individual data getters with offline support
  getUsers: async (): Promise<User[]> => {
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
          createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
          updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
        } as User;
      });
    } catch (error) {
      console.error('Error loading users:', error);
      return [];
    }
  },

  getCampaigns: async (): Promise<Campaign[]> => {
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
    } catch (error: any) {
      console.error('Error loading campaigns:', error);
      // Try without orderBy if index missing
      if (error.code === 'failed-precondition') {
        try {
          const snapshot = await getDocs(collection(db, 'campaigns'));
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        } catch (fallbackError) {
          return [];
        }
      }
      return [];
    }
  },

  getSubmissions: async (): Promise<Submission[]> => {
    try {
      const snapshot = await getDocs(query(collection(db, 'submissions'), orderBy('timestamp', 'desc'), limit(100)));
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
      console.error('Error loading submissions:', error);
      return [];
    }
  },

  getPayouts: async (): Promise<PayoutRequest[]> => {
    try {
      const snapshot = await getDocs(query(collection(db, 'payouts'), orderBy('timestamp', 'desc'), limit(100)));
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
      console.error('Error loading payouts:', error);
      return [];
    }
  },

  getReports: async (): Promise<UserReport[]> => {
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
      console.error('Error loading reports:', error);
      return [];
    }
  },

  getBroadcasts: async (): Promise<Broadcast[]> => {
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
      console.error('Error loading broadcasts:', error);
      return [];
    }
  },

  // Statistics calculation
  calculateStats: (
    users: User[], 
    campaigns: Campaign[], 
    payouts: PayoutRequest[], 
    submissions: Submission[], 
    reports: UserReport[], 
    cashflow: any
  ) => {
    const regularUsers = users.filter(u => u.role !== UserRole.ADMIN);
    const totalUsers = regularUsers.length;
    const activeUsers = regularUsers.filter(u => u.status === UserStatus.ACTIVE).length;
    const totalBalance = regularUsers.reduce((sum, u) => sum + (u.walletBalance || 0), 0);
    const totalPending = regularUsers.reduce((sum, u) => sum + (u.pendingBalance || 0), 0);
    const totalEarnings = regularUsers.reduce((sum, u) => sum + (u.totalEarnings || 0), 0);
    
    const pendingPayouts = payouts.filter(p => p.status === PayoutStatus.PENDING).length;
    const pendingPayoutsAmount = payouts.filter(p => p.status === PayoutStatus.PENDING)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const openReports = reports.filter(r => r.status === 'open').length;
    const activeCampaigns = campaigns.filter(c => c.active).length;
    
    const pendingSubmissions = submissions.filter(s => 
      s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM
    ).length;
    
    const pendingSubmissionsAmount = submissions.filter(s => 
      s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM
    ).reduce((sum, s) => sum + (s.rewardAmount || 0), 0);

    const cashflowRemaining = Math.max(0, cashflow.dailyLimit - cashflow.todaySpent);
    const pendingCashflow = totalPending + pendingPayoutsAmount + pendingSubmissionsAmount;

    return {
      totalUsers,
      activeUsers,
      totalBalance,
      totalPending,
      totalEarnings,
      pendingPayouts,
      pendingPayoutsAmount,
      openReports,
      activeCampaigns,
      pendingSubmissions,
      pendingSubmissionsAmount,
      cashflowRemaining,
      pendingCashflow,
      dailyLimit: cashflow.dailyLimit,
      todaySpent: cashflow.todaySpent
    };
  },

  getDefaultStats: () => ({
    totalUsers: 0,
    activeUsers: 0,
    totalBalance: 0,
    totalPending: 0,
    totalEarnings: 0,
    pendingPayouts: 0,
    pendingPayoutsAmount: 0,
    openReports: 0,
    activeCampaigns: 0,
    pendingSubmissions: 0,
    pendingSubmissionsAmount: 0,
    cashflowRemaining: 100000,
    pendingCashflow: 0,
    dailyLimit: 100000,
    todaySpent: 0
  }),

  // Real-time listeners with offline support
  onAdminDataUpdate: (
    callbacks: {
      onUsers?: (users: User[]) => void;
      onCampaigns?: (campaigns: Campaign[]) => void;
      onPayouts?: (payouts: PayoutRequest[]) => void;
      onSubmissions?: (submissions: Submission[]) => void;
      onReports?: (reports: UserReport[]) => void;
      onBroadcasts?: (broadcasts: Broadcast[]) => void;
      onError?: (error: Error) => void;
    }
  ) => {
    const unsubscribers: (() => void)[] = [];

    // Helper function to create listener
    const createListener = <T>(
      collectionName: string,
      queryFn: any,
      mapper: (doc: any) => T,
      callback?: (data: T[]) => void
    ) => {
      if (!callback) return;
      
      try {
        const q = queryFn ? queryFn(collection(db, collectionName)) : collection(db, collectionName);
        const unsub = onSnapshot(
          q,
          (snapshot) => {
            const data = snapshot.docs.map(doc => mapper(doc));
            callback(data);
          },
          (error) => {
            console.error(`Error in ${collectionName} listener:`, error);
            if (callbacks.onError) callbacks.onError(error);
          }
        );
        unsubscribers.push(unsub);
      } catch (error) {
        console.error(`Failed to create ${collectionName} listener:`, error);
      }
    };

    // Create listeners
    createListener('users', null, (doc) => ({ id: doc.id, ...doc.data() } as User), callbacks.onUsers);
    createListener('campaigns', (ref: any) => query(ref, orderBy('createdAt', 'desc')), 
      (doc) => ({ id: doc.id, ...doc.data() } as Campaign), callbacks.onCampaigns);
    createListener('submissions', (ref: any) => query(ref, orderBy('timestamp', 'desc'), limit(100)),
      (doc) => ({ id: doc.id, ...doc.data() } as Submission), callbacks.onSubmissions);
    createListener('payouts', (ref: any) => query(ref, orderBy('timestamp', 'desc'), limit(100)),
      (doc) => ({ id: doc.id, ...doc.data() } as PayoutRequest), callbacks.onPayouts);
    createListener('reports', (ref: any) => query(ref, orderBy('timestamp', 'desc')),
      (doc) => ({ id: doc.id, ...doc.data() } as UserReport), callbacks.onReports);
    createListener('broadcasts', (ref: any) => query(ref, orderBy('timestamp', 'desc')),
      (doc) => ({ id: doc.id, ...doc.data() } as Broadcast), callbacks.onBroadcasts);

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

  // Admin actions (same as before)
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

  // ... keep other methods as they are in your file
};

// ========== CASHFLOW SERVICE (Updated) ==========
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
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
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

// ========== COMPATIBILITY EXPORTS ==========
// For backward compatibility with your existing code
export const userService = {
  getUsers: adminService.getUsers,
  updateUserStatus: adminService.updateUserStatus
};

export const campaignService = {
  getCampaigns: adminService.getCampaigns
};

export const payoutService = {
  getPayouts: adminService.getPayouts
};

export const submissionService = {
  getSubmissions: adminService.getSubmissions
};

export const reportService = {
  getReports: adminService.getReports
};

export const broadcastService = {
  getBroadcasts: adminService.getBroadcasts
};

export const statsService = {
  getDashboardStats: async () => {
    const data = await adminService.getAdminDashboardData();
    return data.stats;
  }
};
