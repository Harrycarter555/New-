import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, AdminTab, Broadcast } from '../../types';
import { ICONS } from '../../constants';
import { adminService, checkFirebaseConnection, cashflowService } from './firebaseService';

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
          
          // ✅ SAFE PARSING
          const dailyLimit = parseFloat(cashflowData.dailyLimit) || 
                           parseFloat(cashflowData.daily_limit) || 100000;
          const todaySpent = parseFloat(cashflowData.todaySpent) || 
                           parseFloat(cashflowData.today_spent) || 0;
          
          setData(prev => ({
            ...prev,
            cashflow: {
              dailyLimit: Number.isNaN(dailyLimit) ? 100000 : dailyLimit,
              todaySpent: Number.isNaN(todaySpent) ? 0 : todaySpent,
              startDate: cashflowData.startDate || cashflowData.start_date || '',
              endDate: cashflowData.endDate || cashflowData.end_date || ''
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white pb-20">
      {/* Admin Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center">
                <ICONS.Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black italic text-white uppercase leading-none">
                  ADMIN<span className="text-cyan-400">COMMAND</span>
                </h2>
                <p className="text-xs text-slate-400">Control Panel v2.0</p>
              </div>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              ONLINE
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Admin Info */}
            <div className="text-right">
              <p className="text-xs text-slate-400">Logged in as</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center">
                  <ICONS.User className="w-4 h-4 text-cyan-400" />
                </div>
                <p className="text-sm font-bold text-white">@{currentUser.username}</p>
              </div>
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <ICONS.Refresh className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Navigation Tabs */}
        <div className="mb-8">
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
                className={`flex items-center gap-2 whitespace-nowrap px-6 py-3 rounded-xl text-sm font-bold uppercase transition-all ${
                  activeTab === key 
                    ? 'bg-cyan-500 text-black shadow-lg' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-[60vh]">
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
              
              {/* ✅ FIXED: AdminCashflow props - removed cashflow prop */}
              {activeTab === 'cashflow' && (
                <AdminCashflow 
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
              
              {/* ✅ FIXED: AdminBroadcasts props - removed extra props */}
              {activeTab === 'broadcasts' && (
                <AdminBroadcasts 
                  showToast={showToast}
                  currentUser={currentUser}
                  users={data.users}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Admin Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center">
            <div className="text-xs text-slate-600">
              <p>© {new Date().getFullYear()} ReelEarn Admin Panel • v2.0.0</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span>Total Users: {data.users.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                <span>Active Campaigns: {data.campaigns.filter((c: any) => c.active).length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                <span>Pending Payouts: {data.payouts.filter((p: any) => p.status === 'pending').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
