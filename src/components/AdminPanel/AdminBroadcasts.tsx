import React, { useState } from 'react';
import { Broadcast, User } from '../../types';
import { ICONS } from '../../constants';
import { broadcastService } from './firebaseService';

interface AdminBroadcastsProps {
  broadcasts: Broadcast[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: User;
  users: User[]; // ✅ अब users की list पास करनी होगी
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ broadcasts, showToast, currentUser, users }) => {
  const [content, setContent] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // ✅ Multiple user selection toggle
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSendBroadcast = async () => {
    if (!content.trim()) {
      showToast('Broadcast content is required', 'error');
      return;
    }
    if (selectedUsers.length === 0) {
      showToast('Please select at least one user', 'error');
      return;
    }

    setSending(true);
    try {
      await broadcastService.sendBroadcast(
        content,
        currentUser.id,
        currentUser.username,
        selectedUsers // ✅ अब multiple user IDs जा रही हैं
      );
      showToast('Broadcast sent successfully', 'success');
      setContent('');
      setSelectedUsers([]);
    } catch (error: any) {
      showToast(error.message || 'Failed to send broadcast', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide">
      {/* Broadcast Form */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center">
          <ICONS.Megaphone className="w-6 h-6 mr-2 text-blue-400" />
          Send Broadcast
        </h2>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Enter broadcast message..."
          className="w-full p-3 rounded bg-gray-800 text-white mb-4"
          rows={4}
        />

        {/* ✅ User selection list */}
        <div className="max-h-40 overflow-y-auto border border-gray-700 rounded mb-4 p-2">
          {users.map(user => (
            <label key={user.id} className="flex items-center text-gray-300 mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedUsers.includes(user.id)}
                onChange={() => toggleUserSelection(user.id)}
                className="mr-2"
              />
              {user.username} ({user.email})
            </label>
          ))}
        </div>

        <button
          onClick={handleSendBroadcast}
          disabled={sending}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send Broadcast'}
        </button>
      </div>

      {/* Broadcast History */}
      <div className="bg-gray-900 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center">
          <ICONS.History className="w-6 h-6 mr-2 text-green-400" />
          Broadcast History
        </h2>
        {broadcasts.length === 0 ? (
          <p className="text-gray-400">No broadcasts yet.</p>
        ) : (
          <ul className="space-y-3">
            {broadcasts.map(b => (
              <li key={b.id} className="bg-gray-800 p-3 rounded text-gray-200">
                <p>{b.content}</p>
                <small className="text-gray-500">
                  Sent by {b.senderName} to {b.targetUserIds?.length || 'All'} users
                </small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminBroadcasts;
