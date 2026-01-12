// src/components/Header.tsx
import React from 'react';
import { User } from '../types';
import { ICONS } from '../constants';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onNotifyClick: () => void;
  onProfileClick: () => void;
  unreadCount: number;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onNotifyClick,
  onProfileClick,
  unreadCount,
}) => {
  if (!user) return null;

  return (
    <header className="px-6 py-6 flex justify-between items-center max-w-lg mx-auto sticky top-0 bg-black/50 backdrop-blur-xl z-[90]">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-black italic tracking-tighter text-white">
          REEL<span className="text-cyan-400">EARN</span>
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onProfileClick}
          className="p-3 bg-white/5 rounded-2xl border border-white/10 text-cyan-400 active:scale-95 transition-all"
        >
          <ICONS.User className="w-5 h-5" />
        </button>
        <button
          onClick={onNotifyClick}
          className="relative p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400 active:scale-95 transition-all"
        >
          <ICONS.Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={onLogout}
          className="p-3 bg-white/5 rounded-2xl border border-white/10 text-slate-400 active:scale-95 transition-all"
        >
          <ICONS.X className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default Header;
