import React, { useState, useEffect } from 'react';
import { ICONS } from '../../constants';
import { cashflowService } from './firebaseService';

interface AdminDashboardProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  data: {
    users: any[];
    campaigns: any[];
    payouts: any[];
    submissions: any[];
    reports: any[];
    broadcasts: any[];
    cashflow: { dailyLimit: number; todaySpent: number; startDate: string; endDate: string };
  };
  onRefresh: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ showToast, data, onRefresh }) => {
  const [isResetting, setIsResetting] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalBalance: 0,
    totalEarnings: 0,
    pendingPayouts: 0,
    pendingPayoutsAmount: 0,
    activeCampaigns: 0,
    pendingSubmissions: 0,
    pendingSubmissionsAmount: 0,
    openReports: 0
  });

  // Calculate stats whenever data changes
  useEffect(() => {
    const calculateStats = () => {
      const regularUsers = data.users.filter(u => u.role !== 'admin');
      const totalUsers = regularUsers.length;
      const activeUsers = regularUsers.filter(u => u.status === 'active').length;
      const totalBalance = regularUsers.reduce((sum, u) => sum + (u.walletBalance || 0), 0);
      const totalEarnings = regularUsers.reduce((sum, u) => sum + (u.totalEarnings || 0), 0);
      
      const pendingPayouts = data.payouts.filter(p => p.status === 'pending').length;
      const pendingPayoutsAmount = data.payouts
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const activeCampaigns = data.campaigns.filter(c => c.active).length;
      const pendingSubmissions = data.submissions.filter(s => s.status === 'pending').length;
      const pendingSubmissionsAmount = data.submissions
        .filter(s => s.status === 'pending')
        .reduce((sum, s) => sum + (s.rewardAmount || 0), 0);
      
      const openReports = data.reports.filter(r => r.status === 'open').length;

      setStats({
        totalUsers,
        activeUsers,
        totalBalance,
        totalEarnings,
        pendingPayouts,
        pendingPayoutsAmount,
        activeCampaigns,
        pendingSubmissions,
        pendingSubmissionsAmount,
        openReports
      });
    };

    calculateStats();
  }, [data]);

  const handleResetDailySpent = async () => {
    if (!window.confirm('Are you sure you want to reset today\'s spent amount?')) return;
    
    setIsResetting(true);
    try {
      await cashflowService.resetTodaySpent();
      showToast('Today\'s spent amount reset successfully', 'success');
      onRefresh();
    } catch (error: any) {
      showToast(error.message || 'Failed to reset spent amount', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const cashflowRemaining = data.cashflow.dailyLimit - data.cashflow.todaySpent;
  const spentPercentage = (data.cashflow.todaySpent / data.cashflow.dailyLimit) * 100;

  return (
    <div className="space-y-8 animate-slide">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-white">Dashboard Overview</h3>
          <p className="text-sm text-slate-400">Real-time platform statistics and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg font-bold hover:bg-cyan-500/20"
          >
            Refresh Data
          </button>
          <span className="text-xs text-slate-500">
            Updated just now
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-6 rounded-2xl border border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <ICONS.Users className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Users</p>
              <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
              <p className="text-xs text-green-400">{stats.activeUsers} active</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-2xl border border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <ICONS.Wallet className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Balance</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalBalance)}</p>
              <p className="text-xs text-cyan-400">{formatCurrency(stats.totalEarnings)} earned</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 p-6 rounded-2xl border border-orange-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <ICONS.AlertCircle className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Pending Payouts</p>
              <p className="text-2xl font-bold text-white">{stats.pendingPayouts}</p>
              <p className="text-xs text-orange-400">{formatCurrency(stats.pendingPayoutsAmount)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-2xl border border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <ICONS.Campaign className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Active Campaigns</p>
              <p className="text-2xl font-bold text-white">{stats.activeCampaigns}</p>
              <p className="text-xs text-purple-400">{stats.pendingSubmissions} pending subs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cashflow Card */}
      <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-3xl border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-xl font-bold text-white">Daily Cashflow</h4>
            <p className="text-sm text-slate-400">Network liquidity management</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Daily Limit</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(data.cashflow.dailyLimit)}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Spent: {formatCurrency(data.cashflow.todaySpent)}</span>
            <span className="text-cyan-400">Remaining: {formatCurrency(cashflowRemaining)}</span>
          </div>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${
                spentPercentage < 50 ? 'bg-green-500' :
                spentPercentage < 80 ? 'bg-yellow-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.min(spentPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>0</span>
            <span>{spentPercentage.toFixed(1)}%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleResetDailySpent}
            disabled={isResetting || data.cashflow.todaySpent === 0}
            className="flex-1 py-3 bg-orange-500/10 text-orange-400 rounded-xl font-bold hover:bg-orange-500/20 disabled:opacity-50"
          >
            {isResetting ? 'Resetting...' : 'Reset Daily Spent'}
          </button>
          <button
            onClick={() => showToast('Feature coming soon', 'success')}
            className="flex-1 py-3 bg-cyan-500/10 text-cyan-400 rounded-xl font-bold hover:bg-cyan-500/20"
          >
            Send Network Alert
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white/5 p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 mb-1">Today's Spent</p>
          <p className="text-lg font-bold text-white">{formatCurrency(data.cashflow.todaySpent)}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 mb-1">Remaining</p>
          <p className="text-lg font-bold text-cyan-400">{formatCurrency(cashflowRemaining)}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 mb-1">Usage %</p>
          <p className={`text-lg font-bold ${
            spentPercentage < 50 ? 'text-green-500' :
            spentPercentage < 80 ? 'text-yellow-500' :
            'text-red-500'
          }`}>
            {spentPercentage.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 mb-1">Open Reports</p>
          <p className="text-lg font-bold text-red-500">{stats.openReports}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 mb-1">Pending Subs</p>
          <p className="text-lg font-bold text-amber-500">{stats.pendingSubmissions}</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-black/50 p-6 rounded-2xl border border-white/10">
        <h4 className="text-lg font-bold text-white mb-4">Recent Activity</h4>
        <div className="space-y-3">
          {data.payouts.slice(0, 3).map((payout, index) => (
            <div key={payout.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  payout.status === 'approved' ? 'bg-green-500/20' : 'bg-amber-500/20'
                }`}>
                  <ICONS.Wallet className={`w-5 h-5 ${
                    payout.status === 'approved' ? 'text-green-400' : 'text-amber-400'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">@{payout.username}</p>
                  <p className="text-xs text-slate-400">{formatCurrency(payout.amount)} • {payout.method}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                payout.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                payout.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {payout.status}
              </span>
            </div>
          ))}
          
          {data.payouts.length === 0 && (
            <p className="text-center py-8 text-slate-500">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
