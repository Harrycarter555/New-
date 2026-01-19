import React, { useState, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import AdminMembers from './AdminMembers';
import AdminCampaigns from './AdminCampaigns';
import AdminCashflow from './AdminCashflow';
import AdminPayouts from './AdminPayouts';
import AdminReports from './AdminReports';
import AdminBroadcasts from './AdminBroadcasts';
import { userService, campaignService, payoutService, submissionService, reportService, broadcastService, cashflowService } from './firebaseService';
import { User, UserRole, AppState, AdminPanelProps, AdminTab } from '../../types'; // Fixed path and added AppState
import { ICONS } from '../../constants'; // Fixed path

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, showToast, appState, setAppState }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [payoutSubTab, setPayoutSubTab] = useState<'payouts' | 'verifications'>('payouts');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [users, setUsers] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState({ dailyLimit: 100000, todaySpent: 0 });

  // Check admin permission
  if (currentUser.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-10">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ICONS.X className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-white mb-4">ADMIN ACCESS DENIED</h2>
          <p className="text-slate-400">Elevated privileges required for this terminal</p>
        </div>
      </div>
    );
  }

  // Load data based on active tab
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        switch (activeTab) {
          case 'members':
            const usersData = await userService.getUsers();
            setUsers(usersData);
            break;
          case 'campaigns':
            const campaignsData = await campaignService.getCampaigns();
            setCampaigns(campaignsData);
            break;
          case 'payouts':
            const [payoutsData, submissionsData] = await Promise.all([
              payoutService.getPayouts(),
              submissionService.getSubmissions()
            ]);
            setPayouts(payoutsData);
            setSubmissions(submissionsData);
            break;
          case 'reports':
            const reportsData = await reportService.getReports();
            setReports(reportsData);
            break;
          case 'broadcasts':
            const broadcastsData = await broadcastService.getBroadcasts();
            setBroadcasts(broadcastsData);
            break;
          case 'cashflow':
            const cashflowData = await cashflowService.getCashflow();
            setCashflow(cashflowData);
            break;
        }
      } catch (error: any) {
        showToast(error.message || `Failed to load ${activeTab} data`, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTab, showToast]);

  // Setup real-time listeners
  useEffect(() => {
    const unsubscribeUsers = userService.onUsersUpdate(setUsers);
    const unsubscribeCampaigns = campaignService.onCampaignsUpdate(setCampaigns);
    const unsubscribePayouts = payoutService.onPayoutsUpdate(setPayouts);
    const unsubscribeSubmissions = submissionService.onSubmissionsUpdate(setSubmissions);
    const unsubscribeReports = reportService.onReportsUpdate(setReports);
    const unsubscribeBroadcasts = broadcastService.onBroadcastsUpdate(setBroadcasts);
    const unsubscribeCashflow = cashflowService.onCashflowUpdate(setCashflow);

    return () => {
      unsubscribeUsers();
      unsubscribeCampaigns();
      unsubscribePayouts();
      unsubscribeSubmissions();
      unsubscribeReports();
      unsubscribeBroadcasts();
      unsubscribeCashflow();
    };
  }, []);

  if (loading && activeTab !== 'dashboard') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 mt-4 text-sm">Loading {activeTab} data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-40 animate-slide">
      <div>
        <h2 className="text-4xl font-black italic px-2 text-white uppercase leading-none">
          ADMIN<span className="text-cyan-400">COMMAND</span>
        </h2>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 italic">
          Network Command Center
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-white/5 p-2 rounded-3xl border border-white/10 overflow-x-auto hide-scrollbar sticky top-0 z-[95] backdrop-blur-md">
        {(['dashboard', 'members', 'campaigns', 'cashflow', 'payouts', 'reports', 'broadcasts'] as AdminTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap flex-1 px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${
              activeTab === tab ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[60vh]">
        {activeTab === 'dashboard' && <AdminDashboard showToast={showToast} />}
        {activeTab === 'members' && <AdminMembers users={users} showToast={showToast} />}
        {activeTab === 'campaigns' && <AdminCampaigns campaigns={campaigns} showToast={showToast} currentUser={currentUser} />}
        {activeTab === 'cashflow' && <AdminCashflow cashflow={cashflow} showToast={showToast} />}
        {activeTab === 'payouts' && <AdminPayouts payouts={payouts} submissions={submissions} showToast={showToast} payoutSubTab={payoutSubTab} setPayoutSubTab={setPayoutSubTab} />}
        {activeTab === 'reports' && <AdminReports reports={reports} showToast={showToast} />}
        {activeTab === 'broadcasts' && <AdminBroadcasts broadcasts={broadcasts} showToast={showToast} currentUser={currentUser} />}
      </div>
    </div>
  );
};

export default AdminPanel;
