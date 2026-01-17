import React, { useState, useEffect } from 'react';
import { broadcastService } from './firebaseService';
import { ICONS } from '../../utils/constants';

interface AdminBroadcastsProps {
  broadcasts: any[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: any;
  users?: any[]; // Optional prop with default
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ 
  broadcasts, 
  showToast, 
  currentUser,
  users = [] // Default empty array
}) => {
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [targetId, setTargetId] = useState('');
  const [sending, setSending] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  // Process users when component mounts or users prop changes
  useEffect(() => {
    if (users && users.length > 0) {
      // Filter out current admin and other admins
      const filteredUsers = users.filter(user => 
        user.id !== currentUser?.id && 
        user.role !== 'admin' && 
        user.status === 'active'
      );
      setAvailableUsers(filteredUsers);
      console.log('Available users for broadcast:', filteredUsers.length);
    } else {
      console.warn('No users data available');
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

  return (
    <div className="space-y-8 animate-slide">
      {/* Create Broadcast Form */}
      <div className="glass-panel p-10 rounded-[48px] border-t-8 border-cyan-500 space-y-6 shadow-2xl">
        <h3 className="text-xl font-black italic text-white italic uppercase tracking-tighter">
          Directive Dispatch
        </h3>
        
        <div className="space-y-4">
          {/* Target Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Select Target
            </label>
            
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white outline-none shadow-inner focus:border-cyan-500"
            >
              <option value="broadcast" className="bg-black">
                🌐 Broadcast to All Users ({users.length} users)
              </option>
              
              {availableUsers.length > 0 && (
                <optgroup label="📨 Send to Specific User" className="bg-black">
                  <option value="" disabled className="text-slate-500 text-[10px]">
                    ── Select a User ──
                  </option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id} className="bg-black hover:bg-cyan-500/20">
                      👤 @{user.username} 
                      {user.email && ` (${user.email})`}
                      {user.walletBalance !== undefined && ` | ₹${user.walletBalance}`}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            
            {/* User count info */}
            <div className="flex justify-between text-[9px] text-slate-500 px-2">
              <span>
                {targetId === 'broadcast' || !targetId 
                  ? `Will be sent to ${users.filter(u => u.role !== 'admin').length} users` 
                  : `Sending to 1 user`}
              </span>
              <span>{availableUsers.length} users available</span>
            </div>
          </div>
          
          {/* Message Input */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Message Content
            </label>
            
            <textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white h-40 resize-none outline-none focus:border-cyan-500 transition-all shadow-inner"
              placeholder="Enter your message here... 
Example: 
• System maintenance scheduled for tomorrow
• New campaign added - check campaigns section
• Wallet withdrawal process updated"
              maxLength={1000}
            />
            
            <div className="flex justify-between items-center text-[9px] text-slate-600 px-2">
              <span>Max 1000 characters</span>
              <span className={broadcastMsg.length > 900 ? 'text-amber-500' : ''}>
                {broadcastMsg.length}/1000
              </span>
            </div>
          </div>
          
          {/* Send Button */}
          <button
            onClick={handleSendBroadcast}
            disabled={sending || !broadcastMsg.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black py-5 rounded-[24px] uppercase text-sm shadow-xl hover:shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <span className="animate-spin">⟳</span>
                Sending...
              </>
            ) : targetId && targetId !== 'broadcast' ? (
              <>
                <ICONS.Send className="w-4 h-4" />
                Send to Selected User
              </>
            ) : (
              <>
                <ICONS.Megaphone className="w-4 h-4" />
                Broadcast to All Users
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sent Broadcasts */}
      <div className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-xl font-black text-white italic">Previous Broadcasts</h3>
          <span className="text-[10px] text-slate-500 font-bold">
            {broadcasts.length} total
          </span>
        </div>
        
        {broadcasts.length === 0 ? (
          <div className="text-center py-12 glass-panel rounded-3xl">
            <ICONS.Message className="w-20 h-20 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-600 text-sm font-black uppercase mb-2">
              No broadcasts yet
            </p>
            <p className="text-slate-700 text-[10px] max-w-xs mx-auto">
              Your first broadcast will appear here. You can send to all users or specific users.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {broadcasts.map(broadcast => {
              const targetInfo = getBroadcastTargetInfo(broadcast);
              
              return (
                <div 
                  key={broadcast.id} 
                  className="glass-panel p-6 rounded-[32px] border-l-4 border-l-cyan-500 space-y-3 hover:bg-white/2 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <targetInfo.icon className="w-4 h-4 text-cyan-500" />
                        <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">
                          {targetInfo.type}
                        </p>
                      </div>
                      <p className="text-[8px] text-slate-500 font-bold">
                        {formatDate(broadcast.timestamp)}
                      </p>
                      {broadcast.targetUserId && (
                        <p className="text-[9px] text-slate-400">
                          To: {targetInfo.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] px-2 py-1 bg-cyan-500/10 text-cyan-500 rounded-full">
                        Sent
                      </span>
                      {broadcast.readBy && (
                        <span className="text-[8px] px-2 py-1 bg-green-500/10 text-green-500 rounded-full">
                          {broadcast.readBy.length} read
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-white/5">
                    <p className="text-sm text-white leading-relaxed font-medium whitespace-pre-line">
                      {broadcast.content}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[8px] text-slate-500">
                      <ICONS.User className="w-3 h-3" />
                      <span>From: @{broadcast.senderName || 'Admin'}</span>
                    </div>
                    
                    {broadcast.targetUserId && (
                      <button 
                        onClick={() => {
                          setTargetId(broadcast.targetUserId);
                          showToast(`Target set to ${targetInfo.name}`, 'info');
                        }}
                        className="text-[8px] px-3 py-1 bg-white/5 hover:bg-cyan-500/10 text-cyan-400 rounded-full transition-colors"
                      >
                        Resend to same user
                      </button>
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
