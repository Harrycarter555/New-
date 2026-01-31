// src/components/VerifyView.tsx
import React, { useState } from 'react';
import { AppState, User, Platform, SubmissionStatus, Campaign } from '../types';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  increment, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth } from 'firebase/auth';

// Fallback icons
const FALLBACK_ICONS = {
  Check: () => <span className="text-black">✓</span>,
  Instagram: () => <span>📷</span>,
  Facebook: () => <span>📘</span>,
  Info: () => <span>ℹ️</span>,
  Verify: () => <span>✅</span>,
};

interface VerifyViewProps {
  currentUser: User;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  genAI: GoogleGenerativeAI;
  userCampaigns: Campaign[];
}

const VerifyView: React.FC<VerifyViewProps> = ({
  currentUser,
  appState,
  setAppState,
  showToast,
  genAI,
  userCampaigns,
}) => {
  const [platform, setPlatform] = useState<Platform>(Platform.INSTAGRAM);
  const [handleInput, setHandleInput] = useState(
    currentUser.savedSocialUsername?.split('/@')[1] || ''
  );
  const [links, setLinks] = useState<Record<string, string>>({});
  const [selectedVerifyCampaigns, setSelectedVerifyCampaigns] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');

  const activeCampaigns = userCampaigns.filter(c => c.active);

  const toggleCampaign = (id: string) => {
    setSelectedVerifyCampaigns(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const cleanUsername = (username: string) => {
    return username.replace('@', '').trim().toLowerCase();
  };

  const handleVerifySubmit = async () => {
    if (!handleInput) return showToast('Username required', 'error');
    if (selectedVerifyCampaigns.length === 0) return showToast('Select at least one mission', 'error');

    const missing = selectedVerifyCampaigns.find(id => !links[id]?.trim());
    if (missing) {
      const campaign = activeCampaigns.find(c => c.id === missing);
      return showToast(`Link required for: ${campaign?.title}`, 'error');
    }

    setIsAnalyzing(true);
    setAnalysisStep("CHECKING PERMISSIONS...");

    try {
      const auth = getAuth();
      const firebaseUser = auth.currentUser;
      
      if (!firebaseUser) {
        showToast('Please login again', 'error');
        setIsAnalyzing(false);
        return;
      }

      // ✅ CRITICAL: Ensure currentUser.id matches Firebase Auth UID
      if (currentUser.id !== firebaseUser.uid) {
        showToast('User ID mismatch. Please relogin.', 'error');
        console.error('User ID mismatch:', {
          currentUserId: currentUser.id,
          firebaseUid: firebaseUser.uid
        });
        setIsAnalyzing(false);
        return;
      }

      const cleanHandle = cleanUsername(handleInput);
      const successfulSubmissions = [];

      for (const cid of selectedVerifyCampaigns) {
        const campaign = activeCampaigns.find(c => c.id === cid);
        if (!campaign) continue;

        setAnalysisStep(`SUBMITTING: ${campaign.title.toUpperCase()}...`);

        try {
          // ✅ Step 1: Get current user document
          const userDocRef = doc(db, 'users', currentUser.id);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            throw new Error('User document not found in Firestore');
          }

          const userData = userDoc.data();
          
          // ✅ Step 2: Calculate new pending balance
          const currentPendingBalance = userData.pendingBalance || 0;
          const newPendingBalance = currentPendingBalance + campaign.basicPay;
          
          // ✅ Step 3: Create submission with EXACT fields matching rules
          const submissionData = {
            userId: currentUser.id, // Must match auth.uid
            username: currentUser.username || '',
            email: currentUser.email || firebaseUser.email || '',
            socialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
            campaignId: cid,
            campaignTitle: campaign.title,
            platform,
            status: SubmissionStatus.PENDING,
            timestamp: Date.now(),
            rewardAmount: campaign.basicPay,
            externalLink: links[cid],
            isViralBonus: false,
            aiVerificationResponse: "MANUAL_REVIEW_REQUIRED",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
            // Note: DO NOT add authUid field - rules check request.auth.uid directly
          };

          console.log('Creating submission with data:', {
            userId: submissionData.userId,
            authUid: firebaseUser.uid,
            match: submissionData.userId === firebaseUser.uid
          });

          // ✅ Create submission (rules check: request.auth.uid == request.resource.data.userId)
          const submissionRef = await addDoc(collection(db, 'submissions'), submissionData);

          // ✅ Step 4: Update user - ONLY pendingBalance (rules allow this)
          // Important: Update ONLY one field at a time as per your rules
          await updateDoc(userDocRef, {
            pendingBalance: newPendingBalance
          });

          // ✅ Step 5: Update savedSocialUsername in separate update (rules allow in profile update)
          // Check if username changed
          const newSocialUsername = `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`;
          if (userData.savedSocialUsername !== newSocialUsername) {
            await updateDoc(userDocRef, {
              savedSocialUsername: newSocialUsername
            });
          }

          successfulSubmissions.push({
            id: submissionRef.id,
            campaignTitle: campaign.title,
            amount: campaign.basicPay
          });

          console.log(`✅ Successfully submitted: ${campaign.title}`);

        } catch (firestoreError: any) {
          console.error("Firestore Error Details:", {
            code: firestoreError.code,
            message: firestoreError.message,
            campaign: campaign.title,
            userId: currentUser.id,
            firebaseUid: firebaseUser.uid
          });
          
          // Specific error messages
          if (firestoreError.code === 'permission-denied') {
            showToast(`Permission denied. Check: 1) User ID match, 2) Rules configuration`, 'error');
          } else if (firestoreError.code === 'failed-precondition') {
            showToast(`Rules validation failed. Please contact admin.`, 'error');
          } else {
            showToast(`Submission failed: ${firestoreError.message}`, 'error');
          }
          
          setIsAnalyzing(false);
          return;
        }
      }

      if (successfulSubmissions.length > 0) {
        const totalPayout = successfulSubmissions.reduce((acc, s) => acc + s.amount, 0);
        
        // Update local state
        setAppState(prev => ({
          ...prev,
          users: prev.users.map(u =>
            u.id === currentUser.id
              ? {
                  ...u,
                  pendingBalance: u.pendingBalance + totalPayout,
                  savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
                }
              : u
          ),
        }));

        showToast(`✅ ${successfulSubmissions.length} submission(s) successful! ₹${totalPayout} pending`, 'success');
        
        // Reset form
        setSelectedVerifyCampaigns([]);
        setLinks({});
        setHandleInput(cleanHandle);
      }
    } catch (err: any) {
      console.error("Submission Error:", err);
      showToast(`Submission failed: ${err.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Debug: View current user and auth state
  const debugAuthState = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    console.log('=== DEBUG AUTH STATE ===');
    console.log('Firebase Auth User:', user);
    console.log('Current User from props:', currentUser);
    console.log('Match:', currentUser.id === user?.uid);
    
    showToast(`Auth: ${user?.uid}, User: ${currentUser.id}`, 'success');
  };

  return (
    <div className="space-y-10 pb-40 animate-slide">
      {isAnalyzing && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-10 text-center animate-pulse">
          <div className="w-24 h-24 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-8"></div>
          <p className="text-xl font-black italic text-cyan-400 uppercase tracking-widest leading-none">
            {analysisStep}
          </p>
          <p className="text-[10px] text-slate-500 mt-4 uppercase font-black">
            Processing your submission...
          </p>
        </div>
      )}

      <div className="text-center">
        <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase italic">
          MISSION <span className="text-cyan-400">VERIFY</span>
        </h2>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 italic">
          Submit Your Reels
        </p>
        
        {/* Debug Button */}
        <button
          onClick={debugAuthState}
          className="mt-4 mx-auto px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-black text-xs font-bold rounded-xl flex items-center gap-2 hover:opacity-90"
        >
          <span>🐛</span> Debug Auth State
        </button>
      </div>

      {/* Important Notice */}
      <div className="mx-4 p-4 bg-gradient-to-r from-amber-500/20 to-red-500/20 border border-amber-500/30 rounded-xl">
        <p className="text-xs font-black text-amber-400 mb-2">IMPORTANT: User ID Check</p>
        <p className="text-[10px] text-amber-300">
          Your Firestore User ID must match Firebase Auth UID. Check console after clicking Debug button.
        </p>
        <div className="mt-2 text-[8px] text-slate-400">
          <p>Rules require: request.auth.uid == request.resource.data.userId</p>
        </div>
      </div>

      {/* Campaign Selection */}
      <div className="space-y-4 px-2">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2 italic">
          1. Select Missions
        </p>
        <div className="grid grid-cols-2 gap-4">
          {activeCampaigns.map(campaign => (
            <div
              key={campaign.id}
              onClick={() => toggleCampaign(campaign.id)}
              className={`relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all ${
                selectedVerifyCampaigns.includes(campaign.id)
                  ? 'border-cyan-500 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                  : 'border-white/10 opacity-80 hover:opacity-100'
              }`}
            >
              <img 
                src={campaign.thumbnailUrl} 
                alt={campaign.title}
                className="w-full h-40 object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/400x400/0ea5e9/000?text=Campaign';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                <p className="text-xs font-bold text-white truncate">{campaign.title}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-cyan-400 font-bold">
                    ₹{campaign.basicPay}
                  </span>
                  {selectedVerifyCampaigns.includes(campaign.id) && (
                    <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                      <FALLBACK_ICONS.Check />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {activeCampaigns.length === 0 && (
          <div className="text-center py-10">
            <p className="text-white/60 text-sm">No active campaigns available</p>
            <p className="text-white/40 text-[10px] mt-1">Check back later for new missions</p>
          </div>
        )}
      </div>

      {/* Form Section */}
      <div className="px-2 space-y-8">
        {/* Platform + Username */}
        <div className="space-y-6">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2 italic">
            2. Creator Profile
          </p>
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-white/5 rounded-[28px] border border-white/5">
            <button
              onClick={() => setPlatform(Platform.INSTAGRAM)}
              className={`py-4 rounded-[22px] font-black text-[10px] uppercase flex items-center justify-center gap-2 ${
                platform === Platform.INSTAGRAM ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
              }`}
            >
              <FALLBACK_ICONS.Instagram />
              Instagram
            </button>
            <button
              onClick={() => setPlatform(Platform.FACEBOOK)}
              className={`py-4 rounded-[22px] font-black text-[10px] uppercase flex items-center justify-center gap-2 ${
                platform === Platform.FACEBOOK ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
              }`}
            >
              <FALLBACK_ICONS.Facebook />
              Facebook
            </button>
          </div>
          <div className="relative">
            <input
              className="w-full bg-white/5 border border-white/10 rounded-[28px] px-8 py-5 text-xl font-black italic text-white outline-none focus:border-cyan-500 placeholder:text-slate-800"
              placeholder="Username (no @)"
              value={handleInput}
              onChange={e => setHandleInput(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 text-xs">
              {platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}{handleInput || 'username'}
            </div>
          </div>
        </div>

        {/* Links for selected campaigns */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="space-y-4 animate-slide">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2 italic">
              3. Paste Reel URLs
            </p>
            {selectedVerifyCampaigns.map(cid => {
              const campaign = activeCampaigns.find(c => c.id === cid);
              return (
                <div key={cid} className="space-y-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <img 
                      src={campaign?.thumbnailUrl} 
                      alt={campaign?.title}
                      className="w-12 h-12 rounded-xl object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/100x100/0ea5e9/000?text=Campaign';
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{campaign?.title}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[10px] text-cyan-400">₹{campaign?.basicPay}</p>
                        <p className="text-[8px] text-slate-500 bg-black/30 px-2 py-1 rounded">
                          Audio: {campaign?.audioName?.substring(0, 12) || 'Required'}...
                        </p>
                      </div>
                    </div>
                  </div>
                  <input
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-cyan-500 placeholder:text-slate-600"
                    placeholder={`Paste ${platform} Reel URL here...`}
                    value={links[cid] || ''}
                    onChange={e => setLinks({ ...links, [cid]: e.target.value })}
                  />
                  <div className="text-[9px] text-slate-500">
                    <span className="text-cyan-400">Note:</span> URL should contain @{handleInput || 'yourusername'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleVerifySubmit}
          disabled={isAnalyzing || selectedVerifyCampaigns.length === 0}
          className={`w-full py-7 rounded-[40px] font-black uppercase tracking-[0.4em] text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${
            selectedVerifyCampaigns.length === 0 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black hover:opacity-90'
          }`}
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              SUBMITTING...
            </>
          ) : (
            <>
              <FALLBACK_ICONS.Verify />
              SUBMIT FOR REVIEW
            </>
          )}
        </button>

        {/* Status Panel */}
        <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl">
          <p className="text-xs font-black text-white mb-2">Submission Status</p>
          <div className="text-[10px] text-slate-300 space-y-1">
            <div className="flex justify-between">
              <span>Selected Missions:</span>
              <span className="text-cyan-400">{selectedVerifyCampaigns.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform:</span>
              <span className="text-cyan-400">{platform === Platform.INSTAGRAM ? 'Instagram' : 'Facebook'}</span>
            </div>
            <div className="flex justify-between">
              <span>Username:</span>
              <span className="text-cyan-400">@{handleInput || 'none'}</span>
            </div>
            <div className="flex justify-between">
              <span>Auth Status:</span>
              <span className="text-green-400">Logged In</span>
            </div>
            {selectedVerifyCampaigns.length > 0 && (
              <div className="flex justify-between mt-2 pt-2 border-t border-white/10">
                <span className="font-bold">Total Payout:</span>
                <span className="text-lg font-black text-white">
                  ₹{selectedVerifyCampaigns.reduce((sum, cid) => {
                    const campaign = activeCampaigns.find(c => c.id === cid);
                    return sum + (campaign?.basicPay || 0);
                  }, 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Rules Info */}
        <div className="p-4 bg-black/30 border border-white/10 rounded-2xl">
          <p className="text-xs font-black text-amber-400 mb-2">Firestore Rules Active</p>
          <ul className="text-[10px] text-slate-400 space-y-1">
            <li>✓ User must be authenticated</li>
            <li>✓ submission.userId must equal auth.uid</li>
            <li>✓ Can only update pendingBalance field</li>
            <li>✓ Separate update for profile changes</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VerifyView;
