import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';

import { AppState, User, Campaign, UserRole, UserStatus } from './types';
import { auth, db } from './firebase';

// Components
import Header from './components/Header';
import AuthView from './components/AuthView';
import CampaignsPage from './components/CampaignsPage';
import MissionDetailOverlay from './components/MissionDetailOverlay';
import VerifyView from './components/VerifyView';
import WalletView from './components/WalletView';
import AdminPanel from './components/AdminPanel/index';
import ProfileOverlay from './components/overlays/ProfileOverlay';
import AccountRecovery from './components/AccountRecovery';

import { ICONS } from './constants';
import { checkFirebaseConnection, adminService } from './components/AdminPanel/firebaseService';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY as string || '');

// Define View Type
type ViewType = 'auth' | 'campaigns' | 'verify' | 'wallet' | 'admin' | 'recovery';

function App() {
  const [appState, setAppState] = useState<AppState>({
    users: [],
    campaigns: [],
    submissions: [],
    payoutRequests: [],
    broadcasts: [],
    reports: [],
    cashflow: { 
      dailyLimit: 0, 
      todaySpent: 0, 
      startDate: '', 
      endDate: '' 
    },
    logs: [],
    config: { minWithdrawal: 0 }
  });
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('auth'); 
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  
  // ✅ REAL-TIME DATA STATES
  const [userCampaigns, setUserCampaigns] = useState<Campaign[]>([]);
  const [userStats, setUserStats] = useState({
    totalActive: 0,
    totalRewardPool: 0,
    pendingBalance: 0,
    walletBalance: 0
  });
  const [userBroadcasts, setUserBroadcasts] = useState<any[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [userPayouts, setUserPayouts] = useState<any[]>([]);

  // Refs for cleanup
  const authUnsubscribeRef = useRef<(() => void) | null>(null);
  const campaignsUnsubscribeRef = useRef<(() => void) | null>(null);
  const userUnsubscribeRef = useRef<(() => void) | null>(null);
  const broadcastsUnsubscribeRef = useRef<(() => void) | null>(null);
  const submissionsUnsubscribeRef = useRef<(() => void) | null>(null);
  const payoutsUnsubscribeRef = useRef<(() => void) | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    console.log(`Toast: ${type} - ${message}`);
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ==================== FIREBASE CONNECTION CHECK ====================
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setFirebaseStatus('connecting');
        const isConnected = await checkFirebaseConnection();
        
        if (isConnected) {
          setFirebaseStatus('connected');
          console.log('✅ Firebase connected successfully');
        } else {
          setFirebaseStatus('disconnected');
          showToast('Database connection failed. Using offline mode.', 'error');
        }
      } catch (error) {
        setFirebaseStatus('disconnected');
        console.error('Firebase connection error:', error);
      }
    };

    checkConnection();
    
    // Periodic connection check
    const interval = setInterval(checkConnection, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [showToast]);

  // ... (all other listeners and logic remain unchanged) ...

  // ==================== RENDER LOGIC ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 font-bold text-lg mb-2">Loading ReelEarn Pro...</p>
          <p className="text-slate-500 text-sm">
            {firebaseStatus === 'connecting' && 'Connecting to database...'}
            {firebaseStatus === 'connected' && 'Connected ✓'}
            {firebaseStatus === 'disconnected' && 'Offline mode'}
          </p>
        </div>
      </div>
    );
  }

  if (currentView === 'recovery') {
    return <AccountRecovery setCurrentView={setCurrentView as any} showToast={showToast} />;
  }

  if (currentView === 'auth') {
    return <AuthView setCurrentUser={setCurrentUser} setCurrentView={setCurrentView as any} showToast={showToast} />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <ICONS.User className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Authentication Error</h3>
          <p className="text-gray-400 mb-6">Please log in again</p>
          <button
            onClick={() => setCurrentView('auth')}
            className="px-6 py-3 bg-cyan-600 rounded-lg text-white font-bold hover:bg-cyan-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-40 text-white bg-black antialiased font-sans">
      {/* Firebase Status Indicator */}
      {firebaseStatus === 'disconnected' && (
        <div className="fixed top-4 left-4 right-4 z-[100] bg-red-500/20 border border-red-500/30 rounded-xl p-3 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-red-400">Offline Mode</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-3 py-1 bg-red-500/30 text-white rounded-lg hover:bg-red-500/40"
          >
            Retry
          </button>
        </div>
      )}

      <Header
        user={currentUser}
        onLogout={handleLogout}
        onProfileClick={() => setIsProfileOpen(true)}
        onNotifyClick={handleNotifyClick}
        unreadCount={currentUser.role === UserRole.ADMIN ? 
          appState.reports.filter(r => r.status === 'open').length : 
          userBroadcasts.filter(b => !currentUser.readBroadcastIds?.includes(b.id)).length}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-center font-bold border backdrop-blur-sm ${
          toast.type === 'success' 
            ? 'bg-cyan-600/90 border-cyan-400 text-white' 
            : 'bg-red-600/90 border-red-400 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Main Content */}
      <main className="px-5 max-w-lg mx-auto min-h-[calc(100vh-180px)] pt-4">
        {currentView === 'campaigns' && (
          <CampaignsPage 
            userCampaigns={userCampaigns}
            userStats={userStats}
            onCampaignSelect={handleCampaignSelect}
            onNavigateToVerify={() => setCurrentView('verify')}
            onNavigateToWallet={() => setCurrentView('wallet')}
          />
        )}
        
        {currentView === 'verify' && (
          <VerifyView 
            currentUser={currentUser}
            appState={appState}
            setAppState={setAppState}
            showToast={showToast}
            genAI={genAI}
            userCampaigns={userCampaigns}
          />
        )}
        
        {currentView === 'wallet' && (
          <WalletView 
            currentUser={currentUser}
            appState={appState}
            setAppState={setAppState}
            showToast={showToast}
            userCampaigns={userCampaigns}
            userBroadcasts={userBroadcasts}
            userSubmissions={userSubmissions}
            userPayouts={userPayouts}
          />
        )}
        
        {currentView === 'admin' && currentUser.role === UserRole.ADMIN && (
          <AdminPanel
            currentUser={currentUser}
            showToast={showToast}
            appState={appState}
            setAppState={setAppState}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-4 right-4 z-50 bg-gray-900/90 backdrop-blur-xl p-4 rounded-[48px] border border-gray-800 flex justify-between items-center">
        <button 
          onClick={() => setCurrentView('campaigns')} 
          className={`flex-1 flex flex-col items-center py-2 ${currentView === 'campaigns' ? 'text-cyan-400' : 'text-gray-500'}`}
        >
          <ICONS.Home className="w-6 h-6" />
          <span className="text-xs font-bold mt-1">Campaigns</span>
        </button>
        
        <button 
          onClick={() => setCurrentView('verify')} 
          className={`flex-1 flex flex-col items-center py-2 ${currentView === 'verify' ? 'text-cyan-400' : 'text-gray-500'}`}
        >
          <div className="bg-cyan-500 p-4 rounded-2xl -mt-8 text-black">
            <ICONS.Check className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold mt-2">Verify</span>
        </button>
        
        <button 
          onClick={() => setCurrentView(currentUser.role === UserRole.ADMIN ? 'admin' : 'wallet')} 
          className={`flex-1 flex flex-col items-center py-2 ${
            currentView === (currentUser.role === UserRole.ADMIN ? 'admin' : 'wallet') ? 'text-cyan-400' : 'text-gray-500'
          }`}
        >
          {currentUser.role === UserRole.ADMIN ? (
            <ICONS.User className="w-6 h-6" />
          ) : (
            <ICONS.Wallet className="w-6 h-6" />
          )}
          <span className="text-xs font-bold mt-1">
            {currentUser.role === UserRole.ADMIN ? 'Admin' : 'Wallet'}
          </span>
        </button>
      </nav>

      {/* Overlays */}
      {selectedCampaign && (
        <MissionDetailOverlay 
          campaign={selectedCampaign} 
          onClose={() => setSelectedCampaign(null)} 
          onStartVerify={() => setCurrentView('verify')} 
        />
      )}
      
      <ProfileOverlay 
        isOpen={isProfileOpen} 
        user={currentUser} 
        onClose={() => setIsProfileOpen(false)} 
        onLogout={handleLogout}
      />

      {/* Footer Info */}
      <div className="fixed bottom-0 left-0 right-0 py-2 bg-black/50 backdrop-blur-sm border-t border-white/10 text-center">
        <p className="text-xs text-slate-600">
          ReelEarn Pro • {firebaseStatus === 'connected' ? 'Online ✓' : 'Offline ⚠'} • v2.0
        </p>
      </div>
    </div>
  );
}

export default App;
