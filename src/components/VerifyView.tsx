import React, { useState } from 'react';
import { AppState, User, Platform, SubmissionStatus, Campaign } from '../types';
import { ICONS } from '../constants'; // Import ICONS from constants
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

interface VerifyViewProps {
  currentUser: User;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  userCampaigns: Campaign[];
}

const VerifyView: React.FC<VerifyViewProps> = ({
  currentUser,
  appState,
  setAppState,
  showToast,
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

        // Determine status - pending for manual review
        const status = SubmissionStatus.PENDING;

        // Create submission document
        const submissionRef = doc(collection(db, 'submissions'));
        const submissionData = {
          // Required fields
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
          aiVerified: false, // Manual review
          aiScore: 0,
          aiMessage: 'Pending manual review',
          requiresManualReview: true,
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

      // ✅ Update user document - ONLY update pendingBalance
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      
      // Get current user data
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const currentData = userDoc.data();
        const currentPending = currentData.pendingBalance || 0;
        
        // Update only pendingBalance
        batch.update(userDocRef, {
          pendingBalance: currentPending + totalPayout,
          updatedAt: serverTimestamp()
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
                pendingBalance: (u.pendingBalance || 0) + totalPayout,
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
          'Firestore permission denied. Please contact admin.',
          'error'
        );
      } else {
        showToast(`Submission failed: ${error.message}`, 'error');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `₹${amount?.toLocaleString('en-IN') || '0'}`;
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
          Submit Your Reels for Manual Review
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
                    {formatCurrency(campaign.basicPay)}
                  </span>
                  {selectedVerifyCampaigns.includes(campaign.id) && (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <ICONS.Check className="w-3 h-3 text-black" />
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
              <ICONS.Instagram className="w-4 h-4" />
              Instagram
            </button>
            <button
              onClick={() => setPlatform(Platform.FACEBOOK)}
              className={`py-4 rounded-[22px] font-black text-[10px] uppercase flex items-center justify-center gap-2 ${
                platform === Platform.FACEBOOK ? 'bg-green-500 text-black shadow-lg' : 'text-slate-500'
              }`}
            >
              <ICONS.Facebook className="w-4 h-4" />
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
                        <p className="text-[10px] text-green-400">{formatCurrency(campaign?.basicPay || 0)}</p>
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
                  <div className="flex items-center gap-1 text-[9px] text-green-400">
                    <ICONS.Check className="w-3 h-3" />
                    Must be valid {platform} URL
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
              <ICONS.Verify className="w-5 h-5" />
              SUBMIT FOR MANUAL REVIEW
            </>
          )}
        </button>

        {/* Summary */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-2xl">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-xs font-black text-green-400 flex items-center gap-1">
                  <ICONS.Target className="w-3 h-3" />
                  {selectedVerifyCampaigns.length} Mission{selectedVerifyCampaigns.length > 1 ? 's' : ''} Selected
                </p>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <ICONS.Share className="w-3 h-3" />
                  {platform === Platform.INSTAGRAM ? 'Instagram Reels' : 'Facebook Reels'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-white">
                  {formatCurrency(selectedVerifyCampaigns.reduce((sum, cid) => {
                    const campaign = activeCampaigns.find(c => c.id === cid);
                    return sum + (campaign?.basicPay || 0);
                  }, 0))}
                </p>
                <p className="text-[10px] text-slate-400">Total Payout</p>
              </div>
            </div>
            
            <div className="mt-3 p-3 bg-black/30 rounded-lg border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <ICONS.Info className="w-4 h-4 text-amber-400" />
                <p className="text-[10px] text-gray-400">
                  ⚠️ All submissions require manual review (24-48 hours)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ICONS.Shield className="w-4 h-4 text-green-400" />
                <p className="text-[10px] text-gray-400">
                  Payment will be added to wallet after approval
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="p-4 bg-black/30 border border-white/10 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <ICONS.Info className="w-5 h-5 text-cyan-400" />
            <p className="text-sm font-black text-white">How It Works</p>
          </div>
          <div className="text-[10px] text-gray-400 space-y-2">
            <div className="flex items-start gap-2">
              <ICONS.CheckCircle className="w-3 h-3 text-green-400 mt-0.5" />
              <span>1. Select campaigns you've completed</span>
            </div>
            <div className="flex items-start gap-2">
              <ICONS.CheckCircle className="w-3 h-3 text-green-400 mt-0.5" />
              <span>2. Enter your social media username</span>
            </div>
            <div className="flex items-start gap-2">
              <ICONS.CheckCircle className="w-3 h-3 text-green-400 mt-0.5" />
              <span>3. Paste reel links for each campaign</span>
            </div>
            <div className="flex items-start gap-2">
              <ICONS.Clock className="w-3 h-3 text-amber-400 mt-0.5" />
              <span>4. Manual review by admin (24-48 hours)</span>
            </div>
            <div className="flex items-start gap-2">
              <ICONS.Wallet className="w-3 h-3 text-cyan-400 mt-0.5" />
              <span>5. Payment added to wallet after approval</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyView;
