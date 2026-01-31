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

  // ✅ SIMPLE AI VERIFICATION WITHOUT MODEL ERRORS
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
      console.log('🔍 Checking URL with basic validation...');
      
      // Simple checks without calling Gemini API
      const urlLower = url.toLowerCase();
      const usernameLower = username.toLowerCase();
      
      // Basic validation
      let isValid = true;
      let reasons: string[] = [];
      let score = 40; // Default score for manual review
      
      // Check if URL contains username (basic check)
      if (!urlLower.includes(usernameLower) && !urlLower.includes(`@${usernameLower}`)) {
        reasons.push('Username not found in URL');
        score -= 10;
      }
      
      // Check if it's a reel URL
      if (platform === Platform.INSTAGRAM && !urlLower.includes('/reel/')) {
        reasons.push('Not an Instagram Reel URL');
        score -= 10;
      }
      
      if (platform === Platform.FACEBOOK && !urlLower.includes('/reel/') && !urlLower.includes('/video/')) {
        reasons.push('Not a Facebook Reel/Video URL');
        score -= 10;
      }
      
      const requiresReview = score < 35 || reasons.length > 0;
      
      return {
        success: true, // Always allow, but mark for review if needed
        message: requiresReview ? 
          `Manual review required: ${reasons.join(', ')}` : 
          'URL looks valid',
        score,
        requiresReview
      };
      
    } catch (error: any) {
      console.error('AI Verification error:', error);
      
      return {
        success: true, // Always allow, manual review
        message: 'Manual review required - AI service unavailable',
        score: 30,
        requiresReview: true
      };
    }
  };

  // ✅ MAIN SUBMISSION FUNCTION
  const handleVerifySubmit = async () => {
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
    setAnalysisStep('🚀 Starting verification...');

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

        setAnalysisStep(`📤 Processing: ${campaign.title}...`);

        // ✅ Basic AI Verification
        const aiResult = await performAIVerification(links[cid], campaign, cleanHandle);
        console.log(`AI Result for ${campaign.title}:`, aiResult);

        // Determine status - always pending for manual review
        const status = SubmissionStatus.PENDING;
        const requiresReview = true; // Always require review for security

        // Create submission document
        const submissionRef = doc(collection(db, 'submissions'));
        const submissionData = {
          // Required fields for Firestore rules
          userId: firebaseUser.uid,
          campaignId: cid,
          externalLink: links[cid],
          
          // Additional data
          username: currentUser.username || firebaseUser.displayName || 'User',
          email: currentUser.email || firebaseUser.email || '',
          socialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
          platform: platform,
          campaignTitle: campaign.title,
          rewardAmount: campaign.basicPay,
          status: status,
          aiVerified: false, // Manual review always
          aiScore: aiResult.score,
          aiMessage: aiResult.message,
          requiresManualReview: requiresReview,
          timestamp: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        batch.set(submissionRef, submissionData);
        submissions.push(submissionData);
        totalPayout += campaign.basicPay;
      }

      if (submissions.length === 0) {
        showToast('No valid submissions to process', 'error');
        setIsAnalyzing(false);
        return;
      }

      // ✅ Update user document - SINGLE UPDATE WITH ALLOWED FIELDS
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      
      // Get current user data
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const currentData = userDoc.data();
        const currentPending = currentData.pendingBalance || 0;
        
        // ✅ IMPORTANT: Update ALL fields in ONE operation (rules check exact match)
        batch.update(userDocRef, {
          pendingBalance: currentPending + totalPayout,
          savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
          updatedAt: serverTimestamp(),
          lastSubmissionAt: serverTimestamp()
          // DO NOT add any other fields here
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
      console.log('✅ Batch committed successfully');

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
        `✅ ${submissions.length} submission(s) received! ₹${totalPayout} added to pending balance. Manual review required.`,
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
        name: error.name,
        stack: error.stack
      });
      
      if (error.code === 'permission-denied') {
        showToast(
          'Firestore permission denied. Rules need to allow update of: pendingBalance, savedSocialUsername, updatedAt, lastSubmissionAt',
          'error'
        );
        
        // Show exact rules to update
        const rulesUpdate = `
🔥 UPDATE FIRESTORE RULES:

match /users/{userId} {
  allow update: if 
    // User can update specific fields together
    (isSameUser(userId) && 
     request.resource.data.diff(resource.data).affectedKeys().hasOnly([
       'pendingBalance', 'savedSocialUsername', 'updatedAt', 'lastSubmissionAt'
     ])) ||
    // Admin can update everything
    isAdmin();
}
        `;
        console.log(rulesUpdate);
        
      } else if (error.code === 'failed-precondition') {
        showToast(
          'Database error. Please try again.',
          'error'
        );
      } else {
        showToast(`Submission failed: ${error.message}`, 'error');
      }
    } finally {
      setIsAnalyzing(false);
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
      
      // Test write to _test collection
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
          Manual Review System
        </p>
        
        {/* Test Connection Button */}
        <button
          onClick={testFirebaseConnection}
          className="mt-4 mx-auto px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-black text-xs font-bold rounded-xl flex items-center gap-2 hover:opacity-90"
        >
          <Icons.Shield />
          Test Firebase Connection
        </button>
      </div>

      {/* Important Notice */}
      <div className="mx-4 p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <Icons.Warning />
          <p className="text-xs font-black text-green-400">IMPORTANT: Update Firestore Rules</p>
        </div>
        <p className="text-[10px] text-gray-300">
          Update rules to allow: pendingBalance, savedSocialUsername, updatedAt, lastSubmissionAt
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
          onClick={handleVerifySubmit}
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
              SUBMIT FOR MANUAL REVIEW
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
                ⚠️ All submissions require manual review
              </p>
            </div>
          </div>
        )}

        {/* Process Info */}
        <div className="p-4 bg-black/30 border border-white/10 rounded-2xl">
          <p className="text-xs font-black text-white mb-2 flex items-center gap-2">
            <Icons.Info />
            How It Works
          </p>
          <div className="text-[10px] text-gray-400 space-y-1">
            <div className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              <span>Submit your reel links</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              <span>Basic URL validation</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400">⚠</span>
              <span>Manual review by admin (24-48 hours)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              <span>Payment after approval</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyView;
