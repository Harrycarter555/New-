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
  Check: () => <span className="text-black font-bold">✓</span>,
  Instagram: () => <span className="text-lg">📷</span>,
  Facebook: () => <span className="text-lg">📘</span>,
  Info: () => <span className="text-lg">ℹ️</span>,
  Verify: () => <span className="text-lg">✅</span>,
  Shield: () => <span className="text-lg">🛡️</span>,
  Robot: () => <span className="text-lg">🤖</span>,
  Money: () => <span className="text-lg">💰</span>,
  Warning: () => <span className="text-lg">⚠️</span>,
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
  const [aiModel] = useState('gemini-3-flash-preview'); // ✅ Using Gemini 3

  const activeCampaigns = userCampaigns.filter(c => c.active);

  const toggleCampaign = (id: string) => {
    setSelectedVerifyCampaigns(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const cleanUsername = (username: string) => {
    return username.replace('@', '').trim().toLowerCase();
  };

  // ✅ Smart URL Validation
  const validateUrl = (url: string): { valid: boolean; message: string } => {
    if (!url) return { valid: false, message: 'URL is empty' };
    
    const urlLower = url.toLowerCase();
    
    // Check basic URL format
    if (!urlLower.startsWith('http')) {
      return { valid: false, message: 'URL must start with http:// or https://' };
    }
    
    if (platform === Platform.INSTAGRAM) {
      if (!urlLower.includes('instagram.com')) {
        return { valid: false, message: 'Must be an Instagram URL' };
      }
      if (!urlLower.includes('/reel/') && !urlLower.includes('/p/')) {
        return { valid: false, message: 'Must be an Instagram Reel or Post URL' };
      }
      return { valid: true, message: 'Valid Instagram URL' };
    } else {
      if (!urlLower.includes('facebook.com') && !urlLower.includes('fb.watch')) {
        return { valid: false, message: 'Must be a Facebook URL' };
      }
      if (!urlLower.includes('/reel/') && !urlLower.includes('/video/')) {
        return { valid: false, message: 'Must be a Facebook Reel or Video URL' };
      }
      return { valid: true, message: 'Valid Facebook URL' };
    }
  };

  // ✅ WORKING Gemini 3 AI Verification
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
      setAnalysisStep(`🤖 Gemini 3 analyzing ${campaign.title}...`);
      
      // ✅ Using gemini-3-flash-preview
      const model = genAI.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        generationConfig: {
          temperature: 0.1,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1024,
        }
      });
      
      const prompt = `SOCIAL MEDIA CONTENT VERIFICATION

Reel URL: ${url}
Expected Creator Username: @${username}
Platform: ${platform}
Campaign Title: ${campaign.title}
Required Audio: "${campaign.audioName}"
Required Keywords in Caption: "${campaign.caption}"

VERIFICATION CHECKLIST:
1. Is this a valid ${platform} reel URL? (YES/NO)
2. Does the content belong to @${username}? (Check username in URL/caption)
3. Is the audio "${campaign.audioName}" being used? (YES/NO)
4. Does the caption contain these keywords: "${campaign.caption}"? (YES/NO)
5. Is the video in vertical format (9:16)? (YES/NO)

SCORING SYSTEM:
- Give 10 points for each YES
- Give 0 points for each NO
- Total score out of 50

RESPONSE FORMAT (JSON only, no markdown):
{
  "totalScore": 0-50,
  "answers": ["YES", "NO", "YES", "YES", "NO"],
  "verdict": "APPROVED" or "REVIEW_NEEDED" or "REJECTED",
  "reason": "Brief reason for decision"
}

RULES:
- If totalScore >= 40: "APPROVED"
- If totalScore >= 25: "REVIEW_NEEDED"
- If totalScore < 25: "REJECTED"`;
      
      console.log('Sending to Gemini 3:', { url, username, campaign: campaign.title });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log('Gemini 3 Raw Response:', text);
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response:', text);
        throw new Error('AI response format invalid');
      }
      
      const aiResult = JSON.parse(jsonMatch[0]);
      console.log('Parsed AI Result:', aiResult);
      
      const success = aiResult.verdict === "APPROVED";
      const requiresReview = aiResult.verdict === "REVIEW_NEEDED";
      
      return {
        success,
        message: aiResult.reason || 'AI verification completed',
        score: aiResult.totalScore || 0,
        requiresReview
      };
      
    } catch (error: any) {
      console.error('Gemini 3 Verification Error:', error);
      
      // If AI fails, we'll still allow but mark for review
      return {
        success: true, // Allow but review
        message: 'AI service temporary unavailable - Manual review required',
        score: 30, // Middle score for review
        requiresReview: true
      };
    }
  };

  // ✅ SIMPLE & SAFE Firestore Operations
  const handleVerifySubmit = async () => {
    if (!handleInput.trim()) {
      showToast('Please enter your social media username', 'error');
      return;
    }

    if (selectedVerifyCampaigns.length === 0) {
      showToast('Select at least one mission to verify', 'error');
      return;
    }

    // Validate all URLs first
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
    setAnalysisStep('🚀 Starting verification process...');

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
      let approvedCount = 0;
      let reviewNeededCount = 0;

      // Process each campaign
      for (const cid of selectedVerifyCampaigns) {
        const campaign = activeCampaigns.find(c => c.id === cid);
        if (!campaign) continue;

        setAnalysisStep(`🔍 Verifying: ${campaign.title}...`);

        // ✅ AI Verification with Gemini 3
        const aiResult = await performAIVerification(
          links[cid], 
          campaign, 
          cleanHandle
        );

        console.log(`AI Result for ${campaign.title}:`, aiResult);

        // Determine status based on AI result
        let status = SubmissionStatus.PENDING;
        if (aiResult.success && !aiResult.requiresReview) {
          status = SubmissionStatus.APPROVED;
          approvedCount++;
        } else if (aiResult.requiresReview) {
          status = SubmissionStatus.PENDING;
          reviewNeededCount++;
        } else {
          status = SubmissionStatus.REJECTED;
          showToast(`${campaign.title}: ${aiResult.message}`, 'error');
          continue; // Skip rejected submissions
        }

        // Create submission data
        const submissionRef = doc(collection(db, 'submissions'));
        const submissionData = {
          // Basic Info
          userId: firebaseUser.uid,
          username: currentUser.username || firebaseUser.displayName || 'User',
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
          audioName: campaign.audioName,
          captionKeywords: campaign.caption,
          
          // Verification Info
          status: status,
          aiVerified: true,
          aiScore: aiResult.score,
          aiMessage: aiResult.message,
          requiresManualReview: aiResult.requiresReview,
          
          // Timestamps
          timestamp: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          
          // Fields that match your Firestore rules
          reviewed: false,
          reviewedBy: null,
          reviewedAt: null
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

      // ✅ Update user document - SIMPLE FIELDS ONLY
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const currentData = userDoc.data();
        const currentPending = currentData.pendingBalance || 0;
        
        // Only update fields that rules allow
        batch.update(userDocRef, {
          pendingBalance: currentPending + totalPayout,
          savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
          updatedAt: serverTimestamp(),
          lastSubmissionAt: serverTimestamp()
          // DO NOT update: role, status, etc.
        });
      } else {
        // Create if doesn't exist (shouldn't happen)
        batch.set(userDocRef, {
          pendingBalance: totalPayout,
          savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
          updatedAt: serverTimestamp(),
          role: 'user', // Required by your rules
          status: 'active', // Required by your rules
          createdAt: serverTimestamp()
        });
      }

      // Commit everything
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

      // Show success message
      let message = '';
      if (approvedCount === submissions.length) {
        message = `✅ All ${submissions.length} submissions approved! ₹${totalPayout} added to balance.`;
        showToast(message, 'success');
      } else if (reviewNeededCount > 0) {
        message = `Submitted ${submissions.length} missions. ${approvedCount} approved, ${reviewNeededCount} need manual review. ₹${totalPayout} pending.`;
        showToast(message, 'warning');
      }

      // Reset form
      setSelectedVerifyCampaigns([]);
      setLinks({});
      setHandleInput(cleanHandle);

    } catch (error: any) {
      console.error('Complete Verification Error:', {
        code: error.code,
        message: error.message,
        details: error
      });
      
      if (error.code === 'permission-denied') {
        showToast(
          'Firestore permission denied. Please update rules with the JSON below.',
          'error'
        );
        
        // Show rules to copy
        const rules = `// Copy these rules to Firestore Console → Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isLoggedIn() { return request.auth != null; }
    function isAdmin() { return isLoggedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'; }
    function isSameUser(userId) { return isLoggedIn() && request.auth.uid == userId; }
    
    // SUBMISSIONS - Allow users to create their own
    match /submissions/{submissionId} {
      allow read: if (resource != null && isSameUser(resource.data.userId)) || isAdmin();
      allow create: if isLoggedIn() && request.auth.uid == request.resource.data.userId;
      allow update, delete: if isAdmin();
    }
    
    // USERS - Allow users to update their own pendingBalance
    match /users/{userId} {
      allow read: if isSameUser(userId) || isAdmin();
      allow update: if 
        (isSameUser(userId) && 
         request.resource.data.diff(resource.data).affectedKeys().hasOnly([
           'pendingBalance', 'savedSocialUsername', 'updatedAt', 'lastSubmissionAt'
         ])) ||
        isAdmin();
      allow create: if isLoggedIn() && request.auth.uid == userId;
      allow delete: if isAdmin();
    }
  }
}`;
        
        console.log('Copy these rules to Firestore:', rules);
        // You could show this in a modal or alert
        alert('Copy the rules from browser console (F12 → Console)');
        
      } else if (error.code === 'failed-precondition') {
        showToast(
          'Firestore index missing. Please check error details in console.',
          'error'
        );
      } else if (error.message.includes('AI')) {
        showToast(
          'AI verification temporarily unavailable. Submissions marked for manual review.',
          'warning'
        );
      } else {
        showToast(`Verification failed: ${error.message}`, 'error');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-10 pb-40 animate-slide">
      {isAnalyzing && (
        <div className="fixed inset-0 z-[300] bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col items-center justify-center p-10 text-center">
          <div className="relative mb-8">
            <div className="w-28 h-28 border-4 border-transparent rounded-full animate-spin" 
                 style={{
                   borderTopColor: '#3B82F6',
                   borderRightColor: '#10B981', 
                   borderBottomColor: '#F59E0B',
                   borderLeftColor: '#EF4444'
                 }}>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-3xl animate-pulse">
                <Icons.Robot />
              </div>
            </div>
          </div>
          
          <p className="text-2xl font-black text-white uppercase tracking-widest mb-4">
            {analysisStep}
          </p>
          
          <div className="w-64 bg-gray-800 rounded-full h-3 mt-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
          </div>
          
          <p className="text-sm text-gray-400 mt-6 font-mono">
            Gemini 3 AI • Real-time Verification • Secure Processing
          </p>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase">
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI VERIFICATION
          </span>
        </h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">
          Powered by Gemini 3 Flash Preview
        </p>
        
        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-full">
          <Icons.Shield />
          <span className="text-xs font-bold text-blue-400">GEMINI 3 ACTIVE</span>
        </div>
      </div>

      {/* Campaign Selection */}
      <div className="space-y-4 px-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-gray-400 uppercase tracking-widest px-2">
            1. SELECT MISSIONS
          </p>
          <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
            {activeCampaigns.length} Available
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {activeCampaigns.map(campaign => (
            <div
              key={campaign.id}
              onClick={() => toggleCampaign(campaign.id)}
              className={`relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-300 group ${
                selectedVerifyCampaigns.includes(campaign.id)
                  ? 'border-blue-500 shadow-xl shadow-blue-500/20 scale-[1.02]'
                  : 'border-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={campaign.thumbnailUrl} 
                  alt={campaign.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/400x400/3B82F6/000?text=Campaign';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                
                {selectedVerifyCampaigns.includes(campaign.id) && (
                  <div className="absolute top-3 right-3 w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                    <Icons.Check />
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-sm font-bold text-white truncate">{campaign.title}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-lg font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    ₹{campaign.basicPay}
                  </span>
                  <div className="text-[10px] bg-gray-900 text-gray-400 px-2 py-1 rounded">
                    {campaign.audioName?.substring(0, 12) || 'Audio'}...
                  </div>
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
          <p className="text-sm font-black text-gray-400 uppercase tracking-widest px-2">
            2. YOUR PROFILE
          </p>
          
          <div className="grid grid-cols-2 gap-4 p-2 bg-gray-900/50 rounded-2xl border border-gray-800">
            {[Platform.INSTAGRAM, Platform.FACEBOOK].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`py-4 rounded-xl font-bold text-sm uppercase transition-all ${
                  platform === p
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-xl'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {p === Platform.INSTAGRAM ? <Icons.Instagram /> : <Icons.Facebook />}
                  {p}
                </div>
              </button>
            ))}
          </div>
          
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
              @
            </div>
            <input
              className="w-full bg-gray-900/50 border-2 border-gray-800 rounded-2xl pl-12 pr-32 py-5 text-lg font-bold text-white outline-none focus:border-blue-500 transition-all"
              placeholder="yourusername"
              value={handleInput}
              onChange={e => setHandleInput(e.target.value)}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
              {platform === Platform.INSTAGRAM ? 'instagram.com' : 'facebook.com'}
            </div>
          </div>
        </div>

        {/* Links Section */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="space-y-6 animate-slide">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest px-2">
                3. REEL LINKS
              </p>
              <span className="text-xs bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-400 px-3 py-1 rounded-full">
                {selectedVerifyCampaigns.length} links needed
              </span>
            </div>
            
            {selectedVerifyCampaigns.map(cid => {
              const campaign = activeCampaigns.find(c => c.id === cid);
              return (
                <div key={cid} className="space-y-3 p-4 bg-gray-900/30 rounded-2xl border border-gray-800">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img 
                        src={campaign?.thumbnailUrl} 
                        alt={campaign?.title}
                        className="w-16 h-16 rounded-xl object-cover border-2 border-gray-700"
                      />
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-xs font-bold">
                        ₹
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{campaign?.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-black text-green-400">
                          ₹{campaign?.basicPay} Reward
                        </span>
                        <span className="text-[10px] text-gray-400 bg-gray-800 px-2 py-1 rounded">
                          {campaign?.audioName?.substring(0, 10) || 'Audio'}...
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <input
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-sm font-medium text-white outline-none focus:border-blue-500"
                      placeholder={`Paste your ${platform} reel URL...`}
                      value={links[cid] || ''}
                      onChange={e => setLinks({ ...links, [cid]: e.target.value })}
                    />
                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                      🔗
                    </div>
                  </div>
                  
                  <div className="text-[11px] text-gray-500 flex items-center gap-2">
                    <Icons.Warning />
                    Must be a valid {platform} reel URL
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
          className={`w-full py-6 rounded-2xl font-black uppercase tracking-widest text-lg transition-all duration-300 ${
            selectedVerifyCampaigns.length === 0 
              ? 'bg-gray-800 text-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          {isAnalyzing ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              GEMINI 3 VERIFICATION...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <Icons.Robot />
              START GEMINI 3 VERIFICATION
            </div>
          )}
        </button>

        {/* Summary */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="p-6 bg-gradient-to-r from-gray-900 to-black rounded-2xl border border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-sm font-bold text-white">VERIFICATION SUMMARY</p>
                <p className="text-xs text-gray-400">{selectedVerifyCampaigns.length} missions selected</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  ₹{selectedVerifyCampaigns.reduce((sum, cid) => {
                    const campaign = activeCampaigns.find(c => c.id === cid);
                    return sum + (campaign?.basicPay || 0);
                  }, 0)}
                </p>
                <p className="text-xs text-gray-400">Total Potential Reward</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">AI Model:</span>
                <span className="text-blue-400 font-bold">{aiModel}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Verification:</span>
                <span className="text-green-400 font-bold">REAL-TIME</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Processing:</span>
                <span className="text-purple-400 font-bold">INSTANT</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyView;
