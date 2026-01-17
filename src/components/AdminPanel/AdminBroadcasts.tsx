import React, { useState, useEffect } from 'react';
import { broadcastService } from './firebaseService';
import { ICONS } from '../../utils/constants';
import { User, UserRole, UserStatus } from '../../utils/types';

interface AdminBroadcastsProps {
  broadcasts: any[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: User;
  users?: User[];
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ 
  broadcasts, 
  showToast, 
  currentUser,
  users = []
}) => {
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [targetId, setTargetId] = useState<string>('broadcast');
  const [sending, setSending] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  // Process users
  useEffect(() => {
    if (users && users.length > 0) {
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

  const getUsernameById = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `@${user.username}` : 'Unknown User';
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) {
      showToast('Message content is required', 'error');
      return;
    }

    // Validate specific user
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
      setTargetId('broadcast');
      
    } catch (error: any) {
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

  const getBroadcastTargetInfo = (broadcast: any) => {
    if (broadcast.targetUserId) {
      const user = users.find(u => u.id === broadcast.targetUserId);
      return {
        type: 'SPECIFIC USER',
        name: user ? `@${user.username}` : 'Unknown User',
      };
    }
    return {
      type: 'BROADCAST',
      name: 'All Users',
    };
  };

  const getNonAdminUsersCount = () => {
    return users.filter(u => u.role !== UserRole.ADMIN).length;
  };

  return (
    <div className="space-y-6 p-4">
      {/* Create Broadcast */}
      <div className="bg-black/50 border border-slate-800 p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <ICONS.Megaphone className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">Send Message</h3>
        </div>
        
        <div className="space-y-4">
          {/* Target Selection */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              Target
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-black/30 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="broadcast" className="bg-gray-900">
                🌐 Broadcast to All Users ({getNonAdminUsersCount()} users)
              </option>
              
              {availableUsers.length > 0 && (
                <optgroup label="Send to Specific User" className="bg-gray-900">
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id} className="bg-gray-900">
                      👤 @{user.username}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          
          {/* Message Input */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              Message
            </label>
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              className="w-full bg-black/30 border border-slate-700 rounded-lg p-4 text-white h-32 resize-none focus:outline-none focus:border-cyan-500"
              placeholder="Type your message here..."
              maxLength={500}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Max 500 characters</span>
              <span>{broadcastMsg.length}/500</span>
            </div>
          </div>
          
          {/* Send Button */}
          <button
            onClick={handleSendBroadcast}
            disabled={sending || !broadcastMsg.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>

      {/* Sent Broadcasts */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Sent Messages</h3>
          <span className="text-sm text-slate-500">
            {broadcasts.length} total
          </span>
        </div>
        
        {broadcasts.length === 0 ? (
          <div className="text-center py-12 bg-black/30 rounded-xl border border-slate-800">
            <ICONS.Message className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 text-sm font-bold">
              No messages sent yet
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {broadcasts.map(broadcast => {
              const targetInfo = getBroadcastTargetInfo(broadcast);
              
              return (
                <div 
                  key={broadcast.id} 
                  className="bg-black/30 border border-slate-800 p-4 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        targetInfo.type === 'BROADCAST' 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {targetInfo.type}
                      </span>
                      {targetInfo.type === 'SPECIFIC USER' && (
                        <p className="text-xs text-slate-400 mt-1">
                          To: {targetInfo.name}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDate(broadcast.timestamp)}
                    </span>
                  </div>
                  
                  <p className="text-white whitespace-pre-line">
                    {broadcast.content}
                  </p>
                  
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800">
                    <span className="text-xs text-slate-500">
                      From: @{broadcast.senderName || 'Admin'}
                    </span>
                    {broadcast.readBy && (
                      <span className="text-xs text-green-400">
                        {broadcast.readBy.length} read
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
