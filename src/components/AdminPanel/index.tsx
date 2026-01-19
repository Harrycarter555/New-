import React, { useState, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import AdminMembers from './AdminMembers';
import AdminCampaigns from './AdminCampaigns';
import AdminCashflow from './AdminCashflow';
import AdminPayouts from './AdminPayouts';
import AdminReports from './AdminReports';
import AdminBroadcasts from './AdminBroadcasts';
import { userService, campaignService, payoutService, submissionService, reportService, broadcastService, cashflowService } from './firebaseService';
import { User, UserRole, AdminPanelProps, AdminTab, Broadcast } from '../../types';
import { ICONS } from '../../constants';

// ... existing imports

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, showToast, appState, setAppState }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [payoutSubTab, setPayoutSubTab] = useState<'payouts' | 'verifications'>('payouts');
  
  // 1. Loading ko sirf pehli baar ke liye rakhein
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [users, setUsers] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [cashflow, setCashflow] = useState({ dailyLimit: 100000, todaySpent: 0 });

  // 2. Real-time listeners hi data handle karenge (Fastest Method)
  useEffect(() => {
    // Ye listeners background mein data update karte rahenge bina loading screen dikhaye
    const unsubUsers = userService.onUsersUpdate((data) => { setUsers(data); setInitialLoading(false); });
    const unsubCampaigns = campaignService.onCampaignsUpdate(setCampaigns);
    const unsubPayouts = payoutService.onPayoutsUpdate(setPayouts);
    const unsubSubs = submissionService.onSubmissionsUpdate(setSubmissions);
    const unsubReports = reportService.onReportsUpdate(setReports);
    const unsubBroadcasts = broadcastService.onBroadcastsUpdate(setBroadcasts);
    const unsubCashflow = cashflowService.onCashflowUpdate(setCashflow);

    return () => {
      unsubUsers(); unsubCampaigns(); unsubPayouts(); 
      unsubSubs(); unsubReports(); unsubBroadcasts(); unsubCashflow();
    };
  }, []);

  if (currentUser.role !== UserRole.ADMIN) {
    return <div className="text-white p-10">ACCESS DENIED</div>;
  }

  return (
    <div className="space-y-10 pb-40 animate-slide">
      {/* Header & Tabs logic remains same */}
      <div className="px-4">
        <h2 className="text-4xl font-black italic text-white uppercase leading-none">
          ADMIN<span className="text-cyan-400">COMMAND</span>
        </h2>
      </div>

      <div className="flex gap-2 bg-white/5 p-2 rounded-3xl border border-white/10 overflow-x-auto sticky top-0 z-[95] backdrop-blur-md mx-4">
        {(['dashboard', 'members', 'campaigns', 'cashflow', 'payouts', 'reports', 'broadcasts'] as AdminTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap flex-1 px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${
              activeTab === tab ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="min-h-[60vh] px-4">
        {/* 3. Sirf first time total loading dikhayenge, switch par nahi */}
        {initialLoading ? (
          <div className="flex flex-col justify-center items-center py-20">
            <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-cyan-500 font-bold mt-4 tracking-tighter">SYNCING DATABASE...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && <AdminDashboard showToast={showToast} />}
            {activeTab === 'members' && <AdminMembers users={users} showToast={showToast} />}
            {activeTab === 'campaigns' && <AdminCampaigns campaigns={campaigns} showToast={showToast} currentUser={currentUser} />}
            {activeTab === 'cashflow' && <AdminCashflow cashflow={cashflow} showToast={showToast} />}
            {activeTab === 'payouts' && <AdminPayouts payouts={payouts} submissions={submissions} showToast={showToast} payoutSubTab={payoutSubTab} setPayoutSubTab={setPayoutSubTab} />}
            {activeTab === 'reports' && <AdminReports reports={reports} showToast={showToast} />}
            {activeTab === 'broadcasts' && <AdminBroadcasts broadcasts={broadcasts} showToast={showToast} currentUser={currentUser} />}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
