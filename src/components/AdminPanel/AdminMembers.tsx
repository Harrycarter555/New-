import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, UserStatus } from '../../types';
import { ICONS } from '../../utils/constants';
import { userService } from './firebaseService';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  limit,
  doc,
  getDoc 
} from 'firebase/firestore';
import { db } from '../../firebase';

interface AdminMembersProps {
  users: User[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

interface UserLog {
  id: string;
  userId: string;
  username?: string;
  type: 'auth' | 'verify' | 'payout' | 'viral' | 'system' | 'admin' | 'transaction';
  message: string;
  timestamp: number;
  details?: Record<string, any>;
}

interface UserSubmission {
  id: string;
  campaignId: string;
  campaignTitle: string;
  status: string;
  rewardAmount: number;
  timestamp: number;
}

interface UserPayout {
  id: string;
  amount: number;
  method: string;
  status: string;
  timestamp: number;
}

const AdminMembers: React.FC<AdminMembersProps> = ({ users, showToast }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<UserSubmission[]>([]);
  const [userPayouts, setUserPayouts] = useState<UserPayout[]>([]);
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    totalEarned: 0,
    totalPayouts: 0,
    totalWithdrawn: 0,
    pendingSubmissions: 0
  });

  const regularUsers = useMemo(() => {
    return users.filter(u => u.role !== UserRole.ADMIN);
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return regularUsers;
    const query = searchQuery.toLowerCase();
    return regularUsers.filter(user =>
      user.username.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query) ||
      user.savedSocialUsername?.toLowerCase().includes(query)
    );
  }, [regularUsers, searchQuery]);

  // Load user details when selected
  useEffect(() => {
    const loadUserDetails = async () => {
      if (!selectedUser) return;

      setLoadingLogs(true);
      setLoadingSubmissions(true);
      setLoadingPayouts(true);

      try {
        // Load user logs
        const logsRef = collection(db, 'logs');
        const logsQuery = query(
          logsRef,
          where('userId', '==', selectedUser.id),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const logsSnapshot = await getDocs(logsQuery);
        const logs: UserLog[] = [];
        logsSnapshot.forEach(doc => {
          const data = doc.data();
          logs.push({
            id: doc.id,
            userId: data.userId,
            username: data.username,
            type: data.type || 'system',
            message: data.message,
            timestamp: data.timestamp?.toDate().getTime() || Date.now(),
            details: data.details
          });
        });
        setUserLogs(logs);

        // Load user submissions
        const submissionsRef = collection(db, 'submissions');
        const submissionsQuery = query(
          submissionsRef,
          where('userId', '==', selectedUser.id),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        const submissions: UserSubmission[] = [];
        submissionsSnapshot.forEach(doc => {
          const data = doc.data();
          submissions.push({
            id: doc.id,
            campaignId: data.campaignId,
            campaignTitle: data.campaignTitle || 'Unknown Campaign',
            status: data.status,
            rewardAmount: data.rewardAmount || 0,
            timestamp: data.timestamp?.toDate().getTime() || Date.now()
          });
        });
        setUserSubmissions(submissions);

        // Load user payouts
        const payoutsRef = collection(db, 'payouts');
        const payoutsQuery = query(
          payoutsRef,
          where('userId', '==', selectedUser.id),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const payoutsSnapshot = await getDocs(payoutsQuery);
        const payouts: UserPayout[] = [];
        payoutsSnapshot.forEach(doc => {
          const data = doc.data();
          payouts.push({
            id: doc.id,
            amount: data.amount || 0,
            method: data.method || 'Unknown',
            status: data.status || 'pending',
            timestamp: data.timestamp?.toDate().getTime() || Date.now()
          });
        });
        setUserPayouts(payouts);

        // Calculate stats
        const totalSubmissions = submissions.length;
        const totalEarned = submissions
          .filter(s => s.status === 'approved')
          .reduce((sum, s) => sum + s.rewardAmount, 0);
        const totalPayouts = payouts.length;
        const totalWithdrawn = payouts
          .filter(p => p.status === 'approved')
          .reduce((sum, p) => sum + p.amount, 0);
        const pendingSubmissions = submissions.filter(s => s.status === 'pending').length;

        setStats({
          totalSubmissions,
          totalEarned,
          totalPayouts,
          totalWithdrawn,
          pendingSubmissions
        });

      } catch (error) {
        console.error('Error loading user details:', error);
        showToast('Failed to load user details', 'error');
      } finally {
        setLoadingLogs(false);
        setLoadingSubmissions(false);
        setLoadingPayouts(false);
      }
    };

    if (selectedUser && userDetailsOpen) {
      loadUserDetails();
    }
  }, [selectedUser, userDetailsOpen, showToast]);

  const toggleUserStatus = async (userId: string, currentStatus: UserStatus) => {
    try {
      const newStatus = currentStatus === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
      await userService.updateUserStatus(userId, newStatus);
      showToast(`User ${newStatus === UserStatus.ACTIVE ? 'activated' : 'suspended'}`, 'success');
      
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({
          ...selectedUser,
          status: newStatus
        });
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to update user status', 'error');
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount?.toLocaleString('en-IN') || '0'}`;
  };

  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFullDate = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLogTypeColor = (type: string): string => {
    switch (type) {
      case 'auth': return 'bg-blue-500/20 text-blue-400';
      case 'verify': return 'bg-green-500/20 text-green-400';
      case 'payout': return 'bg-amber-500/20 text-amber-400';
      case 'viral': return 'bg-purple-500/20 text-purple-400';
      case 'admin': return 'bg-red-500/20 text-red-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'auth': return <ICONS.Lock className="w-4 h-4" />;
      case 'verify': return <ICONS.CheckCircle className="w-4 h-4" />;
      case 'payout': return <ICONS.Coins className="w-4 h-4" />;
      case 'viral': return <ICONS.Fire className="w-4 h-4" />;
      case 'admin': return <ICONS.Shield className="w-4 h-4" />;
      default: return <ICONS.Info className="w-4 h-4" />;
    }
  };

  const calculateActivityScore = (user: User): number => {
    if (!user.lastLoginAt) return 0;
    
    const daysSinceLogin = (Date.now() - user.lastLoginAt) / (1000 * 60 * 60 * 24);
    let score = 0;
    
    if (daysSinceLogin < 1) score = 90;
    else if (daysSinceLogin < 7) score = 70;
    else if (daysSinceLogin < 30) score = 50;
    else if (daysSinceLogin < 90) score = 30;
    else score = 10;
    
    return score;
  };

  const getActivityLevel = (score: number): string => {
    if (score >= 80) return 'Very Active';
    if (score >= 60) return 'Active';
    if (score >= 40) return 'Moderate';
    if (score >= 20) return 'Low';
    return 'Inactive';
  };

  const getActivityColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-cyan-400';
    if (score >= 40) return 'text-yellow-400';
    if (score >= 20) return 'text-orange-400';
    return 'text-red-400';
  };

  const handleCopySecurityKey = () => {
    if (!selectedUser?.securityKey) return;
    
    navigator.clipboard.writeText(selectedUser.securityKey)
      .then(() => showToast('Security key copied to clipboard', 'success'))
      .catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = selectedUser.securityKey;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Security key copied', 'success');
      });
  };

  return (
    <div className="space-y-6 p-4">
      {/* Search Bar */}
      <div className="bg-black/50 border border-slate-800 p-4 rounded-xl">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <ICONS.Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search users by username, email, ID or social username..."
              className="w-full bg-black/30 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-sm text-slate-400 font-bold">
            {filteredUsers.length} users
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 bg-black/30 rounded-xl border border-slate-800">
            <ICONS.Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 text-sm font-bold">
              {searchQuery ? 'No users found' : 'No users available'}
            </p>
          </div>
        ) : (
          filteredUsers.map(user => {
            const activityScore = calculateActivityScore(user);
            
            return (
              <div 
                key={user.id} 
                className="bg-black/30 border border-slate-800 p-4 rounded-xl hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all cursor-pointer"
                onClick={() => {
                  setSelectedUser(user);
                  setUserDetailsOpen(true);
                }}
              >
                <div className="flex items-center justify-between">
                  {/* User Info Left */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                      <span className="text-cyan-400 text-lg font-bold">
                        {user.username?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-base font-bold text-white truncate">
                          @{user.username}
                        </h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          user.status === UserStatus.ACTIVE
                            ? 'bg-green-500/20 text-green-400'
                            : user.status === UserStatus.SUSPENDED
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {user.status}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-400 truncate max-w-[200px]">
                        {user.email}
                      </p>
                      
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-500">
                          Joined: {formatDate(user.joinedAt)}
                        </span>
                        <span className={`text-xs ${getActivityColor(activityScore)}`}>
                          {getActivityLevel(activityScore)}
                        </span>
                        {user.savedSocialUsername && (
                          <span className="text-xs text-cyan-400">
                            {user.savedSocialUsername}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* User Info Right */}
                  <div className="text-right">
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-white">
                        {formatCurrency(user.walletBalance)}
                      </p>
                      <p className="text-xs text-cyan-400">
                        Available
                      </p>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUser(user);
                        setUserDetailsOpen(true);
                      }}
                      className="mt-2 text-xs px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg font-bold hover:bg-cyan-500/20 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && userDetailsOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-slate-800 w-full max-w-6xl rounded-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-black/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">User Details - @{selectedUser.username}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      selectedUser.status === UserStatus.ACTIVE
                        ? 'bg-green-500/20 text-green-400'
                        : selectedUser.status === UserStatus.SUSPENDED
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {selectedUser.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      User ID: {selectedUser.id}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setUserDetailsOpen(false);
                    setUserLogs([]);
                    setUserSubmissions([]);
                    setUserPayouts([]);
                  }}
                  className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors"
                >
                  <ICONS.Close className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase mb-1">Balance</p>
                  <p className="text-lg font-bold text-white">
                    {formatCurrency(selectedUser.walletBalance)}
                  </p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase mb-1">Pending</p>
                  <p className="text-lg font-bold text-cyan-400">
                    {formatCurrency(selectedUser.pendingBalance)}
                  </p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase mb-1">Total Earned</p>
                  <p className="text-lg font-bold text-green-400">
                    {formatCurrency(selectedUser.totalEarnings)}
                  </p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase mb-1">Submissions</p>
                  <p className="text-lg font-bold text-amber-400">{stats.totalSubmissions}</p>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase mb-1">Payouts</p>
                  <p className="text-lg font-bold text-purple-400">{stats.totalPayouts}</p>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - User Info */}
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <ICONS.User className="w-4 h-4" />
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-400 uppercase mb-1">Username</p>
                        <p className="text-sm font-bold text-white">@{selectedUser.username}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase mb-1">Email</p>
                        <p className="text-sm font-bold text-white">{selectedUser.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase mb-1">Social Username</p>
                        <p className="text-sm font-bold text-cyan-400">
                          {selectedUser.savedSocialUsername || 'Not set'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase mb-1">User Role</p>
                        <p className="text-sm font-bold text-amber-400">{selectedUser.role}</p>
                      </div>
                    </div>
                  </div>

                  {/* Security Information */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <ICONS.Shield className="w-4 h-4" />
                      Security Information
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs text-slate-400 uppercase">Security Key</p>
                          <button
                            onClick={handleCopySecurityKey}
                            className="text-xs px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded hover:bg-cyan-500/20"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="p-2 bg-black/30 rounded border border-slate-700">
                          <p className="text-xs font-mono text-white break-all">
                            {selectedUser.securityKey || 'Not generated'}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-400 uppercase mb-1">Failed Attempts</p>
                          <p className="text-sm font-bold text-white">
                            {selectedUser.failedAttempts || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 uppercase mb-1">Account Lock</p>
                          <p className="text-sm font-bold text-amber-400">
                            {selectedUser.lockoutUntil && selectedUser.lockoutUntil > Date.now() 
                              ? 'Locked' 
                              : 'Active'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Information */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <ICONS.Calendar className="w-4 h-4" />
                      Timeline
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-400 uppercase mb-1">Joined Date</p>
                        <p className="text-sm font-bold text-white">
                          {formatFullDate(selectedUser.joinedAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase mb-1">Last Login</p>
                        <p className="text-sm font-bold text-cyan-400">
                          {formatFullDate(selectedUser.lastLoginAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase mb-1">Account Age</p>
                        <p className="text-sm font-bold text-amber-400">
                          {Math.floor((Date.now() - (selectedUser.joinedAt || Date.now())) / (1000 * 60 * 60 * 24))} days
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Admin Actions */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h4 className="text-sm font-bold text-white mb-4">Admin Actions</h4>
                    <div className="space-y-2">
                      <button
                        onClick={() => toggleUserStatus(selectedUser.id, selectedUser.status)}
                        className={`w-full py-2 rounded text-sm font-bold transition-colors ${
                          selectedUser.status === UserStatus.ACTIVE
                            ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                      >
                        {selectedUser.status === UserStatus.ACTIVE 
                          ? '⚠ Suspend Account' 
                          : '✅ Activate Account'
                        }
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column - Activity & Logs */}
                <div className="space-y-6">
                  {/* Recent Activity Logs */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <ICONS.Activity className="w-4 h-4" />
                        Recent Activity Logs
                      </h4>
                      <span className="text-xs text-slate-500">{userLogs.length} logs</span>
                    </div>
                    
                    {loadingLogs ? (
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-cyan-500"></div>
                        <p className="text-xs text-slate-500 mt-2">Loading logs...</p>
                      </div>
                    ) : userLogs.length === 0 ? (
                      <div className="text-center py-8">
                        <ICONS.Activity className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-slate-500 text-xs">No activity logs found</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {userLogs.slice(0, 10).map(log => (
                          <div key={log.id} className="p-3 bg-black/30 rounded border border-slate-700">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getLogTypeColor(log.type)}`}>
                                  {log.type.toUpperCase()}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {formatDate(log.timestamp)}
                                </span>
                              </div>
                              {getLogIcon(log.type)}
                            </div>
                            <p className="text-sm text-white">{log.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Submissions */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <ICONS.FileText className="w-4 h-4" />
                        Recent Submissions
                      </h4>
                      <span className="text-xs text-slate-500">
                        {stats.pendingSubmissions} pending
                      </span>
                    </div>
                    
                    {loadingSubmissions ? (
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-cyan-500"></div>
                        <p className="text-xs text-slate-500 mt-2">Loading submissions...</p>
                      </div>
                    ) : userSubmissions.length === 0 ? (
                      <div className="text-center py-8">
                        <ICONS.FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-slate-500 text-xs">No submissions found</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {userSubmissions.slice(0, 8).map(submission => (
                          <div key={submission.id} className="p-3 bg-black/30 rounded border border-slate-700">
                            <div className="flex justify-between items-start mb-1">
                              <p className="text-sm font-bold text-white truncate">
                                {submission.campaignTitle}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                submission.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                submission.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {submission.status}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-500">
                                {formatDate(submission.timestamp)}
                              </span>
                              <span className="text-xs font-bold text-cyan-400">
                                {formatCurrency(submission.rewardAmount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Payouts */}
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <ICONS.Coins className="w-4 h-4" />
                        Recent Payouts
                      </h4>
                      <span className="text-xs text-slate-500">
                        {formatCurrency(stats.totalWithdrawn)} withdrawn
                      </span>
                    </div>
                    
                    {loadingPayouts ? (
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-cyan-500"></div>
                        <p className="text-xs text-slate-500 mt-2">Loading payouts...</p>
                      </div>
                    ) : userPayouts.length === 0 ? (
                      <div className="text-center py-8">
                        <ICONS.Coins className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                        <p className="text-slate-500 text-xs">No payout requests found</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {userPayouts.slice(0, 8).map(payout => (
                          <div key={payout.id} className="p-3 bg-black/30 rounded border border-slate-700">
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <p className="text-sm font-bold text-white">
                                  {formatCurrency(payout.amount)}
                                </p>
                                <p className="text-xs text-slate-400">Via {payout.method}</p>
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                payout.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                payout.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {payout.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {formatDate(payout.timestamp)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMembers;
