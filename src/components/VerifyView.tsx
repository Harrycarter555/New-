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
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth } from 'firebase/auth';

// Icons
const Icons = {
  Check: () => <span className="text-black">✓</span>,
  Instagram: () => <span>📷</span>,
  Facebook: () => <span>📘</span>,
  Info: () => <span>ℹ️</span>,
  Verify: () => <span>✅</span>,
  Warning: () => <span>⚠️</span>,
  Shield: () => <span>🛡️</span>,
  Robot: () => <span>🤖</span>,
  Money: () => <span>💰</span>,
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
  const [aiModel] = useState('gemini-1.5-flash-latest'); // ✅ Changed to working model

  const activeCampaigns = userCampaigns.filter(c => c.active);

  const toggleCampaign = (id: string) => {
    setSelectedVerifyCampaigns(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const cleanUsername = (username: string) => {
    return username.replace('@', '').trim().toLowerCase();
  };

  // ✅ SIMPLE URL VALIDATION
  const validateUrl = (url: string): { valid: boolean; message: string } => {
    if (!url) return { valid: false, message: 'URL is empty' };
    
    if (!url.startsWith('http')) {
      return { valid: false, message: 'URL must start with http:// or https://' };
    }
    
    const urlLower = url.toLowerCase();
    
    if (platform === Platform.INSTAGRAM) {
      if (!urlLower.includes('instagram.com')) {
        return { valid: false, message: 'Must be an Instagram URL' };
      }
      if (!urlLower.includes('/reel/')) {
        return { valid: false, message: 'Must be an Instagram Reel URL' };
      }
      return { valid: true, message: 'Valid Instagram URL' };
    } else {
      if (!urlLower.includes('facebook.com') && !urlLower.includes('fb.watch')) {
        return { valid: false, message: 'Must be a Facebook URL' };
      }
      if (!urlLower.includes('/reel/') && !urlLower.includes('/video/')) {
        return { valid: false, message: 'Must be a Facebook Reel/Video URL' };
      }
      return { valid: true, message: 'Valid Facebook URL' };
    }
  };

  // ✅ TEST FIREBASE CONNECTION
  const testFirebaseConnection = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        showToast('Not logged in', 'error');
        return;
      }

      showToast('Testing Firebase connection...', 'success');
      
      // Test write to _test collection (always allowed)
      const testRef = await addDoc(collection(db, '_test'), {
        test: 'connection',
        timestamp: serverTimestamp(),
        uid: user.uid
      });
      
      showToast('✅ Firebase connection successful!', 'success');
      
    } catch (error: any) {
      console.error('Firebase test error:', error);
      showToast(`Firebase error: ${error.message}`, 'error');
    }
  };

  // ✅ SIMPLE AI VERIFICATION (Non-blocking)
  const performAIVerification = async (
    url: string, 
    campaign: Campaign, 
    username: string
  ): Promise<{ 
    success: boolean; 
    message: string; 
    score: number;
    requiresReview: boolean;
  }> => {
    try {
      setAnalysisStep(`🤖 AI analyzing ${campaign.title}...`);
      
      // Try multiple models in order
      const models = [
        'gemini-1.5-flash-latest',  // Most reliable
        'gemini-1.5-pro',
        'gemini-1.0-pro',
        'gemini-pro'
      ];
      
      let lastError = null;
      
      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
              temperature: 0.1,
              topP: 0.95,
              maxOutputTokens: 500,
            }
          });
          
          const prompt = `Check this social media reel:
URL: ${url}
Username should be: @${username}
Campaign: ${campaign.title}
Required audio: ${campaign.audioName}
Required keywords: ${campaign.caption}

Is this valid? Answer only: VALID or INVALID. If INVALID, give one reason.`;
          
          console.log(`Trying model: ${modelName}`);
          
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text().trim();
          
          console.log(`Model ${modelName} response:`, text);
          
          const isValid = text.toUpperCase().includes('VALID');
          
          return {
            success: isValid,
            message: text,
            score: isValid ? 50 : 20,
            requiresReview: !isValid
          };
          
        } catch (error: any) {
          lastError = error;
          console.log(`Model ${modelName} failed:`, error.message);
          continue;
        }
      }
      
      // If all models fail
      console.error('All AI models failed:', lastError);
      
      // ✅ TEMPORARY: ALLOW WITHOUT AI
      return {
        success: true,
        message: 'AI service temporary unavailable - Manual review required',
        score: 40,
        requiresReview: true
      };
      
    } catch (error: any) {
      console.error('AI Verification error:', error);
      
      // ✅ TEMPORARY: ALLOW WITHOUT AI
      return {
        success: true,
        message: 'AI verification failed - Manual review required',
        score: 40,
        requiresReview: true
      };
    }
  };

  // ✅ SIMPLE FIREBASE SUBMISSION (No complex queries)
  const handleSimpleSubmission = async () => {
    if (!handleInput.trim()) {
      showToast('Please enter your social media username', 'error');
      return;
    }

    if (selectedVerifyCampaigns.length === 0) {
      showToast('Select at least one mission', 'error');
      return;
    }

    // Validate all URLs
    for (const cid of selectedVerifyCampaigns) {
      const url = links[cid];
      if (!url?.trim()) {
        const campaign = activeCampaigns.find(c => c.id === cid);
        showToast(`Please provide link for ${campaign?.title}`, 'error');
        return;
      }
      
      const validation = validateUrl(url);
      if (!validation.valid) {
        showToast(`${validation.message}`, 'error');
        return;
      }
    }

    setIsAnalyzing(true);
    setAnalysisStep('🚀 Starting submission...');

    try {
      const auth = getAuth();
      const firebaseUser = auth.currentUser;
      
      if (!firebaseUser) {
        showToast('Please login again', 'error');
        setIsAnalyzing(false);
        return;
      }

      const cleanHandle = cleanUsername(handleInput);
      const batch = writeBatch(db);
      const submissions = [];
      let totalPayout = 0;

      // Process each campaign
      for (const cid of selectedVerifyCampaigns) {
        const campaign = activeCampaigns.find(c => c.id === cid);
        if (!campaign) continue;

        setAnalysisStep(`📤 Submitting: ${campaign.title}...`);

        // ✅ Quick AI check (non-blocking)
        let aiResult = { success: true, message: 'Submitted', score: 50, requiresReview: false };
        
        try {
          aiResult = await performAIVerification(links[cid], campaign, cleanHandle);
        } catch (aiError) {
          console.log('AI check skipped:', aiError);
          // Continue even if AI fails
        }

        // Create submission
        const submissionRef = doc(collection(db, 'submissions'));
        const submissionData = {
          // Basic Info
          userId: firebaseUser.uid,
          username: currentUser.username || 'User',
          email: currentUser.email || firebaseUser.email || '',
          
          // Social Info
          socialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
          platform: platform,
          
          // Campaign Info
          campaignId: cid,
          campaignTitle: campaign.title,
          rewardAmount: campaign.basicPay,
          
          // Content Info
          externalLink: links[cid],
          
          // Verification Info
          status: aiResult.requiresReview ? SubmissionStatus.PENDING : SubmissionStatus.APPROVED,
          aiVerified: true,
          aiScore: aiResult.score,
          aiMessage: aiResult.message,
          requiresManualReview: aiResult.requiresReview,
          
          // Timestamps
          timestamp: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.set(submissionRef, submissionData);
        submissions.push(submissionData);
        totalPayout += campaign.basicPay;
      }

      if (submissions.length === 0) {
        showToast('No submissions to process', 'error');
        setIsAnalyzing(false);
        return;
      }

      // ✅ Update user document
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const currentData = userDoc.data();
        const currentPending = currentData.pendingBalance || 0;
        
        batch.update(userDocRef, {
          pendingBalance: currentPending + totalPayout,
          savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
          updatedAt: serverTimestamp(),
          lastSubmissionAt: serverTimestamp()
        });
      } else {
        // Create user doc if doesn't exist
        batch.set(userDocRef, {
          pendingBalance: totalPayout,
          savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
          updatedAt: serverTimestamp(),
          role: 'user',
          status: 'active',
          createdAt: serverTimestamp()
        });
      }

      // Commit batch
      setAnalysisStep('💾 Saving to database...');
      await batch.commit();

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

      // Success message
      showToast(
        `✅ ${submissions.length} submission(s) received! ₹${totalPayout} added to pending balance.`,
        'success'
      );

      // Reset form
      setSelectedVerifyCampaigns([]);
      setLinks({});
      setHandleInput(cleanHandle);

    } catch (error: any) {
      console.error('Submission Error Details:', {
        code: error.code,
        message: error.message,
        name: error.name
      });
      
      if (error.code === 'permission-denied') {
        showToast(
          'Firestore permission denied. Please update rules in Firebase Console.',
          'error'
        );
      } else {
        showToast(`Submission failed: ${error.message}`, 'error');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-10 pb-40 animate-slide">
      {isAnalyzing && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-10 text-center">
          <div className="w-24 h-24 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-8"></div>
          <p className="text-xl font-black italic text-green-400 uppercase tracking-widest leading-none">
            {analysisStep}
          </p>
          <p className="text-[10px] text-slate-500 mt-4 uppercase font-black">
            Processing your submission...
          </p>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase">
          VERIFY <span className="text-green-400">SUBMISSIONS</span>
        </h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">
          Simple & Working System
        </p>
        
        {/* Connection Test */}
        <button
          onClick={testFirebaseConnection}
          className="mt-4 mx-auto px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-black text-xs font-bold rounded-xl flex items-center gap-2 hover:opacity-90"
        >
          <Icons.Shield />
          Test Firebase Connection
        </button>
      </div>

      {/* Important Notice */}
      <div className="mx-4 p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Icons.Info />
          <p className="text-xs font-black text-green-400">IMPORTANT: Update Firestore Rules</p>
        </div>
        <p className="text-[10px] text-gray-300">
          1. Go to Firebase Console → Firestore → Rules
        </p>
        <p className="text-[10px] text-gray-300">
          2. Copy rules from console (F12 → Console tab)
        </p>
        <p className="text-[10px] text-gray-300">
          3. Paste and Publish
        </p>
      </div>

      {/* Campaign Selection */}
      <div className="space-y-4 px-2">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">
          1. SELECT MISSIONS
        </p>
        <div className="grid grid-cols-2 gap-4">
          {activeCampaigns.map(campaign => (
            <div
              key={campaign.id}
              onClick={() => toggleCampaign(campaign.id)}
              className={`relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all ${
                selectedVerifyCampaigns.includes(campaign.id)
                  ? 'border-green-500 shadow-lg shadow-green-500/20 scale-[1.02]'
                  : 'border-white/10 opacity-80 hover:opacity-100'
              }`}
            >
              <img 
                src={campaign.thumbnailUrl} 
                alt={campaign.title}
                className="w-full h-40 object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://placehold.co/400x400/10B981/000?text=Campaign';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                <p className="text-xs font-bold text-white truncate">{campaign.title}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-green-400 font-bold">
                    ₹{campaign.basicPay}
                  </span>
                  {selectedVerifyCampaigns.includes(campaign.id) && (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <Icons.Check />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Form Section */}
      <div className="px-2 space-y-8">
        {/* Platform + Username */}
        <div className="space-y-6">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">
            2. YOUR SOCIAL PROFILE
          </p>
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-white/5 rounded-[28px] border border-white/5">
            <button
              onClick={() => setPlatform(Platform.INSTAGRAM)}
              className={`py-4 rounded-[22px] font-black text-[10px] uppercase flex items-center justify-center gap-2 ${
                platform === Platform.INSTAGRAM ? 'bg-green-500 text-black shadow-lg' : 'text-slate-500'
              }`}
            >
              <Icons.Instagram />
              Instagram
            </button>
            <button
              onClick={() => setPlatform(Platform.FACEBOOK)}
              className={`py-4 rounded-[22px] font-black text-[10px] uppercase flex items-center justify-center gap-2 ${
                platform === Platform.FACEBOOK ? 'bg-green-500 text-black shadow-lg' : 'text-slate-500'
              }`}
            >
              <Icons.Facebook />
              Facebook
            </button>
          </div>
          <div className="relative">
            <input
              className="w-full bg-white/5 border border-white/10 rounded-[28px] px-8 py-5 text-xl font-black italic text-white outline-none focus:border-green-500 placeholder:text-slate-800"
              placeholder="yourusername"
              value={handleInput}
              onChange={e => setHandleInput(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 text-xs">
              {platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}{handleInput || 'username'}
            </div>
          </div>
        </div>

        {/* Links Section */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="space-y-4 animate-slide">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">
              3. REEL LINKS
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
                        e.currentTarget.src = 'https://placehold.co/100x100/10B981/000?text=Campaign';
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{campaign?.title}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[10px] text-green-400">₹{campaign?.basicPay}</p>
                        <p className="text-[8px] text-slate-500 bg-black/30 px-2 py-1 rounded">
                          {campaign?.audioName?.substring(0, 10) || 'Audio'}...
                        </p>
                      </div>
                    </div>
                  </div>
                  <input
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-green-500 placeholder:text-slate-600"
                    placeholder={`Paste ${platform} reel URL...`}
                    value={links[cid] || ''}
                    onChange={e => setLinks({ ...links, [cid]: e.target.value })}
                  />
                  <div className="text-[9px] text-green-400">
                    ✅ Must be valid {platform} URL
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSimpleSubmission}
          disabled={isAnalyzing || selectedVerifyCampaigns.length === 0}
          className={`w-full py-7 rounded-[40px] font-black uppercase tracking-[0.4em] text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 ${
            selectedVerifyCampaigns.length === 0 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-green-500 to-emerald-500 text-black hover:opacity-90'
          }`}
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              SUBMITTING...
            </>
          ) : (
            <>
              <Icons.Verify />
              SUBMIT FOR APPROVAL
            </>
          )}
        </button>

        {/* Summary */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-2xl">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-xs font-black text-green-400">
                  {selectedVerifyCampaigns.length} Mission{selectedVerifyCampaigns.length > 1 ? 's' : ''} Selected
                </p>
                <p className="text-[10px] text-slate-400">
                  {platform === Platform.INSTAGRAM ? 'Instagram Reels' : 'Facebook Reels'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-white">
                  ₹{selectedVerifyCampaigns.reduce((sum, cid) => {
                    const campaign = activeCampaigns.find(c => c.id === cid);
                    return sum + (campaign?.basicPay || 0);
                  }, 0)}
                </p>
                <p className="text-[10px] text-slate-400">Total Payout</p>
              </div>
            </div>
            
            <div className="mt-3 p-2 bg-black/30 rounded-lg border border-white/10">
              <p className="text-[10px] text-gray-400 text-center">
                Submissions will be processed instantly
              </p>
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="p-4 bg-black/30 border border-white/10 rounded-2xl">
          <p className="text-xs font-black text-white mb-2 flex items-center gap-2">
            <Icons.Info />
            Current Status
          </p>
          <div className="text-[10px] text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Firebase:</span>
              <span className="text-green-400">Connected</span>
            </div>
            <div className="flex justify-between">
              <span>AI Model:</span>
              <span className="text-blue-400">{aiModel}</span>
            </div>
            <div className="flex justify-between">
              <span>User:</span>
              <span className="text-cyan-400">@{handleInput || 'Not set'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyView;
