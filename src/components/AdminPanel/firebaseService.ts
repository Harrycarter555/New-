import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, onSnapshot, serverTimestamp, where,
  getDoc, setDoc, increment, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  User, UserRole, UserStatus, Campaign, Submission, 
  PayoutRequest, Broadcast, UserReport, AppState,
  SubmissionStatus, PayoutStatus, Platform
} from '../../src/types';

// ========== USER MANAGEMENT ==========
export const userService = {
  // Get all users
  getUsers: async (): Promise<User[]> => {
    try {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const usersList: User[] = [];
      
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersList.push({
          id: doc.id,
          username: data.username || '',
          email: data.email || '',
          role: data.role || UserRole.USER,
          status: data.status || UserStatus.ACTIVE,
          walletBalance: data.walletBalance || 0,
          pendingBalance: data.pendingBalance || 0,
          totalEarnings: data.totalEarnings || 0,
          joinedAt: data.joinedAt || Date.now(),
          readBroadcastIds: data.readBroadcastIds || [],
          securityKey: data.securityKey || '',
          savedSocialUsername: data.savedSocialUsername || '',
          payoutMethod: data.payoutMethod,
          payoutDetails: data.payoutDetails,
          password: data.password,
          failedAttempts: data.failedAttempts || 0,
          lockoutUntil: data.lockoutUntil || 0,
        });
      });
      
      return usersList;
    } catch (error) {
      console.error('Error loading users:', error);
      throw error;
    }
  },

  // Update user status
  updateUserStatus: async (userId: string, status: UserStatus): Promise<void> => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  },

  // Update user balance
  updateUserBalance: async (userId: string, amount: number, type: 'add' | 'deduct'): Promise<void> => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) throw new Error('User not found');
      
      const userData = userSnap.data();
      const currentBalance = userData.walletBalance || 0;
      const currentEarnings = userData.totalEarnings || 0;
      
      const updates: any = {
        updatedAt: serverTimestamp()
      };
      
      if (type === 'add') {
        updates.walletBalance = currentBalance + amount;
        updates.totalEarnings = currentEarnings + amount;
      } else {
        updates.walletBalance = Math.max(0, currentBalance - amount);
      }
      
      await updateDoc(userRef, updates);
    } catch (error) {
      console.error('Error updating user balance:', error);
      throw error;
    }
  },

  // Real-time users listener
  onUsersUpdate: (callback: (users: User[]) => void) => {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList: User[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        usersList.push({
          id: doc.id,
          username: data.username || '',
          email: data.email || '',
          role: data.role || UserRole.USER,
          status: data.status || UserStatus.ACTIVE,
          walletBalance: data.walletBalance || 0,
          pendingBalance: data.pendingBalance || 0,
          totalEarnings: data.totalEarnings || 0,
          joinedAt: data.joinedAt || Date.now(),
          readBroadcastIds: data.readBroadcastIds || [],
          securityKey: data.securityKey || '',
          savedSocialUsername: data.savedSocialUsername || '',
          payoutMethod: data.payoutMethod,
          payoutDetails: data.payoutDetails,
          password: data.password,
          failedAttempts: data.failedAttempts || 0,
          lockoutUntil: data.lockoutUntil || 0,
        });
      });
      callback(usersList);
    });
  }
};

// ========== CAMPAIGN MANAGEMENT ==========
export const campaignService = {
  // Get all campaigns
  getCampaigns: async (): Promise<Campaign[]> => {
    try {
      const campaignsRef = collection(db, 'campaigns');
      const campaignsSnapshot = await getDocs(query(campaignsRef, orderBy('createdAt', 'desc')));
      const campaignsList: Campaign[] = [];
      
      campaignsSnapshot.forEach((doc) => {
        const data = doc.data();
        campaignsList.push({
          id: doc.id,
          title: data.title || '',
          videoUrl: data.videoUrl || '',
          thumbnailUrl: data.thumbnailUrl || '',
          caption: data.caption || '',
          hashtags: data.hashtags || '',
          audioName: data.audioName || '',
          goalViews: data.goalViews || 0,
          goalLikes: data.goalLikes || 0,
          basicPay: data.basicPay || 0,
          viralPay: data.viralPay || 0,
          active: data.active || false,
          bioLink: data.bioLink || '',
          createdAt: data.createdAt || Date.now(),
        });
      });
      
      return campaignsList;
    } catch (error) {
      console.error('Error loading campaigns:', error);
      throw error;
    }
  },

  // Create new campaign
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
  },

  // Update campaign
  updateCampaign: async (campaignId: string, updates: Partial<Campaign>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'campaigns', campaignId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
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

  // Real-time campaigns listener
  onCampaignsUpdate: (callback: (campaigns: Campaign[]) => void) => {
    return onSnapshot(
      query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), 
      (snapshot) => {
        const campaignsList: Campaign[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          campaignsList.push({
            id: doc.id,
            title: data.title || '',
            videoUrl: data.videoUrl || '',
            thumbnailUrl: data.thumbnailUrl || '',
            caption: data.caption || '',
            hashtags: data.hashtags || '',
            audioName: data.audioName || '',
            goalViews: data.goalViews || 0,
            goalLikes: data.goalLikes || 0,
            basicPay: data.basicPay || 0,
            viralPay: data.viralPay || 0,
            active: data.active || false,
            bioLink: data.bioLink || '',
            createdAt: data.createdAt?.toDate().getTime() || Date.now(),
          });
        });
        callback(campaignsList);
      }
    );
  }
};

