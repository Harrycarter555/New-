import React, { useState } from 'react';
import { User, AppState, PayoutStatus, Platform, SubmissionStatus, Campaign } from '../types';
import { ICONS } from '../constants';
import { userService, reportService } from './AdminPanel/firebaseService';

interface WalletViewProps {
  currentUser: User;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  userCampaigns: Campaign[];
  userBroadcasts: any[];
  userSubmissions: any[];
  userPayouts: any[];
}

const WalletView: React.FC<WalletViewProps> = ({
  currentUser,
  appState,
  setAppState,
  showToast,
  userCampaigns,
  userBroadcasts,
  userSubmissions,
  userPayouts,
}) => {
  const [walletTab, setWalletTab] = useState<'transactions' | 'inbox' | 'payment' | 'viral' | 'report'>('transactions');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentSettings, setPaymentSettings] = useState<{
    method: 'UPI' | 'BANK' | 'USDT';
    details: string;
  }>({
    method: (currentUser.payoutMethod as 'UPI' | 'BANK' | 'USDT') || 'UPI',
    details: currentUser.payoutDetails || '',
  });
  const [viralLink, setViralLink] = useState('');
  const [selectedCampaignForViral, setSelectedCampaignForViral] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==================== Withdrawal Logic (using saved payment details) ====================
  const handleWithdrawal = async () => {
    const amount = Number(withdrawAmount);

    // Validation
    if (isNaN(amount) || amount <= 0) {
      return showToast('Enter a valid amount greater than 0', 'error');
    }
    if (amount < appState.config.minWithdrawal) {
      return showToast(`Minimum withdrawal is ₹${appState.config.minWithdrawal}`, 'error');
    }
    if (amount > currentUser.walletBalance) {
      return showToast('Insufficient balance in wallet', 'error');
    }
    if (!paymentSettings.details.trim()) {
      return showToast('Update payment details in Payment tab first', 'error');
    }

    setIsSubmitting(true);

    try {
      await userService.requestPayout(
        currentUser.id,
        currentUser.username,
        amount,
        paymentSettings.method,
        paymentSettings.details
      );

      showToast(`Withdrawal request of ₹${amount.toLocaleString('en-IN')} submitted!`, 'success');

      setWithdrawAmount('');

      // Optimistic wallet balance update
      setAppState(prev => ({
        ...prev,
        users: prev.users.map(u =>
          u.id === currentUser.id
            ? { ...u, walletBalance: Math.max(0, u.walletBalance - amount) }
            : u
        )
      }));
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      showToast(error.message || 'Failed to submit withdrawal request. Try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePayment = async () => {
    try {
      showToast('Payment Settings Saved', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update payment settings', 'error');
    }
  };

  const handleViralSubmit = async () => {
    if (!viralLink || !selectedCampaignForViral) {
      return showToast('Please fill all fields', 'error');
    }

    setIsSubmitting(true);
    try {
      showToast('Viral Claim Submitted for Review', 'success');
      setViralLink('');
      setSelectedCampaignForViral('');
    } catch (error: any) {
      showToast(error.message || 'Failed to submit viral claim', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number): string => `₹${amount?.toLocaleString('en-IN') || '0'}`;
  const formatDate = (timestamp: number): string => new Date(timestamp).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const pendingSubmissions = userSubmissions.filter(
    s => s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM
  );

  const approvedEarnings = userSubmissions
    .filter(s => s.status === SubmissionStatus.APPROVED)
    .reduce((sum, s) => sum + (s.rewardAmount || 0), 0);

  return (
    <div className="space-y-10 pb-40 animate-slide">
      <h2 className="text-4xl font-black italic px-2 text-white uppercase leading-none italic">
        CREATOR<br/><span className="text-cyan-400">WALLET</span>
      </h2>

      {/* Balance Card */}
      <div className="glass-panel p-10 rounded-[56px] border-t-8 border-cyan-500 shadow-2xl">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">
          Available Balance
        </p>
        <h2 className="text-6xl font-black italic text-white mb-6">
          {formatCurrency(currentUser.walletBalance)}
        </h2>
        <div className="flex gap-4">
          <div className="flex-1 p-5 bg-white/5 rounded-3xl text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Locked (Pending)</p>
            <p className="text-lg font-black text-white italic">
              {formatCurrency(currentUser.pendingBalance)}
            </p>
          </div>
          <div className="flex-1 p-5 bg-white/5 rounded-3xl text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Total Earned</p>
            <p className="text-lg font-black text-cyan-400 italic">
              {formatCurrency(approvedEarnings)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white/5 p-2 rounded-3xl border border-white/10 overflow-x-auto hide-scrollbar">
        {['transactions', 'inbox', 'payment', 'viral', 'report'].map((t) => (
          <button
            key={t}
            onClick={() => setWalletTab(t as any)}
            className={`whitespace-nowrap flex-1 px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${
              walletTab === t 
                ? t === 'report' 
                  ? 'bg-red-600 text-white shadow-lg' 
                  : 'bg-cyan-500 text-black shadow-lg' 
                : 'text-slate-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Transactions Tab */}
      {walletTab === 'transactions' && (
        <div className="space-y-8">
          <div className="glass-panel p-10 rounded-[56px] space-y-6 shadow-2xl">
            <h3 className="text-xl font-black text-white uppercase italic">Withdraw Funds</h3>
            <div className="space-y-5">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-cyan-400 outline-none shadow-inner"
                placeholder="Amount ₹"
                min="0"
              />
              <div className="p-4 bg-white/5 rounded-xl">
                <p className="text-sm text-slate-400 mb-1">Method</p>
                <p className="text-lg font-bold text-white">{paymentSettings.method}</p>
                <p className="text-sm text-slate-500 mt-1 truncate">
                  {paymentSettings.details || 'Not set - Update in Payment tab'}
                </p>
              </div>
              <button
                onClick={handleWithdrawal}
                disabled={isSubmitting || !withdrawAmount.trim() || !paymentSettings.details.trim()}
                className={`w-full py-6 rounded-[32px] font-black uppercase text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${
                  isSubmitting || !withdrawAmount.trim() || !paymentSettings.details.trim()
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-cyan-500 text-black hover:bg-cyan-600 active:scale-95'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Withdrawal'
                )}
              </button>
            </div>
          </div>

          {/* Transaction History */}
          <div className="space-y-4">
            <h3 className="text-xl font-black italic px-2 text-white">Transaction History</h3>
            {userPayouts.length === 0 && userSubmissions.length === 0 ? (
              <p className="text-center py-10 text-slate-600 italic">No transactions yet</p>
            ) : (
              <>
                {userPayouts.map((payout: any) => (
                  <div key={payout.id} className="flex justify-between items-center p-6 bg-white/5 rounded-3xl border border-white/5 animate-slide">
                    <div>
                      <p className="text-[10px] font-black text-white italic uppercase leading-none">WITHDRAWAL</p>
                      <p className="text-[8px] font-bold text-slate-600 mt-1">{formatDate(payout.timestamp)}</p>
                      <p className="text-[8px] font-bold text-slate-400 mt-1">{payout.method} • {payout.status}</p>
                    </div>
                    <p className="text-xs font-black italic text-cyan-400">{formatCurrency(payout.amount)}</p>
                  </div>
                ))}

                {userSubmissions.map((sub: any) => (
                  <div key={sub.id} className="flex justify-between items-center p-6 bg-white/5 rounded-3xl border border-white/5 animate-slide">
                    <div>
                      <p className="text-[10px] font-black text-white italic uppercase leading-none">{sub.campaignTitle}</p>
                      <p className="text-[8px] font-bold text-slate-600 mt-1">{formatDate(sub.timestamp)}</p>
                      <p className="text-[8px] font-bold text-slate-400 mt-1">{sub.status} • {sub.isViralBonus ? 'Viral Bonus' : 'Basic'}</p>
                    </div>
                    <p className="text-xs font-black italic text-cyan-400">{formatCurrency(sub.rewardAmount)}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Inbox Tab */}
      {walletTab === 'inbox' && (
        <div className="space-y-4 animate-slide">
          <h3 className="text-xl font-black italic px-2 text-white italic uppercase">Messages</h3>
          {userBroadcasts.length === 0 ? (
            <p className="text-center py-20 text-slate-700 font-black uppercase text-[10px]">No new messages</p>
          ) : (
            userBroadcasts.map((m: any) => (
              <div key={m.id} className="glass-panel p-6 rounded-[32px] border-l-4 border-l-cyan-500">
                <p className="text-xs text-white leading-relaxed">{m.content}</p>
                <p className="text-[8px] text-slate-500 mt-2">
                  {formatDate(m.timestamp)}
                  {m.senderName && ` • From: ${m.senderName}`}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Payment Tab */}
      {walletTab === 'payment' && (
        <div className="glass-panel p-10 rounded-[56px] space-y-6 animate-slide">
          <h3 className="text-xl font-black text-white italic uppercase">Payment Settings</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {['UPI', 'BANK', 'USDT'].map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentSettings({ ...paymentSettings, method: m as 'UPI' | 'BANK' | 'USDT' })}
                  className={`py-3 rounded-xl font-black text-[9px] uppercase ${
                    paymentSettings.method === m ? 'bg-cyan-500 text-black shadow-md' : 'bg-white/5 text-slate-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              value={paymentSettings.details}
              onChange={(e) => setPaymentSettings({ ...paymentSettings, details: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none shadow-inner"
              placeholder="UPI ID / Bank Details / Wallet Address"
            />
            <button
              onClick={handleUpdatePayment}
              className="w-full py-6 bg-cyan-500 text-black rounded-[28px] font-black uppercase text-sm shadow-xl active:scale-95"
            >
              Save Payment Details
            </button>
          </div>
        </div>
      )}

      {/* Viral Tab */}
      {walletTab === 'viral' && (
        <div className="glass-panel p-10 rounded-[56px] space-y-6 shadow-2xl animate-slide">
          <h3 className="text-xl font-black italic text-white italic uppercase tracking-tighter">
            Viral Bonus Claim
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {userCampaigns.filter(c => c.active).map(campaign => (
              <div
                key={campaign.id}
                onClick={() => setSelectedCampaignForViral(campaign.id)}
                className={`relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all ${
                  selectedCampaignForViral === campaign.id 
                    ? 'border-cyan-500 shadow-lg shadow-cyan-500/20 scale-[1.02]' 
                    : 'border-white/10 hover:border-cyan-500/30'
                }`}
              >
                <img 
                  src={campaign.thumbnailUrl} 
                  alt={campaign.title}
                  className="w-full h-32 object-cover"
                  onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/400x200?text=No+Thumbnail'}
                />
                <div className="p-3 bg-black/80">
                  <p className="text-[10px] font-bold text-white truncate">{campaign.title}</p>
                  <p className="text-[8px] text-cyan-400 font-bold">₹{campaign.viralPay} bonus</p>
                </div>
              </div>
            ))}
          </div>

          <input
            value={viralLink}
            onChange={(e) => setViralLink(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none"
            placeholder="Paste Viral Reel URL (min 20k views)"
          />
          
          <button
            onClick={handleViralSubmit}
            disabled={!selectedCampaignForViral || !viralLink || isSubmitting}
            className="w-full py-6 bg-cyan-500 text-black rounded-[28px] font-black uppercase text-sm active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Viral Claim'}
          </button>
          
          {pendingSubmissions.length > 0 && (
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <p className="text-xs font-black text-amber-400 mb-2">Pending Reviews:</p>
              {pendingSubmissions.map((sub: any) => (
                <div key={sub.id} className="flex justify-between items-center p-2">
                  <p className="text-[10px] text-white truncate">{sub.campaignTitle}</p>
                  <p className="text-[10px] text-amber-400">{formatCurrency(sub.rewardAmount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Report Tab - No blank screen */}
      {walletTab === 'report' && (
        <ReportTab currentUser={currentUser} showToast={showToast} />
      )}
    </div>
  );
};

// ReportTab - states defined, no blank screen
const ReportTab: React.FC<{
  currentUser: User;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ currentUser, showToast }) => {
  const [category, setCategory] = useState('other');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return showToast('Please write your message', 'error');
    if (message.length > 1000) return showToast('Message too long (max 1000 chars)', 'error');

    setSubmitting(true);
    try {
      await reportService.submitReport(
        currentUser.id,
        currentUser.username,
        currentUser.email || 'no-email',
        message.trim(),
        category
      );
      showToast('Report sent to admin!', 'success');
      setMessage('');
      setCategory('other');
    } catch (err: any) {
      showToast(err.message || 'Failed to send report', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-panel p-8 rounded-[48px] border-t-8 border-red-600 shadow-2xl space-y-8 animate-slide">
      <h3 className="text-3xl font-black italic text-red-400 uppercase text-center">REPORT ISSUE</h3>
      <p className="text-center text-sm text-slate-400">Admin will review your message</p>

      <select
        value={category}
        onChange={e => setCategory(e.target.value)}
        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-4 text-white"
      >
        <option value="other">Other</option>
        <option value="payout">Payout Issue</option>
        <option value="campaign">Campaign Issue</option>
        <option value="bug">App Bug</option>
      </select>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Write your issue here..."
        className="w-full h-40 bg-slate-900/50 border border-slate-700 rounded-2xl p-5 text-white resize-none"
        maxLength={1000}
      />
      <p className="text-right text-xs text-slate-500">{message.length}/1000</p>

      <button
        onClick={handleSubmit}
        disabled={submitting || !message.trim()}
        className={`w-full py-5 rounded-[32px] font-black uppercase text-lg ${
          submitting || !message.trim() ? 'bg-slate-700 text-slate-400' : 'bg-red-600 text-white'
        }`}
      >
        {submitting ? 'Sending...' : 'Send to Admin'}
      </button>
    </div>
  );
};

export default WalletView;
