import React, { useState, useEffect } from 'react';
import { ICONS } from '../../constants';
import { PayoutStatus, SubmissionStatus } from '../../types';
import { 
  doc, getDoc, updateDoc, increment, serverTimestamp, 
  collection, query, where, getDocs, writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebase';

interface AdminPayoutsProps {
  payouts: any[];
  submissions: any[];
  showToast: (message: string, type: 'success' | 'error') => void;
  payoutSubTab: 'payouts' | 'verifications';
  setPayoutSubTab: (tab: 'payouts' | 'verifications') => void;
}

const AdminPayouts: React.FC<AdminPayoutsProps> = ({ 
  payouts, 
  submissions, 
  showToast, 
  payoutSubTab, 
  setPayoutSubTab 
}) => {
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [holdNote, setHoldNote] = useState<string>('');
  const [cashflow, setCashflow] = useState({ dailyLimit: 100000, todaySpent: 0 });

  // ✅ REAL-TIME CASHFLOW LISTENER
  useEffect(() => {
    const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
    const unsubscribe = onSnapshot(cashflowRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCashflow({
          dailyLimit: data.dailyLimit || 100000,
          todaySpent: data.todaySpent || 0
        });
      }
    });
    return unsubscribe;
  }, []);

  // ✅ GET PENDING PAYOUTS (including hold)
  const pendingPayouts = payouts.filter(p => 
    p.status === PayoutStatus.PENDING || p.status === PayoutStatus.HOLD
  );

  // ✅ GET PENDING SUBMISSIONS
  const pendingSubmissions = submissions.filter(s => 
    s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM
  );

  // ✅ CHECK CASHFLOW LIMIT BEFORE APPROVAL
  const checkCashflowBeforeApproval = async (amount: number): Promise<{
    allowed: boolean;
    remaining: number;
    message: string;
  }> => {
    const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
    const cashflowSnap = await getDoc(cashflowRef);
    
    if (cashflowSnap.exists()) {
      const cashflowData = cashflowSnap.data();
      const remaining = cashflowData.dailyLimit - cashflowData.todaySpent;
      const allowed = amount <= remaining;
      
      return {
        allowed,
        remaining,
        message: allowed 
          ? `₹${remaining.toLocaleString('en-IN')} available`
          : `Limit exceeded! Remaining: ₹${remaining.toLocaleString('en-IN')}`
      };
    }
    
    return { allowed: true, remaining: 100000, message: 'Cashflow data not found' };
  };

  // ✅ HANDLE PAYOUT APPROVAL WITH CASHFLOW CHECK
  const handleApprovePayout = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
      const payout = payouts.find(p => p.id === payoutId);
      if (!payout) throw new Error('Payout not found');

      // ✅ CASHFLOW LIMIT CHECK
      const cashflowCheck = await checkCashflowBeforeApproval(payout.amount);
      
      if (!cashflowCheck.allowed) {
        // Auto-hold if limit exceeded
        await updateDoc(doc(db, 'payouts', payoutId), {
          status: PayoutStatus.HOLD,
          holdReason: `Daily cashflow limit exceeded. Remaining: ₹${cashflowCheck.remaining}`,
          holdAt: serverTimestamp(),
          heldBy: 'system',
          updatedAt: serverTimestamp()
        });

        // Return amount to user's wallet
        await updateDoc(doc(db, 'users', payout.userId), {
          walletBalance: increment(payout.amount),
          updatedAt: serverTimestamp()
        });

        showToast(`Payout auto-held: ${cashflowCheck.message}`, 'error');
        setProcessing(null);
        return;
      }

      // ✅ APPROVE PAYOUT
      const batch = writeBatch(db);
      
      // 1. Update payout status
      const payoutRef = doc(db, 'payouts', payoutId);
      batch.update(payoutRef, {
        status: PayoutStatus.APPROVED,
        processedAt: serverTimestamp(),
        processedBy: 'admin',
        updatedAt: serverTimestamp()
      });

      // 2. Update cashflow
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      batch.update(cashflowRef, {
        todaySpent: increment(payout.amount),
        updatedAt: serverTimestamp()
      });

      // 3. Update user wallet (deduct)
      const userRef = doc(db, 'users', payout.userId);
      batch.update(userRef, {
        walletBalance: increment(-payout.amount),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      showToast(`Payout of ₹${payout.amount.toLocaleString('en-IN')} approved`, 'success');
      
    } catch (error: any) {
      console.error('Error approving payout:', error);
      showToast(error.message || 'Failed to approve payout', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // ✅ HANDLE PAYOUT REJECTION
  const handleRejectPayout = async (payoutId: string) => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    setProcessing(payoutId);
    try {
      const payout = payouts.find(p => p.id === payoutId);
      if (!payout) throw new Error('Payout not found');

      const batch = writeBatch(db);
      
      // 1. Update payout status
      const payoutRef = doc(db, 'payouts', payoutId);
      batch.update(payoutRef, {
        status: PayoutStatus.REJECTED,
        rejectionReason: rejectReason,
        processedAt: serverTimestamp(),
        processedBy: 'admin',
        updatedAt: serverTimestamp()
      });

      // 2. Return amount to user's wallet
      const userRef = doc(db, 'users', payout.userId);
      batch.update(userRef, {
        walletBalance: increment(payout.amount),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      showToast('Payout rejected and amount returned to user', 'success');
      setRejectReason('');
      setSelectedItem(null);
      
    } catch (error: any) {
      showToast(error.message || 'Failed to reject payout', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // ✅ PUT PAYOUT ON HOLD
  const handleHoldPayout = async (payoutId: string) => {
    if (!holdNote.trim()) {
      showToast('Please provide a hold reason', 'error');
      return;
    }

    setProcessing(payoutId);
    try {
      const payout = payouts.find(p => p.id === payoutId);
      if (!payout) throw new Error('Payout not found');

      await updateDoc(doc(db, 'payouts', payoutId), {
        status: PayoutStatus.HOLD,
        holdReason: holdNote,
        holdAt: serverTimestamp(),
        heldBy: 'admin',
        updatedAt: serverTimestamp()
      });

      showToast('Payout put on hold', 'success');
      setHoldNote('');
      setSelectedItem(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to put payout on hold', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // ✅ RELEASE HOLD
  const handleReleaseHold = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
      const payout = payouts.find(p => p.id === payoutId);
      if (!payout) throw new Error('Payout not found');

      // Check cashflow before releasing
      const cashflowCheck = await checkCashflowBeforeApproval(payout.amount);
      
      if (!cashflowCheck.allowed) {
        showToast(`Cannot release: ${cashflowCheck.message}`, 'error');
        setProcessing(null);
        return;
      }

      await updateDoc(doc(db, 'payouts', payoutId), {
        status: PayoutStatus.PENDING,
        holdReason: null,
        holdAt: null,
        heldBy: null,
        updatedAt: serverTimestamp()
      });

      showToast('Payout released from hold', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to release hold', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // ✅ APPROVE SUBMISSION
  const handleApproveSubmission = async (submissionId: string) => {
    setProcessing(submissionId);
    try {
      const submission = submissions.find(s => s.id === submissionId);
      if (!submission) throw new Error('Submission not found');

      const batch = writeBatch(db);
      
      // 1. Update submission status
      const submissionRef = doc(db, 'submissions', submissionId);
      batch.update(submissionRef, {
        status: SubmissionStatus.APPROVED,
        approvedAt: serverTimestamp(),
        approvedBy: 'admin',
        updatedAt: serverTimestamp()
      });

      // 2. Update user's wallet and pending balance
      const userRef = doc(db, 'users', submission.userId);
      batch.update(userRef, {
        walletBalance: increment(submission.rewardAmount),
        pendingBalance: increment(-submission.rewardAmount),
        totalEarnings: increment(submission.rewardAmount),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      
      const isViral = submission.status === SubmissionStatus.VIRAL_CLAIM;
      showToast(
        `Submission approved${isViral ? ' with viral bonus' : ''} - ₹${submission.rewardAmount} paid`, 
        'success'
      );
    } catch (error: any) {
      showToast(error.message || 'Failed to approve submission', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // ✅ REJECT SUBMISSION
  const handleRejectSubmission = async (submissionId: string) => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    setProcessing(submissionId);
    try {
      const submission = submissions.find(s => s.id === submissionId);
      if (!submission) throw new Error('Submission not found');

      const batch = writeBatch(db);
      
      // 1. Update submission status
      const submissionRef = doc(db, 'submissions', submissionId);
      batch.update(submissionRef, {
        status: SubmissionStatus.REJECTED,
        rejectionReason: rejectReason,
        rejectedAt: serverTimestamp(),
        rejectedBy: 'admin',
        updatedAt: serverTimestamp()
      });

      // 2. Remove from user's pending balance
      const userRef = doc(db, 'users', submission.userId);
      batch.update(userRef, {
        pendingBalance: increment(-submission.rewardAmount),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      
      showToast('Submission rejected', 'success');
      setRejectReason('');
      setSelectedItem(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to reject submission', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // ✅ FORMAT FUNCTIONS
  const formatCurrency = (amount: number): string => {
    return `₹${amount?.toLocaleString('en-IN') || '0'}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ✅ CALCULATE TOTALS
  const totalPendingAmount = pendingPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalHoldAmount = pendingPayouts
    .filter(p => p.status === PayoutStatus.HOLD)
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const cashflowRemaining = Math.max(0, cashflow.dailyLimit - cashflow.todaySpent);

  return (
    <div className="space-y-8 animate-slide">
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl text-center">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Pending Payouts</p>
          <p className="text-2xl font-black text-white">{pendingPayouts.length}</p>
          <p className="text-sm text-cyan-400 font-bold">{formatCurrency(totalPendingAmount)}</p>
        </div>
        
        <div className="glass-panel p-5 rounded-2xl text-center">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">On Hold</p>
          <p className="text-2xl font-black text-orange-400">
            {pendingPayouts.filter(p => p.status === PayoutStatus.HOLD).length}
          </p>
          <p className="text-sm text-orange-400 font-bold">{formatCurrency(totalHoldAmount)}</p>
        </div>
        
        <div className="glass-panel p-5 rounded-2xl text-center">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Cashflow Remaining</p>
          <p className="text-2xl font-black text-green-400">{formatCurrency(cashflowRemaining)}</p>
          <p className="text-xs text-slate-500">
            of {formatCurrency(cashflow.dailyLimit)}
          </p>
        </div>
      </div>

      {/* Tab Switch */}
      <div className="flex gap-2 bg-white/5 p-1.5 rounded-[24px] border border-white/5">
        <button
          onClick={() => setPayoutSubTab('payouts')}
          className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase transition-all ${
            payoutSubTab === 'payouts' 
              ? 'bg-cyan-500 text-black shadow-lg' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Payouts ({pendingPayouts.length})
        </button>
        <button
          onClick={() => setPayoutSubTab('verifications')}
          className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase transition-all ${
            payoutSubTab === 'verifications' 
              ? 'bg-cyan-500 text-black shadow-lg' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Verifications ({pendingSubmissions.length})
        </button>
      </div>

      {payoutSubTab === 'payouts' ? (
        /* PAYOUTS TAB */
        <div className="space-y-6">
          {/* Rejection/Hold Modal */}
          {selectedItem && payouts.find(p => p.id === selectedItem) && (
            <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 animate-slide">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-white">
                  {payouts.find(p => p.id === selectedItem)?.status === PayoutStatus.HOLD 
                    ? 'Release Hold' 
                    : 'Reject/Hold Payout'}
                </h4>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setRejectReason('');
                    setHoldNote('');
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg"
                >
                  <ICONS.X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              
              {payouts.find(p => p.id === selectedItem)?.status === PayoutStatus.HOLD ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">
                    Payout is currently on hold. Release it to pending status?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReleaseHold(selectedItem)}
                      disabled={processing === selectedItem}
                      className="flex-1 py-3 bg-green-500 text-black rounded-xl text-sm font-bold uppercase disabled:opacity-50"
                    >
                      {processing === selectedItem ? 'Processing...' : 'Release Hold'}
                    </button>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="flex-1 py-3 bg-white/5 text-slate-400 rounded-xl text-sm font-bold uppercase"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label className="text-sm text-slate-300">Rejection Reason</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full h-24 bg-black/50 border border-slate-700 rounded-xl p-3 text-white text-sm"
                      placeholder="Explain why this payout is being rejected..."
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-sm text-slate-300">Hold Note (Optional)</label>
                    <textarea
                      value={holdNote}
                      onChange={(e) => setHoldNote(e.target.value)}
                      className="w-full h-20 bg-black/50 border border-slate-700 rounded-xl p-3 text-white text-sm"
                      placeholder="Add note for putting on hold..."
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRejectPayout(selectedItem)}
                      disabled={processing === selectedItem || !rejectReason.trim()}
                      className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold uppercase disabled:opacity-50"
                    >
                      {processing === selectedItem ? 'Processing...' : 'Reject Payout'}
                    </button>
                    <button
                      onClick={() => handleHoldPayout(selectedItem)}
                      disabled={processing === selectedItem || !holdNote.trim()}
                      className="flex-1 py-3 bg-orange-500 text-white rounded-xl text-sm font-bold uppercase disabled:opacity-50"
                    >
                      Put on Hold
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payouts List */}
          {pendingPayouts.length === 0 ? (
            <div className="text-center py-16">
              <ICONS.Wallet className="w-20 h-20 text-slate-700 mx-auto mb-6" />
              <p className="text-slate-600 text-lg font-black uppercase">No Pending Payouts</p>
              <p className="text-sm text-slate-500 mt-2">All payouts are processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPayouts.map(payout => (
                <div 
                  key={payout.id} 
                  className={`glass-panel p-6 rounded-2xl space-y-4 shadow-xl border ${
                    payout.status === PayoutStatus.HOLD 
                      ? 'border-orange-500/30 bg-orange-500/5' 
                      : 'border-white/5'
                  } animate-slide`}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          payout.status === PayoutStatus.HOLD 
                            ? 'bg-orange-500/20' 
                            : 'bg-cyan-500/20'
                        }`}>
                          <ICONS.Wallet className={`w-6 h-6 ${
                            payout.status === PayoutStatus.HOLD 
                              ? 'text-orange-500' 
                              : 'text-cyan-500'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <p className="text-xl font-black text-white">
                              {formatCurrency(payout.amount)}
                            </p>
                            {payout.status === PayoutStatus.HOLD && (
                              <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full">
                                ON HOLD
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm font-bold text-slate-400">
                              @{payout.username}
                            </span>
                            <span className="text-xs px-2 py-1 bg-slate-800 rounded-full">
                              {payout.method}
                            </span>
                          </div>
                          {payout.holdReason && (
                            <p className="text-xs text-orange-400 mt-1">
                              Hold: {payout.holdReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-2">Requested</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(payout.timestamp)}
                      </p>
                    </div>
                  </div>
                  
                  {/* ✅ CASHFLOW STATUS INDICATOR */}
                  {payout.status === PayoutStatus.PENDING && (
                    <div className={`p-3 rounded-xl border ${
                      payout.amount <= cashflowRemaining 
                        ? 'bg-green-500/10 border-green-500/20' 
                        : 'bg-red-500/10 border-red-500/20'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${
                          payout.amount <= cashflowRemaining 
                            ? 'text-green-400' 
                            : 'text-red-400'
                        }`}>
                          {payout.amount <= cashflowRemaining 
                            ? '✅ Within daily limit' 
                            : '❌ Exceeds daily limit'
                          }
                        </span>
                        <span className="text-xs text-slate-500">
                          Remaining: {formatCurrency(cashflowRemaining)}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    {payout.status === PayoutStatus.HOLD ? (
                      <button
                        onClick={() => setSelectedItem(payout.id)}
                        disabled={processing === payout.id}
                        className="flex-1 py-3 bg-green-500/10 text-green-400 rounded-xl text-sm font-black uppercase border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50"
                      >
                        Review Hold
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprovePayout(payout.id)}
                          disabled={processing === payout.id || payout.amount > cashflowRemaining}
                          className={`flex-1 py-3 rounded-xl text-sm font-black uppercase shadow-lg disabled:opacity-50 ${
                            payout.amount > cashflowRemaining
                              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                              : 'bg-green-500 text-black hover:bg-green-600'
                          }`}
                        >
                          {processing === payout.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => setSelectedItem(payout.id)}
                          disabled={processing === payout.id}
                          className="flex-1 py-3 bg-red-500/10 text-red-400 rounded-xl text-sm font-black uppercase border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Reject/Hold
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VERIFICATIONS TAB */
        <div className="space-y-6">
          {/* Rejection Modal */}
          {selectedItem && submissions.find(s => s.id === selectedItem) && (
            <div className="glass-panel p-6 rounded-2xl border border-red-500/20 animate-slide">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-white">Reject Submission</h4>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setRejectReason('');
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg"
                >
                  <ICONS.X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-3">
                  <label className="text-sm text-slate-300">Rejection Reason *</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full h-32 bg-black/50 border border-slate-700 rounded-xl p-3 text-white text-sm"
                    placeholder="Explain why this submission is being rejected..."
                    required
                  />
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRejectSubmission(selectedItem)}
                    disabled={processing === selectedItem || !rejectReason.trim()}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold uppercase disabled:opacity-50"
                  >
                    {processing === selectedItem ? 'Processing...' : 'Confirm Reject'}
                  </button>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className="flex-1 py-3 bg-white/5 text-slate-400 rounded-xl text-sm font-bold uppercase"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submissions List */}
          {pendingSubmissions.length === 0 ? (
            <div className="text-center py-16">
              <ICONS.Check className="w-20 h-20 text-slate-700 mx-auto mb-6" />
              <p className="text-slate-600 text-lg font-black uppercase">No Pending Verifications</p>
              <p className="text-sm text-slate-500 mt-2">All submissions are processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingSubmissions.map(sub => (
                <div key={sub.id} className="glass-panel p-6 rounded-2xl space-y-4 border border-white/5 shadow-xl animate-slide">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 max-w-[70%]">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-xl overflow-hidden">
                          <img 
                            src={sub.thumbnailUrl || 'https://via.placeholder.com/64?text=No+Image'}
                            alt="Thumbnail"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white truncate">
                            {sub.campaignTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 font-black">
                              @{sub.username}
                            </span>
                            <span className="text-xs px-2 py-1 bg-slate-800 rounded-full">
                              {sub.platform}
                            </span>
                            {sub.status === SubmissionStatus.VIRAL_CLAIM && (
                              <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-500 rounded-full">
                                VIRAL CLAIM
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xl font-black text-white">
                        {formatCurrency(sub.rewardAmount)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {sub.isViralBonus ? 'Viral Bonus' : 'Basic Pay'}
                      </p>
                    </div>
                  </div>
                  
                  {sub.externalLink && (
                    <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                      <p className="text-xs text-cyan-400 font-bold mb-1">Proof Link:</p>
                      <a 
                        href={sub.externalLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-300 break-all hover:text-cyan-400 transition-colors"
                      >
                        {sub.externalLink}
                      </a>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApproveSubmission(sub.id)}
                      disabled={processing === sub.id}
                      className="flex-1 py-3 bg-cyan-500 text-black rounded-xl text-sm font-black uppercase shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                    >
                      {processing === sub.id ? 'Processing...' : 'Approve & Pay'}
                    </button>
                    <button
                      onClick={() => setSelectedItem(sub.id)}
                      disabled={processing === sub.id}
                      className="flex-1 py-3 bg-red-500/10 text-red-400 rounded-xl text-sm font-black uppercase border border-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cashflow Status Footer */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Daily Cashflow Status</p>
            <p className="text-xs text-slate-500">
              {pendingPayouts.filter(p => p.amount > cashflowRemaining).length} payouts exceed limit
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-green-400">{formatCurrency(cashflowRemaining)}</p>
            <p className="text-xs text-slate-500">Available for payouts</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-green-500 transition-all duration-1000"
            style={{ width: `${Math.min((cashflow.todaySpent / cashflow.dailyLimit) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>Spent: {formatCurrency(cashflow.todaySpent)}</span>
          <span>Limit: {formatCurrency(cashflow.dailyLimit)}</span>
        </div>
      </div>
    </div>
  );
};

export default AdminPayouts;