// ========== SUBMISSION MANAGEMENT ==========
export const submissionService = {
  // Get all submissions
  getSubmissions: async (): Promise<Submission[]> => {
    try {
      const submissionsRef = collection(db, 'submissions');
      const submissionsSnapshot = await getDocs(query(submissionsRef, orderBy('timestamp', 'desc')));
      const submissionsList: Submission[] = [];
      
      submissionsSnapshot.forEach((doc) => {
        const data = doc.data();
        submissionsList.push({
          id: doc.id,
          userId: data.userId || '',
          username: data.username || '',
          socialUsername: data.socialUsername || '',
          campaignId: data.campaignId || '',
          campaignTitle: data.campaignTitle || '',
          platform: data.platform || Platform.INSTAGRAM,
          status: data.status || SubmissionStatus.PENDING,
          timestamp: data.timestamp?.toDate().getTime() || Date.now(),
          rewardAmount: data.rewardAmount || 0,
          externalLink: data.externalLink || '',
          approvedAt: data.approvedAt?.toDate().getTime(),
          rejectedAt: data.rejectedAt?.toDate().getTime(),
        });
      });
      
      return submissionsList;
    } catch (error) {
      console.error('Error loading submissions:', error);
      throw error;
    }
  },

  // Approve submission
  approveSubmission: async (submissionId: string, approverId: string): Promise<void> => {
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
        approvedBy: approverId,
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
      
    } catch (error) {
      console.error('Error approving submission:', error);
      throw error;
    }
  },

  // Reject submission
  rejectSubmission: async (submissionId: string, rejecterId: string): Promise<void> => {
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
        rejectedAt: serverTimestamp(),
        rejectedBy: rejecterId,
        updatedAt: serverTimestamp()
      });
      
      // Update user's pending balance
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pendingBalance: increment(-rewardAmount),
        updatedAt: serverTimestamp()
      });
      
    } catch (error) {
      console.error('Error rejecting submission:', error);
      throw error;
    }
  },

  // Real-time submissions listener
  onSubmissionsUpdate: (callback: (submissions: Submission[]) => void) => {
    return onSnapshot(
      query(collection(db, 'submissions'), orderBy('timestamp', 'desc')), 
      (snapshot) => {
        const submissionsList: Submission[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          submissionsList.push({
            id: doc.id,
            userId: data.userId || '',
            username: data.username || '',
            socialUsername: data.socialUsername || '',
            campaignId: data.campaignId || '',
            campaignTitle: data.campaignTitle || '',
            platform: data.platform || Platform.INSTAGRAM,
            status: data.status || SubmissionStatus.PENDING,
            timestamp: data.timestamp?.toDate().getTime() || Date.now(),
            rewardAmount: data.rewardAmount || 0,
            externalLink: data.externalLink || '',
            approvedAt: data.approvedAt?.toDate().getTime(),
            rejectedAt: data.rejectedAt?.toDate().getTime(),
          });
        });
        callback(submissionsList);
      }
    );
  }
};

