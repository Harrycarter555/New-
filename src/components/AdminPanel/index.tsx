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

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, showToast, appState, setAppState }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [payoutSubTab, setPayoutSubTab] = useState<'payouts' | 'verifications'>('payouts');
  const [loading, setLoading] = useState(true);
  
  const [users, setUsers] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [cashflow, setCashflow] = useState({ dailyLimit: 100000, todaySpent: 0 });

  if (currentUser.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center p-10">
          <ICONS.X className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white">ACCESS DENIED</h2>
        </div>
      </div>
    );
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        switch (activeTab) {
          case 'members': setUsers(await userService.getUsers()); break;
          case 'campaigns': setCampaigns(await campaignService.getCampaigns()); break;
          case 'payouts':
            const [p, s] = await Promise.all([payoutService.getPayouts(), submissionService.getSubmissions()]);
            setPayouts(p); setSubmissions(s);
            break;
          case 'reports': setReports(await reportService.getReports()); break;
          case 'broadcasts': setBroadcasts(await broadcastService.getBroadcasts()); break;
          case 'cashflow': setCashflow(await cashflowService.getCashflow()); break;
        }
      } catch (error: any) {
        showToast(error.message || 'Load failed', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab, showToast]);

  useEffect(() => {
    const unsubUsers = userService.onUsersUpdate(setUsers);
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

  return (
    <div className="space-y-10 pb-40 animate-slide">
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
              activeTab === tab ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="min-h-[60vh] px-4">
        {loading && activeTab !== 'dashboard' ? (
          <div className="flex justify-center py-20 animate-pulse text-cyan-500 font-bold">LOADING...</div>
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
