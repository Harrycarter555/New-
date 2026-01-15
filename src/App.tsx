import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { 
  AppState, User, Campaign, UserRole, UserReport 
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
import AdminPanel from './components/AdminPanel/AdminPanel/';
import ProfileOverlay from './components/overlays/ProfileOverlay';
import UserDetailOverlay from './components/overlays/UserDetailOverlay';
import ReportingOverlay from './components/overlays/ReportingOverlay';

import { ICONS } from './constants.tsx';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY as string || '');

function App() {
  const [appState, setAppState] = useState<AppState>(INITIAL_DATA);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'auth' | 'campaigns' | 'verify' | 'wallet' | 'admin'>('auth');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Refs
  const authUnsubscribeRef = useRef<(() => void) | null>(null);

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
        // No mock toast in production
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
            
            // Ensure readBroadcastIds exists
            const safeUserData = {
              ...userData,
              readBroadcastIds: userData.readBroadcastIds || [],
            };
            
            setCurrentUser(safeUserData);
            setCurrentView(safeUserData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
            showToast(`Welcome ${safeUserData.username}!`, 'success');
          } else {
            console.log('⚠️ User doc not found, staying in auth view');
            // Don't set user, stay in auth view
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
  }, []);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    console.log(`Toast: ${type} - ${message}`);
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Logout handler
  const handleLogout = useCallback(async () => {
    try {
      await auth.signOut();
      setCurrentUser(null);
      setCurrentView('auth');
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
    // Should not happen, but as safety
    setCurrentView('auth');
    return null;
  }

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
        {currentView === 'campaigns' && (
          <CampaignList
            campaigns={appState.campaigns.filter(c => c.active)}
            onSelect={handleCampaignSelect}
          />
        )}

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
          onClick={() => setCurrentView('campaigns')}
          className={`flex-1 flex flex-col items-center py-2 transition-all ${
            currentView === 'campaigns' ? 'text-cyan-400 scale-110' : 'text-gray-500'
          }`}
        >
          <ICONS.Home className="w-6 h-6" />
          <span className="text-xs font-bold mt-1">Missions</span>
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
