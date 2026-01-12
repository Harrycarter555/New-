// src/App.tsx
import React, { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";

import { AppState, User, Campaign } from './types';
import { loadAppState, saveAppState } from './utils/firebaseState';
import { INITIAL_DATA } from './constants';

import Header from './components/Header';
import AuthView from './components/AuthView';
import CampaignList from './components/CampaignList';
import MissionDetailOverlay from './components/MissionDetailOverlay';
import VerifyView from './components/VerifyView';
import WalletView from './components/WalletView';
import AdminPanel from './components/AdminPanel';
import ProfileOverlay from './components/overlays/ProfileOverlay';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY as string);

function App() {
  const [appState, setAppState] = useState<AppState>(INITIAL_DATA);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'auth' | 'campaigns' | 'verify' | 'wallet' | 'admin'>('auth');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load state once on mount
  useEffect(() => {
    loadAppState().then(loaded => {
      if (loaded) setAppState(loaded);
    });
  }, []);

  // Auto-save when logged in
  useEffect(() => {
    if (currentUser) {
      saveAppState(appState);
    }
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

  return (
    <div className="min-h-screen pb-40 text-white bg-black">
      <Header
        user={currentUser}
        onLogout={() => {
          setCurrentUser(null);
          setCurrentView('auth');
        }}
        onProfileClick={() => setIsProfileOpen(true)}
        onNotifyClick={() => {
          if (currentUser?.role === UserRole.ADMIN) {
            setCurrentView('admin');
          } else {
            setCurrentView('wallet');
          }
        }}
        unreadCount={
          currentUser?.role === UserRole.ADMIN
            ? appState.reports.length
            : appState.broadcasts.length
        }
      />

      {toast && (
        <div
          className={`fixed top-20 left-4 right-4 z-50 p-4 rounded-2xl text-center font-bold border ${
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

      {/* Bottom Navigation */}
      {/* yahan tumhara fixed bottom nav code daal dena */}

      {/* UserDetailOverlay aur ReportingOverlay jab chahiye tab conditionally render kar dena */}
    </div>
  );
}

export default App;
