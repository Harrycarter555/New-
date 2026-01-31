// src/components/VerifyView.tsx
import React, { useState, useRef } from 'react';
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
  setDoc,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth } from 'firebase/auth';
import html2canvas from 'html2canvas';

// Professional Icons
const ProfessionalIcons = {
  Check: () => <span className="text-black font-bold">✓</span>,
  Instagram: () => <span className="text-xl">📷</span>,
  Facebook: () => <span className="text-xl">📘</span>,
  Warning: () => <span className="text-xl">⚠️</span>,
  Lock: () => <span className="text-xl">🔒</span>,
  Shield: () => <span className="text-xl">🛡️</span>,
  Robot: () => <span className="text-xl">🤖</span>,
  Money: () => <span className="text-xl">💰</span>,
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
  const [verificationScore, setVerificationScore] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);

  const activeCampaigns = userCampaigns.filter(c => c.active);

  const toggleCampaign = (id: string) => {
    setSelectedVerifyCampaigns(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // ============ PROFESSIONAL VALIDATION FUNCTIONS ============
  
  const validateUrlStructure = (url: string): boolean => {
    const instagramPattern = /^(https?:\/\/)?(www\.)?instagram\.com\/(reel|p)\/[A-Za-z0-9_-]+\/?(\?.*)?$/;
    const facebookPattern = /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch)\/(reel|video)\/[A-Za-z0-9_.-]+\/?$/;
    
    return platform === Platform.INSTAGRAM 
      ? instagramPattern.test(url)
      : facebookPattern.test(url);
  };

  const extractUsernameFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (platform === Platform.INSTAGRAM && pathParts[0] === 'reel') {
        // Instagram: /reel/{id} - username might be in referrer or metadata
        return null; // Need to check caption via AI
      } else if (platform === Platform.FACEBOOK && (pathParts[0] === 'reel' || pathParts[0] === 'video')) {
        // Facebook similar
        return null;
      }
      return pathParts[0]?.replace('@', '') || null;
    } catch {
      return null;
    }
  };

  const checkRecentSubmissions = async (userId: string, campaignId: string): Promise<boolean> => {
    try {
      // Check if user already submitted for this campaign recently
      const submissionsRef = collection(db, 'submissions');
      const { getDocs, query, where, orderBy, limit } = await import('firebase/firestore');
      const q = query(
        submissionsRef,
        where('userId', '==', userId),
        where('campaignId', '==', campaignId),
        where('timestamp', '>', Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        orderBy('timestamp', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      return snapshot.empty; // Return true if no recent submission
    } catch (error) {
      console.error('Error checking recent submissions:', error);
      return true; // Allow if check fails
    }
  };

  const performAIVerification = async (url: string, campaign: Campaign, username: string): Promise<{
    success: boolean;
    score: number;
    reasons: string[];
    confidence: number;
  }> => {
    try {
      // Use Gemini AI for verification
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
PROFESSIONAL SOCIAL MEDIA VERIFICATION SYSTEM

TASK: Verify if the Instagram/Facebook Reel meets all campaign requirements

REEL URL: ${url}
CAMPAIGN: ${campaign.title}
REQUIRED AUDIO: ${campaign.audioName}
REQUIRED KEYWORDS: ${campaign.caption}
EXPECTED USERNAME: @${username}
PLATFORM: ${platform}

VERIFICATION CRITERIA (Score each 0-10):
1. URL VALIDITY: Is this a valid ${platform} reel URL? (0 or 10)
2. USERNAME MATCH: Does the reel belong to @${username}? (0-10)
3. AUDIO CHECK: Is the correct audio "${campaign.audioName}" used? (0-10)
4. KEYWORDS PRESENCE: Does caption contain "${campaign.caption}"? (0-10)
5. FORMAT CHECK: Is video vertical (9:16)? (0 or 10)

SCORING SYSTEM:
- 0-20: REJECT (Fraud suspected)
- 21-40: MANUAL REVIEW NEEDED
- 41-50: APPROVED

RESPONSE FORMAT (JSON only):
{
  "totalScore": 0-50,
  "individualScores": [10, 8, 10, 7, 10],
  "confidence": 0-100,
  "verdict": "APPROVED" | "MANUAL_REVIEW" | "REJECTED",
  "reasons": ["string", "string"]
}

IMPORTANT: If URL is fake or username doesn't match, give 0 score.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI returned invalid format');
      }
      
      const verificationResult = JSON.parse(jsonMatch[0]);
      return {
        success: verificationResult.verdict === "APPROVED",
        score: verificationResult.totalScore,
        reasons: verificationResult.reasons || [],
        confidence: verificationResult.confidence || 0
      };
      
    } catch (error) {
      console.error('AI Verification failed:', error);
      return {
        success: false,
        score: 0,
        reasons: ['AI verification failed'],
        confidence: 0
      };
    }
  };

  const captureFraudDetectionData = async () => {
    const detectionData = {
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      // Add more fingerprinting data as needed
    };
    return detectionData;
  };

  const handleProfessionalVerification = async () => {
    if (!handleInput.trim()) {
      showToast('Please enter your social media username', 'error');
      return;
    }

    if (selectedVerifyCampaigns.length === 0) {
      showToast('Select at least one mission to verify', 'error');
      return;
    }

    // Check all links
    for (const cid of selectedVerifyCampaigns) {
      if (!links[cid]?.trim()) {
        const campaign = activeCampaigns.find(c => c.id === cid);
        showToast(`Please provide link for ${campaign?.title}`, 'error');
        return;
      }
    }

    setIsAnalyzing(true);
    setAnalysisStep('🛡️ INITIATING SECURITY CHECK...');
    setVerificationScore(0);

    try {
      const auth = getAuth();
      const firebaseUser = auth.currentUser;
      
      if (!firebaseUser) {
        showToast('Authentication required. Please login again.', 'error');
        setIsAnalyzing(false);
        return;
      }

      // ============ STEP 1: BASIC VALIDATION ============
      setAnalysisStep('🔍 VALIDATING URL STRUCTURE...');
      
      const cleanHandle = handleInput.toLowerCase().replace('@', '').trim();
      let totalScore = 0;
      const allVerificationResults = [];

      // ============ STEP 2: AI VERIFICATION FOR EACH CAMPAIGN ============
      for (const cid of selectedVerifyCampaigns) {
        const campaign = activeCampaigns.find(c => c.id === cid);
        if (!campaign) continue;

        setAnalysisStep(`🤖 AI VERIFICATION: ${campaign.title}...`);

        // Check for recent submissions
        const canSubmit = await checkRecentSubmissions(firebaseUser.uid, cid);
        if (!canSubmit) {
          showToast(`You've already submitted for ${campaign.title} recently`, 'error');
          setIsAnalyzing(false);
          return;
        }

        // URL structure validation
        if (!validateUrlStructure(links[cid])) {
          showToast(`Invalid ${platform} URL format for ${campaign.title}`, 'error');
          setIsAnalyzing(false);
          return;
        }

        // AI Verification
        const aiResult = await performAIVerification(links[cid], campaign, cleanHandle);
        allVerificationResults.push({
          campaignId: cid,
          campaignTitle: campaign.title,
          ...aiResult
        });

        totalScore += aiResult.score;

        if (!aiResult.success) {
          // If AI rejects, show specific reasons
          showToast(
            `${campaign.title}: ${aiResult.reasons.join(', ')} (Score: ${aiResult.score}/50)`,
            'error'
          );
          setIsAnalyzing(false);
          return;
        }

        // Update score display
        setVerificationScore(Math.round((totalScore / (selectedVerifyCampaigns.length * 50)) * 100));
      }

      // ============ STEP 3: FRAUD DETECTION ============
      setAnalysisStep('🔐 RUNNING FRAUD DETECTION...');
      
      const fraudData = await captureFraudDetectionData();
      const avgScore = totalScore / selectedVerifyCampaigns.length;
      
      // Score thresholds
      if (avgScore < 20) {
        showToast('❌ Submission rejected: Low verification score', 'error');
        setIsAnalyzing(false);
        return;
      } else if (avgScore < 40) {
        showToast('⚠️ Manual review required due to moderate score', 'warning');
        // Continue but flag for review
      }

      // ============ STEP 4: SAVE TO FIRESTORE ============
      setAnalysisStep('💾 SAVING VERIFIED SUBMISSIONS...');
      
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data();
        let totalPayout = 0;

        // Create submissions and update balance
        for (const result of allVerificationResults) {
          const campaign = activeCampaigns.find(c => c.id === result.campaignId);
          if (!campaign) continue;

          // Create submission document
          const submissionRef = doc(collection(db, 'submissions'));
          transaction.set(submissionRef, {
            userId: firebaseUser.uid,
            username: currentUser.username,
            email: currentUser.email || firebaseUser.email,
            socialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
            campaignId: result.campaignId,
            campaignTitle: campaign.title,
            platform,
            status: result.score >= 40 ? SubmissionStatus.APPROVED : SubmissionStatus.PENDING,
            timestamp: Date.now(),
            rewardAmount: campaign.basicPay,
            externalLink: links[result.campaignId],
            isViralBonus: false,
            aiVerificationScore: result.score,
            aiVerificationReasons: result.reasons,
            aiConfidence: result.confidence,
            fraudDetectionData: fraudData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            requiresManualReview: result.score < 40
          });

          // Add to total payout
          totalPayout += campaign.basicPay;
        }

        // Update user's pending balance
        const currentBalance = userData.pendingBalance || 0;
        transaction.update(userRef, {
          pendingBalance: currentBalance + totalPayout,
          savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
          totalSubmissions: (userData.totalSubmissions || 0) + allVerificationResults.length,
          verificationScore: avgScore,
          lastVerifiedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // ============ STEP 5: UPDATE LOCAL STATE ============
      const totalPayout = allVerificationResults.reduce((sum, result) => {
        const campaign = activeCampaigns.find(c => c.id === result.campaignId);
        return sum + (campaign?.basicPay || 0);
      }, 0);

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

      // ============ STEP 6: SHOW RESULTS ============
      const approvedCount = allVerificationResults.filter(r => r.score >= 40).length;
      const needsReviewCount = allVerificationResults.length - approvedCount;

      if (needsReviewCount > 0) {
        showToast(
          `✅ ${approvedCount} approved, ${needsReviewCount} need manual review. ₹${totalPayout} pending.`,
          'warning'
        );
      } else {
        showToast(
          `✅ All ${allVerificationResults.length} submissions verified! ₹${totalPayout} added to balance.`,
          'success'
        );
      }

      // Reset form
      setSelectedVerifyCampaigns([]);
      setLinks({});
      setHandleInput(cleanHandle);
      setVerificationScore(0);

    } catch (error: any) {
      console.error('Professional verification failed:', error);
      
      if (error.code === 'permission-denied') {
        showToast('Database permission denied. Please contact admin.', 'error');
      } else if (error.message.includes('AI')) {
        showToast('AI verification service temporarily unavailable. Try manual submission.', 'error');
      } else {
        showToast(`Verification failed: ${error.message}`, 'error');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ============ RENDER COMPONENT ============
  return (
    <div className="space-y-10 pb-40 animate-slide" ref={formRef}>
      {/* Loading Overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[300] bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center p-10 text-center">
          <div className="relative mb-10">
            <div className="w-32 h-32 border-4 border-transparent rounded-full animate-spin" 
                 style={{borderTopColor: '#3B82F6', borderRightColor: '#10B981', borderBottomColor: '#F59E0B', borderLeftColor: '#EF4444'}}>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <ProfessionalIcons.Robot />
            </div>
          </div>
          
          <p className="text-2xl font-black italic text-white uppercase tracking-widest leading-none mb-4">
            {analysisStep}
          </p>
          
          {verificationScore > 0 && (
            <div className="w-64 bg-gray-800 rounded-full h-4 mt-6 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-500"
                style={{ width: `${verificationScore}%` }}
              ></div>
            </div>
          )}
          
          <p className="text-sm text-gray-400 mt-6 font-mono">
            AI Verification • Fraud Detection • Multi-layer Security
          </p>
        </div>
      )}

      {/* Header */}
      <div className="text-center">
        <h2 className="text-5xl font-black italic tracking-tighter text-white uppercase">
          <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            PROFESSIONAL VERIFICATION
          </span>
        </h2>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">
          AI-Powered • Multi-layer Security • Instant Results
        </p>
        
        {/* Security Badge */}
        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-gradient-to-r from-gray-900 to-black border border-gray-700 rounded-full">
          <ProfessionalIcons.Shield />
          <span className="text-xs font-bold text-green-400">SECURE VERIFICATION ACTIVE</span>
        </div>
      </div>

      {/* Campaign Selection */}
      <div className="space-y-4 px-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-black text-gray-400 uppercase tracking-widest px-2">
            STEP 1: SELECT MISSIONS
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
                  ? 'border-gradient-to-r from-blue-500 to-purple-500 shadow-xl shadow-blue-500/20'
                  : 'border-gray-800 hover:border-gray-600'
              }`}
            >
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={campaign.thumbnailUrl} 
                  alt={campaign.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                
                {selectedVerifyCampaigns.includes(campaign.id) && (
                  <div className="absolute top-3 right-3 w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                    <ProfessionalIcons.Check />
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
                    {campaign.audioName?.substring(0, 12)}...
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
            STEP 2: YOUR PROFILE
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
                  {p === Platform.INSTAGRAM ? <ProfessionalIcons.Instagram /> : <ProfessionalIcons.Facebook />}
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
                STEP 3: REEL LINKS
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
                          Audio: {campaign?.audioName?.substring(0, 10)}...
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
                    <ProfessionalIcons.Warning />
                    URL must belong to @{handleInput || 'yourusername'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleProfessionalVerification}
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
              PROCESSING VERIFICATION...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <ProfessionalIcons.Robot />
              START PROFESSIONAL VERIFICATION
            </div>
          )}
        </button>

        {/* Security Features Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-900/50 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <ProfessionalIcons.Shield />
              <span className="text-xs font-bold text-white">AI VERIFICATION</span>
            </div>
            <p className="text-[10px] text-gray-400">
              Gemini AI checks audio, caption, username match
            </p>
          </div>
          
          <div className="p-4 bg-gray-900/50 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <ProfessionalIcons.Lock />
              <span className="text-xs font-bold text-white">FRAUD DETECTION</span>
            </div>
            <p className="text-[10px] text-gray-400">
              Multi-layer security with device fingerprinting
            </p>
          </div>
        </div>

        {/* Total Summary */}
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
                <span className="text-gray-400">AI Verification:</span>
                <span className="text-green-400 font-bold">ACTIVE</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Manual Review:</span>
                <span className="text-yellow-400 font-bold">IF NEEDED</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Processing Time:</span>
                <span className="text-blue-400 font-bold">INSTANT</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyView;
