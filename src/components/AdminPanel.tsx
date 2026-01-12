// src/components/AdminPanel.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserRole, UserStatus, AppState, Campaign, PayoutRequest } from '../types';
import { ICONS } from '../utils/constants';

interface AdminPanelProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  currentUser: User;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type AdminTab = 'dashboard' | 'members' | 'campaigns' | 'payouts' | 'messages' | 'reports';

const AdminPanel: React.FC<AdminPanelProps> = ({ appState, setAppState, currentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
    title: '',
    videoUrl: '',
    thumbnailUrl: '',
    caption: '',
    hashtags: '',
    audioName: '',
    goalViews: 5000,
    goalLikes: 500,
    basicPay: 50,
    viralPay: 500,
    active: true,
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

  // Load all users
  const loadUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'users'));
      const userList: User[] = snap.docs.map(d => ({
        ...(d.data() as User),
        id: d.id,
        readBroadcastIds: (d.data() as User).readBroadcastIds || [],
      })).filter(u => u.role !== UserRole.ADMIN);
      setUsers(userList);
    } catch (e: any) {
      console.error('Error loading users:', e);
      showToast(e.message || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Load data on tab change
  useEffect(() => {
    if (activeTab === 'members') {
      loadUsers();
    }
  }, [activeTab]);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter(user =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === UserStatus.ACTIVE).length;
    const totalEarnings = users.reduce((sum, u) => sum + u.totalEarnings, 0);
    const pendingPayouts = appState.payoutRequests.filter(p => p.status === 'pending').length;
    const openReports = appState.reports.filter(r => r.status === 'open').length;
    const activeCampaigns = appState.campaigns.filter(c => c.active).length;

    return {
      totalUsers,
      activeUsers,
      totalEarnings,
      pendingPayouts,
      openReports,
      activeCampaigns
    };
  }, [users, appState]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Format date
  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Toggle user status
  const toggleUserStatus = async (user: User) => {
    try {
      const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
      await updateDoc(doc(db, 'users', user.id), { status: newStatus });
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === user.id ? { ...u, status: newStatus } : u
      ));
      
      showToast(`User ${newStatus === UserStatus.ACTIVE ? 'activated' : 'suspended'}`, 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Create new campaign
  const handleCreateCampaign = async () => {
    if (!newCampaign.title || !newCampaign.videoUrl) {
      showToast('Title and video URL are required', 'error');
      return;
    }

    try {
      const campaign: Campaign = {
        id: `camp-${Date.now()}`,
        title: newCampaign.title!,
        videoUrl: newCampaign.videoUrl!,
        thumbnailUrl: newCampaign.thumbnailUrl || newCampaign.videoUrl!,
        caption: newCampaign.caption!,
        hashtags: newCampaign.hashtags!,
        audioName: newCampaign.audioName!,
        goalViews: newCampaign.goalViews!,
        goalLikes: newCampaign.goalLikes!,
        basicPay: newCampaign.basicPay!,
        viralPay: newCampaign.viralPay!,
        active: newCampaign.active!,
        bioLink: newCampaign.bioLink,
      };

      setAppState(prev => ({
        ...prev,
        campaigns: [campaign, ...prev.campaigns]
      }));

      setNewCampaign({
        title: '',
        videoUrl: '',
        thumbnailUrl: '',
        caption: '',
        hashtags: '',
        audioName: '',
        goalViews: 5000,
        goalLikes: 500,
        basicPay: 50,
        viralPay: 500,
        active: true,
      });

      showToast('Campaign created successfully', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Approve payout
  const approvePayout = async (payoutId: string) => {
    try {
      const payout = appState.payoutRequests.find(p => p.id === payoutId);
      if (!payout) return;

      // Update user balance
      const user = users.find(u => u.id === payout.userId);
      if (user && user.walletBalance >= payout.amount) {
        await updateDoc(doc(db, 'users', payout.userId), {
          walletBalance: user.walletBalance - payout.amount
        });

        // Update local state
        setAppState(prev => ({
          ...prev,
          payoutRequests: prev.payoutRequests.map(p =>
            p.id === payoutId ? { ...p, status: 'approved' } : p
          )
        }));

        showToast(`Approved ₹${payout.amount} payout for ${payout.username}`, 'success');
      } else {
        showToast('Insufficient balance', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Resolve report
  const resolveReport = async (reportId: string) => {
    try {
      setAppState(prev => ({
        ...prev,
        reports: prev.reports.map(r =>
          r.id === reportId ? { ...r, status: 'resolved' } : r
        )
      }));
      showToast('Report marked as resolved', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

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

      <div className="glass-panel p-6 rounded-3xl">
        <h3 className="text-lg font-black text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {appState.logs.slice(0, 5).map(log => (
            <div key={log.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
              <div>
                <p className="text-[10px] font-black text-white">{log.message}</p>
                <p className="text-[8px] text-slate-500">{formatDate(log.timestamp)}</p>
              </div>
              <span className="text-[8px] px-2 py-1 bg-slate-800 rounded-full">{log.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render members tab
  const renderMembers = () => (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search users by name, email, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white text-sm outline-none"
          />
        </div>
        <button
          onClick={loadUsers}
          className="p-3 bg-white/5 rounded-2xl border border-white/10 active:scale-95"
        >
          <ICONS.User className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-slate-600">No users found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map(user => (
            <div key={user.id} className="glass-panel p-5 rounded-3xl">
              <div className="flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-cyan-500/10 rounded-full flex items-center justify-center">
                      <span className="text-cyan-500 font-black">{user.username[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-black text-white">@{user.username}</p>
                      <p className="text-[10px] text-slate-500">{user.email}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-[8px] px-2 py-1 rounded-full ${
                          user.status === UserStatus.ACTIVE
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}>
                          {user.status}
                        </span>
                        <span className="text-[8px] px-2 py-1 bg-slate-800 rounded-full">
                          Balance: {formatCurrency(user.walletBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleUserStatus(user)}
                    className={`px-4 py-2 rounded-xl text-xs font-black ${
                      user.status === UserStatus.ACTIVE
                        ? 'bg-red-600/20 text-red-300'
                        : 'bg-green-600/20 text-green-300'
                    }`}
                  >
                    {user.status === UserStatus.ACTIVE ? 'Suspend' : 'Activate'}
                  </button>
                  <button
                    onClick={() => setSelectedUserId(user.id)}
                    className="px-4 py-2 bg-white/5 rounded-xl text-xs font-black text-white"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render campaigns tab
  const renderCampaigns = () => (
    <div className="space-y-8">
      <div className="glass-panel p-6 rounded-3xl">
        <h3 className="text-lg font-black text-white mb-4">Create New Campaign</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Campaign Title"
              value={newCampaign.title}
              onChange={(e) => setNewCampaign(prev => ({ ...prev, title: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm"
            />
            <input
              type="text"
              placeholder="Video URL"
              value={newCampaign.videoUrl}
              onChange={(e) => setNewCampaign(prev => ({ ...prev, videoUrl: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm"
            />
          </div>
          
          <input
            type="text"
            placeholder="Caption (required text)"
            value={newCampaign.caption}
            onChange={(e) => setNewCampaign(prev => ({ ...prev, caption: e.target.value }))}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="Goal Views"
              value={newCampaign.goalViews}
              onChange={(e) => setNewCampaign(prev => ({ ...prev, goalViews: parseInt(e.target.value) || 0 }))}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm"
            />
            <input
              type="number"
              placeholder="Goal Likes"
              value={newCampaign.goalLikes}
              onChange={(e) => setNewCampaign(prev => ({ ...prev, goalLikes: parseInt(e.target.value) || 0 }))}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="Basic Pay"
              value={newCampaign.basicPay}
              onChange={(e) => setNewCampaign(prev => ({ ...prev, basicPay: parseInt(e.target.value) || 0 }))}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm"
            />
            <input
              type="number"
              placeholder="Viral Pay"
              value={newCampaign.viralPay}
              onChange={(e) => setNewCampaign(prev => ({ ...prev, viralPay: parseInt(e.target.value) || 0 }))}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm"
            />
          </div>
          
          <button
            onClick={handleCreateCampaign}
            className="w-full py-4 bg-cyan-500 text-black rounded-2xl font-black uppercase tracking-widest"
          >
            Create Campaign
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-black text-white mb-4">Active Campaigns</h3>
        <div className="space-y-4">
          {appState.campaigns.filter(c => c.active).map(campaign => (
            <div key={campaign.id} className="glass-panel p-5 rounded-3xl">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-black text-white">{campaign.title}</p>
                  <p className="text-[10px] text-slate-500">Reward: {formatCurrency(campaign.basicPay)} - {formatCurrency(campaign.viralPay)}</p>
                </div>
                <span className="text-[10px] px-3 py-1 bg-green-500/20 text-green-500 rounded-full">Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render payouts tab
  const renderPayouts = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-black text-white">Pending Payouts</h3>
      {appState.payoutRequests.filter(p => p.status === 'pending').length === 0 ? (
        <div className="text-center py-10">
          <p className="text-slate-600">No pending payouts</p>
        </div>
      ) : (
        appState.payoutRequests.filter(p => p.status === 'pending').map(payout => (
          <div key={payout.id} className="glass-panel p-5 rounded-3xl">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-black text-white">@{payout.username}</p>
                <p className="text-[10px] text-slate-500">{formatCurrency(payout.amount)} • {payout.method}</p>
                <p className="text-[8px] text-slate-600">{formatDate(payout.timestamp)}</p>
              </div>
              <button
                onClick={() => approvePayout(payout.id)}
                className="px-4 py-2 bg-green-500 text-black rounded-xl text-xs font-black"
              >
                Approve
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // Render reports tab
  const renderReports = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-black text-white">User Reports</h3>
      {appState.reports.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-slate-600">No reports</p>
        </div>
      ) : (
        appState.reports.map(report => (
          <div key={report.id} className="glass-panel p-5 rounded-3xl">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-black text-white">@{report.username}</p>
                <p className="text-[10px] text-slate-500">{formatDate(report.timestamp)}</p>
              </div>
              <span className={`text-[10px] px-3 py-1 rounded-full ${
                report.status === 'open' 
                  ? 'bg-yellow-500/20 text-yellow-500' 
                  : 'bg-green-500/20 text-green-500'
              }`}>
                {report.status}
              </span>
            </div>
            <p className="text-sm text-slate-300 mb-4">{report.message}</p>
            {report.status === 'open' && (
              <button
                onClick={() => resolveReport(report.id)}
                className="px-4 py-2 bg-cyan-500 text-black rounded-xl text-xs font-black"
              >
                Mark as Resolved
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-10 pb-40 animate-slide">
      <div className="text-center">
        <h2 className="text-4xl font-black italic px-2 text-white uppercase leading-none">
          ADMIN<br />
          <span className="text-cyan-400">CONTROL PANEL</span>
        </h2>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 italic">
          Logged in as: @{currentUser.username}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-white/5 p-2 rounded-3xl border border-white/10 overflow-x-auto hide-scrollbar sticky top-0 z-10 backdrop-blur-md">
        {(['dashboard', 'members', 'campaigns', 'payouts', 'reports'] as AdminTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap flex-1 px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${
              activeTab === tab ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'members' && renderMembers()}
        {activeTab === 'campaigns' && renderCampaigns()}
        {activeTab === 'payouts' && renderPayouts()}
        {activeTab === 'reports' && renderReports()}
      </div>

      {/* Quick Stats Footer */}
      <div className="fixed bottom-20 left-4 right-4 glass-panel p-4 rounded-3xl border border-white/10">
        <div className="flex justify-between text-center">
          <div>
            <p className="text-[8px] text-slate-500 uppercase">Users</p>
            <p className="text-sm font-black text-white">{stats.totalUsers}</p>
          </div>
          <div>
            <p className="text-[8px] text-slate-500 uppercase">Payouts</p>
            <p className="text-sm font-black text-yellow-500">{stats.pendingPayouts}</p>
          </div>
          <div>
            <p className="text-[8px] text-slate-500 uppercase">Reports</p>
            <p className="text-sm font-black text-red-500">{stats.openReports}</p>
          </div>
          <div>
            <p className="text-[8px] text-slate-500 uppercase">Revenue</p>
            <p className="text-sm font-black text-green-500">{formatCurrency(stats.totalEarnings)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
