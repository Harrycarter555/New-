import React from 'react';

export const CampaignSkeleton: React.FC = () => (
  <div className="glass-panel rounded-[56px] overflow-hidden relative aspect-[9/16] animate-pulse">
    <div className="w-full h-full bg-slate-800"></div>
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-10 space-y-4">
      <div className="h-8 bg-slate-700 rounded-lg w-3/4"></div>
      <div className="flex gap-4">
        <div className="h-4 bg-slate-700 rounded w-1/3"></div>
        <div className="h-4 bg-slate-700 rounded w-1/3"></div>
      </div>
    </div>
  </div>
);

export const WalletSkeleton: React.FC = () => (
  <div className="glass-panel p-10 rounded-[56px] animate-pulse">
    <div className="h-4 bg-slate-700 rounded w-1/4 mb-6"></div>
    <div className="h-16 bg-slate-700 rounded mb-8"></div>
    <div className="flex gap-4">
      <div className="flex-1 h-20 bg-slate-700 rounded-3xl"></div>
      <div className="flex-1 h-20 bg-slate-700 rounded-3xl"></div>
    </div>
  </div>
);
