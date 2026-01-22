import React, { useState, useEffect } from 'react';
import { User, AppState, PayoutStatus, Platform, SubmissionStatus } from '../types';
import { ICONS } from '../constants';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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
  const [paymentSettings, setPaymentSettings] = useState<{
    method: 'UPI' | 'BANK' | 'USDT';
    details: string;
  }>({
    method: (currentUser.payoutMethod as 'UPI' | 'BANK' | 'USDT') || 'UPI',
    details: currentUser.payoutDetails || '',
  });
  const [viralLink, setViralLink] = useState('');
  const [selectedCampaignForViral, setSelectedCampaignForViral] = useState('');
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [userPayouts, setUserPayouts] = useState<any[]>([]);
  const [userBroadcasts, setUserBroadcasts] = useState<any[]>([]);

  // ✅ REAL-TIME: Fetch user submissions
  useEffect(() => {
    if (!currentUser) return;

    const submissionsRef = collection(db, 'submissions');
    const q = query(
      submissionsRef, 
      where('userId', '==', currentUser.id),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const submissions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserSubmissions(submissions);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ✅ REAL-TIME: Fetch user payouts
  useEffect(() => {
    if (!currentUser) return;

    const payoutsRef = collection(db, 'payouts');
    const q = query(
      payoutsRef, 
      where('userId', '==', currentUser.id),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const payouts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserPayouts(payouts);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ✅ REAL-TIME: Fetch user broadcasts
  useEffect(() => {
    if (!currentUser) return;

    const broadcastsRef = collection(db, 'broadcasts');
    const q = query(
      broadcastsRef,
      where('targetUserId', 'in', [currentUser.id, null]),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const broadcasts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserBroadcasts(broadcasts);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ✅ UPDATED: Withdrawal request using Firestore
  const handleWithdrawal = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount < appState.config.minWithdrawal) {
      return showToast(`Minimum withdrawal ₹${appState.config.minWithdrawal}`, 'error');
    }
    if (amount > currentUser.walletBalance) {
      return showToast('Insufficient balance', 'error');
    }

    try {
      // ✅ Save to Firestore
      await addDoc(collection(db, 'payouts'), {
        userId: currentUser.id,
        username: currentUser.username,
        amount,
        method: paymentSettings.method,
        details: paymentSettings.details,
        status: PayoutStatus.PENDING,
        timestamp: Date.now(),
        requestedAt: Date.now(),
        createdAt: serverTimestamp()
      });

      // ✅ Update user's wallet balance
      await updateDoc(doc(db, 'users', currentUser.id), {
        walletBalance: increment(-amount),
        updatedAt: serverTimestamp()
      });

      showToast('Payout Request Submitted', 'success');
      setWithdrawAmount('');
      
      // Update local state
      setAppState(prev => ({
        ...prev,
        users: prev.users.map(u =>
          u.id === currentUser.id
            ? { ...u, walletBalance: u.walletBalance - amount }
            : u
        )
      }));
    } catch (error: any) {
      showToast(error.message || 'Failed to submit payout request', 'error');
    }
  };

  const handleUpdatePayment = async () => {
    try {
      // ✅ Save to Firestore
      await updateDoc(doc(db, 'users', currentUser.id), {
        payoutMethod: paymentSettings.method,
        payoutDetails: paymentSettings.details,
        updatedAt: serverTimestamp()
      });

      // Update local state
      setAppState(prev => ({
        ...prev,
        users: prev.users.map(u =>
          u.id === currentUser.id
            ? { ...u, payoutMethod: paymentSettings.method, payoutDetails: paymentSettings.details }
            : u
        ),
      }));

      showToast('Payment Settings Updated', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to update payment settings', 'error');
    }
  };

  // ✅ UPDATED: Viral submission using Firestore
  const handleViralSubmit = async () => {
    if (!viralLink || !selectedCampaignForViral) return showToast('Please fill all fields', 'error');

    const campaign = appState.campaigns.find(c => c.id === selectedCampaignForViral);
    if (!campaign) return;

    try {
      // ✅ Save to Firestore
      await addDoc(collection(db, 'submissions'), {
        userId: currentUser.id,
        username: currentUser.username,
        socialUsername: currentUser.savedSocialUsername || '',
        campaignId: selectedCampaignForViral,
        campaignTitle: campaign.title,
        platform: Platform.INSTAGRAM,
        status: SubmissionStatus.VIRAL_CLAIM,
        timestamp: Date.now(),
        rewardAmount: campaign.viralPay,
        externalLink: viralLink,
        isViralBonus: true,
        createdAt: serverTimestamp()
      });

      showToast('Viral Claim Submitted for Review', 'success');
      setViralLink('');
      setSelectedCampaignForViral('');
    } catch (error: any) {
      showToast(error.message || 'Failed to submit viral claim', 'error');
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

  // Calculate pending submissions
  const pendingSubmissions = userSubmissions.filter(
    s => s.status === SubmissionStatus.PENDING || s.status === SubmissionStatus.VIRAL_CLAIM
  );

  // Calculate approved earnings
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

      {/* Transactions Tab */}
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

          {/* Transaction History */}
          <div className="space-y-4">
            <h3 className="text-xl font-black italic px-2 text-white italic">Transaction History</h3>
            {userPayouts.length === 0 && userSubmissions.length === 0 ? (
              <p className="text-center py-10 text-slate-600 italic">No transactions yet</p>
            ) : (
              <>
                {userPayouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex justify-between items-center p-6 bg-white/5 rounded-3xl border border-white/5 animate-slide"
                  >
                    <div>
                      <p className="text-[10px] font-black text-white italic uppercase leading-none">
                        WITHDRAWAL
                      </p>
                      <p className="text-[8px] font-bold text-slate-600 mt-1">
                        {formatDate(payout.timestamp)}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 mt-1">
                        {payout.method} • {payout.status}
                      </p>
                    </div>
                    <p className={`text-xs font-black italic ${payout.status === 'approved' ? 'text-green-400' : 'text-amber-400'}`}>
                      {formatCurrency(payout.amount)}
                    </p>
                  </div>
                ))}

                {userSubmissions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex justify-between items-center p-6 bg-white/5 rounded-3xl border border-white/5 animate-slide"
                  >
                    <div>
                      <p className="text-[10px] font-black text-white italic uppercase leading-none">
                        {sub.campaignTitle}
                      </p>
                      <p className="text-[8px] font-bold text-slate-600 mt-1">
                        {formatDate(sub.timestamp)}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 mt-1">
                        {sub.status} • {sub.isViralBonus ? 'Viral Bonus' : 'Basic'}
                      </p>
                    </div>
                    <p className={`text-xs font-black italic ${sub.status === 'approved' ? 'text-cyan-400' : 'text-amber-400'}`}>
                      {formatCurrency(sub.rewardAmount)}
                    </p>
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
            userBroadcasts.map((m) => (
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
    
    {/* Campaign Selection Grid */}
    <div className="grid grid-cols-2 gap-4">
      {userCampaigns.filter(c => c.active).map(campaign => (
        <div
          key={campaign.id}
          onClick={() => setSelectedCampaignForViral(campaign.id)}
          className={`relative rounded-2xl overflow-hidden border-2 cursor-pointer ${
            selectedCampaignForViral === campaign.id 
              ? 'border-cyan-500 shadow-lg shadow-cyan-500/20' 
              : 'border-white/10'
          }`}
        >
          <img 
            src={campaign.thumbnailUrl} 
            alt={campaign.title}
            className="w-full h-32 object-cover"
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
      disabled={!selectedCampaignForViral || !viralLink}
      className="w-full py-6 bg-cyan-500 text-black rounded-[28px] font-black uppercase text-sm active:scale-95 disabled:opacity-50"
    >
      Submit Viral Claim
    </button>
          </div>
          
          {pendingSubmissions.length > 0 && (
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <p className="text-xs font-black text-amber-400 mb-2">Pending Reviews:</p>
              {pendingSubmissions.map(sub => (
                <div key={sub.id} className="flex justify-between items-center p-2">
                  <p className="text-[10px] text-white truncate">{sub.campaignTitle}</p>
                  <p className="text-[10px] text-amber-400">{formatCurrency(sub.rewardAmount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WalletView;