// ========== PAYOUT MANAGEMENT ==========
export const payoutService = {
  // Get all payout requests
  getPayouts: async (): Promise<PayoutRequest[]> => {
    try {
      const payoutsRef = collection(db, 'payouts');
      const payoutsSnapshot = await getDocs(query(payoutsRef, orderBy('timestamp', 'desc')));
      const payoutsList: PayoutRequest[] = [];
      
      payoutsSnapshot.forEach((doc) => {
        const data = doc.data();
        payoutsList.push({
          id: doc.id,
          userId: data.userId || '',
          username: data.username || '',
          amount: data.amount || 0,
          method: data.method || 'UPI',
          status: data.status || PayoutStatus.PENDING,
          timestamp: data.timestamp?.toDate().getTime() || Date.now(),
          processedAt: data.processedAt?.toDate().getTime(),
          processedBy: data.processedBy,
        });
      });
      
      return payoutsList;
    } catch (error) {
      console.error('Error loading payouts:', error);
      throw error;
    }
  },

  // Approve payout
  approvePayout: async (payoutId: string, approverId: string): Promise<void> => {
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
        processedBy: approverId,
        updatedAt: serverTimestamp()
      });
      
      // Deduct from user's wallet
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        walletBalance: increment(-amount),
        updatedAt: serverTimestamp()
      });
      
    } catch (error) {
      console.error('Error approving payout:', error);
      throw error;
    }
  },

  // Reject payout
  rejectPayout: async (payoutId: string, rejecterId: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'payouts', payoutId), {
        status: PayoutStatus.REJECTED,
        processedAt: serverTimestamp(),
        processedBy: rejecterId,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error rejecting payout:', error);
      throw error;
    }
  },

  // Real-time payouts listener
  onPayoutsUpdate: (callback: (payouts: PayoutRequest[]) => void) => {
    return onSnapshot(
      query(collection(db, 'payouts'), orderBy('timestamp', 'desc')), 
      (snapshot) => {
        const payoutsList: PayoutRequest[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          payoutsList.push({
            id: doc.id,
            userId: data.userId || '',
            username: data.username || '',
            amount: data.amount || 0,
            method: data.method || 'UPI',
            status: data.status || PayoutStatus.PENDING,
            timestamp: data.timestamp?.toDate().getTime() || Date.now(),
            processedAt: data.processedAt?.toDate().getTime(),
            processedBy: data.processedBy,
          });
        });
        callback(payoutsList);
      }
    );
  }
};

// ========== REPORT MANAGEMENT ==========
export const reportService = {
  // Get all reports
  getReports: async (): Promise<UserReport[]> => {
    try {
      const reportsRef = collection(db, 'reports');
      const reportsSnapshot = await getDocs(query(reportsRef, orderBy('timestamp', 'desc')));
      const reportsList: UserReport[] = [];
      
      reportsSnapshot.forEach((doc) => {
        const data = doc.data();
        reportsList.push({
          id: doc.id,
          userId: data.userId || '',
          username: data.username || '',
          message: data.message || '',
          status: data.status || 'open',
          timestamp: data.timestamp?.toDate().getTime() || Date.now(),
          resolvedAt: data.resolvedAt?.toDate().getTime(),
        });
      });
      
      return reportsList;
    } catch (error) {
      console.error('Error loading reports:', error);
      throw error;
    }
  },

  // Resolve report
  resolveReport: async (reportId: string, resolverId: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: resolverId,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error resolving report:', error);
      throw error;
    }
  },

  // Delete report
  deleteReport: async (reportId: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'reports', reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  },

  // Real-time reports listener
  onReportsUpdate: (callback: (reports: UserReport[]) => void) => {
    return onSnapshot(
      query(collection(db, 'reports'), orderBy('timestamp', 'desc')), 
      (snapshot) => {
        const reportsList: UserReport[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          reportsList.push({
            id: doc.id,
            userId: data.userId || '',
            username: data.username || '',
            message: data.message || '',
            status: data.status || 'open',
            timestamp: data.timestamp?.toDate().getTime() || Date.now(),
            resolvedAt: data.resolvedAt?.toDate().getTime(),
          });
        });
        callback(reportsList);
      }
    );
  }
};

// ========== BROADCAST MANAGEMENT ==========
export const broadcastService = {
  // Get all broadcasts
  getBroadcasts: async (): Promise<Broadcast[]> => {
    try {
      const broadcastsRef = collection(db, 'broadcasts');
      const broadcastsSnapshot = await getDocs(query(broadcastsRef, orderBy('timestamp', 'desc')));
      const broadcastsList: Broadcast[] = [];
      
      broadcastsSnapshot.forEach((doc) => {
        const data = doc.data();
        broadcastsList.push({
          id: doc.id,
          content: data.content || '',
          senderId: data.senderId || '',
          targetUserId: data.targetUserId,
          timestamp: data.timestamp?.toDate().getTime() || Date.now(),
        });
      });
      
      return broadcastsList;
    } catch (error) {
      console.error('Error loading broadcasts:', error);
      throw error;
    }
  },

  // Create broadcast
  createBroadcast: async (broadcastData: { content: string; senderId: string; targetUserId?: string }): Promise<string> => {
    try {
      const broadcastRef = await addDoc(collection(db, 'broadcasts'), {
        content: broadcastData.content,
        senderId: broadcastData.senderId,
        targetUserId: broadcastData.targetUserId || null,
        timestamp: serverTimestamp(),
      });
      
      return broadcastRef.id;
    } catch (error) {
      console.error('Error creating broadcast:', error);
      throw error;
    }
  },

  // Real-time broadcasts listener
  onBroadcastsUpdate: (callback: (broadcasts: Broadcast[]) => void) => {
    return onSnapshot(
      query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc')), 
      (snapshot) => {
        const broadcastsList: Broadcast[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          broadcastsList.push({
            id: doc.id,
            content: data.content || '',
            senderId: data.senderId || '',
            targetUserId: data.targetUserId,
            timestamp: data.timestamp?.toDate().getTime() || Date.now(),
          });
        });
        callback(broadcastsList);
      }
    );
  }
};

