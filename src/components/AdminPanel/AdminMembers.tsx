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

  const regularUsers = useMemo(() => {
    return users.filter(u => u.role !== UserRole.ADMIN);
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return regularUsers;
    const query = searchQuery.toLowerCase();
    return regularUsers.filter(user =>
      user.username.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query)
    );
  }, [regularUsers, searchQuery]);

  const toggleUserStatus = async (userId: string, currentStatus: UserStatus) => {
    try {
      const newStatus = currentStatus === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
      await userService.updateUserStatus(userId, newStatus);
      showToast(`User ${newStatus === UserStatus.ACTIVE ? 'activated' : 'suspended'}`, 'success');
      
      // Update selected user if open
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

  // Calculate activity score
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

  return (
    <div className="space-y-6 p-4">
      {/* Search Bar */}
      <div className="bg-black/50 border border-slate-800 p-4 rounded-xl">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <ICONS.Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search users by username, email or ID..."
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
          <div className="bg-gray-900 border border-slate-800 w-full max-w-4xl rounded-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-black/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">User Details</h3>
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
                      ID: {selectedUser.id.substring(0, 8)}...
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setUserDetailsOpen(false);
                  }}
                  className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors"
                >
                  <ICONS.Close className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-full flex items-center justify-center border-2 border-cyan-500/30">
                      <span className="text-cyan-400 text-2xl font-bold">
                        {selectedUser.username?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">@{selectedUser.username}</h4>
                      <p className="text-sm text-slate-400">{selectedUser.email}</p>
                      <div className="mt-1">
                        <p className="text-xs text-slate-500">Joined</p>
                        <p className="text-sm font-bold text-slate-300">
                          {formatFullDate(selectedUser.joinedAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-400 uppercase mb-1">User Role</p>
                      <p className="text-sm font-bold text-cyan-400">{selectedUser.role}</p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-400 uppercase mb-1">Last Login</p>
                      <p className="text-sm font-bold text-slate-300">
                        {formatDate(selectedUser.lastLoginAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Financial Info */}
                <div className="space-y-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <h4 className="text-sm font-bold text-white mb-3">Financial Summary</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Available Balance</span>
                        <span className="text-lg font-bold text-white">
                          {formatCurrency(selectedUser.walletBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Pending Balance</span>
                        <span className="text-sm font-bold text-cyan-400">
                          {formatCurrency(selectedUser.pendingBalance)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Total Earnings</span>
                        <span className="text-sm font-bold text-green-400">
                          {formatCurrency(selectedUser.totalEarnings)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white">Account Info</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-400 uppercase mb-1">Social Username</p>
                      <p className="text-sm font-bold text-white">
                        {selectedUser.savedSocialUsername || 'Not set'}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-400 uppercase mb-1">Campaigns Viewed</p>
                      <p className="text-sm font-bold text-cyan-400">
                        {selectedUser.readBroadcastIds?.length || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-400 uppercase mb-1">Failed Logins</p>
                      <p className="text-sm font-bold text-white">
                        {selectedUser.failedAttempts || 0}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-slate-400 uppercase mb-1">Payout Method</p>
                      <p className="text-sm font-bold text-slate-300">
                        {selectedUser.payoutMethod?.type || 'Not set'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white">Admin Actions</h4>
                  <div className="space-y-3">
                    <button
                      onClick={() => toggleUserStatus(selectedUser.id, selectedUser.status)}
                      className={`w-full py-3 rounded-lg text-sm font-bold transition-colors ${
                        selectedUser.status === UserStatus.ACTIVE
                          ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {selectedUser.status === UserStatus.ACTIVE 
                        ? 'Suspend Account' 
                        : 'Activate Account'
                      }
                    </button>
                    
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-400 font-bold">Balance Protection</p>
                      <p className="text-xs text-blue-300 mt-1">
                        User balances are automatically managed by the system.
                      </p>
                    </div>
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
