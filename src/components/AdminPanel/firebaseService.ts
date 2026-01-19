import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, onSnapshot, serverTimestamp, where,
  getDoc, setDoc, increment, arrayUnion, arrayRemove,
  writeBatch 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  User, UserRole, UserStatus, Campaign, Submission, 
  PayoutRequest, Broadcast, UserReport,
  SubmissionStatus, PayoutStatus, Platform
} from '../../utils/types';

// ========== AUTO INITIALIZATION ========== 
export const firestoreInitializer = {
  initializeMissingCollections: async (adminUser: User): Promise<boolean> => {
    try {
      const batch = writeBatch(db);
      let createdAnything = false;

      // 1. Config
      const configRef = doc(db, 'config', 'app-config');
      const configSnap = await getDoc(configRef);
      if (!configSnap.exists()) {
        batch.set(configRef, { minWithdrawal: 100, dailyLimit: 100000, updatedAt: serverTimestamp() });
        createdAnything = true;
      }

      // 2. Cashflow
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      const cashflowSnap = await getDoc(cashflowRef);
      if (!cashflowSnap.exists()) {
        batch.set(cashflowRef, { dailyLimit: 100000, todaySpent: 0, updatedAt: serverTimestamp() });
        createdAnything = true;
      }

      if (createdAnything) {
        await batch.commit();
        return true;
      }
      return false;
    } catch (error) {
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
  // ✅ FIXED: Restored createCampaign
  createCampaign: async (data: any, creatorId: string) => {
    return addDoc(collection(db, 'campaigns'), { ...data, createdBy: creatorId, createdAt: Date.now() });
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

// ========== SUBMISSION & PAYOUT MANAGEMENT ==========
export const submissionService = {
  // ✅ FIXED: Restored approveSubmission
  approveSubmission: async (submissionId: string, approverId: string) => {
    const subRef = doc(db, 'submissions', submissionId);
    const subSnap = await getDoc(subRef);
    if (!subSnap.exists()) return;
    const { userId, rewardAmount } = subSnap.data();
    const batch = writeBatch(db);
    batch.update(subRef, { status: SubmissionStatus.APPROVED, approvedBy: approverId, approvedAt: serverTimestamp() });
    batch.update(doc(db, 'users', userId), { 
      walletBalance: increment(rewardAmount), 
      pendingBalance: increment(-rewardAmount),
      totalEarnings: increment(rewardAmount)
    });
    await batch.commit();
  },
  rejectSubmission: async (submissionId: string, adminId: string) => {
    await updateDoc(doc(db, 'submissions', submissionId), { status: SubmissionStatus.REJECTED, rejectedBy: adminId, rejectedAt: serverTimestamp() });
  },
  onSubmissionsUpdate: (callback: (data: Submission[]) => void) => {
    return onSnapshot(query(collection(db, 'submissions'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    });
  }
};

export const payoutService = {
  // ✅ FIXED: Restored approvePayout
  approvePayout: async (payoutId: string, approverId: string) => {
    const payoutRef = doc(db, 'payouts', payoutId);
    const payoutSnap = await getDoc(payoutRef);
    if (!payoutSnap.exists()) return;
    const { userId, amount } = payoutSnap.data();
    const batch = writeBatch(db);
    batch.update(payoutRef, { status: PayoutStatus.APPROVED, processedBy: approverId, processedAt: serverTimestamp() });
    batch.update(doc(db, 'users', userId), { walletBalance: increment(-amount) });
    batch.update(doc(db, 'cashflow', 'daily-cashflow'), { todaySpent: increment(amount) });
    await batch.commit();
  },
  rejectPayout: async (payoutId: string, adminId: string) => {
    await updateDoc(doc(db, 'payouts', payoutId), { status: PayoutStatus.REJECTED, processedBy: adminId, processedAt: serverTimestamp() });
  },
  onPayoutsUpdate: (callback: (data: PayoutRequest[]) => void) => {
    return onSnapshot(query(collection(db, 'payouts'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest)));
    });
  }
};

// ========== CASHFLOW MANAGEMENT ==========
export const cashflowService = {
  // ✅ FIXED: Added explicit return type to fix DocumentData error
  getCashflow: async (): Promise<{ dailyLimit: number; todaySpent: number }> => {
    const snap = await getDoc(doc(db, 'cashflow', 'daily-cashflow'));
    const data = snap.data();
    return {
      dailyLimit: data?.dailyLimit || 100000,
      todaySpent: data?.todaySpent || 0
    };
  },
  resetTodaySpent: async () => {
    await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), { todaySpent: 0, updatedAt: serverTimestamp() });
  },
  updateDailyLimit: async (limit: number) => {
    await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), { dailyLimit: limit, updatedAt: serverTimestamp() });
  },
  onCashflowUpdate: (callback: (data: { dailyLimit: number; todaySpent: number }) => void) => {
    return onSnapshot(doc(db, 'cashflow', 'daily-cashflow'), (snap) => {
      const data = snap.data();
      if (data) callback({ dailyLimit: data.dailyLimit, todaySpent: data.todaySpent });
    });
  }
};

// ========== STATISTICS, REPORTS & BROADCASTS ==========
export const statsService = {
  getDashboardStats: async () => {
    const [u, c, p, s, r] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'campaigns')),
      getDocs(collection(db, 'payouts')),
      getDocs(collection(db, 'submissions')),
      getDocs(collection(db, 'reports'))
    ]);
    return {
      totalUsers: u.size,
      activeCampaigns: c.docs.filter(d => d.data().active).length,
      pendingPayouts: p.docs.filter(d => d.data().status === PayoutStatus.PENDING).length,
      pendingSubmissions: s.docs.filter(d => d.data().status === SubmissionStatus.PENDING).length,
      openReports: r.docs.filter(d => d.data().status === 'open').length
    };
  }
};

export const reportService = {
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
