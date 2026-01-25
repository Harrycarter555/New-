import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit
} from 'firebase/firestore';

import {
  AppState,
  User,
  Campaign,
  UserRole,
  UserStatus
} from './types';

import { auth, db } from './firebase';

// Components
import Header from './components/Header';
import AuthView from './components/AuthView';
import CampaignsPage from './components/CampaignsPage';
import MissionDetailOverlay from './components/MissionDetailOverlay';
import VerifyView from './components/VerifyView';
import WalletView from './components/WalletView';
import AdminPanel from './components/AdminPanel';
import ProfileOverlay from './components/overlays/ProfileOverlay';
import AccountRecovery from './components/AccountRecovery';

import { ICONS } from './constants';
import {
  checkFirebaseConnection,
  adminService
} from './components/AdminPanel/firebaseService';

// ==================== GEMINI INIT (SAFE) ====================
const genAI = new GoogleGenerativeAI(
  import.meta.env.VITE_GEMINI_API_KEY || ''
);

type ViewType =
  | 'auth'
  | 'campaigns'
  | 'verify'
  | 'wallet'
  | 'admin'
  | 'recovery';

function App() {
  // ==================== GLOBAL STATE ====================
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
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const [firebaseStatus, setFirebaseStatus] =
    useState<'connected' | 'connecting' | 'disconnected'>('connecting');

  // ==================== REAL-TIME USER DATA ====================
  const [userCampaigns, setUserCampaigns] = useState<Campaign[]>([]);
  const [userBroadcasts, setUserBroadcasts] = useState<any[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
  const [userPayouts, setUserPayouts] = useState<any[]>([]);

  // ==================== SAFE UNSUB REFS ====================
  const unsubRefs = useRef<(() => void)[]>([]);

  const clearAllListeners = () => {
    unsubRefs.current.forEach(unsub => {
      try {
        unsub();
      } catch {}
    });
    unsubRefs.current = [];
  };

  // ==================== TOAST ====================
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  // ==================== FIREBASE HEALTH CHECK ====================
  useEffect(() => {
    let active = true;

    const checkConnection = async () => {
      try {
        setFirebaseStatus('connecting');
        const ok = await checkFirebaseConnection();
        if (!active) return;

        setFirebaseStatus(ok ? 'connected' : 'disconnected');
        if (!ok) {
          showToast('Firebase disconnected. Offline mode.', 'error');
        }
      } catch {
        if (active) setFirebaseStatus('disconnected');
      }
    };

    checkConnection();
    const id = setInterval(checkConnection, 60000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [showToast]);

  // ==================== AUTH LISTENER ====================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      clearAllListeners();

      if (!firebaseUser) {
        setCurrentUser(null);
        setCurrentView('auth');
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!snap.exists()) throw new Error('User doc missing');

        const user = snap.data() as User;

        if (
          user.status === UserStatus.SUSPENDED ||
          user.status === UserStatus.BANNED
        ) {
          showToast('Account suspended. Contact admin.', 'error');
          await signOut(auth);
          return;
        }

        const safeUser: User = {
          ...user,
          readBroadcastIds: user.readBroadcastIds || [],
          pendingBalance: user.pendingBalance || 0,
          walletBalance: user.walletBalance || 0,
          totalEarnings: user.totalEarnings || 0
        };

        setCurrentUser(safeUser);
        setCurrentView(
          safeUser.role === UserRole.ADMIN ? 'admin' : 'campaigns'
        );

        if (safeUser.role === UserRole.ADMIN) {
          const adminData = await adminService.getAdminDashboardData();
          setAppState(prev => ({ ...prev, ...adminData }));
        }
      } catch (err) {
        console.error(err);
        showToast('Login failed. Retry.', 'error');
        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsub();
      clearAllListeners();
    };
  }, [showToast]);

  // ==================== USER CAMPAIGNS ====================
  useEffect(() => {
    if (!currentUser || currentUser.role === UserRole.ADMIN) return;

    const q = query(
      collection(db, 'campaigns'),
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, snap => {
      const list: Campaign[] = [];
      snap.forEach(d =>
        list.push({ id: d.id, ...(d.data() as Campaign) })
      );
      setUserCampaigns(list);
    });

    unsubRefs.current.push(unsub);
    return () => unsub();
  }, [currentUser]);

  // ==================== USER BROADCASTS ====================
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'broadcasts'),
      where('targetUserId', 'in', [null, currentUser.id]),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, snap => {
      setUserBroadcasts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    unsubRefs.current.push(unsub);
    return () => unsub();
  }, [currentUser]);

  // ==================== SUBMISSIONS ====================
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'submissions'),
      where('userId', '==', currentUser.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, snap => {
      setUserSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    unsubRefs.current.push(unsub);
    return () => unsub();
  }, [currentUser]);

  // ==================== PAYOUTS ====================
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'payouts'),
      where('userId', '==', currentUser.id),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, snap => {
      setUserPayouts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    unsubRefs.current.push(unsub);
    return () => unsub();
  }, [currentUser]);

  // ==================== LOGOUT ====================
  const handleLogout = async () => {
    clearAllListeners();
    await signOut(auth);
    setCurrentUser(null);
    setCurrentView('auth');
  };

  // ==================== RENDER ====================
  if (loading) return null;

  return (
    <>
      {toast && <div>{toast.message}</div>}

      {currentUser && (
        <Header
          user={currentUser}
          onProfile={() => setIsProfileOpen(true)}
        />
      )}

      {currentView === 'auth' && <AuthView />}
      {currentView === 'recovery' && <AccountRecovery />}
      {currentView === 'campaigns' && (
        <CampaignsPage
          campaigns={userCampaigns}
          onSelect={setSelectedCampaign}
        />
      )}
      {currentView === 'verify' && currentUser && (
        <VerifyView
          currentUser={currentUser}
          appState={appState}
          setAppState={setAppState}
          showToast={showToast}
          genAI={genAI}
          userCampaigns={userCampaigns}
        />
      )}
      {currentView === 'wallet' && currentUser && (
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
      {currentView === 'admin' && currentUser?.role === UserRole.ADMIN && (
        <AdminPanel
          appState={appState}
          setAppState={setAppState}
          currentUser={currentUser}
          showToast={showToast}
        />
      )}

      <ProfileOverlay
        isOpen={isProfileOpen}
        user={currentUser}
        onClose={() => setIsProfileOpen(false)}
        onLogout={handleLogout}
      />

      {selectedCampaign && (
        <MissionDetailOverlay
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </>
  );
}

export default App;
