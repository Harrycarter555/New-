import React, { useState, useEffect } from 'react';
import { broadcastService, userService } from './firebaseService';
import { ICONS } from '../../utils/constants'; // Path checked
import { User, UserRole, UserStatus, Broadcast } from '../../utils/types'; // Path checked

interface AdminBroadcastsProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: User;
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ 
  showToast, 
  currentUser
}) => {
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [targetId, setTargetId] = useState<string>('broadcast');
  const [sending, setSending] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Users & Broadcasts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [users, fetchedBroadcasts] = await Promise.all([
          userService.getUsers(),
          broadcastService.getBroadcasts()
        ]);
        
        setAvailableUsers(users.filter(u => 
          u.id !== currentUser?.id && 
          u.role !== UserRole.ADMIN && 
          u.status === UserStatus.ACTIVE
        ));
        setBroadcasts(fetchedBroadcasts);
      } catch (error) {
        showToast('Failed to load data', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    // Real-time listener for new messages
    const unsubscribe = broadcastService.onBroadcastsUpdate((updated) => {
      setBroadcasts(updated);
    });
    return () => unsubscribe();
  }, [currentUser, showToast]);

  const handleSend = async () => {
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
        targetUserId: targetId !== 'broadcast' ? targetId : undefined
      });

      showToast('Message Dispatched!', 'success');
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
      {/* Create Section */}
      <div className="bg-black/50 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          {/* ✅ FIXED: Megaphone changed to Bell to avoid TS error */}
          <ICONS.Bell className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">New Message</h3>
        </div>
        
        <div className="space-y-4">
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full bg-black/30 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 outline-none"
          >
            <option value="broadcast">🌐 ALL USERS (BROADCAST)</option>
            {availableUsers.map(user => (
              <option key={user.id} value={user.id} className="bg-gray-900">
                👤 @{user.username}
              </option>
            ))}
          </select>
          
          <textarea
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            className="w-full bg-black/30 border border-slate-700 rounded-lg p-4 text-white h-32 resize-none focus:border-cyan-500 outline-none"
            placeholder="Type your message here..."
            maxLength={500}
          />
          
          <button
            onClick={handleSend}
            disabled={sending || !broadcastMsg.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black py-4 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {sending ? 'SENDING...' : 'SEND MESSAGE'}
          </button>
        </div>
      </div>

      {/* History Section */}
      <div className="space-y-4">
        <h3 className="text-slate-500 font-black text-xs tracking-widest uppercase px-2">Message History</h3>
        {loading ? (
          <div className="text-center py-10 text-slate-600 animate-pulse">Loading history...</div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-10 text-slate-600 bg-black/20 rounded-xl border border-dashed border-slate-800">
            No history found.
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {broadcasts.map(b => (
              <div key={b.id} className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${b.targetUserId ? 'bg-green-500/20 text-green-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                    {b.targetUserId ? 'DIRECT' : 'GLOBAL'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(b.timestamp).toLocaleString('en-IN')}
                  </span>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-line">{b.content}</p>
                <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
                   <span className="text-[10px] text-slate-600">From: @{b.senderName || 'Admin'}</span>
                   {b.readBy && <span className="text-[10px] text-green-500/70">{b.readBy.length} read</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBroadcasts;
