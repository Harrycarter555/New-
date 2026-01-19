import { useState, useEffect, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, limit, DocumentData } from 'firebase/firestore';

import { 
  AppState, User, Campaign, UserRole, UserStatus 
} from './types.ts';
import { loadAppState } from './utils/firebaseState';
import { INITIAL_DATA } from './constants.tsx';
import { auth, db } from './firebase';
import { campaignHelper, userAuthHelper, broadcastHelper, syncManager } from './utils/firebaseHelper';

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

// Define View Type to ensure consistency across components
type ViewType = 'auth' | 'campaigns' | 'verify' | 'wallet' | 'admin' | 'recovery';

function App() {
  const [appState, setAppState] = useState<AppState>(INITIAL_DATA);
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

  // Refs for cleanup
  const authUnsubscribeRef = useRef<(() => void) | null>(null);
  const campaignsUnsubscribeRef = useRef<(() => void) | null>(null);
  const userUnsubscribeRef = useRef<(() => void) | null>(null);
  const broadcastsUnsubscribeRef = useRef<(() => void) | null>(null);
  const submissionsUnsubscribeRef = useRef<(() => void) | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    console.log(`Toast: ${type} - ${message}`);
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ==================== REAL-TIME LISTENERS ====================

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
        const campaign: Campaign = {
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

  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.id);
    
    userUnsubscribeRef.current = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const updatedUser = snapshot.data() as User;
        
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
    });

    return () => {
      if (userUnsubscribeRef.current) {
        userUnsubscribeRef.current();
      }
    };
  }, [currentUser, showToast]);

  useEffect(() => {
    if (!currentUser) return;

    const broadcastsRef = collection(db, 'broadcasts');
    const q = query(
      broadcastsRef,
      where('targetUserId', 'in', [currentUser.id, null]), 
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    broadcastsUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const broadcastsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserBroadcasts(broadcastsData);
    });

    return () => {
      if (broadcastsUnsubscribeRef.current) {
        broadcastsUnsubscribeRef.current();
      }
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const submissionsRef = collection(db, 'submissions');
    const q = query(
      submissionsRef,
      where('userId', '==', currentUser.id),
      orderBy('timestamp', 'desc')
    );

    submissionsUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const submissionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserSubmissions(submissionsData);
    });

    return () => {
      if (submissionsUnsubscribeRef.current) {
        submissionsUnsubscribeRef.current();
      }
    };
  }, [currentUser]);

  // ==================== AUTH & INITIALIZATION ====================

  useEffect(() => {
    const initApp = async () => {
      try {
        const loadedState = await loadAppState();
        if (loadedState) {
          setAppState(loadedState);
        }
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            
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
            setCurrentView(safeUserData.role === UserRole.ADMIN ? 'admin' : 'campaigns'); 
            showToast(`Welcome ${safeUserData.username}!`, 'success');
            
            setUserStats(prev => ({
              ...prev,
              pendingBalance: safeUserData.pendingBalance || 0,
              walletBalance: safeUserData.walletBalance || 0
            }));
          } else {
            showToast('User account not found. Please sign up.', 'error');
          }
        } catch (error) {
          console.error('❌ Error fetching user:', error);
          showToast('Database connection error. Please try again.', 'error');
        }
      } else {
        setCurrentUser(null);
        setCurrentView('auth');
        setUserCampaigns([]);
        setUserBroadcasts([]);
        setUserSubmissions([]);
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
      if (campaignsUnsubscribeRef.current) campaignsUnsubscribeRef.current();
      if (userUnsubscribeRef.current) userUnsubscribeRef.current();
      if (broadcastsUnsubscribeRef.current) broadcastsUnsubscribeRef.current();
      if (submissionsUnsubscribeRef.current) submissionsUnsubscribeRef.current();
      
      await signOut(auth);
      setCurrentUser(null);
      setCurrentView('auth');
      setUserCampaigns([]);
      setUserBroadcasts([]);
      setUserSubmissions([]);
      showToast('Logged out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Logout failed', 'error');
    }
  }, [showToast]);

  const handleCampaignSelect = useCallback((campaign: Campaign) => {
    setSelectedCampaign(campaign);
  }, []);

  // ==================== UI COMPONENTS ====================

  const CampaignsPage = () => (
    <div className="space-y-10 pb-20">
      <div className="mb-8">
        <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
          LIVE<br/>
          <span className="text-cyan-400">CAMPAIGNS</span>
        </h1>
        <p className="text-slate-400 text-sm mt-2">Complete missions and earn rewards</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
          <p className="text-2xl font-bold text-cyan-400">₹{userStats.pendingBalance.toLocaleString()}</p>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Wallet</p>
          <p className="text-2xl font-bold text-white">₹{userStats.walletBalance.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setCurrentView('verify')} className="p-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl text-center hover:opacity-90">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <ICONS.CheckCircle className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-white mb-1">Submit Verification</h3>
        </button>
        <button onClick={() => setCurrentView('wallet')} className="p-6 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl text-center hover:opacity-90">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <ICONS.Coins className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-bold text-white mb-1">Withdraw Funds</h3>
        </button>
      </div>

      <div className="mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">AVAILABLE MISSIONS</h2>
          <button onClick={() => setCurrentView('wallet')} className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <ICONS.Wallet className="w-4 h-4" /> Wallet
          </button>
        </div>
        {userCampaigns.length === 0 ? (
          <div className="text-center py-20 border border-slate-800 rounded-2xl bg-black/50">
            <ICONS.Campaign className="w-20 h-20 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-400">No Active Campaigns</h3>
          </div>
        ) : (
          <CampaignList campaigns={userCampaigns} onSelect={handleCampaignSelect} />
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 font-bold text-lg">Loading ReelEarn Pro...</p>
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

  if (!currentUser) return null;

  return (
    <div className="min-h-screen pb-40 text-white bg-black antialiased font-sans">
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onProfileClick={() => setIsProfileOpen(true)}
        onNotifyClick={() => setCurrentView(currentUser.role === UserRole.ADMIN ? 'admin' : 'wallet')}
        unreadCount={currentUser.role === UserRole.ADMIN ? appState.reports.filter(r => r.status === 'open').length : 0}
      />

      {toast && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl text-center font-bold border ${toast.type === 'success' ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-red-600 border-red-400 text-white'}`}>
          {toast.message}
        </div>
      )}

      <main className="px-5 max-w-lg mx-auto min-h-[calc(100vh-180px)]">
        {currentView === 'campaigns' && <CampaignsPage />}
        {currentView === 'verify' && <VerifyView currentUser={currentUser} appState={appState} setAppState={setAppState} showToast={showToast} genAI={genAI} />}
        {currentView === 'wallet' && <WalletView currentUser={currentUser} appState={appState} setAppState={setAppState} showToast={showToast} />}
        {currentView === 'admin' && currentUser.role === UserRole.ADMIN && (
          <AdminPanel
            appState={appState}
            setAppState={setAppState}
            currentUser={currentUser}
            showToast={showToast}
          />
        )}
      </main>

      <nav className="fixed bottom-6 left-4 right-4 z-50 bg-gray-900/90 backdrop-blur-xl p-4 rounded-[48px] border border-gray-800 flex justify-between items-center">
        <button onClick={() => setCurrentView('campaigns')} className={`flex-1 flex flex-col items-center py-2 ${currentView === 'campaigns' ? 'text-cyan-400' : 'text-gray-500'}`}>
          <ICONS.Home className="w-6 h-6" /><span className="text-xs font-bold mt-1">Campaigns</span>
        </button>
        <button onClick={() => setCurrentView('verify')} className={`flex-1 flex flex-col items-center py-2 ${currentView === 'verify' ? 'text-cyan-400' : 'text-gray-500'}`}>
          <div className="bg-cyan-500 p-4 rounded-2xl -mt-8 text-black"><ICONS.Check className="w-6 h-6" /></div>
          <span className="text-xs font-bold mt-2">Verify</span>
        </button>
        <button onClick={() => setCurrentView(currentUser.role === UserRole.ADMIN ? 'admin' : 'wallet')} className={`flex-1 flex flex-col items-center py-2 ${currentView === (currentUser.role === UserRole.ADMIN ? 'admin' : 'wallet') ? 'text-cyan-400' : 'text-gray-500'}`}>
          {currentUser.role === UserRole.ADMIN ? <ICONS.User className="w-6 h-6" /> : <ICONS.Wallet className="w-6 h-6" />}
          <span className="text-xs font-bold mt-1">{currentUser.role === UserRole.ADMIN ? 'Admin' : 'Wallet'}</span>
        </button>
      </nav>

      {selectedCampaign && <MissionDetailOverlay campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} onStartVerify={() => setCurrentView('verify')} />}
      <ProfileOverlay isOpen={isProfileOpen} user={currentUser} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}

export default App;
