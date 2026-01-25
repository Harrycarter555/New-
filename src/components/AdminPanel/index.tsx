import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, AdminTab, Broadcast } from '../../types';
import { ICONS } from '../../constants';
import { adminService, checkFirebaseConnection, cashflowService, broadcastService } from './firebaseService';

// Import Admin Components
import AdminDashboard from './AdminDashboard';
import AdminMembers from './AdminMembers';
import AdminCampaigns from './AdminCampaigns';
import AdminCashflow from './AdminCashflow';
import AdminPayouts from './AdminPayouts';
import AdminReports from './AdminReports';
import AdminBroadcasts from './AdminBroadcasts';

// Firebase imports for real-time listeners
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

interface AdminPanelProps {
  currentUser: User;
  showToast: (message: string, type: 'success' | 'error') => void;
  appState?: any;
  setAppState?: any;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [payoutSubTab, setPayoutSubTab] = useState<'payouts' | 'verifications'>('payouts');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState({
    users: [] as User[],
    campaigns: [] as any[],
    payouts: [] as any[],
    submissions: [] as any[],
    reports: [] as any[],
    broadcasts: [] as Broadcast[],
    cashflow: { dailyLimit: 100000, todaySpent: 0, startDate: '', endDate: '' }
  });

  // ✅ Load admin data
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('📥 Loading admin data...');
      
      const [adminData, cashflowData] = await Promise.all([
        adminService.getAdminDashboardData(),
        cashflowService.getCashflowData()
      ]);

      setData(prev => ({
        ...prev,
        ...adminData,
        cashflow: cashflowData
      }));
      
      showToast('Admin dashboard loaded successfully', 'success');
    } catch (error: any) {
      console.error('Error loading admin data:', error);
      showToast('Failed to load admin data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitialData();
    
    // Check connection
    checkFirebaseConnection().then(isConnected => {
      if (!isConnected) {
        showToast('Connected to Firebase', 'success');
      }
    });
  }, [loadInitialData, showToast]);

  // ✅ Setup real-time listeners
  useEffect(() => {
    console.log('🔔 Setting up real-time listeners...');
    
    const cleanup = adminService.onAdminDataUpdate({
      onUsers: (users) => {
        console.log('📊 Users updated:', users.length);
        setData(prev => ({ ...prev, users }));
      },
      onCampaigns: (campaigns) => {
        console.log('📊 Campaigns updated:', campaigns.length);
        setData(prev => ({ ...prev, campaigns }));
      },
      onPayouts: (payouts) => {
        console.log('📊 Payouts updated:', payouts.length);
        setData(prev => ({ ...prev, payouts }));
      },
      onSubmissions: (submissions) => {
        console.log('📊 Submissions updated:', submissions.length);
        setData(prev => ({ ...prev, submissions }));
      },
      onReports: (reports) => {
        console.log('📊 Reports updated:', reports.length);
        setData(prev => ({ ...prev, reports }));
      },
      onBroadcasts: (broadcasts) => {
        console.log('📊 Broadcasts updated:', broadcasts.length);
        setData(prev => ({ ...prev, broadcasts }));
      }
    });

    return cleanup;
  }, []);

  // ✅ Cashflow real-time listener
  useEffect(() => {
    console.log('💰 Setting up cashflow listener...');
    
    const cashflowRef = doc(db, 'cashflow', 'daily-cashflow');
    const unsubscribe = onSnapshot(
      cashflowRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const cashflowData = snapshot.data();
          console.log('💰 Cashflow updated:', cashflowData);
          setData(prev => ({
            ...prev,
            cashflow: {
              dailyLimit: cashflowData.dailyLimit || 100000,
              todaySpent: cashflowData.todaySpent || 0,
              startDate: cashflowData.startDate || '',
              endDate: cashflowData.endDate || ''
            }
          }));
        }
      },
      (error) => {
        console.error('Cashflow listener error:', error);
      }
    );

    return unsubscribe;
  }, []);

  // ✅ Refresh data function
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    showToast('Refreshing data...', 'success');
    await loadInitialData();
  }, [loadInitialData, showToast]);

  if (currentUser.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ICONS.ShieldOff className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">ACCESS DENIED</h3>
          <p className="text-gray-400">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-40 animate-slide">
      {/* Admin Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black italic text-white uppercase leading-none">
              ADMIN<span className="text-cyan-400">COMMAND</span>
            </h2>
            
            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              ONLINE
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <ICONS.Refresh className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <div className="text-right">
              <p className="text-xs text-slate-400">Logged in as</p>
              <p className="text-sm font-bold text-white">@{currentUser.username}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-6">
        <div className="flex gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 overflow-x-auto hide-scrollbar">
          {([
            { key: 'dashboard', label: 'Dashboard', icon: ICONS.Home },
            { key: 'members', label: 'Members', icon: ICONS.Users },
            { key: 'campaigns', label: 'Campaigns', icon: ICONS.Campaign },
            { key: 'cashflow', label: 'Cashflow', icon: ICONS.Dollar },
            { key: 'payouts', label: 'Payouts', icon: ICONS.Wallet },
            { key: 'reports', label: 'Reports', icon: ICONS.AlertCircle },
            { key: 'broadcasts', label: 'Broadcasts', icon: ICONS.Bell }
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as AdminTab)}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${
                activeTab === key 
                  ? 'bg-cyan-500 text-black shadow-lg' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="px-6 min-h-[60vh]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-cyan-400 font-bold text-lg mb-2">
              Loading Admin Panel...
            </p>
            <p className="text-slate-500 text-sm">
              Fetching data from database...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <AdminDashboard 
                showToast={showToast}
                data={data}
                onRefresh={handleRefresh}
              />
            )}
            
            {activeTab === 'members' && (
              <AdminMembers 
                users={data.users} 
                showToast={showToast}
              />
            )}
            
            {activeTab === 'campaigns' && (
              <AdminCampaigns 
                campaigns={data.campaigns} 
                showToast={showToast}
                currentUser={currentUser}
              />
            )}
            
            {activeTab === 'cashflow' && (
              <AdminCashflow 
                cashflow={data.cashflow} 
                showToast={showToast}
              />
            )}
            
            {activeTab === 'payouts' && (
              <AdminPayouts 
                payouts={data.payouts} 
                submissions={data.submissions} 
                showToast={showToast}
                payoutSubTab={payoutSubTab}
                setPayoutSubTab={setPayoutSubTab}
              />
            )}
            
            {activeTab === 'reports' && (
              <AdminReports 
                reports={data.reports} 
                showToast={showToast}
              />
            )}
            
            {activeTab === 'broadcasts' && (
              <AdminBroadcasts 
                broadcasts={data.broadcasts} 
                showToast={showToast}
                currentUser={currentUser}
              />
            )}
          </>
        )}
      </div>

      {/* Admin Footer */}
      <div className="px-6 pt-6 border-t border-white/10">
        <div className="text-center text-xs text-slate-600">
          <p>© {new Date().getFullYear()} ReelEarn Admin Panel • v2.0.0</p>
          <p className="mt-1">
            Total Users: {data.users.length} • 
            Active Campaigns: {data.campaigns.filter((c: any) => c.active).length} • 
            Connection: Online
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
