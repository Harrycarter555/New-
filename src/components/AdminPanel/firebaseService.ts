import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, serverTimestamp, where,
  getDoc, setDoc, increment, arrayUnion
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  User, UserRole, UserStatus, Campaign, 
  SubmissionStatus, PayoutStatus, Platform
} from '../../types';

// ========== SIMPLIFIED FIREBASE SERVICE ==========
export const checkFirebaseConnection = async (): Promise<boolean> => {
  try {
    await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), where('role', '==', UserRole.ADMIN)));
    return true;
  } catch (error) {
    console.error('Firebase connection error:', error);
    return false;
  }
};

// ========== ADMIN SERVICE ==========
export const adminService = {
  // Get all admin dashboard data
  getAdminDashboardData: async () => {
    try {
      console.log('🔄 Loading admin dashboard data...');
      
      // Load all data
      const [usersSnap, campaignsSnap, payoutsSnap, submissionsSnap, reportsSnap, broadcastsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'campaigns')),
        getDocs(collection(db, 'payouts')),
        getDocs(collection(db, 'submissions')),
        getDocs(collection(db, 'reports')),
        getDocs(collection(db, 'broadcasts'))
      ]);

      const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
      const campaigns = campaignsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const payouts = payoutsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const submissions = submissionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const reports = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const broadcasts = broadcastsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
  }
};

// ========== COMPATIBILITY EXPORTS ==========
export const userService = {
  updateUserStatus: adminService.updateUserStatus,
};

export const campaignService = {
  createCampaign: adminService.createCampaign,
  updateCampaign: adminService.updateCampaign,
  toggleCampaignStatus: adminService.toggleCampaignStatus,
  deleteCampaign: adminService.deleteCampaign,
};

export const submissionService = {
  approveSubmission: adminService.approveSubmission,
  rejectSubmission: adminService.rejectSubmission,
};

export const payoutService = {
  approvePayout: adminService.approvePayout,
  rejectPayout: adminService.rejectPayout,
};

export const reportService = {
  resolveReport: adminService.resolveReport,
  deleteReport: adminService.deleteReport,
};
