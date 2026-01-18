import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, getDocs, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, UserRole, UserStatus } from '../../types';
import { ICONS } from '../../utils/constants';

interface AdminSecurityKeysProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AdminSecurityKeys: React.FC<AdminSecurityKeysProps> = ({ showToast }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newKey, setNewKey] = useState('');

  // Fetch all users
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', UserRole.USER));
      const querySnapshot = await getDocs(q);
      
      const usersList: User[] = [];
      querySnapshot.forEach((doc) => {
        usersList.push({ id: doc.id, ...doc.data() } as User);
      });
      
      setUsers(usersList);
    } catch (error) {
      console.error('Error fetching users:', error);
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      user.username.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.id.toLowerCase().includes(query) ||
      (user.securityKey && user.securityKey.toLowerCase().includes(query))
    );
  }, [users, searchQuery]);

  // Generate new security key
  const generateSecurityKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `REEL-${key.substring(0, 8)}-${key.substring(8, 16)}-${key.substring(16, 24)}-${key.substring(24, 32)}`;
  };

  // Regenerate security key for user
  const handleRegenerateKey = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      const newSecurityKey = generateSecurityKey();
      
      // Update in Firestore
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        securityKey: newSecurityKey,
        updatedAt: Date.now()
      });

      // Update local state
      setUsers(users.map(u => 
        u.id === selectedUser.id 
          ? { ...u, securityKey: newSecurityKey }
          : u
      ));

      setNewKey(newSecurityKey);
      setShowRegenerateModal(false);
      setShowKeyModal(true);
      
      showToast(`Security key regenerated for @${selectedUser.username}`, 'success');
      
    } catch (error) {
      console.error('Error regenerating key:', error);
      showToast('Failed to regenerate security key', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Copy key to clipboard
  const copyKeyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    showToast('Security key copied to clipboard!', 'success');
  };

  // Format date
  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get key status
  const getKeyStatus = (user: User) => {
    if (!user.securityKey) return { status: 'Missing', color: 'text-red-400', bg: 'bg-red-500/20' };
    
    const keyAge = user.joinedAt ? Date.now() - user.joinedAt : 0;
    const daysOld = keyAge / (1000 * 60 * 60 * 24);
    
    if (daysOld > 180) return { status: 'Old (6+ months)', color: 'text-amber-400', bg: 'bg-amber-500/20' };
    if (daysOld > 90) return { status: 'Aged (3+ months)', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { status: 'Active', color: 'text-green-400', bg: 'bg-green-500/20' };
  };

  // Check if user has recovery requests
  const hasRecoveryRequest = async (userId: string): Promise<boolean> => {
    try {
      const requestsRef = collection(db, 'recovery_requests');
      const q = query(requestsRef, where('userId', '==', userId), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking recovery requests:', error);
      return false;
    }
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="bg-black/50 border border-slate-800 p-6 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
              <ICONS.Key className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Security Keys Management</h3>
              <p className="text-sm text-slate-400">
                View and manage user security keys for account recovery
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Total Users</p>
            <p className="text-2xl font-bold text-white">{users.length}</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-black/50 border border-slate-800 p-4 rounded-xl">
        <div className="relative">
          <ICONS.Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search users by username, email, user ID, or security key..."
            className="w-full bg-black/30 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-slate-500">
            {filteredUsers.length} users found
          </span>
          <button
            onClick={fetchUsers}
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-2"
          >
            <ICONS.Refresh className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500"></div>
          <p className="text-slate-500 text-sm mt-2">Loading security keys...</p>
        </div>
      )}

      {/* Users List */}
      {!loading && filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-black/30 rounded-xl border border-slate-800">
          <ICONS.Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-bold">
            {searchQuery ? 'No users found' : 'No users available'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(user => {
            const keyStatus = getKeyStatus(user);
            
            return (
              <div 
                key={user.id} 
                className="bg-black/30 border border-slate-800 p-4 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/5 transition-all cursor-pointer"
                onClick={() => {
                  setSelectedUser(user);
                  setShowKeyModal(true);
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-cyan-500/30">
                      <span className="text-cyan-400 font-bold">
                        {user.username?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white truncate max-w-[120px]">
                        @{user.username}
                      </h4>
                      <p className="text-xs text-slate-400 truncate max-w-[120px]">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  
                  <span className={`text-xs px-2 py-1 rounded-full ${keyStatus.bg} ${keyStatus.color}`}>
                    {keyStatus.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="p-2 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">Security Key</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-mono text-white truncate mr-2">
                        {user.securityKey 
                          ? `${user.securityKey.substring(0, 12)}...` 
                          : 'Not generated'
                        }
                      </p>
                      {user.securityKey && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyKeyToClipboard(user.securityKey!);
                          }}
                          className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded hover:bg-purple-500/30"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-slate-800/30 rounded">
                      <p className="text-xs text-slate-400">Joined</p>
                      <p className="text-xs font-bold text-white">
                        {formatDate(user.joinedAt)}
                      </p>
                    </div>
                    <div className="p-2 bg-slate-800/30 rounded">
                      <p className="text-xs text-slate-400">Last Login</p>
                      <p className="text-xs font-bold text-white">
                        {formatDate(user.lastLoginAt)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser(user);
                      setShowRegenerateModal(true);
                    }}
                    className="w-full text-xs bg-amber-500/10 text-amber-400 py-2 rounded-lg font-bold hover:bg-amber-500/20 transition-colors"
                  >
                    🔄 Regenerate Key
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Regenerate Key Modal */}
      {selectedUser && showRegenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-slate-800 w-full max-w-md rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-black/50">
              <h3 className="text-xl font-bold text-white">Regenerate Security Key</h3>
              <p className="text-sm text-slate-400 mt-1">
                This will replace the existing security key for @{selectedUser.username}
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
                <p className="text-sm text-red-400 font-bold mb-2">⚠️ IMPORTANT WARNING</p>
                <ul className="text-xs text-red-300 space-y-1">
                  <li>• User's old security key will become invalid</li>
                  <li>• User must save the new key for future recovery</li>
                  <li>• Cannot undo this action</li>
                  <li>• User may lose access if they don't save the new key</li>
                </ul>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400">User Information</p>
                  <p className="text-sm font-bold text-white">@{selectedUser.username}</p>
                  <p className="text-xs text-slate-400">{selectedUser.email}</p>
                </div>

                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400">Current Key Status</p>
                  <p className="text-sm font-mono text-white break-all">
                    {selectedUser.securityKey || 'No key assigned'}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleRegenerateKey}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold py-3 rounded-lg hover:opacity-90"
                  >
                    Generate New Key
                  </button>
                  <button
                    onClick={() => setShowRegenerateModal(false)}
                    className="flex-1 bg-slate-800 text-slate-400 font-bold py-3 rounded-lg hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Display Modal */}
      {selectedUser && showKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-slate-800 w-full max-w-md rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-black/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Security Key Details</h3>
                  <p className="text-sm text-slate-400 mt-1">@{selectedUser.username}</p>
                </div>
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center hover:bg-slate-700"
                >
                  <ICONS.Close className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
                  <span className="text-purple-400 text-2xl font-bold">
                    {selectedUser.username?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">@{selectedUser.username}</h4>
                  <p className="text-sm text-slate-400">{selectedUser.email}</p>
                  <div className="mt-2 text-xs text-slate-500">
                    User ID: {selectedUser.id.substring(0, 12)}...
                  </div>
                </div>
              </div>

              {/* Security Key Display */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-300">Security Key</span>
                  <button
                    onClick={() => copyKeyToClipboard(selectedUser.securityKey || '')}
                    className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-lg hover:bg-purple-500/30"
                  >
                    📋 Copy Key
                  </button>
                </div>
                
                <div className="p-4 bg-black/50 border-2 border-purple-500/30 rounded-lg">
                  <p className="text-center font-mono text-white text-lg tracking-wider break-all">
                    {newKey || selectedUser.securityKey || 'NO KEY ASSIGNED'}
                  </p>
                </div>
                
                <p className="text-xs text-slate-500 mt-2">
                  {newKey 
                    ? '⚠️ This is the NEW security key. User must save this!' 
                    : 'User needs this key for account recovery. Admin cannot recover account without this key.'
                  }
                </p>
              </div>

              {/* Key Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400">Key Generated</p>
                  <p className="text-sm font-bold text-white">
                    {formatDate(selectedUser.joinedAt)}
                  </p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xs text-slate-400">Status</p>
                  <p className={`text-sm font-bold ${getKeyStatus(selectedUser).color}`}>
                    {getKeyStatus(selectedUser).status}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setShowKeyModal(false);
                    setShowRegenerateModal(true);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold py-3 rounded-lg hover:opacity-90"
                >
                  🔄 Regenerate This Key
                </button>
                
                <button
                  onClick={() => {
                    if (selectedUser.email) {
                      navigator.clipboard.writeText(selectedUser.email);
                      showToast('Email copied to clipboard', 'success');
                    }
                  }}
                  className="w-full bg-slate-800 text-slate-400 font-bold py-3 rounded-lg hover:bg-slate-700"
                >
                  Copy User Email
                </button>
              </div>

              {/* Important Note */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-400 font-bold">🔐 IMPORTANT:</p>
                <ul className="text-xs text-amber-300 mt-1 space-y-1">
                  <li>• Only share this key with the user via secure channel</li>
                  <li>• User MUST save this key for future recovery</li>
                  <li>• Without this key, account recovery is impossible</li>
                  <li>• Store securely - this key grants full account access</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSecurityKeys;
