import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  limit,
  updateDoc,
  arrayUnion,
  increment
} from 'firebase/firestore';

import {
  AppState,
  User,
  Campaign,
  UserRole,
  UserStatus,
  Platform,
  SubmissionStatus,
  PayoutStatus
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
import UserReportForm from './components/UserReportForm';

import { ICONS } from './constants';
import {
  checkFirebaseConnection,
  adminService,
  broadcastService
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
      dailyLimit: 100000,
      todaySpent: 0,
      startDate: '',
      endDate: ''
    },
    logs: [],
    config: { minWithdrawal: 100 }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('auth');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [unreadCount, setUnreadCount] = useState(0);

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
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userDocRef);
        
        if (!snap.exists()) {
          showToast('User account not found', 'error');
          await signOut(auth);
          return;
        }

        const user = snap.data() as User;

        // Check if user is suspended or banned
        if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED) {
          showToast('Account suspended. Contact admin.', 'error');
          await signOut(auth);
          return;
        }

        // Update last login
        await updateDoc(userDocRef, {
          lastLoginAt: Date.now(),
          updatedAt: new Date()
        });

        const safeUser: User = {
          ...user,
          id: firebaseUser.uid,
          readBroadcastIds: user.readBroadcastIds || [],
          pendingBalance: user.pendingBalance || 0,
          walletBalance: user.walletBalance || 0,
          totalEarnings: user.totalEarnings || 0,
          savedSocialUsername: user.savedSocialUsername || '',
          securityKey: user.securityKey || '',
          payoutMethod: user.payoutMethod || 'UPI',
          payoutDetails: user.payoutDetails || ''
        };

        setCurrentUser(safeUser);
        setCurrentView(
          safeUser.role === UserRole.ADMIN ? 'admin' : 'campaigns'
        );

        // Load admin data if admin
        if (safeUser.role === UserRole.ADMIN) {
          try {
            const adminData = await adminService.getAdminDashboardData();
            setAppState(prev => ({ ...prev, ...adminData }));
          } catch (error) {
            console.error('Error loading admin data:', error);
          }
        }
      } catch (err) {
        console.error('Auth error:', err);
        showToast('Login failed. Please try again.', 'error');
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

  // ==================== USER CAMPAIGNS LISTENER ====================
  useEffect(() => {
    if (!currentUser || currentUser.role === UserRole.ADMIN) return;

    const campaignsRef = collection(db, 'campaigns');
    const q = query(
      campaignsRef,
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Campaign[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          title: data.title || 'Untitled Campaign',
          description: data.description || '',
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
          createdAt: data.createdAt?.toDate?.().getTime() || Date.now(),
          updatedAt: data.updatedAt?.toDate?.().getTime() || Date.now()
        });
      });
      setUserCampaigns(list);
    }, (error) => {
      console.error('Campaigns listener error:', error);
    });

    unsubRefs.current.push(unsub);
    return () => unsub();
  }, [currentUser]);

  // ==================== USER BROADCASTS LISTENER ====================
  useEffect(() => {
    if (!currentUser) return;

    const broadcastsRef = collection(db, 'broadcasts');
    const q = query(
      broadcastsRef,
      where('targetUserId', 'in', [null, currentUser.id]),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const broadcasts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          content: data.content || '',
          senderId: data.senderId || '',
          senderName: data.senderName || 'Admin',
          targetUserId: data.targetUserId,
          timestamp: data.timestamp || Date.now(),
          readBy: data.readBy || [],
          createdAt: data.createdAt?.toDate?.().getTime() || Date.now()
        };
      });
      setUserBroadcasts(broadcasts);

      // Calculate unread count
      if (currentUser) {
        const unread = broadcasts.filter(b => 
          !currentUser.readBroadcastIds?.includes(b.id)
        ).length;
        setUnreadCount(unread);
      }
    }, (error) => {
      console.error('Broadcasts listener error:', error);
    });

    unsubRefs.current.push(unsub);
    return () => unsub();
  }, [currentUser]);

  // ==================== MARK BROADCAST AS READ ====================
  const handleNotifyClick = useCallback(async () => {
    if (!currentUser || userBroadcasts.length === 0) return;

    try {
      const unreadBroadcasts = userBroadcasts.filter(b => 
        !currentUser.readBroadcastIds?.includes(b.id)
      );

      if (unreadBroadcasts.length === 0) return;

      // Mark all as read
      for (const broadcast of unreadBroadcasts) {
        await broadcastService.markAsRead(broadcast.id, currentUser.id);
      }

      // Update local state
      const newReadIds = [...(currentUser.readBroadcastIds || []), ...unreadBroadcasts.map(b => b.id)];
      setCurrentUser(prev => prev ? {
        ...prev,
        readBroadcastIds: newReadIds
      } : null);

      setUnreadCount(0);
      showToast('All messages marked as read', 'success');
    } catch (error) {
      console.error('Error marking broadcasts as read:', error);
    }
  }, [currentUser, userBroadcasts, showToast]);

  // ==================== USER SUBMISSIONS LISTENER ====================
  useEffect(() => {
    if (!currentUser) return;

    const submissionsRef = collection(db, 'submissions');
    const q = query(
      submissionsRef,
      where('userId', '==', currentUser.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const submissions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId || '',
          username: data.username || '',
          socialUsername: data.socialUsername || '',
          campaignId: data.campaignId || '',
          campaignTitle: data.campaignTitle || '',
          platform: data.platform || Platform.INSTAGRAM,
          status: data.status || SubmissionStatus.PENDING,
          timestamp: data.timestamp || Date.now(),
          rewardAmount: data.rewardAmount || 0,
          externalLink: data.externalLink || '',
          isViralBonus: data.isViralBonus || false,
          approvedAt: data.approvedAt,
          rejectedAt: data.rejectedAt
        };
      });
      setUserSubmissions(submissions);
    }, (error) => {
      console.error('Submissions listener error:', error);
    });

    unsubRefs.current.push(unsub);
    return () => unsub();
  }, [currentUser]);

  // ==================== USER PAYOUTS LISTENER ====================
  useEffect(() => {
    if (!currentUser) return;

    const payoutsRef = collection(db, 'payouts');
    const q = query(
      payoutsRef,
      where('userId', '==', currentUser.id),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const payouts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId || '',
          username: data.username || '',
          amount: data.amount || 0,
          method: data.method || 'UPI',
          status: data.status || PayoutStatus.PENDING,
          timestamp: data.timestamp || Date.now(),
          upiId: data.upiId || '',
          accountDetails: data.accountDetails || '',
          processedAt: data.processedAt,
          processedBy: data.processedBy
        };
      });
      setUserPayouts(payouts);
    }, (error) => {
      console.error('Payouts listener error:', error);
    });

    unsubRefs.current.push(unsub);
    return () => unsub();
  }, [currentUser]);

  // ==================== HANDLE LOGOUT ====================
  const handleLogout = async () => {
    try {
      clearAllListeners();
      await signOut(auth);
      setCurrentUser(null);
      setCurrentView('auth');
      showToast('Logged out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Logout failed', 'error');
    }
  };

  // ==================== HANDLE PROFILE CLICK ====================
  const handleProfileClick = () => {
    setIsProfileOpen(true);
  };

  // ==================== RENDER LOADING ====================
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="w-20 h-20 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-black text-white mb-2">REEL<span className="text-cyan-400">EARN</span></h2>
        <p className="text-slate-500">Loading your experience...</p>
      </div>
    );
  }

  // ==================== RENDER TOAST ====================
  const renderToast = () => {
    if (!toast) return null;

    return (
      <div className={`fixed top-6 right-6 z-[1000] px-6 py-4 rounded-xl shadow-2xl animate-slide ${
        toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-orange-600'
      }`}>
        <div className="flex items-center gap-3">
          {toast.type === 'success' ? (
            <ICONS.CheckCircle className="w-5 h-5 text-white" />
          ) : (
            <ICONS.AlertTriangle className="w-5 h-5 text-white" />
          )}
          <p className="text-white font-bold text-sm">{toast.message}</p>
        </div>
      </div>
    );
  };

  // ==================== RENDER FIREBASE STATUS ====================
  const renderFirebaseStatus = () => {
    if (firebaseStatus === 'connected') return null;

    return (
      <div className="fixed bottom-4 right-4 z-[999] px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            firebaseStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
          }`}></div>
          <span className="text-xs text-white font-bold">
            {firebaseStatus === 'connecting' ? 'Connecting...' : 'Offline Mode'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      {renderToast()}
      {renderFirebaseStatus()}

      {/* Header for regular users */}
      {currentUser && currentUser.role !== UserRole.ADMIN && currentView !== 'auth' && (
        <Header
          user={currentUser}
          onLogout={handleLogout}
          onNotifyClick={handleNotifyClick}
          onProfileClick={handleProfileClick}
          unreadCount={unreadCount}
          onReportClick={() => setShowReportForm(true)}
        />
      )}

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 pb-32 pt-4">
        {currentView === 'auth' && (
          <AuthView
            setCurrentUser={setCurrentUser}
            setCurrentView={setCurrentView}
            showToast={showToast}
          />
        )}

        {currentView === 'recovery' && (
          <AccountRecovery
            setCurrentView={setCurrentView}
            showToast={showToast}
          />
        )}

        {currentView === 'campaigns' && currentUser && (
          <CampaignsPage
            userCampaigns={userCampaigns}
            userStats={{
              totalActive: userCampaigns.length,
              totalRewardPool: userCampaigns.reduce((sum, c) => sum + c.basicPay, 0),
              pendingBalance: currentUser.pendingBalance || 0,
              walletBalance: currentUser.walletBalance || 0
            }}
            onCampaignSelect={setSelectedCampaign}
            onNavigateToVerify={() => setCurrentView('verify')}
            onNavigateToWallet={() => setCurrentView('wallet')}
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
            currentUser={currentUser}
            showToast={showToast}
            appState={appState}
            setAppState={setAppState}
          />
        )}
      </main>

      {/* Overlays & Modals */}
      {isProfileOpen && currentUser && (
        <ProfileOverlay
          isOpen={isProfileOpen}
          user={currentUser}
          onClose={() => setIsProfileOpen(false)}
          onLogout={handleLogout}
        />
      )}

      {selectedCampaign && (
        <MissionDetailOverlay
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          onStartVerify={() => {
            setSelectedCampaign(null);
            setCurrentView('verify');
          }}
        />
      )}

      {showReportForm && currentUser && (
        <UserReportForm
          currentUser={currentUser}
          showToast={showToast}
          onClose={() => setShowReportForm(false)}
        />
      )}

      {/* Bottom Navigation for Users */}
      {currentUser && currentUser.role !== UserRole.ADMIN && currentView !== 'admin' && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 z-50">
          <div className="max-w-lg mx-auto px-6 py-3">
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setCurrentView('campaigns')}
                className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                  currentView === 'campaigns'
                    ? 'bg-cyan-500 text-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ICONS.Campaign className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold uppercase">Missions</span>
              </button>

              <button
                onClick={() => setCurrentView('verify')}
                className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                  currentView === 'verify'
                    ? 'bg-cyan-500 text-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ICONS.Check className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold uppercase">Verify</span>
              </button>

              <button
                onClick={() => setCurrentView('wallet')}
                className={`flex flex-col items-center p-3 rounded-xl transition-all ${
                  currentView === 'wallet'
                    ? 'bg-cyan-500 text-black'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ICONS.Wallet className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold uppercase">Wallet</span>
                {currentUser.pendingBalance > 0 && (
                  <span className="absolute top-1 right-4 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                )}
              </button>

              <button
                onClick={handleProfileClick}
                className="flex flex-col items-center p-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <ICONS.User className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold uppercase">Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
