// src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onAuthStateChanged } from 'firebase/auth';

import { 
  AppState, User, Campaign, UserRole, UserReport 
} from './types.ts';

import { loadAppState, saveAppState } from './utils/firebaseState';
import { INITIAL_DATA } from './constants.tsx';
import { auth } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

import Header from './components/Header';
import AuthView from './components/AuthView';
import CampaignList from './components/CampaignList';
import MissionDetailOverlay from './components/MissionDetailOverlay';
import VerifyView from './components/VerifyView';
import WalletView from './components/WalletView';
import AdminPanel from './components/AdminPanel';
import ProfileOverlay from './components/overlays/ProfileOverlay';
import UserDetailOverlay from './components/overlays/UserDetailOverlay';
import ReportingOverlay from './components/overlays/ReportingOverlay';

import { ICONS } from './constants.tsx';

// Performance utilities
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY as string);

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

  // Refs for cleanup
  const authUnsubscribeRef = useRef<(() => void) | null>(null);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      try {
        // Load initial state
        const loadedState = await loadAppState();
        if (loadedState) {
          setAppState(loadedState);
        }
      } catch (error) {
        console.error('App initialization error:', error);
        showToast('Failed to load app data', 'error');
      } finally {
        setLoading(false);
      }
    };

    initApp();
  }, []);

  // Firebase auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setCurrentUser(userData);
            
            // Set view based on role
            if (userData.role === UserRole.ADMIN) {
              setCurrentView('admin');
            } else {
              setCurrentView('campaigns');
            }
            
            showToast(`Welcome back, ${userData.username}!`, 'success');
          } else {
            // User document not found
            setCurrentUser(null);
            setCurrentView('auth');
            showToast('User profile not found. Please sign up again.', 'error');
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setCurrentUser(null);
          setCurrentView('auth');
          showToast('Error loading user data', 'error');
        }
      } else {
        // No user logged in
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

  // Auto-save with debounce
  useEffect(() => {
    if (!currentUser) return;

    const debouncedSave = debounce(async () => {
      try {
        await saveAppState(appState);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 2000); // 2 seconds debounce

    debouncedSave();
  }, [appState, currentUser]);

  // Session timeout (30 minutes)
  useEffect(() => {
    const resetSessionTimer = () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }

      if (currentUser && currentUser.role !== UserRole.ADMIN) {
        sessionTimeoutRef.current = setTimeout(() => {
          setCurrentUser(null);
          setCurrentView('auth');
          showToast('Session expired. Please login again.', 'error');
        }, 30 * 60 * 1000); // 30 minutes
      }
    };

    // Reset on user interaction
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, resetSessionTimer);
    });

    resetSessionTimer();

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, resetSessionTimer);
      });
    };
  }, [currentUser]);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
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
    setSelectedCampaign(campaign);
  }, []);

  // Report submission handler
  const handleReportSubmit = useCallback((message: string) => {
    if (!currentUser) return;

    const newReport = {
      id: `rep-${Date.now()}`,
      userId: currentUser.id,
      username: currentUser.username,
      message: message.trim(),
      status: 'open' as const,
      timestamp: Date.now(),
    } as UserReport;

    setAppState(prev => ({
      ...prev,
      reports: [newReport, ...prev.reports],
      logs: [
        {
          id: `log-${Date.now()}`,
          userId: currentUser.id,
          username: currentUser.username,
          type: 'system',
          message: `${currentUser.username} submitted a report`,
          timestamp: Date.now(),
        },
        ...prev.logs.slice(0, 49) // Keep only last 50 logs
      ]
    }));

    showToast('Report submitted to admin', 'success');
  }, [currentUser, showToast]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 font-black uppercase tracking-widest text-sm">LOADING REEL EARN PRO...</p>
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

  // Main app view
  return (
    <div className="min-h-screen pb-40 text-white bg-black antialiased font-sans hide-scrollbar">
      {/* Header */}
      <Header
        user={currentUser}
        onLogout={handleLogout}
        onProfileClick={() => setIsProfileOpen(true)}
        onNotifyClick={() => {
          if (currentUser!.role === UserRole.ADMIN) {
            setCurrentView('admin');
          } else {
            setCurrentView('wallet');
          }
        }}
        unreadCount={
          currentUser!.role === UserRole.ADMIN
            ? appState.reports.filter(r => r.status === 'open').length
            : appState.broadcasts.filter(m => 
                !m.targetUserId || m.targetUserId === currentUser!.id
              ).filter(m => !currentUser!.readBroadcastIds.includes(m.id)).length
        }
      />

      {/* Toast Notifications */}
      {toast && (
        <div
          className={`fixed top-20 left-4 right-4 z-50 p-4 rounded-2xl text-center font-bold border animate-slide ${
            toast.type === 'success' ? 'bg-cyan-600 border-cyan-400' : 'bg-red-600 border-red-400'
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
            currentUser={currentUser!}
            appState={appState}
            setAppState={setAppState}
            showToast={showToast}
            genAI={genAI}
          />
        )}

        {currentView === 'wallet' && (
          <WalletView
            currentUser={currentUser!}
            appState={appState}
            setAppState={setAppState}
            showToast={showToast}
          />
        )}

        {currentView === 'admin' && (
          <AdminPanel
            appState={appState}
            setAppState={setAppState}
            currentUser={currentUser!}
            showToast={showToast}
          />
        )}
      </main>

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

      <UserDetailOverlay
        isOpen={!!selectedUserDetail}
        user={selectedUserDetail}
        logs={appState.logs}
        onClose={() => setSelectedUserDetail(null)}
      />

      <ReportingOverlay
        isOpen={isReporting}
        currentUser={currentUser}
        onClose={() => setIsReporting(false)}
        onSubmit={handleReportSubmit}
        showToast={showToast}
      />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-4 right-4 z-50 glass-panel p-4 rounded-[48px] flex justify-between items-center border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.9)] bg-[#050505]/80 backdrop-blur-3xl border-t-2 border-white/5">
        <button
          onClick={() => setCurrentView('campaigns')}
          className={`flex-1 flex flex-col items-center py-3 transition-all ${
            currentView === 'campaigns' ? 'text-cyan-400 scale-110' : 'text-slate-700 hover:text-slate-500'
          }`}
          aria-label="Missions"
        >
          <ICONS.Home className="w-7 h-7" />
          <span className="text-[9px] font-black uppercase mt-1 italic tracking-widest leading-none">Missions</span>
        </button>

        <button
          onClick={() => setCurrentView('verify')}
          className={`flex-1 flex flex-col items-center py-3 transition-all ${
            currentView === 'verify' ? 'text-cyan-400 scale-110' : 'text-slate-700 hover:text-slate-500'
          }`}
          aria-label="Verify"
        >
          <div className="bg-cyan-500 p-6 rounded-[28px] -mt-24 text-black shadow-[0_20px_60px_rgba(0,210,255,0.4)] active:scale-90 relative border-4 border-black/50">
            <ICONS.Check className="w-8 h-8" />
          </div>
          <span className="text-[9px] font-black uppercase mt-3 italic tracking-widest leading-none">Verify</span>
        </button>

        <button
          onClick={() => setCurrentView(currentUser!.role === UserRole.ADMIN ? 'admin' : 'wallet')}
          className={`flex-1 flex flex-col items-center py-3 transition-all ${
            currentView === (currentUser!.role === UserRole.ADMIN ? 'admin' : 'wallet')
              ? 'text-cyan-400 scale-110'
              : 'text-slate-700 hover:text-slate-500'
          }`}
          aria-label={currentUser!.role === UserRole.ADMIN ? "Admin" : "Wallet"}
        >
          {currentUser!.role === UserRole.ADMIN ? (
            <ICONS.User className="w-7 h-7" />
          ) : (
            <ICONS.Wallet className="w-7 h-7" />
          )}
          <span className="text-[9px] font-black uppercase mt-1 italic tracking-widest leading-none">
            {currentUser!.role === UserRole.ADMIN ? 'Admin' : 'Wallet'}
          </span>
        </button>
      </nav>
    </div>
  );
}

export default App;
