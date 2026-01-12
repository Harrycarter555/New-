// src/components/WalletView.tsx
import React, { useState, useMemo } from 'react';
import { User, AppState, AppLog, PayoutStatus, Platform } from '../types';
import { ICONS } from '../constants';

interface WalletViewProps {
  currentUser: User;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const WalletView: React.FC<WalletViewProps> = ({
  currentUser,
  appState,
  setAppState,
  showToast,
}) => {
  const [walletTab, setWalletTab] = useState<'transactions' | 'inbox' | 'payment' | 'viral'>('transactions');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentSettings, setPaymentSettings] = useState({
    method: currentUser.payoutMethod || 'UPI',
    details: currentUser.payoutDetails || '',
  });
  const [viralLink, setViralLink] = useState('');
  const [selectedCampaignForViral, setSelectedCampaignForViral] = useState('');

  const userLogs = useMemo(
    () =>
      appState.logs.filter(
        (l) => l.userId === currentUser.id && ['verify', 'viral', 'payout'].includes(l.type)
      ),
    [appState.logs, currentUser.id]
  );

  const userMessages = useMemo(
    () =>
      appState.broadcasts.filter(
        (m) => !m.targetUserId || m.targetUserId === currentUser.id
      ),
    [appState.broadcasts, currentUser.id]
  );

