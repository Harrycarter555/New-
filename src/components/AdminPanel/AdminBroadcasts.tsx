import React, { useState, useEffect } from 'react';
import { Broadcast, User } from '../../types';
import { ICONS } from '../../constants';
import { broadcastService } from './firebaseService';

interface AdminBroadcastsProps {
  broadcasts: Broadcast[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: any;
  users: User[];
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ 
  broadcasts, 
  showToast, 
  currentUser,
  users 
}) => {
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific' | 'multiple'>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter regular users (non-admin)
  const regularUsers = users.filter(u => u.role !== 'admin');

  const handleSendBroadcast = async () => {
    if (!content.trim()) {
      showToast('Broadcast content is required', 'error');
      return;
    }

    setSending(true);
    try {
      if (targetType === 'all') {
        // Send to all users
        await broadcastService.sendBroadcast(
          content,
          currentUser.id,
          currentUser.username,
          undefined // No target = all users
        );
        showToast('Broadcast sent to all users successfully', 'success');
      } 
      else if (targetType === 'specific' && targetUserId) {
        // Send to specific user
        await broadcastService.sendBroadcast(
          content,
          currentUser.id,
          currentUser.username,
          targetUserId
        );
        showToast(`Broadcast sent to @${users.find(u => u.id === targetUserId)?.username}`, 'success');
      }
      else if (targetType === 'multiple' && selectedUsers.length > 0) {
        // Send to multiple users
        for (const userId of selectedUsers) {
          await broadcastService.sendBroadcast(
            content,
            currentUser.id,
            currentUser.username,
            userId
          );
        }
        showToast(`Broadcast sent to ${selectedUsers.length} user(s)`, 'success');
      } else {
        showToast('Please select recipient(s)', 'error');
        return;
      }
      
      // Reset form
      setContent('');
      setTargetUserId('');
      setSelectedUsers([]);
      setTargetType('all');
    } catch (error: any) {
      showToast(error.message || 'Failed to send broadcast', 'error');
    } finally {
      setSending(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = regularUsers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-slide">
      {/* Send Broadcast Form */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black text-white">Send Broadcast</h3>
          <span className="text-sm text-slate-400">
            {broadcasts.length} total broadcasts
          </span>
        </div>
        
        <div className="space-y-6">
          {/* Message Input */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-3">
              Broadcast Message *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl p-5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 h-40 resize-none shadow-inner"
              placeholder="Enter your broadcast message here..."
              required
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Max 500 characters</span>
              <span>{content.length}/500</span>
            </div>
          </div>

          {/* Target Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-300">
              Select Recipients
            </label>
            
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTargetType('all')}
                className={`py-3 rounded-xl font-bold transition-all ${
                  targetType === 'all'
                    ? 'bg-cyan-500 text-black shadow-lg'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                All Users
              </button>
              <button
                onClick={() => setTargetType('specific')}
                className={`py-3 rounded-xl font-bold transition-all ${
                  targetType === 'specific'
                    ? 'bg-cyan-500 text-black shadow-lg'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Specific User
              </button>
              <button
                onClick={() => setTargetType('multiple')}
                className={`py-3 rounded-xl font-bold transition-all ${
                  targetType === 'multiple'
                    ? 'bg-cyan-500 text-black shadow-lg'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Multiple Users
              </button>
            </div>

            {/* Specific User Selection */}
            {targetType === 'specific' && (
              <div className="space-y-3">
                <label className="text-sm text-slate-400">Select User</label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">Select a user...</option>
                  {regularUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      @{user.username} ({user.email})
                    </option>
                  ))}
                </select>
                {targetUserId && (
                  <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                    <p className="text-sm text-cyan-400">
                      Selected: @{users.find(u => u.id === targetUserId)?.username}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Multiple Users Selection */}
            {targetType === 'multiple' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <ICONS.Search className="w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    placeholder="Search users by username or email..."
                  />
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl p-3">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center py-4 text-slate-500">No users found</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map(user => (
                        <div
                          key={user.id}
                          onClick={() => toggleUserSelection(user.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            selectedUsers.includes(user.id)
                              ? 'bg-cyan-500/20 border border-cyan-500/30'
                              : 'bg-white/5 hover:bg-white/10'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                            selectedUsers.includes(user.id)
                              ? 'bg-cyan-500 border-cyan-500'
                              : 'border-slate-600'
                          }`}>
                            {selectedUsers.includes(user.id) && (
                              <ICONS.Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-white">@{user.username}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                          <div className="text-xs text-slate-500">
                            ₹{user.walletBalance?.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedUsers.length > 0 && (
                  <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                    <p className="text-sm text-cyan-400 mb-2">
                      Selected {selectedUsers.length} user(s)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.slice(0, 5).map(userId => {
                        const user = users.find(u => u.id === userId);
                        return (
                          <span
                            key={userId}
                            className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-lg text-xs"
                          >
                            @{user?.username}
                          </span>
                        );
                      })}
                      {selectedUsers.length > 5 && (
                        <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded-lg text-xs">
                          +{selectedUsers.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendBroadcast}
            disabled={sending || !content.trim() || 
              (targetType === 'specific' && !targetUserId) ||
              (targetType === 'multiple' && selectedUsers.length === 0)}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 rounded-2xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all active:scale-95"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <ICONS.Refresh className="w-5 h-5 animate-spin" />
                Sending...
              </span>
            ) : (
              'Send Broadcast'
            )}
          </button>
        </div>
      </div>

      {/* Broadcast History */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black text-white">Broadcast History</h3>
          <span className="text-sm text-slate-400">
            Latest {Math.min(broadcasts.length, 20)} broadcasts
          </span>
        </div>
        
        {broadcasts.length === 0 ? (
          <div className="text-center py-16 bg-black/30 rounded-2xl border border-slate-800">
            <ICONS.Bell className="w-20 h-20 text-slate-700 mx-auto mb-6" />
            <p className="text-slate-500 text-lg font-bold mb-2">No broadcasts sent yet</p>
            <p className="text-sm text-slate-600">Send your first broadcast to users</p>
          </div>
        ) : (
          <div className="space-y-4">
            {broadcasts.slice(0, 20).map(broadcast => {
              const targetUser = broadcast.targetUserId 
                ? users.find(u => u.id === broadcast.targetUserId)
                : null;
              
              return (
                <div key={broadcast.id} className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all">
                  <p className="text-white mb-4 text-lg leading-relaxed">{broadcast.content}</p>
                  
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
                          <ICONS.User className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">
                            By: {broadcast.senderName || 'Admin'}
                          </p>
                          {targetUser ? (
                            <p className="text-xs text-cyan-400">
                              To: @{targetUser.username}
                            </p>
                          ) : (
                            <p className="text-xs text-green-400">
                              To: All Users
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <span className="text-xs text-slate-500 bg-black/30 px-3 py-1 rounded-full">
                        {broadcast.readBy?.length || 0} read
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm text-slate-500 pt-3 border-t border-slate-800">
                      <span>
                        {new Date(broadcast.timestamp).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </span>
                      <span>
                        {broadcast.targetUserId ? 'Targeted' : 'Broadcast'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBroadcasts;
