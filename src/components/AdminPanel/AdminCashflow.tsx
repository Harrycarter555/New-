import React, { useState, useEffect } from 'react';
import { cashflowService } from './firebaseService';
import { ICONS } from '../../utils/constants';

interface AdminCashflowProps {
  cashflow: { dailyLimit: number; todaySpent: number };
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AdminCashflow: React.FC<AdminCashflowProps> = ({ cashflow, showToast }) => {
  const [dailyLimit, setDailyLimit] = useState(cashflow.dailyLimit);
  const [todaySpent, setTodaySpent] = useState(cashflow.todaySpent);
  const [updating, setUpdating] = useState(false);

  // Update local state when cashflow prop changes
  useEffect(() => {
    setDailyLimit(cashflow.dailyLimit);
    setTodaySpent(cashflow.todaySpent);
  }, [cashflow]);

  const cashflowRemaining = dailyLimit - todaySpent;
  const spentPercentage = (todaySpent / dailyLimit) * 100;

  const handleUpdateLimit = async () => {
    if (dailyLimit < todaySpent) {
      showToast('Daily limit cannot be less than today\'s spent', 'error');
      return;
    }

    if (dailyLimit < 1000) {
      showToast('Minimum daily limit is ₹1000', 'error');
      return;
    }

    setUpdating(true);
    try {
      await cashflowService.updateDailyLimit(dailyLimit);
      showToast('Daily limit updated successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update daily limit', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleResetSpent = async () => {
    if (!window.confirm('Are you sure you want to reset today\'s spent amount? This action cannot be undone.')) return;
    
    setUpdating(true);
    try {
      await cashflowService.resetTodaySpent();
      showToast('Today\'s spent amount reset successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to reset today\'s spent', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-10 animate-slide">
      {/* Cashflow Management Card */}
      <div className="glass-panel p-10 rounded-[48px] border-t-8 border-cyan-500 space-y-8 shadow-2xl">
        <h3 className="text-2xl font-black text-white text-center italic uppercase tracking-tighter">
          Liquidity & Burn Config
        </h3>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-white/5 rounded-3xl border border-white/5 text-center shadow-inner">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2 italic">
              Total Daily Cap
            </p>
            <p className="text-3xl font-black text-white italic">
              {formatCurrency(dailyLimit)}
            </p>
          </div>
          
          <div className="p-6 bg-white/5 rounded-3xl border border-white/5 text-center shadow-inner">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-2 italic">
              Today's Spent
            </p>
            <p className="text-3xl font-black text-orange-400 italic">
              {formatCurrency(todaySpent)}
            </p>
          </div>
        </div>

        {/* Remaining Balance Card */}
        <div className="p-8 bg-black/20 rounded-3xl border border-cyan-500/20 text-center shadow-2xl">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-4 italic">
            Network Available Burn
          </p>
          <p className="text-5xl font-black text-cyan-400 italic">
            {formatCurrency(cashflowRemaining)}
          </p>
          
          {/* Progress Bar */}
          <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mt-6">
            <div 
              className={`h-full transition-all duration-1000 ${getProgressBarColor(spentPercentage)}`}
              style={{ width: `${Math.min(spentPercentage, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-[9px] text-slate-500 font-black mt-2">
            <span>0</span>
            <span className="text-cyan-400">{formatCurrency(todaySpent)} Spent</span>
            <span>{formatCurrency(dailyLimit)}</span>
          </div>
          
          {/* Percentage Indicator */}
          <div className="mt-4">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
              spentPercentage < 50 ? 'text-green-500 bg-green-500/10' :
              spentPercentage < 80 ? 'text-yellow-500 bg-yellow-500/10' :
              'text-red-500 bg-red-500/10'
            }`}>
              {spentPercentage.toFixed(1)}% Used
            </span>
          </div>
        </div>

        {/* Control Panel */}
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase px-4 italic block mb-2">
              Modify System Threshold (₹)
            </label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 rounded-[28px] px-8 py-5 text-2xl font-black text-cyan-400 outline-none text-center shadow-inner focus:border-cyan-500/50"
              min="1000"
              step="1000"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleUpdateLimit}
              disabled={updating || dailyLimit === cashflow.dailyLimit}
              className="w-full btn-primary py-7 rounded-[32px] font-black uppercase text-sm shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Updating...' : 'Sync System Threshold'}
            </button>
            
            <button
              onClick={handleResetSpent}
              disabled={updating || todaySpent === 0}
              className="w-full py-7 bg-orange-500/10 text-orange-500 rounded-[32px] font-black uppercase text-sm border border-orange-500/20 hover:bg-orange-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset Today's Spent
            </button>
          </div>
        </div>
      </div>

      {/* Information Panel */}
      <div className="glass-panel p-8 rounded-3xl border-l-4 border-l-blue-500">
        <h4 className="text-lg font-black text-white mb-4">Cashflow Information</h4>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-cyan-500/10 rounded-full flex items-center justify-center">
                <ICONS.Info className="w-4 h-4 text-cyan-500" />
              </div>
              <span className="text-[10px] font-black text-slate-500">Daily Limit Reset</span>
            </div>
            <span className="text-[10px] font-black text-white">00:00 IST Daily</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center">
                <ICONS.AlertCircle className="w-4 h-4 text-green-500" />
              </div>
              <span className="text-[10px] font-black text-slate-500">Safe Threshold</span>
            </div>
            <span className="text-[10px] font-black text-green-500">Below 80%</span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500/10 rounded-full flex items-center justify-center">
                <ICONS.AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-[10px] font-black text-slate-500">Critical Threshold</span>
            </div>
            <span className="text-[10px] font-black text-red-500">Above 95%</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-panel p-4 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase">Remaining Today</p>
          <p className="text-xl font-black text-cyan-400">{formatCurrency(cashflowRemaining)}</p>
        </div>
        
        <div className="glass-panel p-4 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase">Usage %</p>
          <p className={`text-xl font-black ${
            spentPercentage < 50 ? 'text-green-500' :
            spentPercentage < 80 ? 'text-yellow-500' :
            'text-red-500'
          }`}>
            {spentPercentage.toFixed(1)}%
          </p>
        </div>
        
        <div className="glass-panel p-4 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase">Avg Daily Spend</p>
          <p className="text-xl font-black text-white">{formatCurrency(Math.floor(todaySpent / 24 * 100) / 100)}/hr</p>
        </div>
      </div>
    </div>
  );
};

export default AdminCashflow;
