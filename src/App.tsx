// src/App.tsx
import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

import { 
  AppState, User, Campaign, UserRole 
} from './types.ts';

import { loadAppState, saveAppState } from './utils/firebaseState';
import { INITIAL_DATA } from './constants.tsx';

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

  useEffect(() => {
    loadAppState().then(loaded => loaded && setAppState(loaded));
  }, []);

  useEffect(() => {
    if (currentUser) saveAppState(appState);
  }, [appState, currentUser]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  if (currentView === 'auth') {
    return (
      <AuthView
        appState={appState}
        setAppState={setAppState}
        setCurrentUser={setCurrentUser}
        setCurrentView={setCurrentView}
        showToast={showToast}
      />
    );
  }

  if (!currentUser) {
    setCurrentView('auth');
    return null;
  }

  return (
    <div className="min-h-screen pb-40 text-white bg-black">
      <Header
        user={currentUser}
        onLogout={() => {
          setCurrentUser(null);
          setCurrentView('auth');
          showToast('Logged out successfully', 'success');
        }}
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
            ? appState.reports.length
            : appState.broadcasts.filter(m => !m.targetUserId || m.targetUserId === currentUser.id).length
        }
      />

      {toast && (
        <div
          className={`fixed top-20 left-4 right-4 z-50 p-4 rounded-2xl text-center font-bold border animate-slide ${
            toast.type === 'success' ? 'bg-cyan-600 border-cyan-400' : 'bg-red-600 border-red-400'
          }`}
        >
          {toast.message}
        </div>
      )}

      <main className="px-5 max-w-lg mx-auto">
        {currentView === 'campaigns' && (
          <CampaignList
            campaigns={appState.campaigns.filter(c => c.active)}
            onSelect={setSelectedCampaign}
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

        {currentView === 'admin' && (
          <AdminPanel
            appState={appState}
            setAppState={setAppState}
            currentUser={currentUser}
            showToast={showToast}
          />
        )}
      </main>

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
        onSubmit={(msg) => {
          const newReport = {
            id: `rep-${Date.now()}`,
            userId: currentUser.id,
            username: currentUser.username,
            message: msg,
            status: 'open',
            timestamp: Date.now(),
          };
          setAppState(prev => ({
            ...prev,
            reports: [newReport, ...prev.reports],
          }));
          showToast('Report submitted to admin', 'success');
        }}
        showToast={showToast}
      />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-4 right-4 z-50 glass-panel p-4 rounded-[48px] flex justify-between items-center border border-white/10 shadow-[0_20px_80px_rgba(0,0,0,0.9)] bg-[#050505]/80 backdrop-blur-3xl border-t-2 border-white/5">
        <button
          onClick={() => setCurrentView('campaigns')}
          className={`flex-1 flex flex-col items-center py-3 transition-all ${
            currentView === 'campaigns' ? 'text-cyan-400 scale-110' : 'text-slate-700 hover:text-slate-500'
          }`}
        >
          <ICONS.Home className="w-7 h-7" />
          <span className="text-[9px] font-black uppercase mt-1 italic tracking-widest leading-none">Missions</span>
        </button>

        <button
          onClick={() => setCurrentView('verify')}
          className={`flex-1 flex flex-col items-center py-3 transition-all ${
            currentView === 'verify' ? 'text-cyan-400 scale-110' : 'text-slate-700 hover:text-slate-500'
          }`}
        >
          <div className="bg-cyan-500 p-6 rounded-[28px] -mt-24 text-black shadow-[0_20px_60px_rgba(0,210,255,0.4)] active:scale-90 relative border-4 border-black/50">
            <ICONS.Check className="w-8 h-8" />
          </div>
          <span className="text-[9px] font-black uppercase mt-3 italic tracking-widest leading-none">Verify</span>
        </button>

        <button
          onClick={() => setCurrentView(currentUser.role === UserRole.ADMIN ? 'admin' : 'wallet')}
          className={`flex-1 flex flex-col items-center py-3 transition-all ${
            currentView === (currentUser.role === UserRole.ADMIN ? 'admin' : 'wallet')
              ? 'text-cyan-400 scale-110'
              : 'text-slate-700 hover:text-slate-500'
          }`}
        >
      {currentUser.role === UserRole.ADMIN ? (
  <ICONS.Users className="w-7 h-7" />  // ab Users add ho gaya hai
) : (
  <ICONS.Wallet className="w-7 h-7" />
)}
          <span className="text-[9px] font-black uppercase mt-1 italic tracking-widest leading-none">
            {currentUser.role === UserRole.ADMIN ? 'Admin' : 'Wallet'}
          </span>
        </button>
      </nav>
    </div>
  );
}

export default App;
