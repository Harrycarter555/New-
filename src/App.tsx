import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

import { 
  AppState, User, Campaign, UserRole, UserStatus 
} from './types.ts';

import { loadAppState, saveAppState } from './utils/firebaseState';
import { INITIAL_DATA } from './constants.tsx';
import { auth, db } from './firebase';

import Header from './components/Header';
import AuthView from './components/AuthView';
import CampaignList from './components/CampaignList';
import MissionDetailOverlay from './components/MissionDetailOverlay';
import VerifyView from './components/VerifyView';
import WalletView from './components/WalletView';
import AdminPanel from './components/AdminPanel/index';
import ProfileOverlay from './components/overlays/ProfileOverlay';
import AccountRecovery from './components/AccountRecovery';

import { ICONS } from './constants.tsx';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY as string || '');

function App() {
  const [appState, setAppState] = useState<AppState>(INITIAL_DATA);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'auth' | 'home' | 'verify' | 'wallet' | 'admin' | 'recovery'>('auth');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userCampaigns, setUserCampaigns] = useState<Campaign[]>([]);
  const [userStats, setUserStats] = useState({
    totalActive: 0,
    totalRewardPool: 0,
    unreadMessages: 0,
    pendingSubmissions: 0
  });

  // Refs for cleanup
  const authUnsubscribeRef = useRef<(() => void) | null>(null);
  const campaignsUnsubscribeRef = useRef<(() => void) | null>(null);
  const userUnsubscribeRef = useRef<(() => void) | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    console.log(`Toast: ${type} - ${message}`);
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ==================== REAL-TIME LISTENERS ====================

  // Setup real-time campaigns listener
  useEffect(() => {
    if (!currentUser || currentUser.role === UserRole.ADMIN) return;

    const campaignsRef = collection(db, 'campaigns');
    const q = query(
      campaignsRef, 
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );

    campaignsUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const campaignsData: Campaign[] = [];
      let totalRewardPool = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const campaign = {
          id: doc.id,
          title: data.title || '',
          videoUrl: data.videoUrl || '',
          thumbnailUrl: data.thumbnailUrl || '',
          caption: data.caption || '',
          hashtags: data.hashtags || '',
          audioName: data.audioName || '',
          goalViews: data.goalViews || 0,
          goalLikes: data.goalLikes || 0,
          basicPay: data.basicPay || 0,
          viralPay: data.viralPay || 0,
          active: data.active || false,
          bioLink: data.bioLink || '',
          createdAt: data.createdAt || Date.now()
        };
        
        campaignsData.push(campaign);
        totalRewardPool += campaign.basicPay + campaign.viralPay;
      });

      setUserCampaigns(campaignsData);
      setUserStats(prev => ({
        ...prev,
        totalActive: campaignsData.length,
        totalRewardPool
      }));
    });

    return () => {
      if (campaignsUnsubscribeRef.current) {
        campaignsUnsubscribeRef.current();
      }
    };
  }, [currentUser]);

  // Setup real-time user status listener
  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.id);
    
    userUnsubscribeRef.current = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const updatedUser = snapshot.data() as User;
        
        // Check if user got suspended
        if (updatedUser.status === UserStatus.SUSPENDED || updatedUser.status === UserStatus.BANNED) {
          showToast('Your account has been suspended. Please contact admin.', 'error');
          setTimeout(() => {
            handleLogout();
          }, 3000);
        }
        
        // Update current user data
        setCurrentUser(updatedUser);
      }
    });

    return () => {
      if (userUnsubscribeRef.current) {
        userUnsubscribeRef.current();
      }
    };
  }, [currentUser]);

  // ==================== AUTH & INITIALIZATION ====================

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('🚀 Initializing ReelEarn Pro...');
        const loadedState = await loadAppState();
        if (loadedState) {
          setAppState(loadedState);
          console.log('✅ App state loaded');
        }
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // Firebase auth state listener
  useEffect(() => {
    console.log('🔐 Setting up Firebase auth listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Firebase auth state changed:', firebaseUser?.email);
      
      if (firebaseUser) {
        try {
          console.log('📥 Fetching user data from Firestore...');
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            console.log('✅ User found:', userData.username);
            
            // Check if user is not suspended
            if (userData.status === UserStatus.SUSPENDED || userData.status === UserStatus.BANNED) {
              showToast('Your account is suspended. Please contact admin.', 'error');
              await signOut(auth);
              setCurrentView('auth');
              return;
            }
            
            // Ensure readBroadcastIds exists
            const safeUserData = {
              ...userData,
              readBroadcastIds: userData.readBroadcastIds || [],
            };
            
            setCurrentUser(safeUserData);
            setCurrentView(safeUserData.role === UserRole.ADMIN ? 'admin' : 'home');
            showToast(`Welcome ${safeUserData.username}!`, 'success');
          } else {
            console.log('⚠️ User doc not found, staying in auth view');
            showToast('User account not found. Please sign up.', 'error');
          }
        } catch (error) {
          console.error('❌ Error fetching user:', error);
          showToast('Database connection error. Please try again.', 'error');
        }
      } else {
        console.log('👤 No user logged in');
        setCurrentUser(null);
        setCurrentView('auth');
      }
    });

    authUnsubscribeRef.current = unsubscribe;
    return () => {
      if (authUnsubscribeRef.current) {
        authUnsubscribeRef.current();
      }
    };
  }, [showToast]);

  // Logout handler
  const handleLogout = useCallback(async () => {
    try {
      // Cleanup listeners
      if (campaignsUnsubscribeRef.current) campaignsUnsubscribeRef.current();
      if (userUnsubscribeRef.current) userUnsubscribeRef.current();
      
      await signOut(auth);
      setCurrentUser(null);
      setCurrentView('auth');
      setUserCampaigns([]);
      showToast('Logged out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Logout failed', 'error');
    }
  }, [showToast]);

  // Campaign selection handler
  const handleCampaignSelect = useCallback((campaign: Campaign) => {
    console.log('Campaign selected:', campaign.title);
    setSelectedCampaign(campaign);
  }, []);

  // ==================== UI RENDERING ====================

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 font-bold text-lg">Loading ReelEarn Pro...</p>
          <p className="text-slate-500 text-sm mt-2">Connecting to services</p>
        </div>
      </div>
    );
  }

  // Recovery view
  if (currentView === 'recovery') {
    return (
      <AccountRecovery
        setCurrentView={setCurrentView}
        showToast={showToast}
      />
    );
  }

  // Auth view
  if (currentView === 'auth') {
    return (
      <AuthView
        setCurrentUser={setCurrentUser}
        setCurrentView={setCurrentView}
        showToast={showToast}
      />
    );
  }

  // Main app view (when user is logged in)
  if (!currentUser) {
    setCurrentView('auth');
    return null;
  }

  // ==================== USER DASHBOARD COMPONENT ====================
  const UserDashboard = () => (
    <div className="space-y-10 pb-20">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
          WELCOME<br/>
          <span className="text-cyan-400">@{currentUser.username}</span>
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          Complete missions and earn rewards
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Active Missions</p>
          <p className="text-2xl font-bold text-white">{userStats.totalActive}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Reward Pool</p>
          <p className="text-2xl font-bold text-green-400">₹{userStats.totalRewardPool.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Pending</p>
          <p className="text-2xl font-bold text-cyan-400">₹{currentUser.pendingBalance.toLocaleString()}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setCurrentView('verify')}
          className="p-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl text-center hover:opacity-90 transition-opacity"
        >
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <ICONS.CheckCircle className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-white mb-1">Submit Verification</h3>
          <p className="text-xs text-white/70">Submit your completed missions</p>
        </button>
        
        <button
          onClick={() => setCurrentView('wallet')}
          className="p-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-center hover:opacity-90 transition-opacity"
        >
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <ICONS.Coins className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-white mb-1">Withdraw Funds</h3>
          <p className="text-xs text-white/70">Request payout to your account</p>
        </button>
      </div>

      {/* Campaigns List */}
      <div className="mt-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">
            LIVE MISSIONS
          </h2>
          <button
            onClick={() => setCurrentView('wallet')}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-xl hover:bg-cyan-500/20 transition-colors"
          >
            <ICONS.Wallet className="w-4 h-4" />
            Wallet
          </button>
        </div>

        {userCampaigns.length === 0 ? (
          <div className="text-center py-20 border border-slate-800 rounded-2xl bg-black/50">
            <ICONS.Campaign className="w-20 h-20 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-400 mb-2">No Active Missions</h3>
            <p className="text-slate-600 text-sm">
              Check back later for new missions
            </p>
          </div>
        ) : (
          <CampaignList 
            campaigns={userCampaigns}
            onSelect={handleCampaignSelect}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-40 text-white bg-black antialiased font-sans">
      {/* Header */}
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onProfileClick={() => setIsProfileOpen(true)}
        onNotifyClick={() => {
          if (currentUser.role === UserRole.ADMIN) {
            setCurrentView('admin');
          } else {
            setCurrentView('wallet');
          }
        }}
        unreadCount={
          currentUser.role === UserRole.ADMIN
            ? appState.reports.filter(r => r.status === 'open').length
            : appState.broadcasts.filter(m => {
                const readIds = currentUser.readBroadcastIds || [];
                const isTargeted = !m.targetUserId || m.targetUserId === currentUser.id;
                const isUnread = !readIds.includes(m.id);
                return isTargeted && isUnread;
              }).length
        }
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-center font-bold border ${
            toast.type === 'success' 
              ? 'bg-cyan-600 border-cyan-400 text-white' 
              : 'bg-red-600 border-red-400 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Main Content */}
      <main className="px-5 max-w-lg mx-auto min-h-[calc(100vh-180px)]">
        {currentView === 'home' && <UserDashboard />}

        {currentView === 'verify' && (
          <VerifyView
            currentUser={currentUser}
            appState={appState}
            setAppState={setAppState}
            showToast={showToast}
            genAI={genAI}
          />
        )}

        {currentView === 'wallet' && (
          <WalletView
            currentUser={currentUser}
            appState={appState}
            setAppState={setAppState}
            showToast={showToast}
          />
        )}

        {currentView === 'admin' && currentUser.role === UserRole.ADMIN && (
          <AdminPanel
            appState={appState}
            setAppState={setAppState}
            currentUser={currentUser}
            showToast={showToast}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-4 right-4 z-50 bg-gray-900/90 backdrop-blur-xl p-4 rounded-[48px] border border-gray-800 flex justify-between items-center">
        <button
          onClick={() => setCurrentView('home')}
          className={`flex-1 flex flex-col items-center py-2 transition-all ${
            currentView === 'home' ? 'text-cyan-400 scale-110' : 'text-gray-500'
          }`}
        >
          <ICONS.Home className="w-6 h-6" />
          <span className="text-xs font-bold mt-1">Home</span>
        </button>

        <button
          onClick={() => setCurrentView('verify')}
          className={`flex-1 flex flex-col items-center py-2 transition-all ${
            currentView === 'verify' ? 'text-cyan-400 scale-110' : 'text-gray-500'
          }`}
        >
          <div className="bg-cyan-500 p-4 rounded-2xl -mt-8 text-black">
            <ICONS.Check className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold mt-2">Verify</span>
        </button>

        <button
          onClick={() => setCurrentView(currentUser.role === UserRole.ADMIN ? 'admin' : 'wallet')}
          className={`flex-1 flex flex-col items-center py-2 transition-all ${
            currentView === (currentUser.role === UserRole.ADMIN ? 'admin' : 'wallet') 
              ? 'text-cyan-400 scale-110' 
              : 'text-gray-500'
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
      />

      {/* Firebase fallback warning (hidden but in DOM) */}
      <div className="hidden" id="firebase-warning">
        Firebase connection required for full functionality
      </div>
    </div>
  );
}

export default App;
