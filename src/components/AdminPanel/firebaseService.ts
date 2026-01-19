import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, onSnapshot, serverTimestamp, where,
  getDoc, setDoc, increment, arrayUnion, arrayRemove,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  User, UserRole, UserStatus, Campaign, Submission, 
  PayoutRequest, Broadcast, UserReport, AppState,
  SubmissionStatus, PayoutStatus, Platform
} from '../../types'; // Check path if it is '../../utils/types'

// ========== AUTO INITIALIZATION ========== 
export const firestoreInitializer = {
  initializeMissingCollections: async (adminUser: User): Promise<boolean> => {
    try {
      console.log('🔍 Syncing Firestore Schema...');
      const batch = writeBatch(db);
      let needsCommit = false;

      // 1. Config & Cashflow checks
      const configRef = doc(db, 'config', 'app-config');
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      
      const [configSnap, cashflowSnap] = await Promise.all([
        getDoc(configRef),
        getDoc(cashflowRef)
      ]);

      if (!configSnap.exists()) {
        batch.set(configRef, { minWithdrawal: 100, dailyLimit: 100000, updatedAt: serverTimestamp() });
        needsCommit = true;
      }

      if (!cashflowSnap.exists()) {
        const today = new Date().toISOString().split('T')[0];
        batch.set(cashflowRef, { 
          dailyLimit: 100000, todaySpent: 0, startDate: today, 
          endDate: today, updatedAt: serverTimestamp() 
        });
        needsCommit = true;
      }

      // 2. Admin User Sync
      const adminRef = doc(db, 'users', adminUser.id);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        batch.set(adminRef, {
          ...adminUser,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          walletBalance: 10000,
          joinedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: serverTimestamp()
        });
        needsCommit = true;
      }

      if (needsCommit) {
        await batch.commit();
        console.log('✅ Schema Initialized');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Init Error:', error);
      return false;
    }
  }
};

// ========== USER MANAGEMENT ==========
export const userService = {
  getUsers: async (): Promise<User[]> => {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
  },

  updateUserStatus: async (userId: string, status: UserStatus) => {
    await updateDoc(doc(db, 'users', userId), { status, updatedAt: serverTimestamp() });
  },

  updateUserBalance: async (userId: string, amount: number, type: 'add' | 'deduct') => {
    const userRef = doc(db, 'users', userId);
    const updateData = type === 'add' 
      ? { walletBalance: increment(amount), totalEarnings: increment(amount) }
      : { walletBalance: increment(-amount) };
    await updateDoc(userRef, { ...updateData, updatedAt: serverTimestamp() });
  },

  onUsersUpdate: (callback: (users: User[]) => void) => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });
  }
};

// ========== CAMPAIGN MANAGEMENT ==========
export const campaignService = {
  getCampaigns: async (): Promise<Campaign[]> => {
    const q = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
  },

  createCampaign: async (data: any, creatorId: string) => {
    return addDoc(collection(db, 'campaigns'), { 
      ...data, 
      createdBy: creatorId, 
      createdAt: Date.now(),
      updatedAt: serverTimestamp() 
    });
  },

  onCampaignsUpdate: (callback: (campaigns: Campaign[]) => void) => {
    return onSnapshot(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign)));
    });
  },

  deleteCampaign: async (id: string) => await deleteDoc(doc(db, 'campaigns', id))
};

// ========== SUBMISSION MANAGEMENT ==========
export const submissionService = {
  approveSubmission: async (submissionId: string, approverId: string) => {
    const subRef = doc(db, 'submissions', submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) throw new Error('Not Found');
    
    const { userId, rewardAmount } = subSnap.data();
    const batch = writeBatch(db);
    
    batch.update(subRef, { status: SubmissionStatus.APPROVED, approvedAt: serverTimestamp(), approvedBy: approverId });
    batch.update(doc(db, 'users', userId), { 
      walletBalance: increment(rewardAmount), 
      pendingBalance: increment(-rewardAmount),
      totalEarnings: increment(rewardAmount)
    });
    
    await batch.commit();
  },

  onSubmissionsUpdate: (callback: (data: Submission[]) => void) => {
    return onSnapshot(query(collection(db, 'submissions'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    });
  }
};

// ========== PAYOUT MANAGEMENT ==========
export const payoutService = {
  approvePayout: async (payoutId: string, adminId: string) => {
    const payoutRef = doc(db, 'payouts', payoutId);
    const payoutSnap = await getDoc(payoutRef);
    if (!payoutSnap.exists()) return;

    const { userId, amount } = payoutSnap.data();
    const batch = writeBatch(db);

    batch.update(payoutRef, { status: PayoutStatus.APPROVED, processedAt: serverTimestamp(), processedBy: adminId });
    batch.update(doc(db, 'users', userId), { walletBalance: increment(-amount) });
    batch.update(doc(db, 'cashflow', 'daily-cashflow'), { todaySpent: increment(amount) });

    await batch.commit();
  },

  onPayoutsUpdate: (callback: (data: PayoutRequest[]) => void) => {
    return onSnapshot(query(collection(db, 'payouts'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest)));
    });
  }
};

// ========== BROADCAST MANAGEMENT ==========
export const broadcastService = {
  createBroadcast: async (data: { content: string, senderId: string, senderName?: string, targetUserId?: string | null }) => {
    return addDoc(collection(db, 'broadcasts'), {
      ...data,
      timestamp: Date.now(),
      readBy: [],
      createdAt: serverTimestamp()
    });
  },

  onBroadcastsUpdate: (callback: (data: Broadcast[]) => void) => {
    return onSnapshot(query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Broadcast)));
    });
  }
};

// ========== CASHFLOW MANAGEMENT ==========
export const cashflowService = {
  onCashflowUpdate: (callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'cashflow', 'daily-cashflow'), (snap) => {
      if (snap.exists()) callback(snap.data());
    });
  },

  updateDailyLimit: async (limit: number) => {
    await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), { dailyLimit: limit, updatedAt: serverTimestamp() });
  }
};

// ========== REPORTS & STATS ==========
export const reportService = {
  onReportsUpdate: (callback: (data: UserReport[]) => void) => {
    return onSnapshot(query(collection(db, 'reports'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserReport)));
    });
  }
};

export const statsService = {
  getDashboardStats: async () => {
    // Note: Performance optimization using Promise.all
    const [uSnap, cSnap, pSnap, sSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'campaigns')),
      getDocs(collection(db, 'payouts')),
      getDocs(collection(db, 'submissions'))
    ]);

    const users = uSnap.docs.map(d => d.data());
    const regUsers = users.filter(u => u.role !== UserRole.ADMIN);

    return {
      totalUsers: regUsers.length,
      activeUsers: regUsers.filter(u => u.status === UserStatus.ACTIVE).length,
      totalBalance: regUsers.reduce((s, u) => s + (u.walletBalance || 0), 0),
      pendingPayouts: pSnap.docs.filter(d => d.data().status === PayoutStatus.PENDING).length,
      activeCampaigns: cSnap.docs.filter(d => d.data().active).length,
      pendingSubmissions: sSnap.docs.filter(d => d.data().status === SubmissionStatus.PENDING).length
    };
  }
};
