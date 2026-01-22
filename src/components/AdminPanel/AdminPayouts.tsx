import React, { useState } from 'react';
import { payoutService, submissionService } from './firebaseService';
import { ICONS } from '../../utils/constants';
import { PayoutStatus, SubmissionStatus } from '../../types';

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

  const pendingPayouts = payouts.filter(p => p.status === PayoutStatus.PENDING);
  const pendingSubmissions = submissions.filter(s => 
    s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM
  );

  const handleApprovePayout = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
      await payoutService.approvePayout(payoutId, 'admin-id'); // Replace with actual admin ID
      showToast('Payout approved successfully', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to approve payout', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectPayout = async (payoutId: string) => {
    setProcessing(payoutId);
    try {
      await payoutService.rejectPayout(payoutId, 'admin-id');
      showToast('Payout rejected', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to reject payout', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveSubmission = async (submissionId: string) => {
    setProcessing(submissionId);
    try {
      await submissionService.approveSubmission(submissionId, 'admin-id');
      showToast('Submission approved and user paid', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to approve submission', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectSubmission = async (submissionId: string) => {
    setProcessing(submissionId);
    try {
      await submissionService.rejectSubmission(submissionId, 'admin-id');
      showToast('Submission rejected', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to reject submission', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 animate-slide">
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
          Node Settlements
        </button>
        <button
          onClick={() => setPayoutSubTab('verifications')}
          className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${
            payoutSubTab === 'verifications' 
              ? 'bg-cyan-500 text-black shadow-lg' 
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Mission Verification
        </button>
      </div>

      {payoutSubTab === 'payouts' ? (
        /* Payouts Tab */
        <div className="space-y-4">
          {pendingPayouts.length === 0 ? (
            <div className="text-center py-12">
              <ICONS.Wallet className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-600 text-sm font-black uppercase">Settlement Hub Idle</p>
            </div>
          ) : (
            pendingPayouts.map(payout => (
              <div key={payout.id} className="glass-panel p-6 rounded-[32px] flex flex-col gap-4 shadow-xl border border-white/5 animate-slide">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xl font-black text-white italic tracking-tighter">
                      {formatCurrency(payout.amount)}
                    </p>
                    <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">
                      @{payout.username} • {payout.method}
                    </p>
                    <p className="text-[7px] text-slate-600 mt-1">
                      Requested: {formatDate(payout.timestamp)}
                    </p>
                  </div>
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/20">
                    <ICONS.ArrowLeft className="w-4 h-4 text-cyan-500 rotate-180" />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprovePayout(payout.id)}
                    disabled={processing === payout.id}
                    className="flex-1 py-3 bg-green-500 text-black rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >
                    {processing === payout.id ? 'Processing...' : 'Authorize Settlement'}
                  </button>
                  <button
                    onClick={() => handleRejectPayout(payout.id)}
                    disabled={processing === payout.id}
                    className="flex-1 py-3 bg-white/5 text-red-500 rounded-xl text-[9px] font-black uppercase border border-red-500/10 active:scale-95 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Verifications Tab */
        <div className="space-y-4">
          {pendingSubmissions.length === 0 ? (
            <div className="text-center py-12">
              <ICONS.Check className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-600 text-sm font-black uppercase">Audit Records Clear</p>
            </div>
          ) : (
            pendingSubmissions.map(sub => (
              <div key={sub.id} className="glass-panel p-6 rounded-[32px] space-y-4 border border-white/5 shadow-xl animate-slide">
                <div className="flex justify-between items-center">
                  <div className="max-w-[70%]">
                    <p className="text-xs font-black text-white italic uppercase tracking-tighter truncate">
                      {sub.campaignTitle}
                    </p>
                    <p className="text-[8px] text-slate-500 uppercase font-black">
                      @{sub.username} • {sub.platform}
                    </p>
                    {sub.status === SubmissionStatus.VIRAL_CLAIM && (
                      <span className="inline-block px-2 py-0.5 bg-cyan-500/20 text-cyan-500 text-[8px] font-black uppercase rounded-full mt-1">
                        VIRAL CLAIM
                      </span>
                    )}
                  </div>
                  <p className={`text-lg font-black italic ${
                    sub.status === SubmissionStatus.VIRAL_CLAIM ? 'text-cyan-400' : 'text-slate-200'
                  }`}>
                    {formatCurrency(sub.rewardAmount)}
                  </p>
                </div>
                
                {sub.externalLink && (
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5 overflow-hidden">
                    <p 
                      className="text-[7px] text-cyan-400 font-bold truncate italic cursor-pointer"
                      onClick={() => window.open(sub.externalLink, '_blank')}
                      title="Click to open link"
                    >
                      {sub.externalLink}
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveSubmission(sub.id)}
                    disabled={processing === sub.id}
                    className="flex-1 py-3 bg-cyan-500 text-black rounded-xl text-[9px] font-black uppercase shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {processing === sub.id ? 'Processing...' : 'Approve & Settle'}
                  </button>
                  <button
                    onClick={() => handleRejectSubmission(sub.id)}
                    disabled={processing === sub.id}
                    className="flex-1 py-3 bg-white/5 text-red-500 rounded-xl text-[9px] font-black uppercase border border-red-500/10 active:scale-95 disabled:opacity-50"
                  >
                    Reject Proof
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPayouts;