// ========== CASHFLOW MANAGEMENT ==========
export const cashflowService = {
  // Get cashflow data
  getCashflow: async (): Promise<{ dailyLimit: number; todaySpent: number }> => {
    try {
      const cashflowRef = doc(db, 'system', 'cashflow');
      const cashflowSnap = await getDoc(cashflowRef);
      
      if (cashflowSnap.exists()) {
        const data = cashflowSnap.data();
        return {
          dailyLimit: data.dailyLimit || 100000,
          todaySpent: data.todaySpent || 0,
        };
      } else {
        // Create default cashflow document
        const defaultCashflow = {
          dailyLimit: 100000,
          todaySpent: 0,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          updatedAt: serverTimestamp(),
        };
        
        await setDoc(cashflowRef, defaultCashflow);
        return defaultCashflow;
      }
    } catch (error) {
      console.error('Error loading cashflow:', error);
      throw error;
    }
  },

  // Update daily limit
  updateDailyLimit: async (dailyLimit: number): Promise<void> => {
    try {
      await updateDoc(doc(db, 'system', 'cashflow'), {
        dailyLimit,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating daily limit:', error);
      throw error;
    }
  },

  // Reset today's spent
  resetTodaySpent: async (): Promise<void> => {
    try {
      await updateDoc(doc(db, 'system', 'cashflow'), {
        todaySpent: 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error resetting today spent:', error);
      throw error;
    }
  },

  // Update today's spent (when payout is approved)
  updateTodaySpent: async (amount: number): Promise<void> => {
    try {
      await updateDoc(doc(db, 'system', 'cashflow'), {
        todaySpent: increment(amount),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating today spent:', error);
      throw error;
    }
  },

  // Real-time cashflow listener
  onCashflowUpdate: (callback: (cashflow: { dailyLimit: number; todaySpent: number }) => void) => {
    return onSnapshot(doc(db, 'system', 'cashflow'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          dailyLimit: data.dailyLimit || 100000,
          todaySpent: data.todaySpent || 0,
        });
      }
    });
  }
};

// ========== STATISTICS ==========
export const statsService = {
  // Get dashboard statistics
  getDashboardStats: async () => {
    try {
      const [users, campaigns, payouts, submissions, reports] = await Promise.all([
        userService.getUsers(),
        campaignService.getCampaigns(),
        payoutService.getPayouts(),
        submissionService.getSubmissions(),
        reportService.getReports(),
      ]);

      const regularUsers = users.filter(u => u.role !== UserRole.ADMIN);
      const totalUsers = regularUsers.length;
      const activeUsers = regularUsers.filter(u => u.status === UserStatus.ACTIVE).length;
      const totalBalance = regularUsers.reduce((sum, u) => sum + u.walletBalance, 0);
      const totalPending = regularUsers.reduce((sum, u) => sum + u.pendingBalance, 0);
      const totalEarnings = regularUsers.reduce((sum, u) => sum + u.totalEarnings, 0);
      
      const pendingPayouts = payouts.filter(p => p.status === PayoutStatus.PENDING).length;
      const pendingPayoutsAmount = payouts.filter(p => p.status === PayoutStatus.PENDING).reduce((sum, p) => sum + p.amount, 0);
      
      const openReports = reports.filter(r => r.status === 'open').length;
      const activeCampaigns = campaigns.filter(c => c.active).length;
      
      const pendingSubmissions = submissions.filter(s => s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM).length;
      const pendingSubmissionsAmount = submissions.filter(s => s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM).reduce((sum, s) => sum + s.rewardAmount, 0);

      const cashflow = await cashflowService.getCashflow();
      const cashflowRemaining = cashflow.dailyLimit - cashflow.todaySpent;
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
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      throw error;
    }
  }
};
