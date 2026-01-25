import React, { useState } from 'react';
import { Broadcast } from '../../types';
import { ICONS } from '../../constants';
import { adminService, broadcastService } from './firebaseService';

interface AdminBroadcastsProps {
  broadcasts: Broadcast[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: any;
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ broadcasts, showToast, currentUser }) => {
  const [content, setContent] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendBroadcast = async () => {
    if (!content.trim()) {
      showToast('Broadcast content is required', 'error');
      return;
    }

    setSending(true);
    try {
      await broadcastService.sendBroadcast(
        content,
        currentUser.id,
        currentUser.username,
        targetUserId || undefined
      );
      
      showToast('Broadcast sent successfully', 'success');
      setContent('');
      setTargetUserId('');
    } catch (error: any) {
      showToast(error.message || 'Failed to send broadcast', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide">
      {/* Send Broadcast Form */}
      <div className="bg-black/50 border border-slate-800 p-6 rounded-3xl">
        <h3 className="text-xl font-bold text-white mb-4">Send Broadcast</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              Broadcast Message *
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 h-32 resize-none"
              placeholder="Enter broadcast message..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              Target User ID (Optional - leave empty for all users)
            </label>
            <input
              type="text"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              placeholder="Enter user ID for targeted broadcast"
            />
          </div>

          <button
            onClick={handleSendBroadcast}
            disabled={sending || !content.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </div>

      {/* Broadcast History */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Broadcast History</h3>
        
        {broadcasts.length === 0 ? (
          <div className="text-center py-12 bg-black/30 rounded-xl border border-slate-800">
            <ICONS.Bell className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 text-sm font-bold">No broadcasts sent yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {broadcasts.map(broadcast => (
              <div key={broadcast.id} className="bg-slate-900/30 border border-slate-800 p-4 rounded-xl">
                <p className="text-white mb-2">{broadcast.content}</p>
                <div className="flex justify-between items-center text-sm text-slate-500">
                  <span>By: {broadcast.senderName || 'Admin'}</span>
                  <span>
                    {new Date(broadcast.timestamp).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
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
