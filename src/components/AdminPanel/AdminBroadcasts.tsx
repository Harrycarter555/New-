import React, { useState, useEffect } from 'react';
import { broadcastService, userService } from './firebaseService';
import { ICONS } from '../../constants'; 
import { User, UserRole, UserStatus, Broadcast } from '../../types';

interface AdminBroadcastsProps {
  broadcasts: Broadcast[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: User;
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ 
  broadcasts,
  showToast, 
  currentUser
}) => {
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [targetId, setTargetId] = useState<string>('broadcast');
  const [sending, setSending] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const users = await userService.getUsers();
        setAllUsers(users);
        const filteredUsers = users.filter(user => 
          user.id !== currentUser?.id && 
          user.role !== UserRole.ADMIN && 
          user.status === UserStatus.ACTIVE
        );
        setAvailableUsers(filteredUsers);
      } catch (error: any) {
        showToast('Failed to load users', 'error');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [currentUser, showToast]);

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) {
      showToast('Message content is required', 'error');
      return;
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

      showToast(targetId === 'broadcast' ? 'Broadcast sent to all' : 'Message sent', 'success');
      setBroadcastMsg('');
      setTargetId('broadcast');
    } catch (error: any) {
      showToast(error.message || 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <div className="bg-black/50 border border-slate-800 p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <ICONS.Message className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">Send Message</h3>
        </div>
        
        <div className="space-y-4">
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full bg-black/30 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="broadcast">🌐 Broadcast to All Users</option>
            {availableUsers.map(user => (
              <option key={user.id} value={user.id}>👤 @{user.username}</option>
            ))}
          </select>
          
          <textarea
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            className="w-full bg-black/30 border border-slate-700 rounded-lg p-4 text-white h-32 resize-none focus:border-cyan-500"
            placeholder="Type your message..."
          />
          
          <button
            onClick={handleSendBroadcast}
            disabled={sending || !broadcastMsg.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {sending ? 'Sending...' : 'Dispatch Message'}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white px-2">History ({broadcasts.length})</h3>
        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {broadcasts.length === 0 ? (
            <p className="text-slate-500 text-center py-10 text-sm">No messages sent yet.</p>
          ) : (
            [...broadcasts].reverse().map(b => (
              <div key={b.id} className="bg-white/5 border border-white/10 p-4 rounded-lg">
                <div className="flex justify-between text-[10px] mb-2">
                  <span className={b.targetUserId ? "text-green-400 font-bold" : "text-cyan-400 font-bold uppercase"}>
                    {b.targetUserId ? 'Direct Message' : 'Global Broadcast'}
                  </span>
                  <span className="text-slate-500">{new Date(b.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-slate-200 text-sm whitespace-pre-line">{b.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcasts;
