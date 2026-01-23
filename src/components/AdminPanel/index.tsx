import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, AdminTab, Broadcast } from '../../types';
import { ICONS } from '../../constants';
import { adminService, checkFirebaseConnection, cashflowService, broadcastService, initializationService } from './firebaseService';

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
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, showToast }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [payoutSubTab, setPayoutSubTab] = useState<'payouts' | 'verifications'>('payouts');
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking' | 'offline'>('checking');
  const [data, setData] = useState({
    users: [] as User[],
    campaigns: [] as any[],
    payouts: [] as any[],
    submissions: [] as any[],
    reports: [] as any[],
    broadcasts: [] as Broadcast[],
    cashflow: { dailyLimit: 100000, todaySpent: 0, startDate: '', endDate: '' }
  });

  // ✅ FIXED: Check Firebase connection and initialize on mount
  useEffect(() => {
    const initializeAdmin = async () => {
      try {
        console.log('🔄 Initializing Admin Panel...');
        setConnectionStatus('checking');
        
        // First initialize collections
        try {
          const initResult = await initializationService.initializeCollections();
          console.log('Collections initialized:', initResult);
        } catch (initError) {
          console.log('Collections initialization warning:', initError);
        }
        
        // Then check connection
        const isConnected = await checkFirebaseConnection();
        console.log('Firebase connection:', isConnected);
        
        if (isConnected) {
          setConnectionStatus('connected');
          loadInitialData();
        } else {
          setConnectionStatus('offline');
          showToast('Working in offline mode. Data may be cached.', 'warning');
          
          // Try to load cached data anyway
          try {
            await loadInitialData();
          } catch (error) {
            console.error('Failed to load cached data:', error);
            showToast('Failed to load data. Please check your internet connection.', 'error');
          } finally {
            setIsLoading(false);
          }
        }
      } catch (error: any) {
        console.error('Admin initialization failed:', error);
        setConnectionStatus('disconnected');
        showToast('Failed to initialize admin panel: ' + error.message, 'error');
        setIsLoading(false);
      }
    };

    initializeAdmin();
    
    // Check online/offline status
    const handleOnline = () => {
      console.log('✅ Online status detected');
      setConnectionStatus('connected');
      loadInitialData();
    };
    
    const handleOffline = () => {
      console.log('⚠️ Offline status detected');
      setConnectionStatus('offline');
      showToast('You are offline. Some features may be limited.', 'warning');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ✅ FIXED: Load initial data with better error handling
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('📥 Loading admin data...');
      
      // Load data in parallel with timeout
      const loadData = async () => {
        try {
          const [adminData, cashflowData] = await Promise.all([
            adminService.getAdminDashboardData(),
            cashflowService.getCashflowData()
          ]);

          console.log('✅ Data loaded:', {
            users: adminData.users?.length || 0,
            campaigns: adminData.campaigns?.length || 0,
            submissions: adminData.submissions?.length || 0,
            payouts: adminData.payouts?.length || 0,
            reports: adminData.reports?.length || 0,
            broadcasts: adminData.broadcasts?.length || 0
          });

          return { adminData, cashflowData };
        } catch (error) {
          console.error('Data loading error:', error);
          throw error;
        }
      };

      const { adminData, cashflowData } = await loadData();
      
      setData(prev => ({
        ...prev,
        ...adminData,
        cashflow: cashflowData
      }));
      
      showToast('Admin dashboard loaded successfully', 'success');
    } catch (error: any) {
      console.error('Error loading admin data:', error);
      showToast('Failed to load data: ' + (error.message || 'Unknown error'), 'error');
      
      // Set fallback empty data but don't break the UI
      setData(prev => ({
        ...prev,
        users: [],
        campaigns: [],
        payouts: [],
        submissions: [],
        reports: [],
        broadcasts: []
      }));
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // ✅ FIXED: Setup real-time listeners with better error handling
  useEffect(() => {
    if (connectionStatus !== 'connected') {
      console.log('Skipping real-time listeners, connection status:', connectionStatus);
      return;
    }

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
  }, [connectionStatus]);

  // ✅ FIXED: Cashflow real-time listener with error handling
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

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
  }, [connectionStatus]);

  // ✅ FIXED: Refresh data function
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    showToast('Refreshing data...', 'success');
    await loadInitialData();
  }, [loadInitialData, showToast]);

  // ✅ FIXED: Render loading states based on connection
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
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400' 
                : connectionStatus === 'checking' 
                ? 'bg-amber-500/20 text-amber-400' 
                : connectionStatus === 'offline'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'checking' ? 'bg-amber-500' : 
                connectionStatus === 'offline' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              {connectionStatus.toUpperCase()}
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
              disabled={connectionStatus === 'disconnected'}
              className={`flex items-center gap-2 whitespace-nowrap px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${
                activeTab === key 
                  ? 'bg-cyan-500 text-black shadow-lg' 
                  : connectionStatus === 'disconnected'
                  ? 'text-slate-700 cursor-not-allowed'
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
              {connectionStatus === 'checking' ? 'Checking connection...' : 'Loading Admin Panel...'}
            </p>
            <p className="text-slate-500 text-sm">
              {connectionStatus === 'checking' 
                ? 'Verifying Firebase connection' 
                : 'Fetching data from database'}
            </p>
          </div>
        ) : connectionStatus === 'disconnected' ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ICONS.WifiOff className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Database Disconnected</h3>
            <p className="text-gray-400 mb-6">Unable to connect to Firebase. Please check your configuration.</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-3 bg-cyan-600 rounded-lg text-white font-bold hover:bg-cyan-700 mr-3"
            >
              Retry Connection
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gray-700 rounded-lg text-white font-bold hover:bg-gray-600"
            >
              Reload Page
            </button>
          </div>
        ) : connectionStatus === 'offline' ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <ICONS.WifiOff className="w-10 h-10 text-yellow-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Working Offline</h3>
            <p className="text-gray-400 mb-6">You are currently offline. Some features may be limited.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white/5 p-4 rounded-xl">
                <p className="text-sm text-slate-400">Users</p>
                <p className="text-2xl font-bold text-white">{data.users.length}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl">
                <p className="text-sm text-slate-400">Campaigns</p>
                <p className="text-2xl font-bold text-white">{data.campaigns.length}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-xl">
                <p className="text-sm text-slate-400">Balance</p>
                <p className="text-2xl font-bold text-white">
                  ₹{data.users.reduce((sum, user) => sum + (user.walletBalance || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              className="px-6 py-3 bg-cyan-600 rounded-lg text-white font-bold hover:bg-cyan-700"
            >
              Try Reload Data
            </button>
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
            Active Campaigns: {data.campaigns.filter(c => c.active).length} • 
            Connection: {connectionStatus}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
