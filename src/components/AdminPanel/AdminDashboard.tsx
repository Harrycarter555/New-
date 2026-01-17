import React, { useState, useEffect } from 'react';
import { statsService, cashflowService } from './firebaseService';
import { ICONS } from '../../utils/constants';

interface AdminDashboardProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ showToast }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cashflow, setCashflow] = useState({ dailyLimit: 100000, todaySpent: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsData, cashflowData] = await Promise.all([
          statsService.getDashboardStats(),
          cashflowService.getCashflow()
        ]);
        setStats(statsData);
        setCashflow(cashflowData);
      } catch (error: any) {
        console.error('Dashboard load error:', error);
        setError(error.message || 'Failed to load dashboard stats');
        showToast(error.message || 'Failed to load dashboard stats', 'error');
        
        // ✅ Fallback data agar Firebase error ho
        setStats({
          totalUsers: 0,
          activeUsers: 0,
          totalBalance: 0,
          totalPending: 0,
          totalEarnings: 0,
          pendingPayouts: 0,
          pendingPayoutsAmount: 0,
          openReports: 0,
          activeCampaigns: 0,
          pendingSubmissions: 0,
          pendingSubmissionsAmount: 0,
          pendingCashflow: 0
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [showToast]);

  // Real-time cashflow updates
  useEffect(() => {
    const unsubscribe = cashflowService.onCashflowUpdate(setCashflow);
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 mt-4 text-sm">Loading dashboard data...</p>
          {error && (
            <p className="text-red-500 text-xs mt-2">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ICONS.X className="w-10 h-10 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Dashboard Error</h3>
        <p className="text-gray-400 mb-4">{error || 'Unable to load statistics'}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-cyan-600 rounded-lg text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const cashflowRemaining = cashflow.dailyLimit - cashflow.todaySpent;
  const spentPercentage = (cashflow.todaySpent / cashflow.dailyLimit) * 100;

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className="space-y-8 animate-slide">
      {/* Error Warning */}
      {error && (
        <div className="glass-panel p-4 rounded-2xl border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <ICONS.AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-white">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-6 rounded-3xl border-t-4 border-cyan-500 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-full flex items-center justify-center">
              <ICONS.Users className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Active Nodes</p>
              <p className="text-2xl font-black text-white">{stats.totalUsers || 0}</p>
            </div>
          </div>
          <p className="text-[9px] text-green-500 font-black">
            {stats.activeUsers || 0} active • {(stats.totalUsers || 0) - (stats.activeUsers || 0)} suspended
          </p>
        </div>
        
        <div className="glass-panel p-6 rounded-3xl border-t-4 border-green-500 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
              <ICONS.Wallet className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Wallet Pool</p>
              <p className="text-2xl font-black text-white">{formatCurrency(stats.totalBalance || 0)}</p>
            </div>
          </div>
          <p className="text-[9px] text-green-400 font-black">{formatCurrency(stats.totalEarnings || 0)} earned</p>
        </div>

        <div className="glass-panel p-6 rounded-3xl border-t-4 border-orange-500 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
              <ICONS.Lock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Capital In Audit</p>
              <p className="text-2xl font-black text-white">{formatCurrency(stats.totalPending || 0)}</p>
            </div>
          </div>
          <p className="text-[9px] text-orange-400 font-black">{stats.pendingSubmissions || 0} submissions</p>
        </div>
        
        <div className="glass-panel p-6 rounded-3xl border-t-4 border-red-500 shadow-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center">
              <ICONS.ArrowLeft className="w-5 h-5 text-red-500 rotate-180" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase">Withdrawal Queue</p>
              <p className="text-2xl font-black text-white">{stats.pendingPayouts || 0}</p>
            </div>
          </div>
          <p className="text-[9px] text-red-400 font-black">{formatCurrency(stats.pendingPayoutsAmount || 0)}</p>
        </div>
      </div>

      {/* Cashflow Card */}
      <div className="glass-panel p-8 rounded-3xl border-l-8 border-cyan-500 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Network Liquidity</p>
            <h2 className="text-5xl font-black text-cyan-400">{formatCurrency(cashflowRemaining)}</h2>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-600 uppercase">Daily Limit</p>
            <p className="text-xl font-black text-white">{formatCurrency(cashflow.dailyLimit)}</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mt-4">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000"
            style={{ width: `${Math.min(spentPercentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[8px] text-slate-500 font-black mt-2">
          <span>Spent: {formatCurrency(cashflow.todaySpent)}</span>
          <span>Remaining: {formatCurrency(cashflowRemaining)}</span>
        </div>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase">Active Campaigns</p>
          <p className="text-xl font-black text-green-500">{stats.activeCampaigns || 0}</p>
        </div>
        
        <div className="glass-panel p-4 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase">Open Reports</p>
          <p className="text-xl font-black text-red-500">{stats.openReports || 0}</p>
        </div>
        
        <div className="glass-panel p-4 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase">Pending Cashflow</p>
          <p className="text-xl font-black text-orange-500">{formatCurrency(stats.pendingCashflow || 0)}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-panel p-6 rounded-3xl">
        <h3 className="text-lg font-black text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => {
              cashflowService.resetTodaySpent()
                .then(() => showToast("Today's spent reset", 'success'))
                .catch(err => showToast(err.message, 'error'));
            }}
            className="p-4 bg-orange-500/10 text-orange-500 rounded-2xl text-[10px] font-black uppercase border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
          >
            Reset Daily Spent
          </button>
          <button 
            onClick={() => showToast('Feature coming soon', 'success')} // Changed from 'info' to 'success'
            className="p-4 bg-cyan-500/10 text-cyan-500 rounded-2xl text-[10px] font-black uppercase border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
          >
            Send Network Alert
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
