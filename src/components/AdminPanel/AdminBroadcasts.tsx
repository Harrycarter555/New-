import React, { useState, useEffect } from 'react';
import { broadcastService, userService } from './firebaseService';
import { ICONS } from '../../constants'; // Or wherever your constants are
import { User, UserRole, UserStatus, Broadcast } from '../../types';

interface AdminBroadcastsProps {
  broadcasts: Broadcast[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: User;
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ broadcasts, showToast, currentUser }) => {
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [targetId, setTargetId] = useState<string>('broadcast');
  const [sending, setSending] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await userService.getUsers();
        setAvailableUsers(users.filter(u => u.role !== UserRole.ADMIN && u.status === UserStatus.ACTIVE));
      } catch (error) {
        console.error('User fetch failed');
      }
    };
    fetchUsers();
  }, []);

  const handleSend = async () => {
    if (!broadcastMsg.trim()) return;
    setSending(true);
    try {
      await broadcastService.createBroadcast({
        content: broadcastMsg.trim(),
        senderId: currentUser.id,
        senderName: currentUser.username || 'Admin',
        targetUserId: targetId !== 'broadcast' ? targetId : undefined
      });
      showToast('Message Dispatched!', 'success');
      setBroadcastMsg('');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
        {/* ✅ FIXED: Megaphone replaced with Campaign */}
        <h3 className="text-white font-black mb-4 flex items-center gap-2">
          <ICONS.Campaign className="w-5 h-5 text-cyan-400"/> NEW MESSAGE
        </h3>
        
        <select 
          value={targetId} 
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white mb-4 outline-none focus:border-cyan-500"
        >
          <option value="broadcast">🌐 ALL USERS (BROADCAST)</option>
          {availableUsers.map(u => <option key={u.id} value={u.id}>👤 @{u.username}</option>)}
        </select>
        
        <textarea 
          value={broadcastMsg} 
          onChange={(e) => setBroadcastMsg(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white h-32 mb-4 outline-none focus:border-cyan-500"
          placeholder="Enter message content..."
        />
        
        <button 
          onClick={handleSend} 
          disabled={sending}
          className="w-full bg-cyan-500 text-black font-black py-4 rounded-xl hover:bg-cyan-400 disabled:opacity-50"
        >
          {sending ? 'SENDING...' : 'SEND MESSAGE'}
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-slate-500 font-black text-xs tracking-widest uppercase">Message History</h3>
        {broadcasts.length === 0 ? (
          <div className="text-center py-10 text-slate-600">No history found.</div>
        ) : (
          broadcasts.map(b => (
            <div key={b.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl">
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${b.targetUserId ? 'bg-green-500/20 text-green-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                  {b.targetUserId ? 'DIRECT' : 'GLOBAL'}
                </span>
                <span className="text-[10px] text-slate-500">{new Date(b.timestamp).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-300">{b.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminBroadcasts;
