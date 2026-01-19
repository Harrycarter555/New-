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
} from '../../types'; // Path check kar lena (../../utils/types bhi ho sakta hai)

// ========== AUTO INITIALIZATION ==========
export const firestoreInitializer = {
  initializeMissingCollections: async (adminUser: User): Promise<boolean> => {
    try {
      console.log('🔍 Checking Firestore collections...');
      const batch = writeBatch(db);
      let createdAnything = false;

      // 1. Config Check
      const configRef = doc(db, 'config', 'app-config');
      const configSnap = await getDoc(configRef);
      if (!configSnap.exists()) {
        batch.set(configRef, { minWithdrawal: 100, dailyLimit: 100000, updatedAt: serverTimestamp() });
        createdAnything = true;
      }

      // 2. Cashflow Check
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      const cashflowSnap = await getDoc(cashflowRef);
      if (!cashflowSnap.exists()) {
        const today = new Date().toISOString().split('T')[0];
        batch.set(cashflowRef, { dailyLimit: 100000, todaySpent: 0, startDate: today, endDate: today, updatedAt: serverTimestamp() });
        createdAnything = true;
      }

      // 3. Admin User Check
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
        createdAnything = true;
      }

      if (createdAnything) {
        await batch.commit();
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
    const updates = type === 'add' 
      ? { walletBalance: increment(amount), totalEarnings: increment(amount) }
      : { walletBalance: increment(-amount) };
    await updateDoc(userRef, { ...updates, updatedAt: serverTimestamp() });
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
    return addDoc(collection(db, 'campaigns'), { ...data, createdBy: creatorId, createdAt: Date.now(), updatedAt: serverTimestamp() });
  },
  updateCampaign: async (id: string, updates: Partial<Campaign>) => {
    await updateDoc(doc(db, 'campaigns', id), { ...updates, updatedAt: serverTimestamp() });
  },
  toggleCampaignStatus: async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'campaigns', id), { active: !currentStatus, updatedAt: serverTimestamp() });
  },
  deleteCampaign: async (id: string) => await deleteDoc(doc(db, 'campaigns', id)),
  onCampaignsUpdate: (callback: (campaigns: Campaign[]) => void) => {
    return onSnapshot(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign)));
    });
  }
};

// ========== SUBMISSION MANAGEMENT ==========
export const submissionService = {
  approveSubmission: async (submissionId: string, adminId: string) => {
    const subRef = doc(db, 'submissions', submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) return;
    const { userId, rewardAmount } = subSnap.data();
    const batch = writeBatch(db);
    batch.update(subRef, { status: SubmissionStatus.APPROVED, approvedBy: adminId, approvedAt: serverTimestamp() });
    batch.update(doc(db, 'users', userId), { 
      walletBalance: increment(rewardAmount), 
      pendingBalance: increment(-rewardAmount),
      totalEarnings: increment(rewardAmount)
    });
    await batch.commit();
  },
  rejectSubmission: async (submissionId: string, adminId: string) => {
    const subRef = doc(db, 'submissions', submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) return;
    const { userId, rewardAmount } = subSnap.data();
    const batch = writeBatch(db);
    batch.update(subRef, { status: SubmissionStatus.REJECTED, rejectedBy: adminId, rejectedAt: serverTimestamp() });
    batch.update(doc(db, 'users', userId), { pendingBalance: increment(-rewardAmount) });
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
    batch.update(payoutRef, { status: PayoutStatus.APPROVED, processedBy: adminId, processedAt: serverTimestamp() });
    batch.update(doc(db, 'users', userId), { walletBalance: increment(-amount) });
    batch.update(doc(db, 'cashflow', 'daily-cashflow'), { todaySpent: increment(amount) });
    await batch.commit();
  },
  rejectPayout: async (payoutId: string, adminId: string) => {
    await updateDoc(doc(db, 'payouts', payoutId), { status: PayoutStatus.REJECTED, processedBy: adminId, processedAt: serverTimestamp() });
  },
  getPayouts: async () => {
    const snap = await getDocs(query(collection(db, 'payouts'), orderBy('timestamp', 'desc')));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest));
  },
  onPayoutsUpdate: (callback: (data: PayoutRequest[]) => void) => {
    return onSnapshot(query(collection(db, 'payouts'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest)));
    });
  }
};

// ========== CASHFLOW MANAGEMENT ==========
export const cashflowService = {
  getCashflow: async () => {
    const snap = await getDoc(doc(db, 'cashflow', 'daily-cashflow'));
    return snap.exists() ? snap.data() : { dailyLimit: 100000, todaySpent: 0 };
  },
  updateDailyLimit: async (limit: number) => {
    await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), { dailyLimit: limit, updatedAt: serverTimestamp() });
  },
  resetTodaySpent: async () => {
    await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), { todaySpent: 0, updatedAt: serverTimestamp() });
  },
  onCashflowUpdate: (callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'cashflow', 'daily-cashflow'), (snap) => {
      if (snap.exists()) callback(snap.data());
    });
  }
};

// ========== REPORTS & BROADCASTS ==========
export const reportService = {
  getReports: async () => {
    const snap = await getDocs(query(collection(db, 'reports'), orderBy('timestamp', 'desc')));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserReport));
  },
  resolveReport: async (id: string, adminId: string) => {
    await updateDoc(doc(db, 'reports', id), { status: 'resolved', resolvedBy: adminId, resolvedAt: serverTimestamp() });
  },
  deleteReport: async (id: string) => await deleteDoc(doc(db, 'reports', id)),
  onReportsUpdate: (callback: (data: UserReport[]) => void) => {
    return onSnapshot(query(collection(db, 'reports'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserReport)));
    });
  }
};

export const broadcastService = {
  createBroadcast: async (data: any) => {
    return addDoc(collection(db, 'broadcasts'), { ...data, timestamp: Date.now(), createdAt: serverTimestamp() });
  },
  onBroadcastsUpdate: (callback: (data: Broadcast[]) => void) => {
    return onSnapshot(query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Broadcast)));
    });
  }
};

// ========== STATISTICS ==========
export const statsService = {
  getDashboardStats: async () => {
    const [uSnap, cSnap, pSnap, sSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'campaigns')),
      getDocs(collection(db, 'payouts')),
      getDocs(collection(db, 'submissions'))
    ]);
    const users = uSnap.docs.map(d => d.data() as User).filter(u => u.role !== UserRole.ADMIN);
    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === UserStatus.ACTIVE).length,
      totalBalance: users.reduce((s, u) => s + (u.walletBalance || 0), 0),
      pendingPayouts: pSnap.docs.filter(d => d.data().status === PayoutStatus.PENDING).length,
      activeCampaigns: cSnap.docs.filter(d => d.data().active).length,
      pendingSubmissions: sSnap.docs.filter(d => d.data().status === SubmissionStatus.PENDING).length
    };
  }
};
