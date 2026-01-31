import React, { useState, useEffect } from 'react';
import { ICONS } from '../../constants';
import { 
  collection, addDoc, serverTimestamp, 
  query, where, orderBy, onSnapshot, 
  doc, updateDoc, arrayUnion, getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../firebase';

interface AdminBroadcastsProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: any;
  users: any[];
}

const AdminBroadcasts: React.FC<AdminBroadcastsProps> = ({ 
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
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ REAL-TIME BROADCASTS LISTENER
  useEffect(() => {
    setLoading(true);
    
    const broadcastsRef = collection(db, 'broadcasts');
    const q = query(broadcastsRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const broadcastsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBroadcasts(broadcastsData);
      setLoading(false);
    }, (error) => {
      console.error('Broadcasts listener error:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Filter regular users (non-admin)
  const regularUsers = users.filter(u => u.role !== 'admin');

  // ✅ SEND BROADCAST FUNCTION
  const handleSendBroadcast = async () => {
    if (!content.trim()) {
      showToast('Broadcast content is required', 'error');
      return;
    }

    if (targetType === 'specific' && !targetUserId) {
      showToast('Please select a user', 'error');
      return;
    }

    if (targetType === 'multiple' && selectedUsers.length === 0) {
      showToast('Please select at least one user', 'error');
      return;
    }

    setSending(true);
    try {
      if (targetType === 'all') {
        // ✅ SEND TO ALL USERS
        await addDoc(collection(db, 'broadcasts'), {
          content: content.trim(),
          senderId: currentUser.id,
          senderName: currentUser.username || 'Admin',
          targetUserId: null, // null = all users
          type: 'broadcast',
          timestamp: serverTimestamp(),
          readBy: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // ✅ ADD TO USER LOGS
        await logBroadcastToAllUsers(content.trim(), currentUser.id);
        
        showToast('Broadcast sent to all users successfully', 'success');
        
      } else if (targetType === 'specific' && targetUserId) {
        // ✅ SEND TO SPECIFIC USER
        const targetUser = users.find(u => u.id === targetUserId);
        
        await addDoc(collection(db, 'broadcasts'), {
          content: content.trim(),
          senderId: currentUser.id,
          senderName: currentUser.username || 'Admin',
          targetUserId: targetUserId,
          targetUserName: targetUser?.username || 'User',
          type: 'targeted',
          timestamp: serverTimestamp(),
          readBy: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // ✅ ADD TO USER'S PERSONAL LOGS
        await addDoc(collection(db, 'user_logs'), {
          userId: targetUserId,
          type: 'admin_message',
          message: `Admin message: ${content.substring(0, 50)}...`,
          adminId: currentUser.id,
          adminName: currentUser.username || 'Admin',
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp()
        });

        showToast(`Broadcast sent to @${targetUser?.username || 'user'}`, 'success');
        
      } else if (targetType === 'multiple' && selectedUsers.length > 0) {
        // ✅ SEND TO MULTIPLE USERS (BATCH OPERATION)
        const batch = writeBatch(db);
        
        for (const userId of selectedUsers) {
          const user = users.find(u => u.id === userId);
          const broadcastRef = doc(collection(db, 'broadcasts'));
          
          batch.set(broadcastRef, {
            content: content.trim(),
            senderId: currentUser.id,
            senderName: currentUser.username || 'Admin',
            targetUserId: userId,
            targetUserName: user?.username || 'User',
            type: 'targeted',
            timestamp: serverTimestamp(),
            readBy: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // ✅ ADD TO EACH USER'S LOGS
          const userLogRef = doc(collection(db, 'user_logs'));
          batch.set(userLogRef, {
            userId: userId,
            type: 'admin_message',
            message: `Admin message: ${content.substring(0, 50)}...`,
            adminId: currentUser.id,
            adminName: currentUser.username || 'Admin',
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        }

        await batch.commit();
        showToast(`Broadcast sent to ${selectedUsers.length} user(s)`, 'success');
      } else {
        showToast('Please select recipient(s)', 'error');
        return;
      }
      
      // ✅ RESET FORM
      setContent('');
      setTargetUserId('');
      setSelectedUsers([]);
      setTargetType('all');
      
    } catch (error: any) {
      console.error('Error sending broadcast:', error);
      showToast(error.message || 'Failed to send broadcast', 'error');
    } finally {
      setSending(false);
    }
  };

  // ✅ LOG BROADCAST TO ALL USERS
  const logBroadcastToAllUsers = async (message: string, adminId: string) => {
    try {
      const regularUsers = users.filter(u => u.role !== 'admin');
      const batch = writeBatch(db);
      
      // Log to first 50 users (to avoid too many writes)
      regularUsers.slice(0, 50).forEach(user => {
        const logRef = doc(collection(db, 'user_logs'));
        batch.set(logRef, {
          userId: user.id,
          type: 'system_message',
          message: `System broadcast: ${message.substring(0, 50)}...`,
          timestamp: serverTimestamp(),
          createdAt: serverTimestamp()
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error logging broadcast:', error);
      // Don't show error to admin - this is just logging
    }
  };

  // ✅ DELETE BROADCAST
  const handleDeleteBroadcast = async (broadcastId: string) => {
    if (!window.confirm('Are you sure you want to delete this broadcast?')) return;
    
    try {
      await updateDoc(doc(db, 'broadcasts', broadcastId), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: currentUser.id,
        updatedAt: serverTimestamp()
      });
      
      showToast('Broadcast deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to delete broadcast', 'error');
    }
  };

  // ✅ MARK BROADCAST AS READ (FOR ADMIN VIEW)
  const handleMarkAsRead = async (broadcastId: string) => {
    try {
      await updateDoc(doc(db, 'broadcasts', broadcastId), {
        readBy: arrayUnion(currentUser.id),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  // ✅ TOGGLE USER SELECTION
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // ✅ SELECT ALL USERS
  const selectAllUsers = () => {
    const allUserIds = regularUsers.map(u => u.id);
    setSelectedUsers(allUserIds);
    showToast(`Selected all ${allUserIds.length} users`, 'success');
  };

  // ✅ CLEAR ALL SELECTIONS
  const clearSelections = () => {
    setSelectedUsers([]);
    showToast('Cleared all selections', 'success');
  };

  // ✅ FILTER USERS
  const filteredUsers = regularUsers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ✅ FORMAT DATE
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ✅ GET READ COUNT
  const getReadCount = (broadcast: any) => {
    if (!broadcast.readBy) return 0;
    return broadcast.readBy.length;
  };

  // ✅ GET TARGET USERNAME
  const getTargetUserName = (broadcast: any) => {
    if (!broadcast.targetUserId) return 'All Users';
    const user = users.find(u => u.id === broadcast.targetUserId);
    return user ? `@${user.username}` : 'Unknown User';
  };

  return (
    <div className="space-y-8 animate-slide">
      {/* Send Broadcast Form */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black text-white">Send Broadcast</h3>
          <div className="text-sm text-slate-400">
            <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full">
              {regularUsers.length} active users
            </span>
          </div>
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
              maxLength={1000}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Max 1000 characters</span>
              <span>{content.length}/1000</span>
            </div>
          </div>

          {/* Target Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-300">
              Select Recipients
            </label>
            
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => {
                  setTargetType('all');
                  setSelectedUsers([]);
                  setTargetUserId('');
                }}
                className={`py-3 rounded-xl font-bold transition-all ${
                  targetType === 'all'
                    ? 'bg-cyan-500 text-black shadow-lg'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                All Users
              </button>
              <button
                onClick={() => {
                  setTargetType('specific');
                  setSelectedUsers([]);
                }}
                className={`py-3 rounded-xl font-bold transition-all ${
                  targetType === 'specific'
                    ? 'bg-cyan-500 text-black shadow-lg'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Specific User
              </button>
              <button
                onClick={() => {
                  setTargetType('multiple');
                  setTargetUserId('');
                }}
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-cyan-400 font-bold">
                          Selected: @{users.find(u => u.id === targetUserId)?.username}
                        </p>
                        <p className="text-xs text-slate-400">
                          {users.find(u => u.id === targetUserId)?.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Balance</p>
                        <p className="text-sm font-bold text-white">
                          ₹{users.find(u => u.id === targetUserId)?.walletBalance?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Multiple Users Selection */}
            {targetType === 'multiple' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <ICONS.Search className="w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      placeholder="Search users by username or email..."
                    />
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={selectAllUsers}
                      className="px-3 py-2 bg-green-500/10 text-green-400 rounded-lg text-xs font-bold hover:bg-green-500/20"
                    >
                      Select All
                    </button>
                    <button
                      onClick={clearSelections}
                      className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/20"
                    >
                      Clear
                    </button>
                  </div>
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
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-white">@{user.username}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                user.status === 'active' 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {user.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-cyan-400">
                              ₹{user.walletBalance?.toLocaleString() || 0}
                            </p>
                            <p className="text-xs text-slate-500">balance</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedUsers.length > 0 && (
                  <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-cyan-400 font-bold">
                        Selected {selectedUsers.length} user(s)
                      </p>
                      <p className="text-xs text-slate-500">
                        Total reach: {selectedUsers.length} users
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedUsers.slice(0, 5).map(userId => {
                        const user = users.find(u => u.id === userId);
                        return (
                          <span
                            key={userId}
                            className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-lg text-xs flex items-center gap-1"
                          >
                            <span>@{user?.username}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleUserSelection(userId);
                              }}
                              className="text-red-400 hover:text-red-300"
                            >
                              ×
                            </button>
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
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 rounded-2xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <ICONS.Refresh className="w-5 h-5 animate-spin" />
                Sending Broadcast...
              </>
            ) : (
              <>
                <ICONS.Send className="w-5 h-5" />
                Send Broadcast
              </>
            )}
          </button>
        </div>
      </div>

      {/* Broadcast History */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black text-white">Broadcast History</h3>
          <div className="text-sm text-slate-400">
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                Loading...
              </span>
            ) : (
              <span>Total: {broadcasts.length} broadcasts</span>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500 mb-4"></div>
            <p className="text-slate-500">Loading broadcasts...</p>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-16 bg-black/30 rounded-2xl border border-slate-800">
            <ICONS.Bell className="w-20 h-20 text-slate-700 mx-auto mb-6" />
            <p className="text-slate-500 text-lg font-bold mb-2">No broadcasts sent yet</p>
            <p className="text-sm text-slate-600">Send your first broadcast to users</p>
          </div>
        ) : (
          <div className="space-y-4">
            {broadcasts.slice(0, 20).map(broadcast => {
              const isRead = broadcast.readBy?.includes(currentUser.id);
              const readCount = getReadCount(broadcast);
              
              return (
                <div key={broadcast.id} className={`glass-panel p-6 rounded-2xl border ${
                  isRead ? 'border-slate-800' : 'border-cyan-500/30 bg-cyan-500/5'
                } transition-all`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <p className="text-white mb-4 text-lg leading-relaxed">{broadcast.content}</p>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${
                            broadcast.targetUserId ? 'bg-purple-500' : 'bg-green-500'
                          }`}></div>
                          <span className="text-sm text-slate-400">
                            {broadcast.targetUserId ? 'Targeted' : 'Broadcast'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <ICONS.User className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-bold text-cyan-400">
                            {getTargetUserName(broadcast)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <ICONS.Users className="w-4 h-4 text-slate-500" />
                          <span className="text-sm text-slate-400">
                            {readCount} read
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {!isRead && (
                        <button
                          onClick={() => handleMarkAsRead(broadcast.id)}
                          className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20"
                          title="Mark as read"
                        >
                          <ICONS.Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBroadcast(broadcast.id)}
                        className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                        title="Delete broadcast"
                      >
                        <ICONS.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-cyan-500/10 rounded-full flex items-center justify-center">
                        <ICONS.User className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          By: {broadcast.senderName || 'Admin'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(broadcast.timestamp)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Status</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isRead ? 'bg-slate-800 text-slate-400' : 'bg-cyan-500/20 text-cyan-400'
                      }`}>
                        {isRead ? 'Read' : 'Unread'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Broadcast Stats */}
        {broadcasts.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-xl text-center">
              <p className="text-xs text-slate-400 mb-1">Total Sent</p>
              <p className="text-lg font-bold text-white">{broadcasts.length}</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl text-center">
              <p className="text-xs text-slate-400 mb-1">Broadcasts</p>
              <p className="text-lg font-bold text-green-400">
                {broadcasts.filter(b => !b.targetUserId).length}
              </p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl text-center">
              <p className="text-xs text-slate-400 mb-1">Targeted</p>
              <p className="text-lg font-bold text-purple-400">
                {broadcasts.filter(b => b.targetUserId).length}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBroadcasts;
