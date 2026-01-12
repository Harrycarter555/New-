import React, { useState } from 'react';
import { User } from '../../types';
import { ICONS } from '../../constants';

interface ProfileOverlayProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
}

const ProfileOverlay: React.FC<ProfileOverlayProps> = ({ isOpen, user, onClose }) => {
  const [showKey, setShowKey] = useState(false);

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl flex flex-col p-8 overflow-y-auto animate-slide">
      <div className="flex justify-between items-center mb-10">
        <button
          onClick={onClose}
          className="w-fit p-4 bg-white/5 rounded-2xl active:scale-90 transition-all border border-white/5 shadow-md"
        >
          <ICONS.ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">
          Personal Node Config
        </span>
      </div>

      <div className="glass-panel p-10 rounded-[64px] border-t-8 border-cyan-500 shadow-2xl space-y-8 relative">
        <div className="text-center space-y-3">
          <div className="w-24 h-24 bg-cyan-500/10 rounded-full mx-auto flex items-center justify-center text-5xl font-black text-cyan-400 border border-cyan-500/20 shadow-2xl mb-2">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-3xl font-black italic text-white tracking-tighter leading-none italic">
            @{user.username}
          </h2>
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">
            {user.email}
          </p>
        </div>

        <div className="space-y-6 pt-4">
          {/* Recovery Key */}
          <div className="space-y-1">
            <p className="text-[8px] font-black text-slate-600 uppercase italic px-2 tracking-widest">
              Node Recovery Key
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex justify-between items-center shadow-inner group">
              <p className="text-sm font-black text-white tracking-widest">
                {showKey ? user.securityKey : '•••••••••••••••••••••••••••'}
              </p>
              <button
                onClick={() => setShowKey(!showKey)}
                className="text-cyan-500 active:scale-90 transition-all"
              >
                {/* Eye icon - agar constants mein nahi hai toh SVG daal do */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Linked Handle & Node ID */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[8px] font-black text-slate-600 uppercase italic px-2 tracking-widest">
                Linked Handle
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-inner">
                <p className="text-[10px] font-black text-white truncate italic">
                  {user.savedSocialUsername || 'Not Linked'}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[8px] font-black text-slate-600 uppercase italic px-2 tracking-widest">
                Node ID
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-inner">
                <p className="text-[10px] font-black text-white truncate italic">
                  {user.id}
                </p>
              </div>
            </div>
          </div>

          {/* Settlement Terminal */}
          <div className="space-y-1">
            <p className="text-[8px] font-black text-slate-600 uppercase italic px-2 tracking-widest">
              Settlement Terminal
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-inner">
              <p className="text-[10px] font-black text-white italic uppercase tracking-tighter">
                {user.payoutMethod || 'None'} • {user.payoutDetails || 'No details set'}
              </p>
            </div>
          </div>

          {/* Logout */}
          <div className="pt-4 flex flex-col gap-3">
            <button
              onClick={() => {
                // Logout logic - App se pass kar sakte ho ya yahan alert
                alert('Logged out - implement logout in App.tsx');
                onClose();
              }}
              className="w-full py-5 bg-red-600/10 text-red-600 border border-red-600/20 rounded-[28px] font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
            >
              Deactivate Node Session
            </button>
            <p className="text-center text-[7px] text-slate-800 font-black uppercase italic tracking-[0.4em]">
              Node Active Since {new Date(user.joinedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverlay;
