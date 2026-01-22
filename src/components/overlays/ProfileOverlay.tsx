// Updated ProfileOverlay with professional design
import React, { useState } from 'react';
import { User, UserStatus } from '../../types';
import { ICONS } from '../../constants';

interface ProfileOverlayProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onLogout: () => void;
}

const ProfileOverlay: React.FC<ProfileOverlayProps> = ({ isOpen, user, onClose, onLogout }) => {
  const [showKey, setShowKey] = useState(false);

  if (!isOpen || !user) return null;

  const getStatusColor = (status: string) => {
    switch(status) {
      case UserStatus.ACTIVE: return 'text-green-500 bg-green-500/10 border-green-500/20';
      case UserStatus.SUSPENDED: return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case UserStatus.BANNED: return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex flex-col overflow-y-auto animate-slide">
      {/* Header */}
      <div className="sticky top-0 bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 py-5 flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-3 bg-white/5 rounded-xl border border-white/10 active:scale-90 transition-all"
        >
          <ICONS.ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-lg font-black text-white uppercase tracking-tighter">Profile</h2>
        <div className="w-10"></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 max-w-lg mx-auto w-full space-y-8">
        {/* User Info Card */}
        <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-3xl font-black text-white">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-black text-white">{user.username}</h3>
              <p className="text-sm text-slate-400">{user.email}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(user.status)}`}>
                {user.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-xs text-slate-400">Balance</p>
              <p className="text-lg font-black text-white">₹{user.walletBalance.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-xs text-slate-400">Pending</p>
              <p className="text-lg font-black text-cyan-400">₹{user.pendingBalance.toLocaleString()}</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl">
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-lg font-black text-green-400">₹{user.totalEarnings.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
          <h4 className="text-lg font-black text-white">Security</h4>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400 mb-1">Recovery Key</p>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="font-mono text-sm">{showKey ? user.securityKey : '••••••••••••••••••••'}</p>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="text-cyan-400 text-sm font-bold"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">Linked Account</p>
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-sm font-bold text-white">{user.savedSocialUsername || 'Not Linked'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">Payout Method</p>
              <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                <p className="text-sm font-bold text-white">{user.payoutMethod || 'Not Set'}</p>
                {user.payoutDetails && (
                  <p className="text-xs text-slate-400 mt-1">{user.payoutDetails}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
          <h4 className="text-lg font-black text-white">Account Information</h4>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <p className="text-sm text-slate-400">User ID</p>
              <p className="text-sm font-bold text-white">{user.id}</p>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <p className="text-sm text-slate-400">Role</p>
              <p className="text-sm font-bold text-white capitalize">{user.role}</p>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-white/5">
              <p className="text-sm text-slate-400">Joined</p>
              <p className="text-sm font-bold text-white">
                {new Date(user.joinedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={() => {
            onLogout();
            onClose();
          }}
          className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-bold uppercase tracking-wider active:scale-95 transition-all"
        >
          Logout
        </button>

        <p className="text-center text-xs text-slate-600">
          Account created on {new Date(user.joinedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default ProfileOverlay;
