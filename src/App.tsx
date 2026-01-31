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
  serverTimestamp,
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
  PayoutStatus,
  ViewType
} from './types';

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
import UserReportForm from './components/UserReportForm';

import { ICONS } from './constants';

// ==================== GEMINI INIT ====================
const genAI = new GoogleGenerativeAI(
  import.meta.env.VITE_GEMINI_API_KEY || ''
);

function App() {
  // ==================== GLOBAL STATE ====================
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

  // ==================== TOAST FUNCTION ====================
  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  // ==================== REAL-TIME SYNC MANAGER ====================
  const setupRealTimeListeners = useCallback((userId: string) => {
    console.log('🔄 Setting up real-time listeners for user:', userId);
    
    // 1. ACTIVE CAMPAIGNS LISTENER
    const campaignsQuery = query(
      collection(db, 'campaigns'),
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const campaignsUnsub = onSnapshot(campaignsQuery, (snapshot) => {
      const campaigns: Campaign[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Campaign;
        campaigns.push({
          ...data,
          id: doc.id,
          updatedAt: data.updatedAt || Date.now()
        });
      });
      console.log('🔄 Campaigns updated:', campaigns.length);
      setUserCampaigns(campaigns);
    }, (error) => {
      console.error('Campaigns listener error:', error);
    });
    
    unsubRefs.current.push(campaignsUnsub);

    // 2. BROADCASTS LISTENER
    const broadcastsQuery = query(
      collection(db, 'broadcasts'),
      where('targetUserId', 'in', [null, userId]),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const broadcastsUnsub = onSnapshot(broadcastsQuery, async (snapshot) => {
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
          createdAt: data.createdAt || Date.now()
        };
      });
      
      console.log('🔄 Broadcasts updated:', broadcasts.length);
      setUserBroadcasts(broadcasts);

      // Calculate unread count
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        const readIds = userData.readBroadcastIds || [];
        const unread = broadcasts.filter(b => !readIds.includes(b.id)).length;
        setUnreadCount(unread);
      }
    }, (error) => {
      console.error('Broadcasts listener error:', error);
    });
    
    unsubRefs.current.push(broadcastsUnsub);

    // 3. SUBMISSIONS LISTENER
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const submissionsUnsub = onSnapshot(submissionsQuery, (snapshot) => {
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
      
      console.log('🔄 Submissions updated:', submissions.length);
      setUserSubmissions(submissions);
    }, (error) => {
      console.error('Submissions listener error:', error);
    });
    
    unsubRefs.current.push(submissionsUnsub);

    // 4. PAYOUTS LISTENER
    const payoutsQuery = query(
      collection(db, 'payouts'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const payoutsUnsub = onSnapshot(payoutsQuery, (snapshot) => {
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
      
      console.log('🔄 Payouts updated:', payouts.length);
      setUserPayouts(payouts);
    }, (error) => {
      console.error('Payouts listener error:', error);
    });
    
    unsubRefs.current.push(payoutsUnsub);

    // 5. USER DATA LISTENER (For balance/status updates)
    const userUnsub = onSnapshot(doc(db, 'users', userId), (doc) => {
      if (doc.exists()) {
        const userData = doc.data() as User;
        console.log('🔄 User data updated:', userData.username, 'Balance:', userData.walletBalance);
        setCurrentUser(prev => prev ? { ...prev, ...userData } : null);
      }
    }, (error) => {
      console.error('User listener error:', error);
    });
    
    unsubRefs.current.push(userUnsub);
  }, []);

  // ==================== CHECK FIREBASE CONNECTION ====================
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const testRef = doc(db, '_test', 'connection');
        await updateDoc(testRef, { timestamp: Date.now() }, { merge: true });
        console.log('✅ Firebase connection OK');
      } catch (error) {
        console.warn('⚠️ Firebase connection issue');
      }
    };
    checkConnection();
  }, []);

  // ==================== AUTH LISTENER ====================
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      clearAllListeners(); // Clear old listeners

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
          console.log('User document not found, creating temporary...');
          
          const tempUser: User = {
            id: firebaseUser.uid,
            username: firebaseUser.email?.split('@')[0] || 'user',
            email: firebaseUser.email || '',
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
            walletBalance: 100, // Welcome bonus
            pendingBalance: 0,
            totalEarnings: 0,
            joinedAt: Date.now(),
            lastLoginAt: Date.now(),
            readBroadcastIds: [],
            securityKey: '',
            savedSocialUsername: '',
            payoutMethod: '',
            payoutDetails: ''
          };
          
          await setDoc(userDocRef, tempUser);
          setCurrentUser(tempUser);
          setCurrentView('campaigns');
          setupRealTimeListeners(firebaseUser.uid);
          showToast('Welcome! ₹100 bonus added to your wallet.', 'success');
          setLoading(false);
          return;
        }

        const userData = snap.data() as User;
        
        // ✅ CHECK IF USER SUSPENDED/BANNED BY ADMIN
        if (userData.status === UserStatus.SUSPENDED || userData.status === UserStatus.BANNED) {
          showToast('Account suspended. Contact admin.', 'error');
          await signOut(auth);
          clearAllListeners();
          return;
        }

        // Update last login
        await updateDoc(userDocRef, {
          lastLoginAt: Date.now(),
          updatedAt: serverTimestamp()
        });

        const safeUser: User = {
          ...userData,
          id: firebaseUser.uid,
          lastLoginAt: Date.now(),
          updatedAt: Date.now()
        };

        setCurrentUser(safeUser);
        
        // Setup real-time listeners
        setupRealTimeListeners(firebaseUser.uid);
        
        // Set view based on role
        if (safeUser.role === UserRole.ADMIN) {
          setCurrentView('admin');
        } else {
          setCurrentView('campaigns');
        }

        showToast('Login successful!', 'success');
        
      } catch (err: any) {
        console.error('Auth error:', err);
        showToast('Login failed. Please try again.', 'error');
        clearAllListeners();
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsub();
      clearAllListeners();
    };
  }, [showToast, setupRealTimeListeners]);

  // ==================== MARK BROADCAST AS READ ====================
  const handleNotifyClick = useCallback(async () => {
    if (!currentUser || userBroadcasts.length === 0) return;

    try {
      const unreadBroadcasts = userBroadcasts.filter(b => 
        !currentUser.readBroadcastIds?.includes(b.id)
      );

      if (unreadBroadcasts.length === 0) return;

      const batchUpdates = unreadBroadcasts.map(async (broadcast) => {
        await updateDoc(doc(db, 'broadcasts', broadcast.id), {
          readBy: [...(broadcast.readBy || []), currentUser.id],
          updatedAt: serverTimestamp()
        });
      });

      await Promise.all(batchUpdates);

      // Update user's read broadcast IDs
      const newReadIds = [...(currentUser.readBroadcastIds || []), ...unreadBroadcasts.map(b => b.id)];
      await updateDoc(doc(db, 'users', currentUser.id), {
        readBroadcastIds: newReadIds,
        updatedAt: serverTimestamp()
      });

      // Update local state
      setCurrentUser(prev => prev ? {
        ...prev,
        readBroadcastIds: newReadIds
      } : null);

      setUnreadCount(0);
      showToast('All messages marked as read', 'success');
    } catch (error: any) {
      console.error('Error marking broadcasts as read:', error);
      showToast('Failed to mark as read', 'error');
    }
  }, [currentUser, userBroadcasts, showToast]);

  // ==================== HANDLE LOGOUT ====================
  const handleLogout = async () => {
    try {
      clearAllListeners();
      await signOut(auth);
      setCurrentUser(null);
      setCurrentView('auth');
      showToast('Logged out successfully', 'success');
    } catch (error: any) {
      console.error('Logout error:', error);
      showToast('Logout failed', 'error');
    }
  };

  // ==================== HANDLE PROFILE CLICK ====================
  const handleProfileClick = () => {
    setIsProfileOpen(true);
  };

  // ==================== CREATE APP STATE FOR COMPONENTS ====================
  const getAppState = (): AppState => ({
    users: [currentUser || {
      id: '',
      username: '',
      email: '',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      walletBalance: 0,
      pendingBalance: 0,
      totalEarnings: 0,
      joinedAt: Date.now(),
      readBroadcastIds: [],
      securityKey: ''
    }],
    campaigns: userCampaigns,
    submissions: userSubmissions,
    payoutRequests: userPayouts,
    broadcasts: userBroadcasts,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      {renderToast()}
      
      {/* Header for regular users only */}
      {currentUser && currentUser.role !== UserRole.ADMIN && currentView !== 'auth' && currentView !== 'recovery' && (
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
        {/* Auth View */}
        {currentView === 'auth' && (
          <AuthView
            setCurrentUser={setCurrentUser}
            setCurrentView={setCurrentView}
            showToast={showToast}
          />
        )}

        {/* Recovery View */}
        {currentView === 'recovery' && (
          <AccountRecovery
            setCurrentView={setCurrentView}
            showToast={showToast}
          />
        )}

        {/* Campaigns View */}
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

        {/* Verify View */}
        {currentView === 'verify' && currentUser && (
          <VerifyView
            currentUser={currentUser}
            appState={getAppState()}
            setAppState={() => {}}
            showToast={showToast}
            genAI={genAI}
            userCampaigns={userCampaigns}
          />
        )}

        {/* Wallet View */}
        {currentView === 'wallet' && currentUser && (
          <WalletView
            currentUser={currentUser}
            appState={getAppState()}
            setAppState={() => {}}
            showToast={showToast}
            userCampaigns={userCampaigns}
            userBroadcasts={userBroadcasts}
            userSubmissions={userSubmissions}
            userPayouts={userPayouts}
          />
        )}

        {/* Admin Panel */}
        {currentView === 'admin' && currentUser?.role === UserRole.ADMIN && (
          <AdminPanel
            currentUser={currentUser}
            showToast={showToast}
            appState={null}
            setAppState={() => {}}
          />
        )}
      </main>

      {/* Overlays & Modals */}
      {/* Profile Overlay */}
      {isProfileOpen && currentUser && (
        <ProfileOverlay
          isOpen={isProfileOpen}
          user={currentUser}
          onClose={() => setIsProfileOpen(false)}
          onLogout={handleLogout}
        />
      )}

      {/* Mission Detail Overlay */}
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

      {/* Report Form */}
      {showReportForm && currentUser && (
        <UserReportForm
          currentUser={currentUser}
          showToast={showToast}
          onClose={() => setShowReportForm(false)}
        />
      )}

      {/* Bottom Navigation for regular users only */}
      {currentUser && currentUser.role !== UserRole.ADMIN && 
       currentView !== 'auth' && currentView !== 'recovery' && currentView !== 'admin' && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 z-50">
          <div className="max-w-lg mx-auto px-6 py-3">
            <div className="grid grid-cols-3 gap-2">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
