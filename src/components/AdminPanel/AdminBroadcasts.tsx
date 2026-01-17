import React, { useState, useEffect } from 'react';
import { broadcastService } from './firebaseService';
import { ICONS } from '../../utils/constants';
import { User, UserRole, UserStatus } from '../../utils/types'; // Add User types

interface AdminBroadcastsProps {
  broadcasts: any[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: any;
  users?: User[]; // Use User type instead of any
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ 
  broadcasts, 
  showToast, 
  currentUser,
  users = [] // Default empty array
}) => {
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [targetId, setTargetId] = useState<string>('broadcast'); // Default to broadcast
  const [sending, setSending] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  // Process users when component mounts or users prop changes
  useEffect(() => {
    if (users && users.length > 0) {
      // Filter out current admin and other admins - FIXED: Use UserRole.ADMIN
      const filteredUsers = users.filter(user => 
        user.id !== currentUser?.id && 
        user.role !== UserRole.ADMIN && 
        user.status === UserStatus.ACTIVE
      );
      setAvailableUsers(filteredUsers);
    } else {
      setAvailableUsers([]);
    }
  }, [users, currentUser]);

  // Get username by ID
  const getUsernameById = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `@${user.username}` : 'Unknown User';
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) {
      showToast('Message content is required', 'error');
      return;
    }

    // Validate if specific user is selected
    if (targetId && targetId !== 'broadcast') {
      const selectedUser = users.find(u => u.id === targetId);
      if (!selectedUser) {
        showToast('Selected user not found', 'error');
        return;
      }
    }

    setSending(true);
    try {
      await broadcastService.createBroadcast({
        content: broadcastMsg.trim(),
        senderId: currentUser.id,
        senderName: currentUser.username || 'Admin',
        targetUserId: targetId && targetId !== 'broadcast' ? targetId : undefined,
        timestamp: Date.now(),
        readBy: []
      });

      showToast(
        targetId && targetId !== 'broadcast' 
          ? `Message sent to ${getUsernameById(targetId)}` 
          : 'Broadcast sent to all users', 
        'success'
      );
      
      setBroadcastMsg('');
      setTargetId('broadcast'); // Reset to broadcast mode
      
    } catch (error: any) {
      console.error('Broadcast error:', error);
      showToast(error.message || 'Failed to send broadcast', 'error');
    } finally {
      setSending(false);
    }
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

  // Get broadcast target info
  const getBroadcastTargetInfo = (broadcast: any) => {
    if (broadcast.targetUserId) {
      const user = users.find(u => u.id === broadcast.targetUserId);
      return {
        type: 'SPECIFIC USER',
        name: user ? `@${user.username}` : 'Unknown User',
        icon: ICONS.User
      };
    }
    return {
      type: 'NETWORK BROADCAST',
      name: 'All Users',
      icon: ICONS.Globe
    };
  };

  // Calculate non-admin users count
  const getNonAdminUsersCount = () => {
    return users.filter(u => u.role !== UserRole.ADMIN).length;
  };

  return (
    <div className="space-y-8 animate-slide">
      {/* Create Broadcast Form */}
      <div className="glass-panel p-8 rounded-3xl border border-cyan-500/30 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <ICONS.Megaphone className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-black text-white">
            Send Broadcast
          </h3>
        </div>
        
        <div className="space-y-4">
          {/* Target Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-300 block">
              Target Audience
            </label>
            
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-black/50 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="broadcast" className="bg-black">
                🌐 Broadcast to All Users ({getNonAdminUsersCount()} users)
              </option>
              
              {availableUsers.length > 0 && (
                <optgroup label="Send to Specific User" className="bg-black">
                  <option value="" disabled className="text-slate-500 text-sm">
                    -- Select a User --
                  </option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id} className="bg-black">
                      👤 @{user.username} 
                      {user.email && ` • ${user.email}`}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            
            {/* User count info */}
            <div className="flex justify-between text-xs text-slate-500">
              <span>
                {targetId === 'broadcast' || !targetId 
                  ? `Will be sent to ${getNonAdminUsersCount()} users` 
                  : `Sending to 1 user`}
              </span>
              <span>{availableUsers.length} active users</span>
            </div>
          </div>
          
          {/* Message Input */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-300 block">
              Message
            </label>
            
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              className="w-full bg-black/50 border border-slate-700 rounded-xl p-4 text-white h-40 resize-none outline-none focus:border-cyan-500 transition-colors"
              placeholder="Type your message here..."
              maxLength={500}
            />
            
            <div className="flex justify-between items-center text-xs text-slate-600">
              <span>Max 500 characters</span>
              <span className={broadcastMsg.length > 450 ? 'text-amber-500' : ''}>
                {broadcastMsg.length}/500
              </span>
            </div>
          </div>
          
          {/* Send Button */}
          <button
            onClick={handleSendBroadcast}
            disabled={sending || !broadcastMsg.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <span className="animate-spin">⟳</span>
                Sending...
              </>
            ) : targetId && targetId !== 'broadcast' ? (
              <>
                <ICONS.Send className="w-5 h-5" />
                Send to User
              </>
            ) : (
              <>
                <ICONS.Megaphone className="w-5 h-5" />
                Send Broadcast
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sent Broadcasts */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Sent Messages</h3>
          <span className="text-xs text-slate-500 font-bold">
            {broadcasts.length} total
          </span>
        </div>
        
        {broadcasts.length === 0 ? (
          <div className="text-center py-12 bg-black/30 rounded-xl">
            <ICONS.Message className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-600 text-sm font-bold">
              No broadcasts sent yet
            </p>
            <p className="text-slate-700 text-xs mt-2 max-w-xs mx-auto">
              Send your first message to users
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {broadcasts.map(broadcast => {
              const targetInfo = getBroadcastTargetInfo(broadcast);
              
              return (
                <div 
                  key={broadcast.id} 
                  className="bg-black/30 border border-slate-800 p-4 rounded-xl space-y-3 hover:bg-black/40 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <targetInfo.icon className="w-4 h-4 text-cyan-500" />
                        <p className="text-xs font-bold text-cyan-400">
                          {targetInfo.type}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {formatDate(broadcast.timestamp)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded-full">
                        Sent
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    <p className="text-white whitespace-pre-line">
                      {broadcast.content}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <ICONS.User className="w-3 h-3" />
                      <span>From: @{broadcast.senderName || 'Admin'}</span>
                    </div>
                    
                    {broadcast.targetUserId && (
                      <span className="text-xs text-slate-400">
                        To: {targetInfo.name}
                      </span>
                    )}
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
