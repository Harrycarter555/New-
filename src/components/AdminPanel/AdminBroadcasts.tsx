import React, { useState } from 'react';
import { broadcastService } from './firebaseService';
import { ICONS } from '../../utils/constants';

interface AdminBroadcastsProps {
  broadcasts: any[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: any;
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ broadcasts, showToast, currentUser }) => {
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [targetId, setTargetId] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) {
      showToast('Message content is required', 'error');
      return;
    }

    setSending(true);
    try {
      await broadcastService.createBroadcast({
        content: broadcastMsg,
        senderId: currentUser.id,
        targetUserId: targetId || undefined
      });

      showToast('Broadcast sent successfully', 'success');
      setBroadcastMsg('');
      setTargetId('');
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

  return (
    <div className="space-y-8 animate-slide">
      {/* Create Broadcast Form */}
      <div className="glass-panel p-10 rounded-[48px] border-t-8 border-cyan-500 space-y-6 shadow-2xl">
        <h3 className="text-xl font-black italic text-white italic uppercase tracking-tighter">
          Directive Dispatch
        </h3>
        
        <div className="space-y-4">
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white outline-none shadow-inner focus:border-cyan-500"
          >
            <option value="" className="bg-black">Target Mode: BROADCAST (NETWORK)</option>
            <option value="specific" disabled className="bg-black text-slate-500">
              ── Specific User ──
            </option>
            {/* User options would be populated dynamically */}
            <option value="user-1" className="bg-black">Target Node: @pro_creator</option>
          </select>
          
          <textarea
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white h-32 resize-none outline-none focus:border-cyan-500 transition-all shadow-inner"
            placeholder="Enter directive content..."
            maxLength={500}
          />
          
          <div className="flex justify-between items-center text-[9px] text-slate-600">
            <span>Max 500 characters</span>
            <span>{broadcastMsg.length}/500</span>
          </div>
          
          <button
            onClick={handleSendBroadcast}
            disabled={sending || !broadcastMsg.trim()}
            className="w-full btn-primary py-7 rounded-[24px] font-black uppercase text-sm shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Launch Dispatch'}
          </button>
        </div>
      </div>

      {/* Sent Broadcasts */}
      <div className="space-y-6">
        <h3 className="text-xl font-black text-white italic px-2">Previous Broadcasts</h3>
        
        {broadcasts.length === 0 ? (
          <div className="text-center py-12">
            <ICONS.Message className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-600 text-sm font-black uppercase">No broadcasts sent yet</p>
          </div>
        ) : (
          broadcasts.map(broadcast => (
            <div key={broadcast.id} className="glass-panel p-6 rounded-[32px] border-l-4 border-l-cyan-500 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">
                    {broadcast.targetUserId ? 'SPECIFIC USER' : 'NETWORK BROADCAST'}
                  </p>
                  <p className="text-[8px] text-slate-500 font-bold">
                    {formatDate(broadcast.timestamp)}
                  </p>
                </div>
                <span className="text-[8px] px-2 py-1 bg-cyan-500/10 text-cyan-500 rounded-full">
                  Sent
                </span>
              </div>
              
              <p className="text-sm text-white leading-relaxed font-medium">
                {broadcast.content}
              </p>
              
              {broadcast.targetUserId && (
                <div className="flex items-center gap-2 text-[8px] text-slate-500">
                  <ICONS.User className="w-3 h-3" />
                  <span>Targeted to specific user</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminBroadcasts;
