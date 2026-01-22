import React from 'react';
import { Campaign } from '../types';
import CampaignList from './CampaignList';
import { ICONS } from '../constants';

interface CampaignsPageProps {
  userCampaigns: Campaign[];
  userStats: {
    totalActive: number;
    totalRewardPool: number;
    pendingBalance: number;
    walletBalance: number;
  };
  onCampaignSelect: (campaign: Campaign) => void;
  onNavigateToVerify: () => void;
  onNavigateToWallet: () => void;
}

const CampaignsPage: React.FC<CampaignsPageProps> = ({
  userCampaigns,
  userStats,
  onCampaignSelect,
  onNavigateToVerify,
  onNavigateToWallet,
}) => {
  return (
    <div className="space-y-10 pb-20">
      <div className="mb-8">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
          LIVE<br/>
          <span className="text-cyan-400">CAMPAIGNS</span>
        </h1>
        <p className="text-slate-400 text-sm mt-2">Complete missions and earn rewards</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Active Missions</p>
          <p className="text-2xl font-bold text-white">{userStats.totalActive}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Reward Pool</p>
          <p className="text-2xl font-bold text-green-400">₹{userStats.totalRewardPool.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Pending</p>
          <p className="text-2xl font-bold text-cyan-400">₹{userStats.pendingBalance.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Wallet</p>
          <p className="text-2xl font-bold text-white">₹{userStats.walletBalance.toLocaleString()}</p>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={onNavigateToVerify} className="p-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl text-center hover:opacity-90">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <ICONS.CheckCircle className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-white mb-1">Submit Verification</h3>
        </button>
        <button onClick={onNavigateToWallet} className="p-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-center hover:opacity-90">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <ICONS.Coins className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-white mb-1">Withdraw Funds</h3>
        </button>
      </div>

      {/* Campaigns List */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">AVAILABLE MISSIONS</h2>
          <button onClick={onNavigateToWallet} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <ICONS.Wallet className="w-4 h-4" /> Wallet
          </button>
        </div>
        {userCampaigns.length === 0 ? (
          <div className="text-center py-20 border border-slate-800 rounded-2xl bg-black/50">
            <ICONS.Campaign className="w-20 h-20 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-400">No Active Campaigns</h3>
          </div>
        ) : (
          <CampaignList campaigns={userCampaigns} onSelect={onCampaignSelect} />
        )}
      </div>
    </div>
  );
};

export default CampaignsPage;