  const handleWithdrawal = () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount < appState.config.minWithdrawal) {
      return showToast(`Minimum withdrawal ₹${appState.config.minWithdrawal}`, 'error');
    }
    if (amount > currentUser.walletBalance) {
      return showToast('Insufficient balance', 'error');
    }

    const req = {
      id: `p-${Date.now()}`,
      userId: currentUser.id,
      username: currentUser.username,
      amount,
      method: paymentSettings.details || 'UPI',
      status: PayoutStatus.PENDING,
      timestamp: Date.now(),
    };

    setAppState((prev) => ({
      ...prev,
      payoutRequests: [req, ...prev.payoutRequests],
    }));

    showToast('Payout Request Submitted', 'success');
    setWithdrawAmount('');
  };

  const handleUpdatePayment = () => {
    setAppState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? { ...u, payoutMethod: paymentSettings.method, payoutDetails: paymentSettings.details }
          : u
      ),
    }));
    showToast('Payment Settings Updated', 'success');
  };

  const handleViralSubmit = () => {
    if (!viralLink || !selectedCampaignForViral) {
      return showToast('Please fill all fields', 'error');
    }

    const campaign = appState.campaigns.find((c) => c.id === selectedCampaignForViral);
    if (!campaign) return;

    const viralSubmission = {
      id: `v-${Date.now()}`,
      userId: currentUser.id,
      username: currentUser.username,
      socialUsername: currentUser.savedSocialUsername || '',
      campaignId: selectedCampaignForViral,
      campaignTitle: campaign.title,
      platform: Platform.INSTAGRAM,
      status: 'VIRAL_CLAIM' as any,
      timestamp: Date.now(),
      rewardAmount: campaign.viralPay,
      externalLink: viralLink,
    };

    setAppState((prev) => ({
      ...prev,
      submissions: [viralSubmission, ...prev.submissions],
    }));

    setViralLink('');
    showToast('Viral Claim Submitted for Review', 'success');
  };

  return (
    <div className="space-y-10 pb-40 animate-slide">
      <h2 className="text-4xl font-black italic px-2 text-white uppercase leading-none italic">
        CREATOR<br/><span className="text-cyan-400">WALLET</span>
      </h2>

      <div className="glass-panel p-10 rounded-[56px] border-t-8 border-cyan-500 shadow-2xl">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">
          Available Balance
        </p>
        <h2 className="text-6xl font-black italic text-white mb-6">
          ₹{currentUser.walletBalance.toLocaleString()}
        </h2>
        <div className="flex gap-4">
          <div className="flex-1 p-5 bg-white/5 rounded-3xl text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Locked (Pending)</p>
            <p className="text-lg font-black text-white italic">
              ₹{currentUser.pendingBalance.toLocaleString()}
            </p>
          </div>
          <div className="flex-1 p-5 bg-white/5 rounded-3xl text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Total Earned</p>
            <p className="text-lg font-black text-cyan-400 italic">
              ₹{currentUser.totalEarnings.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 bg-white/5 p-2 rounded-3xl border border-white/10 overflow-x-auto hide-scrollbar">
        {['transactions', 'inbox', 'payment', 'viral'].map((t) => (
          <button
            key={t}
            onClick={() => setWalletTab(t as any)}
            className={`whitespace-nowrap flex-1 px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${
              walletTab === t ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {walletTab === 'transactions' && (
        <div className="space-y-8">
          <div className="glass-panel p-10 rounded-[56px] space-y-6 shadow-2xl">
            <h3 className="text-xl font-black text-white uppercase italic">Withdraw Funds</h3>
            <div className="space-y-4">
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-2xl font-black text-cyan-400 italic outline-none shadow-inner"
                placeholder="Amount ₹"
              />
              <button
                onClick={handleWithdrawal}
                className="w-full py-6 bg-cyan-500 text-black rounded-[28px] font-black uppercase text-sm shadow-xl active:scale-95"
              >
                Confirm Withdrawal
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-black italic px-2 text-white italic">Transaction History</h3>
            {userLogs.length === 0 ? (
              <p className="text-center py-10 text-slate-600 italic">No transactions yet</p>
            ) : (
              userLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex justify-between items-center p-6 bg-white/5 rounded-3xl border border-white/5 animate-slide"
                >
                  <div>
                    <p className="text-[10px] font-black text-white italic uppercase leading-none">
                      {log.type.toUpperCase()}
                    </p>
                    <p className="text-[8px] font-bold text-slate-600 mt-1">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <p className={`text-xs font-black italic ${log.type === 'payout' ? 'text-red-400' : 'text-cyan-400'}`}>
                    {log.message}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {walletTab === 'inbox' && (
        <div className="space-y-4 animate-slide">
          <h3 className="text-xl font-black italic px-2 text-white italic uppercase">Messages</h3>
          {userMessages.length === 0 ? (
            <p className="text-center py-20 text-slate-700 font-black uppercase text-[10px]">No new messages</p>
          ) : (
            userMessages.map((m) => (
              <div key={m.id} className="glass-panel p-6 rounded-[32px] border-l-4 border-l-cyan-500">
                <p className="text-xs text-white leading-relaxed">{m.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {walletTab === 'payment' && (
        <div className="glass-panel p-10 rounded-[56px] space-y-6 animate-slide">
          <h3 className="text-xl font-black text-white italic uppercase">Payment Settings</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {['UPI', 'BANK', 'USDT'].map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentSettings({ ...paymentSettings, method: m })}
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

      {walletTab === 'viral' && (
        <div className="glass-panel p-10 rounded-[56px] space-y-6 shadow-2xl animate-slide">
          <h3 className="text-xl font-black italic text-white italic uppercase tracking-tighter">
            Viral Bonus Claim
          </h3>
          <div className="space-y-4">
            <select
              value={selectedCampaignForViral}
              onChange={(e) => setSelectedCampaignForViral(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-bold text-white outline-none"
            >
              <option value="" className="bg-black">Select Campaign</option>
              {appState.campaigns.map((c) => (
                <option key={c.id} value={c.id} className="bg-black">
                  {c.title}
                </option>
              ))}
            </select>
            <input
              value={viralLink}
              onChange={(e) => setViralLink(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none"
              placeholder="Paste Viral Reel URL (min 20k views)"
            />
            <button
              onClick={handleViralSubmit}
              className="w-full py-6 bg-cyan-500 text-black rounded-[28px] font-black uppercase text-sm active:scale-95"
            >
              Submit Viral Claim
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletView;
