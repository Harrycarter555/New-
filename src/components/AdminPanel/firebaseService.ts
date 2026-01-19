import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, onSnapshot, serverTimestamp, where,
  getDoc, setDoc, increment, writeBatch 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  User, UserRole, UserStatus, Campaign, Submission, 
  PayoutRequest, Broadcast, UserReport,
  SubmissionStatus, PayoutStatus
} from '../../utils/types';

// ========== 1. DASHBOARD & STATS ==========
export const statsService = {
  getDashboardStats: async () => {
    try {
      const [uSnap, cSnap, pSnap, sSnap, rSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'campaigns')),
        getDocs(collection(db, 'payouts')),
        getDocs(collection(db, 'submissions')),
        getDocs(collection(db, 'reports'))
      ]);

      const users = uSnap.docs.map(d => d.data() as User);
      const nonAdmins = users.filter(u => u.role !== UserRole.ADMIN);
      const payouts = pSnap.docs.map(d => d.data() as PayoutRequest);
      const submissions = sSnap.docs.map(d => d.data() as Submission);

      return {
        totalUsers: nonAdmins.length,
        activeUsers: nonAdmins.filter(u => u.status === UserStatus.ACTIVE).length,
        totalBalance: nonAdmins.reduce((s, u) => s + (u.walletBalance || 0), 0),
        pendingPayouts: payouts.filter(p => p.status === PayoutStatus.PENDING).length,
        activeCampaigns: cSnap.docs.filter(d => d.data().active).length,
        pendingSubmissions: submissions.filter(s => s.status === SubmissionStatus.PENDING).length,
        openReports: rSnap.docs.filter(d => d.data().status === 'open').length
      };
    } catch (error) {
      console.error("Stats Error:", error);
      throw error;
    }
  }
};

// ========== 2. USER MANAGEMENT ==========
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

// ========== 3. CAMPAIGN MANAGEMENT ==========
export const campaignService = {
  getCampaigns: async (): Promise<Campaign[]> => {
    const q = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
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

// ========== 4. CASHFLOW MANAGEMENT ==========
export const cashflowService = {
  getCashflow: async () => {
    const snap = await getDoc(doc(db, 'cashflow', 'daily-cashflow'));
    return snap.exists() ? snap.data() : { dailyLimit: 100000, todaySpent: 0 };
  },
  resetTodaySpent: async () => {
    await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), { todaySpent: 0, updatedAt: serverTimestamp() });
  },
  updateDailyLimit: async (limit: number) => {
    await updateDoc(doc(db, 'cashflow', 'daily-cashflow'), { dailyLimit: limit, updatedAt: serverTimestamp() });
  },
  onCashflowUpdate: (callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'cashflow', 'daily-cashflow'), (snap) => {
      if (snap.exists()) callback(snap.data());
    });
  }
};

// ========== 5. PAYOUTS & SUBMISSIONS ==========
export const payoutService = {
  rejectPayout: async (payoutId: string, adminId: string) => {
    await updateDoc(doc(db, 'payouts', payoutId), { status: PayoutStatus.REJECTED, processedBy: adminId, processedAt: serverTimestamp() });
  },
  onPayoutsUpdate: (callback: (data: PayoutRequest[]) => void) => {
    return onSnapshot(query(collection(db, 'payouts'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayoutRequest)));
    });
  }
};

export const submissionService = {
  rejectSubmission: async (submissionId: string, adminId: string) => {
    await updateDoc(doc(db, 'submissions', submissionId), { status: SubmissionStatus.REJECTED, rejectedBy: adminId, rejectedAt: serverTimestamp() });
  },
  onSubmissionsUpdate: (callback: (data: Submission[]) => void) => {
    return onSnapshot(query(collection(db, 'submissions'), orderBy('timestamp', 'desc')), (snap) => {
      callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    });
  }
};

// ========== 6. REPORTS & BROADCASTS ==========
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
