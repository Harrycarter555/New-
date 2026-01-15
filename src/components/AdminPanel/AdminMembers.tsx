import React, { useState, useMemo } from 'react';
import { User, UserRole, UserStatus } from '../../../src/types';
import { ICONS } from '../../utils/constants';
import { userService } from './firebaseService';

interface AdminMembersProps {
  users: User[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AdminMembers: React.FC<AdminMembersProps> = ({ users, showToast }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [balanceEdit, setBalanceEdit] = useState({ amount: '', type: 'add' as 'add' | 'deduct' });
  const [updating, setUpdating] = useState(false);

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
    setUpdating(true);
    try {
      const newStatus = currentStatus === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
      await userService.updateUserStatus(userId, newStatus);
      showToast(`User ${newStatus === UserStatus.ACTIVE ? 'activated' : 'suspended'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update user status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const updateUserBalance = async () => {
    if (!selectedUser) return;
    
    const amount = Number(balanceEdit.amount);
    if (!amount || amount <= 0) {
      showToast('Enter valid amount', 'error');
      return;
    }

    setUpdating(true);
    try {
      await userService.updateUserBalance(selectedUser.id, amount, balanceEdit.type);
      showToast(`Balance ${balanceEdit.type === 'add' ? 'added' : 'deducted'}: ₹${amount}`, 'success');
      setSelectedUser(null);
      setBalanceEdit({ amount: '', type: 'add' });
    } catch (error: any) {
      showToast(error.message || 'Failed to update balance', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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
              placeholder="Search users..."
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

      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.map(user => (
          <div key={user.id} className="glass-panel p-6 rounded-3xl border border-white/5 hover:border-cyan-500/20 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/20">
                  <span className="text-cyan-500 text-lg font-black">{user.username[0].toUpperCase()}</span>
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">@{user.username}</h4>
                  <p className="text-[9px] text-slate-500 truncate max-w-[150px]">{user.email}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-[8px] px-2 py-0.5 rounded-full ${
                      user.status === UserStatus.ACTIVE
                        ? 'bg-green-500/20 text-green-500'
                        : user.status === UserStatus.SUSPENDED
                        ? 'bg-orange-500/20 text-orange-500'
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {user.status}
                    </span>
                    <span className="text-[8px] px-2 py-0.5 bg-slate-800/50 text-slate-500 rounded-full">
                      {formatDate(user.joinedAt)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-white">{formatCurrency(user.walletBalance)}</p>
                <p className="text-[9px] text-cyan-500">{formatCurrency(user.pendingBalance)} pending</p>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-[8px] text-slate-500 uppercase mb-1">Total Earned</p>
                <p className="text-sm font-black text-cyan-400">{formatCurrency(user.totalEarnings)}</p>
              </div>
              <div className="p-3 bg-white/5 rounded-xl">
                <p className="text-[8px] text-slate-500 uppercase mb-1">Security Key</p>
                <p className="text-[9px] font-black text-white truncate" title={user.securityKey}>
                  {user.securityKey.substring(0, 10)}...
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => toggleUserStatus(user.id, user.status)}
                disabled={updating}
                className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-colors ${
                  user.status === UserStatus.ACTIVE
                    ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 disabled:opacity-50'
                    : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 disabled:opacity-50'
                }`}
              >
                {user.status === UserStatus.ACTIVE ? 'Suspend' : 'Activate'}
              </button>
              
              <button
                onClick={() => setSelectedUser(user)}
                className="flex-1 py-2.5 bg-cyan-500/10 text-cyan-500 rounded-xl text-[9px] font-black uppercase hover:bg-cyan-500/20 transition-colors"
              >
                Manage Balance
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Balance Edit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-8 animate-slide">
          <div className="glass-panel w-full max-w-sm p-8 rounded-[48px] border-t-8 border-cyan-500 space-y-6">
            <h3 className="text-xl font-black text-white text-center">
              Manage @{selectedUser.username}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setBalanceEdit({...balanceEdit, type: 'add'})}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase transition-colors ${
                    balanceEdit.type === 'add' 
                      ? 'bg-cyan-500 text-black' 
                      : 'bg-white/5 text-slate-500'
                  }`}
                >
                  Add Balance
                </button>
                <button
                  onClick={() => setBalanceEdit({...balanceEdit, type: 'deduct'})}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase transition-colors ${
                    balanceEdit.type === 'deduct' 
                      ? 'bg-cyan-500 text-black' 
                      : 'bg-white/5 text-slate-500'
                  }`}
                >
                  Deduct Balance
                </button>
              </div>
              
              <input
                type="number"
                placeholder="Amount ₹"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-2xl font-black text-cyan-400 text-center focus:outline-none focus:border-cyan-500"
                value={balanceEdit.amount}
                onChange={(e) => setBalanceEdit({...balanceEdit, amount: e.target.value})}
              />
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="py-3 bg-white/5 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateUserBalance}
                  disabled={updating}
                  className="py-3 bg-cyan-500 text-black rounded-xl text-[10px] font-black uppercase hover:bg-cyan-400 disabled:opacity-50 transition-colors"
                >
                  {updating ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMembers;
