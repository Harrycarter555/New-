// src/components/AdminPanel.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  collection, getDocs, updateDoc, doc, query, orderBy, 
  addDoc, deleteDoc, onSnapshot, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserRole, UserStatus, AppState, Campaign, PayoutRequest, Broadcast, UserReport } from '../types';
import { ICONS } from '../utils/constants';

interface AdminPanelProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  currentUser: User;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type AdminTab = 'dashboard' | 'members' | 'campaigns' | 'payouts' | 'broadcasts' | 'reports';

const AdminPanel: React.FC<AdminPanelProps> = ({ appState, setAppState, currentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  
  // New campaign form
  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
    title: '',
    description: '',
    requirements: ['Follow account', 'Use hashtags'],
    reward: 100,
    duration: 7,
    active: true,
    tags: ['trending', 'viral'],
  });

  // New broadcast form
  const [newBroadcast, setNewBroadcast] = useState<Partial<Broadcast>>({
    title: '',
    message: '',
    targetUserId: '',
  });

  // Check admin permission
  if (currentUser.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-10">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ICONS.X className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">ACCESS DENIED</h2>
          <p className="text-slate-400">Admin privileges required</p>
        </div>
      </div>
    );
  }

  // ========== FIREBASE FUNCTIONS ==========

  // Load all users from Firestore
  const loadUsers = async () => {
    try {
      setLoading(true);
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
          lockoutUntil: data.lockoutUntil,
        });
      });

      setUsers(usersList);
      console.log(`Loaded ${usersList.length} users from Firestore`);
    } catch (error: any) {
      console.error('Error loading users:', error);
      showToast(error.message || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load campaigns from Firestore
  const loadCampaigns = async () => {
    try {
      const campaignsRef = collection(db, 'campaigns');
      const campaignsSnapshot = await getDocs(query(campaignsRef, orderBy('createdAt', 'desc')));
      
      const campaignsList: Campaign[] = [];
      campaignsSnapshot.forEach((doc) => {
        const data = doc.data();
        campaignsList.push({
          id: doc.id,
          title: data.title || '',
          description: data.description || '',
          requirements: data.requirements || [],
          reward: data.reward || 0,
          duration: data.duration || 7,
          active: data.active || false,
          tags: data.tags || [],
          createdAt: data.createdAt || Date.now(),
        });
      });

      setCampaigns(campaignsList);
      console.log(`Loaded ${campaignsList.length} campaigns`);
    } catch (error: any) {
      console.error('Error loading campaigns:', error);
    }
  };

  // Load payouts from Firestore
  const loadPayouts = async () => {
    try {
      const payoutsRef = collection(db, 'payouts');
      const payoutsSnapshot = await getDocs(query(payoutsRef, orderBy('requestedAt', 'desc')));
      
      const payoutsList: PayoutRequest[] = [];
      payoutsSnapshot.forEach((doc) => {
        const data = doc.data();
        payoutsList.push({
          id: doc.id,
          userId: data.userId || '',
          username: data.username || '',
          amount: data.amount || 0,
          method: data.method || 'upi',
          status: data.status || 'pending',
          requestedAt: data.requestedAt || Date.now(),
          processedAt: data.processedAt,
        });
      });

      setPayouts(payoutsList);
    } catch (error: any) {
      console.error('Error loading payouts:', error);
    }
  };

  // Load reports from Firestore
  const loadReports = async () => {
    try {
      const reportsRef = collection(db, 'reports');
      const reportsSnapshot = await getDocs(query(reportsRef, orderBy('createdAt', 'desc')));
      
      const reportsList: UserReport[] = [];
      reportsSnapshot.forEach((doc) => {
        const data = doc.data();
        reportsList.push({
          id: doc.id,
          userId: data.userId || '',
          reporterId: data.reporterId || '',
          username: data.username || '',
          reason: data.reason || '',
          status: data.status || 'open',
          createdAt: data.createdAt || Date.now(),
          resolvedAt: data.resolvedAt,
        });
      });

      setReports(reportsList);
    } catch (error: any) {
      console.error('Error loading reports:', error);
    }
  };

  // Load broadcasts from Firestore
  const loadBroadcasts = async () => {
    try {
      const broadcastsRef = collection(db, 'broadcasts');
      const broadcastsSnapshot = await getDocs(query(broadcastsRef, orderBy('createdAt', 'desc')));
      
      const broadcastsList: Broadcast[] = [];
      broadcastsSnapshot.forEach((doc) => {
        const data = doc.data();
        broadcastsList.push({
          id: doc.id,
          title: data.title || '',
          message: data.message || '',
          targetUserId: data.targetUserId,
          createdAt: data.createdAt || Date.now(),
        });
      });

      setBroadcasts(broadcastsList);
    } catch (error: any) {
      console.error('Error loading broadcasts:', error);
    }
  };

  // Real-time listeners
  useEffect(() => {
    // Users real-time listener
    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
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
          lockoutUntil: data.lockoutUntil,
        });
      });
      setUsers(usersList);
    });

    // Campaigns real-time listener
    const campaignsUnsubscribe = onSnapshot(
      query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), 
      (snapshot) => {
        const campaignsList: Campaign[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          campaignsList.push({
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            requirements: data.requirements || [],
            reward: data.reward || 0,
            duration: data.duration || 7,
            active: data.active || false,
            tags: data.tags || [],
            createdAt: data.createdAt || Date.now(),
          });
        });
        setCampaigns(campaignsList);
      }
    );

    return () => {
      usersUnsubscribe();
      campaignsUnsubscribe();
    };
  }, []);

  // Load data based on active tab
  useEffect(() => {
    switch (activeTab) {
      case 'members':
        loadUsers();
        break;
      case 'campaigns':
        loadCampaigns();
        break;
      case 'payouts':
        loadPayouts();
        break;
      case 'reports':
        loadReports();
        break;
      case 'broadcasts':
        loadBroadcasts();
        break;
    }
  }, [activeTab]);

  // ========== ADMIN ACTIONS ==========

  // Toggle user status (Active/Suspended)
  const toggleUserStatus = async (user: User) => {
    try {
      const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
      
      await updateDoc(doc(db, 'users', user.id), { 
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      showToast(`User ${newStatus === UserStatus.ACTIVE ? 'activated' : 'suspended'}`, 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // Update user wallet balance
  const updateUserBalance = async (userId: string, amount: number, type: 'add' | 'deduct') => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) {
        showToast('User not found', 'error');
        return;
      }

      const newBalance = type === 'add' 
        ? user.walletBalance + amount 
        : Math.max(0, user.walletBalance - amount);

      await updateDoc(doc(db, 'users', userId), { 
        walletBalance: newBalance,
        totalEarnings: type === 'add' ? user.totalEarnings + amount : user.totalEarnings,
        updatedAt: serverTimestamp()
      });

      showToast(`Balance ${type === 'add' ? 'added' : 'deducted'}: ₹${amount}`, 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // Create new campaign
  const handleCreateCampaign = async () => {
    if (!newCampaign.title || !newCampaign.description) {
      showToast('Title and description are required', 'error');
      return;
    }

    try {
      const campaignData = {
        title: newCampaign.title,
        description: newCampaign.description,
        requirements: newCampaign.requirements || [],
        reward: newCampaign.reward || 100,
        duration: newCampaign.duration || 7,
        active: newCampaign.active || true,
        tags: newCampaign.tags || [],
        createdAt: serverTimestamp(),
        createdBy: currentUser.id,
      };

      const docRef = await addDoc(collection(db, 'campaigns'), campaignData);
      
      showToast(`Campaign "${newCampaign.title}" created`, 'success');
      
      // Reset form
      setNewCampaign({
        title: '',
        description: '',
        requirements: ['Follow account', 'Use hashtags'],
        reward: 100,
        duration: 7,
        active: true,
        tags: ['trending', 'viral'],
      });
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // Toggle campaign active status
  const toggleCampaignStatus = async (campaignId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'campaigns', campaignId), { 
        active: !currentStatus,
        updatedAt: serverTimestamp()
      });
      
      showToast(`Campaign ${!currentStatus ? 'activated' : 'deactivated'}`, 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // Delete campaign
  const deleteCampaign = async (campaignId: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await deleteDoc(doc(db, 'campaigns', campaignId));
      showToast('Campaign deleted', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // Approve payout
  const approvePayout = async (payoutId: string) => {
    try {
      const payout = payouts.find(p => p.id === payoutId);
      if (!payout) {
        showToast('Payout not found', 'error');
        return;
      }

      // Update payout status
      await updateDoc(doc(db, 'payouts', payoutId), { 
        status: 'approved',
        processedAt: serverTimestamp(),
        processedBy: currentUser.id
      });

      // Deduct from user's wallet
      const user = users.find(u => u.id === payout.userId);
      if (user) {
        const newBalance = Math.max(0, user.walletBalance - payout.amount);
        await updateDoc(doc(db, 'users', payout.userId), { 
          walletBalance: newBalance,
          updatedAt: serverTimestamp()
        });
      }

      showToast(`Approved ₹${payout.amount} payout`, 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // Reject payout
  const rejectPayout = async (payoutId: string) => {
    try {
      await updateDoc(doc(db, 'payouts', payoutId), { 
        status: 'rejected',
        processedAt: serverTimestamp(),
        processedBy: currentUser.id
      });

      showToast('Payout rejected', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // Create broadcast message
  const createBroadcast = async () => {
    if (!newBroadcast.title || !newBroadcast.message) {
      showToast('Title and message are required', 'error');
      return;
    }

    try {
      const broadcastData = {
        title: newBroadcast.title,
        message: newBroadcast.message,
        targetUserId: newBroadcast.targetUserId || '',
        createdAt: serverTimestamp(),
        createdBy: currentUser.id,
      };

      await addDoc(collection(db, 'broadcasts'), broadcastData);
      
      showToast('Broadcast sent to users', 'success');
      
      // Reset form
      setNewBroadcast({
        title: '',
        message: '',
        targetUserId: '',
      });
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // Resolve report
  const resolveReport = async (reportId: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { 
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: currentUser.id
      });

      showToast('Report marked as resolved', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // Delete report
  const deleteReport = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      showToast('Report deleted', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  // ========== UI HELPER FUNCTIONS ==========

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users.filter(u => u.role !== UserRole.ADMIN);
    return users.filter(user =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
    ).filter(u => u.role !== UserRole.ADMIN);
  }, [users, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const regularUsers = users.filter(u => u.role !== UserRole.ADMIN);
    const totalUsers = regularUsers.length;
    const activeUsers = regularUsers.filter(u => u.status === UserStatus.ACTIVE).length;
    const totalEarnings = regularUsers.reduce((sum, u) => sum + u.totalEarnings, 0);
    const pendingPayouts = payouts.filter(p => p.status === 'pending').length;
    const openReports = reports.filter(r => r.status === 'open').length;
    const activeCampaigns = campaigns.filter(c => c.active).length;
    const totalPayouts = payouts.filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalUsers,
      activeUsers,
      totalEarnings,
      pendingPayouts,
      openReports,
      activeCampaigns,
      totalPayouts
    };
  }, [users, campaigns, payouts, reports]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate days since joined
  const getDaysSince = (timestamp: number): number => {
    const diff = Date.now() - timestamp;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // ========== RENDER FUNCTIONS ==========

  // Render dashboard tab
  const renderDashboard = () => (
    <div className="space-y-8 animate-slide">
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-6 rounded-3xl border-t-4 border-cyan-500">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Total Users</p>
          <p className="text-4xl font-black text-white">{stats.totalUsers}</p>
          <p className="text-[9px] text-green-500 font-black mt-2">
            {stats.activeUsers} active • {stats.totalUsers - stats.activeUsers} suspended
          </p>
        </div>
        
        <div className="glass-panel p-6 rounded-3xl border-t-4 border-blue-500">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Total Earnings</p>
          <p className="text-4xl font-black text-white">{formatCurrency(stats.totalEarnings)}</p>
          <p className="text-[9px] text-cyan-500 font-black mt-2">Platform revenue</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase">Pending Payouts</p>
          <p className="text-xl font-black text-yellow-500">{stats.pendingPayouts}</p>
          <p className="text-[7px] text-slate-500">{formatCurrency(payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0))}</p>
        </div>
        
        <div className="glass-panel p-4 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase">Open Reports</p>
          <p className="text-xl font-black text-red-500">{stats.openReports}</p>
        </div>
        
        <div className="glass-panel p-4 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase">Active Campaigns</p>
          <p className="text-xl font-black text-green-500">{stats.activeCampaigns}</p>
        </div>
      </div>

      {/* Recent Users */}
      <div className="glass-panel p-6 rounded-3xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-white">Recent Users</h3>
          <button 
            onClick={loadUsers}
            className="text-[10px] text-cyan-400 font-black"
          >
            REFRESH
          </button>
        </div>
        <div className="space-y-3">
          {users.filter(u => u.role !== UserRole.ADMIN).slice(0, 5).map(user => (
            <div key={user.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cyan-500/10 rounded-full flex items-center justify-center">
                  <span className="text-cyan-500 text-xs font-black">{user.username[0].toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-[10px] font-black text-white">@{user.username}</p>
                  <p className="text-[8px] text-slate-500">{getDaysSince(user.joinedAt)} days ago</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-white">{formatCurrency(user.walletBalance)}</p>
                <span className={`text-[8px] px-2 py-1 rounded-full ${
                  user.status === UserStatus.ACTIVE
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-red-500/20 text-red-500'
                }`}>
                  {user.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render members tab (CONTINUED IN NEXT MESSAGE - TOO LONG)
  // ... (बाकी code यही रहेगा, बस Firestore functions connected हैं)
  };

export default AdminPanel;
