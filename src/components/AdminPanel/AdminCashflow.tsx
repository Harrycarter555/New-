import React, { useState, useEffect } from 'react';
import { ICONS } from '../../constants';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

interface AdminCashflowProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AdminCashflow: React.FC<AdminCashflowProps> = ({ showToast }) => {
  const [cashflow, setCashflow] = useState({
    dailyLimit: 100000,
    todaySpent: 0,
    startDate: '',
    endDate: ''
  });
  const [newLimit, setNewLimit] = useState('');
  const [updating, setUpdating] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ✅ REAL-TIME CASHFLOW LISTENER
  useEffect(() => {
    const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
    
    const unsubscribe = onSnapshot(cashflowRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updatedCashflow = {
          dailyLimit: data.dailyLimit ,
          todaySpent: data.todaySpent ,
          startDate: data.startDate || new Date().toISOString().split('T')[0],
          endDate: data.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
        
        console.log('💰 Cashflow updated in real-time:', updatedCashflow);
        setCashflow(updatedCashflow);
      } else {
        // Create default cashflow document if doesn't exist
        createDefaultCashflow();
      }
    }, (error) => {
      console.error('Cashflow listener error:', error);
    });

    return unsubscribe;
  }, []);

  // ✅ CREATE DEFAULT CASHFLOW DOCUMENT
  const createDefaultCashflow = async () => {
    try {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setFullYear(today.getFullYear() + 1);

      const defaultCashflow = {
        dailyLimit: 100000,
        todaySpent: 0,
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'cashflow', 'daily-cashflow'), defaultCashflow);
      setCashflow(defaultCashflow);
    } catch (error) {
      console.error('Error creating cashflow document:', error);
    }
  };

  // ✅ CALCULATE REMAINING & PERCENTAGE
  const cashflowRemaining = Math.max(0, cashflow.dailyLimit - cashflow.todaySpent);
  const spentPercentage = cashflow.dailyLimit > 0 
    ? (cashflow.todaySpent / cashflow.dailyLimit) * 100 
    : 0;

  // ✅ GET PROGRESS BAR COLOR
  const getProgressBarColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    if (percentage < 90) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // ✅ UPDATE DAILY LIMIT
  const handleUpdateLimit = async () => {
    const limitValue = parseInt(newLimit);
    
    if (!limitValue || isNaN(limitValue)) {
      showToast('Please enter a valid limit amount', 'error');
      return;
    }

    if (limitValue < 1000) {
      showToast('Minimum daily limit is ₹1000', 'error');
      return;
    }

    if (limitValue < cashflow.todaySpent) {
      showToast(`Daily limit cannot be less than today's spent (₹${cashflow.todaySpent})`, 'error');
      return;
    }

    setUpdating(true);
    try {
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      
      // Update cashflow document
      await updateDoc(cashflowRef, {
        dailyLimit: limitValue,
        updatedAt: serverTimestamp()
      });

      // ✅ CHECK ALL PENDING PAYOUTS AGAINST NEW LIMIT
      await checkPendingPayoutsAgainstLimit(limitValue);
      
      showToast(`Daily limit updated to ₹${limitValue.toLocaleString('en-IN')}`, 'success');
      setNewLimit('');
      
    } catch (error: any) {
      console.error('Error updating daily limit:', error);
      showToast(error.message || 'Failed to update daily limit', 'error');
    } finally {
      setUpdating(false);
    }
  };

  // ✅ CHECK PENDING PAYOUTS AGAINST NEW LIMIT
  const checkPendingPayoutsAgainstLimit = async (newLimit: number) => {
    try {
      const payoutsRef = collection(db, 'payouts');
      const q = query(payoutsRef, where('status', '==', 'pending'));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      let affectedCount = 0;

      snapshot.forEach((docSnap) => {
        const payout = docSnap.data();
        const payoutAmount = payout.amount || 0;
        
        if (payoutAmount > newLimit) {
          batch.update(docSnap.ref, {
            status: 'hold',
            holdReason: `Payout amount (₹${payoutAmount}) exceeds new daily limit (₹${newLimit})`,
            holdAt: serverTimestamp(),
            heldBy: 'system',
            updatedAt: serverTimestamp()
          });
          affectedCount++;
        }
      });

      if (affectedCount > 0) {
        await batch.commit();
        console.log(`💰 ${affectedCount} payouts put on hold due to limit change`);
        
        // Show notification
        showToast(`${affectedCount} pending payouts put on hold (exceed new limit)`, 'warning');
      }
    } catch (error) {
      console.error('Error checking payouts against limit:', error);
    }
  };

  // ✅ RESET TODAY'S SPENT
  const handleResetSpent = async () => {
    if (!window.confirm('Are you sure you want to reset today\'s spent amount? This will reset the daily counter.')) {
      return;
    }

    setResetting(true);
    try {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setFullYear(today.getFullYear() + 1);

      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      
      await updateDoc(cashflowRef, {
        todaySpent: 0,
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        updatedAt: serverTimestamp()
      });

      showToast("Today's spent amount reset to ₹0", 'success');
      
    } catch (error: any) {
      console.error('Error resetting today spent:', error);
      showToast(error.message || 'Failed to reset spent amount', 'error');
    } finally {
      setResetting(false);
    }
  };

  // ✅ FORMAT CURRENCY
  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // ✅ FORMAT DATE
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-8 animate-slide">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white">Cashflow Management</h2>
          <p className="text-sm text-slate-400">Control daily spending limits and monitor liquidity</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Last Updated</p>
          <p className="text-sm text-slate-400">{new Date().toLocaleTimeString('en-IN', { hour12: true })}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-6 rounded-2xl border border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <ICONS.Dollar className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Daily Limit</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(cashflow.dailyLimit)}</p>
              <p className="text-xs text-slate-500">Per day maximum</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 p-6 rounded-2xl border border-orange-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <ICONS.Activity className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Today's Spent</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(cashflow.todaySpent)}</p>
              <p className="text-xs text-slate-500">{spentPercentage.toFixed(1)}% of limit</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-2xl border border-green-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <ICONS.Wallet className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-slate-400">Remaining Today</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(cashflowRemaining)}</p>
              <p className="text-xs text-slate-500">Available for payouts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-black/50 p-6 rounded-2xl border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Daily Limit Usage</h3>
            <p className="text-sm text-slate-400">Track spending against daily budget</p>
          </div>
          <div className="text-right">
            <p className={`text-lg font-bold ${
              spentPercentage < 50 ? 'text-green-500' :
              spentPercentage < 80 ? 'text-yellow-500' :
              spentPercentage < 90 ? 'text-orange-500' : 'text-red-500'
            }`}>
              {spentPercentage.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">Used</p>
          </div>
        </div>

        <div className="mb-2">
          <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${getProgressBarColor(spentPercentage)}`}
              style={{ width: `${Math.min(spentPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>0</span>
            <span>50%</span>
            <span>80%</span>
            <span>90%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-slate-400">Safe Zone</p>
            <p className="text-sm font-bold text-green-400">Below 50%</p>
          </div>
          <div className="text-center p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-slate-400">Warning Zone</p>
            <p className="text-sm font-bold text-yellow-400">50-80%</p>
          </div>
          <div className="text-center p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-slate-400">Critical Zone</p>
            <p className="text-sm font-bold text-red-400">Above 80%</p>
          </div>
        </div>
      </div>

      {/* Update Limit Section */}
      <div className="bg-black/50 p-6 rounded-2xl border border-white/10">
        <h3 className="text-lg font-bold text-white mb-4">Update Daily Limit</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              New Daily Limit (₹)
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                placeholder="Enter new daily limit"
                min="1000"
                step="1000"
              />
              <button
                onClick={handleUpdateLimit}
                disabled={updating || !newLimit.trim()}
                className="px-6 bg-cyan-500 text-black font-bold rounded-xl hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? 'Updating...' : 'Update'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Minimum: ₹1,000 | Current: {formatCurrency(cashflow.dailyLimit)}
            </p>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-sm text-amber-400 font-bold mb-2">⚠️ Important Note</p>
            <p className="text-xs text-amber-300">
              When you reduce the daily limit, any pending payouts that exceed the new limit will be automatically put on hold.
              Users will need to wait until the limit is increased or request a smaller amount.
            </p>
          </div>
        </div>
      </div>

      {/* Reset Spent Section */}
      <div className="bg-black/50 p-6 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Reset Daily Counter</h3>
            <p className="text-sm text-slate-400">Reset today's spent amount to zero</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Period</p>
            <p className="text-sm text-slate-400">
              {formatDate(cashflow.startDate)} to {formatDate(cashflow.endDate)}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-xl">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-slate-300">Current Daily Spent</p>
                <p className="text-2xl font-bold text-orange-400">{formatCurrency(cashflow.todaySpent)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-300">Will Reset To</p>
                <p className="text-2xl font-bold text-green-400">₹0</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleResetSpent}
            disabled={resetting || cashflow.todaySpent === 0}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetting ? 'Resetting...' : 'Reset Today\'s Spent'}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Resetting will start a new daily cycle. Pending payouts will still be processed.
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 mb-1">Daily Average</p>
          <p className="text-lg font-bold text-white">
            {formatCurrency(Math.floor(cashflow.todaySpent / 24 * 100) / 100)}/hr
          </p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 mb-1">Payouts Today</p>
          <p className="text-lg font-bold text-cyan-400">
            {Math.floor(cashflow.todaySpent / 500) || 0}
          </p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 mb-1">Limit Usage</p>
          <p className={`text-lg font-bold ${
            spentPercentage < 50 ? 'text-green-500' :
            spentPercentage < 80 ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {spentPercentage.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl text-center">
          <p className="text-xs text-slate-400 mb-1">Days Remaining</p>
          <p className="text-lg font-bold text-white">
            {cashflow.endDate ? Math.ceil((new Date(cashflow.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 365}
          </p>
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <ICONS.Info className="w-4 h-4" />
          How Cashflow Management Works
        </h4>
        <ul className="text-xs text-slate-400 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-green-400">•</span>
            <span><strong>Daily Limit:</strong> Maximum amount that can be paid out in a single day</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400">•</span>
            <span><strong>Today's Spent:</strong> Total amount paid out today across all users</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400">•</span>
            <span><strong>Auto-hold:</strong> Payouts exceeding limit are automatically put on hold</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-400">•</span>
            <span><strong>Reset:</strong> Daily spent resets at 00:00 IST or manually by admin</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default AdminCashflow;
