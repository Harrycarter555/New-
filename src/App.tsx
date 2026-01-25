import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { 
  AppState, User, Campaign, UserRole, UserStatus 
} from './types.ts';
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

import { ICONS } from './constants.tsx';

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

  // ==================== REAL-TIME LISTENERS ====================

  // User Data Listener
  useEffect(() => {
    if (!currentUser) return;

    // This is a simplified version - in real app you'd use onSnapshot
    const updateUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.id));
        if (userDoc.exists()) {
          const updatedUser = userDoc.data() as User;
          
          // Check account status
          if (updatedUser.status === UserStatus.SUSPENDED || updatedUser.status === UserStatus.BANNED) {
            showToast('Your account has been suspended. Please contact admin.', 'error');
            setTimeout(() => {
              handleLogout();
            }, 3000);
            return;
          }
          
          setCurrentUser(updatedUser);
          setUserStats(prev => ({
            ...prev,
            pendingBalance: updatedUser.pendingBalance || 0,
            walletBalance: updatedUser.walletBalance || 0
          }));
        }
      } catch (error) {
        console.error('Error updating user data:', error);
      }
    };

    // Check every 30 seconds for updates
    const interval = setInterval(updateUserData, 30000);
    return () => clearInterval(interval);
  }, [currentUser, showToast]);

  // ==================== AUTH & INITIALIZATION ====================

  useEffect(() => {
    // Initial loading complete
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          console.log('🔄 Loading user data...');
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            
            // Check account status
            if (userData.status === UserStatus.SUSPENDED || userData.status === UserStatus.BANNED) {
              showToast('Your account is suspended. Please contact admin.', 'error');
              await signOut(auth);
              setCurrentView('auth');
              return;
            }
            
            const safeUserData = {
              ...userData,
              readBroadcastIds: userData.readBroadcastIds || [],
            };
            
            setCurrentUser(safeUserData);
            
            // Set initial view based on role
            if (safeUserData.role === UserRole.ADMIN) {
              setCurrentView('admin');
            } else {
              setCurrentView('campaigns');
            }
            
            showToast(`Welcome back, ${safeUserData.username}!`, 'success');
            
            // Update user stats
            setUserStats(prev => ({
              ...prev,
              pendingBalance: safeUserData.pendingBalance || 0,
              walletBalance: safeUserData.walletBalance || 0
            }));
          } else {
            showToast('User account not found. Please sign up.', 'error');
            await signOut(auth);
          }
        } catch (error) {
          console.error('❌ Error fetching user:', error);
          showToast('Database connection error. Please try again.', 'error');
        }
      } else {
        // No user logged in
        setCurrentUser(null);
        setCurrentView('auth');
        setUserCampaigns([]);
        setUserBroadcasts([]);
        setUserSubmissions([]);
        setUserPayouts([]);
      }
    });

    authUnsubscribeRef.current = unsubscribe;
    return () => {
      if (authUnsubscribeRef.current) {
        authUnsubscribeRef.current();
      }
    };
  }, [showToast]);

  const handleLogout = useCallback(async () => {
    try {
      // Cleanup all listeners
      if (campaignsUnsubscribeRef.current) campaignsUnsubscribeRef.current();
      if (userUnsubscribeRef.current) userUnsubscribeRef.current();
      if (broadcastsUnsubscribeRef.current) broadcastsUnsubscribeRef.current();
      if (submissionsUnsubscribeRef.current) submissionsUnsubscribeRef.current();
      if (payoutsUnsubscribeRef.current) payoutsUnsubscribeRef.current();
      
      await signOut(auth);
      setCurrentUser(null);
      setCurrentView('auth');
      setUserCampaigns([]);
      setUserBroadcasts([]);
      setUserSubmissions([]);
      setUserPayouts([]);
      showToast('Logged out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Logout failed', 'error');
    }
  }, [showToast]);

  const handleCampaignSelect = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
  }, []);

  const handleNotifyClick = useCallback(() => {
    if (currentUser?.role === UserRole.ADMIN) {
      setCurrentView('admin');
    } else {
      setCurrentView('wallet');
    }
  }, [currentUser]);

  // ==================== RENDER LOGIC ====================

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 font-bold text-lg mb-2">Loading ReelEarn Pro...</p>
          <p className="text-slate-500 text-sm">
            Connecting to server...
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
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onProfileClick={() => setIsProfileOpen(true)}
        onNotifyClick={handleNotifyClick}
        unreadCount={currentUser.role === UserRole.ADMIN ? 
          appState.reports.filter(r => r.status === 'open').length : 
          0} // Simplified
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
          ReelEarn Pro • Online • v2.0
        </p>
      </div>
    </div>
  );
}

export default App;
