// src/components/overlays/UserDetailOverlay.tsx
import React from 'react';
import { User, AppLog, UserStatus } from '../../types';
import { ICONS } from '../../constants';

interface UserDetailOverlayProps {
  isOpen: boolean;
  user: User | null;
  logs: AppLog[];
  onClose: () => void;
}

const UserDetailOverlay: React.FC<UserDetailOverlayProps> = ({ isOpen, user, logs, onClose }) => {
  if (!isOpen || !user) return null;

  const personalLogs = logs.filter(
    (l) => l.userId === user.id && ['verify', 'viral', 'payout'].includes(l.type)
  );

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex flex-col p-8 overflow-y-auto animate-slide">
      <div className="flex justify-between items-center mb-10">
        <button onClick={onClose} className="p-4 bg-white/5 rounded-2xl active:scale-90 border border-white/5">
          <ICONS.ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">
          Node Dossier
        </span>
      </div>

      <div className="glass-panel p-10 rounded-[64px] border-t-8 border-cyan-500 shadow-2xl space-y-10">
        {/* User Avatar & Info */}
        <div className="text-center space-y-2">
          <div className="w-24 h-24 bg-cyan-500/10 rounded-full mx-auto flex items-center justify-center text-5xl font-black text-cyan-400 border border-cyan-500/20">
            {user.username[0].toUpperCase()}
          </div>
          <h2 className="text-3xl font-black italic text-white">@{user.username}</h2>
          <span className={`px-4 py-1.5 rounded-full text-[8px] uppercase border ${
            user.status === UserStatus.ACTIVE ? 'text-green-500 border-green-500/20 bg-green-500/10' : 'text-red-500 border-red-500/20 bg-red-500/10'
          }`}>
            {user.status}
          </span>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-white/5 rounded-3xl text-center shadow-inner">
            <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Balance</p>
            <p className="text-xl font-black text-white">₹{user.walletBalance.toLocaleString()}</p>
          </div>
          <div className="p-6 bg-white/5 rounded-3xl text-center shadow-inner">
            <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Total Earned</p>
            <p className="text-xl font-black text-cyan-400">₹{user.totalEarnings.toLocaleString()}</p>
          </div>
        </div>

        {/* Activity Logs */}
        <div className="space-y-4">
          <h3 className="text-xl font-black text-white uppercase">Activity Logs</h3>
          {personalLogs.length === 0 ? (
            <p className="text-center text-slate-600 italic py-8">No activity yet</p>
          ) : (
            personalLogs.map(log => (
              <div key={log.id} className="p-5 bg-white/5 rounded-2xl border border-white/5 flex justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase">{log.type}</p>
                  <p className="text-[7px] text-slate-600">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
                <p className="text-[10px] italic">{log.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailOverlay;
