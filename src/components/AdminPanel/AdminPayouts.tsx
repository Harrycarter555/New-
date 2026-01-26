import React, { useState } from 'react';
import { payoutService, submissionService } from './firebaseService';
import { ICONS } from '../../utils/constants';
import { PayoutStatus, SubmissionStatus } from '../../types';
import { doc, updateDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';
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
  const [selectedPayout, setSelectedPayout] = useState<string | null>(null);
  const [holdNote, setHoldNote] = useState<string>('');

  // Get all pending payouts (including hold status)
  const pendingPayouts = payouts.filter(p => 
    p.status === PayoutStatus.PENDING || p.status === PayoutStatus.HOLD
  );

  // Get pending submissions
  const pendingSubmissions = submissions.filter(s => 
    s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM
  );

  // Handle payout approval
  const handleApprovePayout = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
      const payout = payouts.find(p => p.id === payoutId);
      if (!payout) throw new Error('Payout not found');

      // Check cashflow limit
      const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
      const cashflowSnap = await getDoc(cashflowRef);
      
      if (cashflowSnap.exists()) {
        const cashflowData = cashflowSnap.data();
        const remaining = cashflowData.dailyLimit - cashflowData.todaySpent;
        
        if (payout.amount > remaining) {
          showToast(`Daily limit exceeded. Remaining: ₹${remaining}`, 'error');
          setProcessing(null);
          return;
        }
      }

      // Approve payout
      await payoutService.approvePayout(payoutId, 'admin-id');
      
      // Update cashflow
      await updateDoc(cashflowRef, {
        todaySpent: increment(payout.amount),
        updatedAt: serverTimestamp()
      });

      // Update user wallet balance (deduct)
      const userRef = doc(db, 'users', payout.userId);
      await updateDoc(userRef, {
        walletBalance: increment(-payout.amount),
        updatedAt: serverTimestamp()
      });

      showToast(`Payout of ₹${payout.amount} approved successfully`, 'success');
    } catch (error: any) {
      console.error('Error approving payout:', error);
      showToast(error.message || 'Failed to approve payout', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // Handle payout rejection
  const handleRejectPayout = async (payoutId: string) => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    setProcessing(payoutId);
    try {
      const payout = payouts.find(p => p.id === payoutId);
      if (!payout) throw new Error('Payout not found');

      await payoutService.rejectPayout(payoutId, 'admin-id', rejectReason);
      
      // Return amount to user's wallet
      const userRef = doc(db, 'users', payout.userId);
      await updateDoc(userRef, {
        walletBalance: increment(payout.amount),
        updatedAt: serverTimestamp()
      });

      showToast('Payout rejected and amount returned to user', 'success');
      setRejectReason('');
      setSelectedPayout(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to reject payout', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // Put payout on hold
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
        heldBy: 'admin-id',
        updatedAt: serverTimestamp()
      });

      showToast('Payout put on hold', 'success');
      setHoldNote('');
      setSelectedPayout(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to put payout on hold', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // Release hold
  const handleReleaseHold = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
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

  // Handle submission approval
  const handleApproveSubmission = async (submissionId: string) => {
    setProcessing(submissionId);
    try {
      const submission = submissions.find(s => s.id === submissionId);
      if (!submission) throw new Error('Submission not found');

      // Check if it's viral claim
      const isViral = submission.status === SubmissionStatus.VIRAL_CLAIM;
      
      await submissionService.approveSubmission(submissionId, 'admin-id');
      
      showToast(
        `Submission approved ${isViral ? 'with viral bonus' : ''} and user paid`, 
        'success'
      );
    } catch (error: any) {
      showToast(error.message || 'Failed to approve submission', 'error');
    } finally {
      setProcessing(null);
    }
  };

  // Handle submission rejection
  const handleRejectSubmission = async (submissionId: string) => {
    if (!rejectReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }

    setProcessing(submissionId);
    try {
      await submissionService.rejectSubmission(submissionId, 'admin-id', rejectReason);
      
      showToast('Submission rejected', 'success');
      setRejectReason('');
      setSelectedPayout(null);
    } catch (error: any) {
      showToast(error.message || 'Failed to reject submission', 'error');
    } finally {
      setProcessing(null);
    }
  };

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

  // Calculate totals
  const totalPendingAmount = pendingPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalHoldAmount = pendingPayouts
    .filter(p => p.status === PayoutStatus.HOLD)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-8 animate-slide">
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Pending Payouts</p>
          <p className="text-xl font-black text-white">{pendingPayouts.length}</p>
          <p className="text-[10px] text-cyan-400 font-bold">{formatCurrency(totalPendingAmount)}</p>
        </div>
        
        <div className="glass-panel p-5 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase mb-1">On Hold</p>
          <p className="text-xl font-black text-orange-400">
            {pendingPayouts.filter(p => p.status === PayoutStatus.HOLD).length}
          </p>
          <p className="text-[10px] text-orange-400 font-bold">{formatCurrency(totalHoldAmount)}</p>
        </div>
        
        <div className="glass-panel p-5 rounded-2xl text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Pending Verifications</p>
          <p className="text-xl font-black text-amber-400">{pendingSubmissions.length}</p>
          <p className="text-[10px] text-amber-400 font-bold">
            {formatCurrency(pendingSubmissions.reduce((sum, s) => sum + (s.rewardAmount || 0), 0))}
          </p>
        </div>
      </div>

      {/* Tab Switch */}
      <div className="flex gap-2 bg-white/5 p-1.5 rounded-[24px] border border-white/5 shadow-inner backdrop-blur-md">
        <button
          onClick={() => setPayoutSubTab('payouts')}
          className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${
            payoutSubTab === 'payouts' 
              ? 'bg-cyan-500 text-black shadow-lg' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Node Settlements ({pendingPayouts.length})
        </button>
        <button
          onClick={() => setPayoutSubTab('verifications')}
          className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${
            payoutSubTab === 'verifications' 
              ? 'bg-cyan-500 text-black shadow-lg' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Mission Verification ({pendingSubmissions.length})
        </button>
      </div>

      {payoutSubTab === 'payouts' ? (
        /* Payouts Tab */
        <div className="space-y-6">
          {/* Rejection/Hold Modal */}
          {selectedPayout && (
            <div className="glass-panel p-6 rounded-2xl border border-cyan-500/20 animate-slide">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-white">
                  {payouts.find(p => p.id === selectedPayout)?.status === PayoutStatus.HOLD 
                    ? 'Release Hold' 
                    : 'Reject/Hold Payout'}
                </h4>
                <button
                  onClick={() => {
                    setSelectedPayout(null);
                    setRejectReason('');
                    setHoldNote('');
                  }}
                  className="p-1 hover:bg-white/10 rounded-lg"
                >
                  <ICONS.X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              
              {payouts.find(p => p.id === selectedPayout)?.status === PayoutStatus.HOLD ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">
                    Payout is currently on hold. Release it to pending status?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReleaseHold(selectedPayout)}
                      disabled={processing === selectedPayout}
                      className="flex-1 py-3 bg-green-500 text-black rounded-xl text-xs font-bold uppercase disabled:opacity-50"
                    >
                      {processing === selectedPayout ? 'Processing...' : 'Release Hold'}
                    </button>
                    <button
                      onClick={() => setSelectedPayout(null)}
                      className="flex-1 py-3 bg-white/5 text-slate-400 rounded-xl text-xs font-bold uppercase"
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
                      onClick={() => handleRejectPayout(selectedPayout)}
                      disabled={processing === selectedPayout || !rejectReason.trim()}
                      className="flex-1 py-3 bg-red-500 text-white rounded-xl text-xs font-bold uppercase disabled:opacity-50"
                    >
                      {processing === selectedPayout ? 'Processing...' : 'Reject Payout'}
                    </button>
                    <button
                      onClick={() => handleHoldPayout(selectedPayout)}
                      disabled={processing === selectedPayout || !holdNote.trim()}
                      className="flex-1 py-3 bg-orange-500 text-white rounded-xl text-xs font-bold uppercase disabled:opacity-50"
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
              <p className="text-slate-600 text-lg font-black uppercase">No Pending Settlements</p>
              <p className="text-sm text-slate-500 mt-2">All payouts are processed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPayouts.map(payout => (
                <div 
                  key={payout.id} 
                  className={`glass-panel p-6 rounded-2xl space-y-4 shadow-xl border ${
                    payout.status === PayoutStatus.HOLD 
                      ? 'border-orange-500/30' 
                      : 'border-white/5'
                  } animate-slide`}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                          <ICONS.Wallet className="w-6 h-6 text-cyan-500" />
                        </div>
                        <div>
                          <p className="text-xl font-black text-white italic">
                            {formatCurrency(payout.amount)}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                              @{payout.username}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded-full">
                              {payout.method}
                            </span>
                            {payout.status === PayoutStatus.HOLD && (
                              <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                                ON HOLD
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1 ml-1">
                        <p className="text-[10px] text-slate-600">
                          Requested: {formatDate(payout.timestamp)}
                        </p>
                        {payout.upiId && (
                          <p className="text-[10px] text-cyan-400 font-bold">
                            UPI: {payout.upiId}
                          </p>
                        )}
                        {payout.holdReason && (
                          <p className="text-[10px] text-orange-400">
                            Hold Reason: {payout.holdReason}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-[8px] text-slate-500 uppercase mb-2">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        payout.status === PayoutStatus.PENDING
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {payout.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    {payout.status === PayoutStatus.HOLD ? (
                      <>
                        <button
                          onClick={() => setSelectedPayout(payout.id)}
                          disabled={processing === payout.id}
                          className="flex-1 py-3 bg-green-500/10 text-green-400 rounded-xl text-xs font-black uppercase border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50"
                        >
                          Review Hold
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprovePayout(payout.id)}
                          disabled={processing === payout.id}
                          className="flex-1 py-3 bg-green-500 text-black rounded-xl text-xs font-black uppercase shadow-lg disabled:opacity-50"
                        >
                          {processing === payout.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => setSelectedPayout(payout.id)}
                          disabled={processing === payout.id}
                          className="flex-1 py-3 bg-red-500/10 text-red-400 rounded-xl text-xs font-black uppercase border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
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

          {/* Processed Payouts Summary */}
          {payouts.filter(p => p.status === PayoutStatus.APPROVED).length > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-green-500/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-green-400 font-bold">Processed Today</p>
                  <p className="text-xs text-slate-400">
                    {payouts.filter(p => 
                      p.status === PayoutStatus.APPROVED && 
                      new Date(p.processedAt || p.timestamp).toDateString() === new Date().toDateString()
                    ).length} payouts
                  </p>
                </div>
                <p className="text-lg font-black text-green-400">
                  {formatCurrency(
                    payouts
                      .filter(p => 
                        p.status === PayoutStatus.APPROVED && 
                        new Date(p.processedAt || p.timestamp).toDateString() === new Date().toDateString()
                      )
                      .reduce((sum, p) => sum + (p.amount || 0), 0)
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Verifications Tab */
        <div className="space-y-6">
          {/* Rejection Modal for Submissions */}
          {selectedPayout && (
            <div className="glass-panel p-6 rounded-2xl border border-red-500/20 animate-slide">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-white">Reject Submission</h4>
                <button
                  onClick={() => {
                    setSelectedPayout(null);
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
                    onClick={() => handleRejectSubmission(selectedPayout)}
                    disabled={processing === selectedPayout || !rejectReason.trim()}
                    className="flex-1 py-3 bg-red-500 text-white rounded-xl text-xs font-bold uppercase disabled:opacity-50"
                  >
                    {processing === selectedPayout ? 'Processing...' : 'Confirm Reject'}
                  </button>
                  <button
                    onClick={() => setSelectedPayout(null)}
                    className="flex-1 py-3 bg-white/5 text-slate-400 rounded-xl text-xs font-bold uppercase"
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
                        <img 
                          src={submissions.find(s => s.id === sub.id)?.thumbnailUrl || ''}
                          alt="Thumbnail"
                          className="w-16 h-16 rounded-xl object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/64?text=No+Image';
                          }}
                        />
                        <div>
                          <p className="text-sm font-black text-white italic uppercase tracking-tighter truncate">
                            {sub.campaignTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500 uppercase font-black">
                              @{sub.username}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded-full">
                              {sub.platform}
                            </span>
                            {sub.status === SubmissionStatus.VIRAL_CLAIM && (
                              <span className="text-[10px] px-2 py-0.5 bg-cyan-500/20 text-cyan-500 rounded-full">
                                VIRAL CLAIM
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-1 ml-1">
                        <p className="text-[10px] text-slate-600">
                          Submitted: {formatDate(sub.timestamp)}
                        </p>
                        {sub.socialUsername && (
                          <p className="text-[10px] text-cyan-400 font-bold">
                            Account: {sub.socialUsername}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-black italic text-white">
                        {formatCurrency(sub.rewardAmount)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
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
                        className="text-[11px] text-slate-300 break-all hover:text-cyan-400 transition-colors"
                      >
                        {sub.externalLink}
                      </a>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApproveSubmission(sub.id)}
                      disabled={processing === sub.id}
                      className="flex-1 py-3 bg-cyan-500 text-black rounded-xl text-xs font-black uppercase shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                    >
                      {processing === sub.id ? 'Processing...' : 'Approve & Pay'}
                    </button>
                    <button
                      onClick={() => setSelectedPayout(sub.id)}
                      disabled={processing === sub.id}
                      className="flex-1 py-3 bg-red-500/10 text-red-400 rounded-xl text-xs font-black uppercase border border-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Approved Submissions Summary */}
          {submissions.filter(s => s.status === SubmissionStatus.APPROVED).length > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-cyan-400 font-bold">Approved Today</p>
                  <p className="text-xs text-slate-400">
                    {submissions.filter(s => 
                      s.status === SubmissionStatus.APPROVED && 
                      new Date(s.approvedAt || s.timestamp).toDateString() === new Date().toDateString()
                    ).length} submissions
                  </p>
                </div>
                <p className="text-lg font-black text-cyan-400">
                  {formatCurrency(
                    submissions
                      .filter(s => 
                        s.status === SubmissionStatus.APPROVED && 
                        new Date(s.approvedAt || s.timestamp).toDateString() === new Date().toDateString()
                      )
                      .reduce((sum, s) => sum + (s.rewardAmount || 0), 0)
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats Footer */}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-[8px] text-slate-500 uppercase font-black">Total Requests</p>
            <p className="text-lg font-black text-white">{payouts.length}</p>
          </div>
          <div>
            <p className="text-[8px] text-slate-500 uppercase font-black">Pending</p>
            <p className="text-lg font-black text-amber-400">{pendingPayouts.length}</p>
          </div>
          <div>
            <p className="text-[8px] text-slate-500 uppercase font-black">Approved</p>
            <p className="text-lg font-black text-green-400">
              {payouts.filter(p => p.status === PayoutStatus.APPROVED).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPayouts;
