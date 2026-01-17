import React, { useState, useMemo } from 'react';
import { User, UserRole, UserStatus } from '../../utils/types';
import { ICONS } from '../../utils/constants';
import { userService } from './firebaseService';

interface AdminMembersProps {
  users: User[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AdminMembers: React.FC<AdminMembersProps> = ({ users, showToast }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);

  const regularUsers = users.filter(u => u.role !== UserRole.ADMIN);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return regularUsers;
    return regularUsers.filter(user =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [regularUsers, searchQuery]);

  const toggleUserStatus = async (userId: string, currentStatus: UserStatus) => {
    try {
      const newStatus = currentStatus === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
      await userService.updateUserStatus(userId, newStatus);
      showToast(`User ${newStatus === UserStatus.ACTIVE ? 'activated' : 'suspended'}`, 'success');
      
      // Update selected user if it's the same user
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
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFullDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Calculate user activity score
  const calculateActivityScore = (user: User): number => {
    let score = 0;
    
    // Last login score (recent = higher)
    const daysSinceLogin = (Date.now() - user.lastLoginAt) / (1000 * 60 * 60 * 24);
    if (daysSinceLogin < 1) score += 40;
    else if (daysSinceLogin < 7) score += 30;
    else if (daysSinceLogin < 30) score += 20;
    else if (daysSinceLogin < 90) score += 10;
    
    // Earnings score
    if (user.totalEarnings > 1000) score += 30;
    else if (user.totalEarnings > 500) score += 20;
    else if (user.totalEarnings > 100) score += 10;
    
    return Math.min(score, 100);
  };

  const getActivityLevel = (score: number): string => {
    if (score >= 80) return 'Very High';
    if (score >= 60) return 'High';
    if (score >= 40) return 'Medium';
    if (score >= 20) return 'Low';
    return 'Very Low';
  };

  const getActivityColor = (score: number): string => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-cyan-500';
    if (score >= 40) return 'text-yellow-500';
    if (score >= 20) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6 animate-slide">
      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-3xl">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <ICONS.Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type="text"
              placeholder="Search users by username, email or ID..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="text-[10px] text-slate-500 font-black">
            {filteredUsers.length} users
          </div>
        </div>
      </div>

      {/* Users List - Simple Cards */}
      <div className="space-y-3">
        {filteredUsers.map(user => {
          const activityScore = calculateActivityScore(user);
          
          return (
            <div 
              key={user.id} 
              className="glass-panel p-5 rounded-3xl border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all cursor-pointer active:scale-[0.99]"
              onClick={() => {
                setSelectedUser(user);
                setUserDetailsOpen(true);
              }}
            >
              <div className="flex items-center justify-between">
                {/* User Info Left */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                    <span className="text-cyan-400 text-xl font-black">{user.username[0].toUpperCase()}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-base font-black text-white truncate">@{user.username}</h4>
                      <span className={`text-[8px] px-2 py-0.5 rounded-full ${
                        user.status === UserStatus.ACTIVE
                          ? 'bg-green-500/20 text-green-400'
                          : user.status === UserStatus.SUSPENDED
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {user.status}
                      </span>
                    </div>
                    
                    <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{user.email}</p>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[9px] text-slate-500">
                        Joined: {formatDate(user.joinedAt)}
                      </span>
                      <span className={`text-[9px] ${getActivityColor(activityScore)}`}>
                        Activity: {getActivityLevel(activityScore)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User Info Right */}
                <div className="text-right">
                  <div className="space-y-1">
                    <p className="text-lg font-black text-white">{formatCurrency(user.walletBalance)}</p>
                    <p className="text-[10px] text-cyan-500">Available Balance</p>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser(user);
                      setUserDetailsOpen(true);
                    }}
                    className="mt-2 text-[9px] px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg font-bold hover:bg-cyan-500/20 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* User Details Modal */}
      {selectedUser && userDetailsOpen && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-slide overflow-y-auto">
          <div className="glass-panel w-full max-w-4xl p-8 rounded-[48px] border-t-8 border-cyan-500 space-y-8 my-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-white mb-2">User Details</h3>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-3 py-1 rounded-full ${
                    selectedUser.status === UserStatus.ACTIVE
                      ? 'bg-green-500/20 text-green-400'
                      : selectedUser.status === UserStatus.SUSPENDED
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {selectedUser.status}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    User ID: {selectedUser.id.substring(0, 12)}...
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserDetailsOpen(false);
                }}
                className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <ICONS.Close className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column - Basic Info */}
              <div className="space-y-6">
                {/* Profile Section */}
                <div className="p-6 bg-white/5 rounded-3xl">
                  <div className="flex items-center gap-6 mb-6">
                    <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-full flex items-center justify-center border-4 border-cyan-500/20">
                      <span className="text-cyan-400 text-3xl font-black">{selectedUser.username[0].toUpperCase()}</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white">@{selectedUser.username}</h4>
                      <p className="text-sm text-slate-400">{selectedUser.email}</p>
                      <div className="mt-2">
                        <p className="text-[10px] text-slate-500">Joined</p>
                        <p className="text-sm font-bold text-slate-300">{formatFullDate(selectedUser.joinedAt)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white/3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase mb-1">User Role</p>
                      <p className="text-sm font-black text-cyan-400">{selectedUser.role}</p>
                    </div>
                    <div className="p-3 bg-white/3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase mb-1">Last Login</p>
                      <p className="text-sm font-bold text-slate-300">
                        {formatDate(selectedUser.lastLoginAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financial Overview (READ ONLY) */}
                <div className="p-6 bg-white/5 rounded-3xl">
                  <h4 className="text-lg font-black text-white mb-4">Financial Overview</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-white/3 rounded-xl">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase">Available Balance</p>
                        <p className="text-2xl font-black text-white">{formatCurrency(selectedUser.walletBalance)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase">Pending Balance</p>
                        <p className="text-lg font-black text-cyan-400">{formatCurrency(selectedUser.pendingBalance)}</p>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-white/3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase mb-1">Total Earnings (Lifetime)</p>
                      <p className="text-xl font-black text-green-400">{formatCurrency(selectedUser.totalEarnings)}</p>
                      <div className="h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full"
                          style={{ width: `${Math.min((selectedUser.totalEarnings / 10000) * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1 text-right">
                        Goal: ₹10,000
                      </p>
                    </div>

                    <div className="p-3 bg-white/3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase mb-1">Withdrawal Status</p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-300">
                          {selectedUser.payoutMethod?.type || 'No payout method set'}
                        </p>
                        <span className="text-[9px] px-2 py-1 bg-slate-800/50 text-slate-400 rounded-full">
                          Auto-Approved
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Activity & Actions */}
              <div className="space-y-6">
                {/* Activity Stats */}
                <div className="p-6 bg-white/5 rounded-3xl">
                  <h4 className="text-lg font-black text-white mb-4">Activity Stats</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase mb-2">Campaigns Viewed</p>
                      <p className="text-2xl font-black text-cyan-400">
                        {selectedUser.readBroadcastIds?.length || 0}
                      </p>
                    </div>
                    <div className="p-4 bg-white/3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase mb-2">Social Username</p>
                      <p className="text-sm font-bold text-white truncate">
                        {selectedUser.savedSocialUsername || 'Not set'}
                      </p>
                    </div>
                    <div className="p-4 bg-white/3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase mb-2">Failed Login Attempts</p>
                      <p className="text-2xl font-black text-white">{selectedUser.failedAttempts || 0}</p>
                    </div>
                    <div className="p-4 bg-white/3 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase mb-2">Account Locked Until</p>
                      <p className="text-sm font-bold text-slate-300">
                        {selectedUser.lockoutUntil 
                          ? formatDate(selectedUser.lockoutUntil)
                          : 'Not Locked'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* Activity Score */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-slate-900/50 to-black/50 rounded-xl border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] text-slate-400 uppercase">Activity Score</p>
                      <span className={`text-xs font-black ${getActivityColor(calculateActivityScore(selectedUser))}`}>
                        {getActivityLevel(calculateActivityScore(selectedUser))}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${calculateActivityScore(selectedUser)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] text-slate-500 mt-1">
                      <span>0</span>
                      <span>25</span>
                      <span>50</span>
                      <span>75</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>

                {/* Admin Actions - ONLY STATUS TOGGLE */}
                <div className="p-6 bg-white/5 rounded-3xl">
                  <h4 className="text-lg font-black text-white mb-4">Admin Actions</h4>
                  
                  <div className="space-y-4">
                    {/* Status Toggle */}
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase mb-2">Account Status Management</p>
                      <button
                        onClick={async () => {
                          await toggleUserStatus(selectedUser.id, selectedUser.status);
                        }}
                        className={`w-full py-4 rounded-xl text-sm font-black uppercase transition-all ${
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
                      <p className="text-[9px] text-slate-500 mt-2 text-center">
                        {selectedUser.status === UserStatus.ACTIVE 
                          ? 'User can login and use the platform'
                          : 'User cannot login until activated'
                        }
                      </p>
                    </div>

                    {/* Read Only Notice */}
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <div className="flex items-start gap-3">
                        <ICONS.Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-black text-blue-400 uppercase">Balance Protection</p>
                          <p className="text-[9px] text-blue-300">
                            User balances are protected and cannot be modified by admin. 
                            Users earn through campaigns and can withdraw according to platform rules.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* View History Button (Optional) */}
                    <button
                      onClick={() => {
                        showToast('Transaction history feature coming soon', 'info');
                      }}
                      className="w-full py-3 bg-white/5 text-slate-400 rounded-xl text-[10px] font-black uppercase hover:bg-white/10 transition-colors"
                    >
                      View Transaction History
                    </button>
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
