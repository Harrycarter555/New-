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

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [payoutSubTab, setPayoutSubTab] = useState<'payouts' | 'verifications'>('payouts');
  
  // ✅ Single Initial Loading state
  const [isInitialSync, setIsInitialSync] = useState(true);
  
  const [users, setUsers] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [cashflow, setCashflow] = useState({ dailyLimit: 100000, todaySpent: 0 });

  // ✅ Optimized Real-time Sync
  useEffect(() => {
    const unsubUsers = userService.onUsersUpdate((data) => { setUsers(data); setIsInitialSync(false); });
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

  if (currentUser.role !== UserRole.ADMIN) return <div className="p-10 text-white font-black text-center">ACCESS DENIED</div>;

  return (
    <div className="space-y-10 pb-40">
      <div className="px-4">
        <h2 className="text-4xl font-black italic text-white uppercase leading-none">ADMIN<span className="text-cyan-400">COMMAND</span></h2>
      </div>

      {/* Navigation */}
      <div className="flex gap-2 bg-white/5 p-2 rounded-3xl border border-white/10 overflow-x-auto sticky top-0 z-[95] backdrop-blur-md mx-4 hide-scrollbar">
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
        {isInitialSync ? (
          <div className="flex flex-col items-center justify-center py-20 text-cyan-500 animate-pulse">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-black text-xs tracking-widest uppercase">Syncing Database...</p>
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
