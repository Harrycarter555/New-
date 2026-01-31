// src/components/VerifyView.tsx
import React, { useState, useEffect } from 'react';
import { AppState, User, Platform, SubmissionStatus, Campaign } from '../types';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ICONS } from '../constants';

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

  // DEBUG MODE - Set to true to see AI responses
  const DEBUG_MODE = true;
  
  // TEMPORARY: Set to true to bypass AI for testing
  const TEMP_BYPASS_AI = true; // ✅ TEMPORARILY TRUE for testing

  // Use userCampaigns instead of appState.campaigns
  const activeCampaigns = userCampaigns.filter(c => c.active);

  const toggleCampaign = (id: string) => {
    setSelectedVerifyCampaigns(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Helper functions for URL cleaning
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
    setAnalysisStep("AI INITIALIZING...");

    try {
      // ✅ IMPORTANT: Use correct model name based on your API
      let model;
      
      // Try different model names - Google frequently changes these
      const modelNames = [
        "gemini-1.5-flash",  // Original
        "gemini-1.5-flash-latest", // Latest version
        "gemini-1.5-pro",    // Pro version
        "gemini-pro",        // Older pro
        "models/gemini-1.5-flash", // Full path
        "gemini-1.0-pro"     // Fallback
      ];
      
      const cleanHandle = cleanUsername(handleInput);
      const successfulSubmissions = [];

      for (const cid of selectedVerifyCampaigns) {
        const campaign = activeCampaigns.find(c => c.id === cid);
        if (!campaign) continue;

        setAnalysisStep(`VERIFYING: ${campaign.title.toUpperCase()}...`);

        // ✅ TEMPORARY: Skip AI verification completely for now
        if (TEMP_BYPASS_AI) {
          console.log("TEMPORARY: Bypassing AI verification for", campaign.title);
          
          // Direct success without AI
          const submissionRef = await addDoc(collection(db, 'submissions'), {
            userId: currentUser.id,
            username: currentUser.username,
            socialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
            campaignId: cid,
            campaignTitle: campaign.title,
            platform,
            status: SubmissionStatus.PENDING,
            timestamp: Date.now(),
            rewardAmount: campaign.basicPay,
            externalLink: links[cid],
            isViralBonus: false,
            aiVerificationResponse: "TEMPORARY_BYPASS",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // ✅ Update user's pending balance
          await updateDoc(doc(db, 'users', currentUser.id), {
            pendingBalance: increment(campaign.basicPay),
            savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${cleanHandle}`,
            updatedAt: serverTimestamp()
          });

          successfulSubmissions.push({
            id: submissionRef.id,
            campaignTitle: campaign.title,
            amount: campaign.basicPay
          });

          continue; // Skip to next campaign
        }

        // Original AI verification code (commented out for now)
        /*
        try {
          // Try to get model - catch if model not found
          model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        } catch (modelError) {
          console.warn("Primary model failed, trying fallback...", modelError);
          // Try fallback model
          model = genAI.getGenerativeModel({ model: "gemini-pro" });
        }

        // Create verification prompt
        const prompt = `
Verify this social media reel submission:

REEL URL: ${links[cid]}
EXPECTED USERNAME: @${cleanHandle}
PLATFORM: ${platform}

REQUIREMENTS:
- Audio should be: "${campaign.audioName}"
- Caption should contain: "${campaign.caption}"
- Video should be vertical (9:16)

If ALL requirements are met, respond with: "SUCCESS"
If any requirement fails, respond with ONE short error in Hinglish.

Example errors:
"Audio galat hai"
"Caption mein keywords nahi hai"
"Username match nahi ho raha"
`;

        if (DEBUG_MODE) {
          console.log("=== AI VERIFICATION ===");
          console.log("Campaign:", campaign.title);
          console.log("Model used:", model.model);
        }

        const result = await model.generateContent(prompt);
        const response = (await result.response).text().trim();
        
        if (DEBUG_MODE) {
          console.log("AI Response:", response);
          console.log("=== END ===");
        }

        // Check for success
        const isSuccess = response.toUpperCase().includes("SUCCESS");

        if (isSuccess) {
          // Save to Firestore...
        } else {
          showToast(`${campaign.title}: ${response}`, 'error');
          setIsAnalyzing(false);
          return;
        }
        */
      }

      if (successfulSubmissions.length > 0) {
        setAnalysisStep("LOGGING PAYOUT DATA...");
        
        // Calculate total payout
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

        showToast(`✅ ${successfulSubmissions.length} submission(s) verified! ₹${totalPayout} added to pending balance`, 'success');
        
        // Reset form
        setSelectedVerifyCampaigns([]);
        setLinks({});
        setHandleInput(cleanHandle);
      }
    } catch (err: any) {
      console.error("Verification Error:", err);
      showToast(`Verification failed: ${err.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
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
            Processing Submission...
          </p>
          {TEMP_BYPASS_AI && (
            <p className="text-[10px] text-amber-500 mt-2 font-bold">
              ⚡ AI Verification Temporarily Disabled
            </p>
          )}
        </div>
      )}

      <div className="text-center">
        <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase italic">
          MISSION <span className="text-cyan-400">VERIFY</span>
        </h2>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 italic">
          Audit Submission
        </p>
        {TEMP_BYPASS_AI && (
          <div className="mt-2 p-2 bg-amber-500/20 border border-amber-500/30 rounded-lg mx-4">
            <p className="text-[10px] text-amber-400 font-bold">
              ⚡ TEST MODE: AI Verification Bypassed
            </p>
            <p className="text-[8px] text-amber-300 mt-1">
              Submissions will be accepted without AI check
            </p>
          </div>
        )}
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
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] text-slate-400 bg-black/50 px-2 py-1 rounded">
                      {campaign.audioName?.substring(0, 10)}...
                    </span>
                    {selectedVerifyCampaigns.includes(campaign.id) && (
                      <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                        <ICONS.Check className="w-3 h-3 text-black" />
                      </div>
                    )}
                  </div>
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
              <ICONS.Instagram className="w-4 h-4" />
              Instagram
            </button>
            <button
              onClick={() => setPlatform(Platform.FACEBOOK)}
              className={`py-4 rounded-[22px] font-black text-[10px] uppercase flex items-center justify-center gap-2 ${
                platform === Platform.FACEBOOK ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
              }`}
            >
              <ICONS.Facebook className="w-4 h-4" />
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
              3. URL Link Verification
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
                          {campaign?.audioName?.substring(0, 15)}...
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
                  <div className="flex items-center gap-2 text-[9px] text-slate-500">
                    <ICONS.Info className="w-3 h-3" />
                    <span>Make sure URL contains: <span className="text-cyan-400">@{handleInput || 'yourusername'}</span></span>
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
              : 'bg-cyan-500 text-black hover:bg-cyan-400'
          }`}
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              VERIFYING...
            </>
          ) : (
            <>
              <ICONS.Verify className="w-6 h-6" />
              {TEMP_BYPASS_AI ? 'SUBMIT FOR APPROVAL' : 'START VERIFICATION'}
            </>
          )}
        </button>

        {/* Selected campaigns summary */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-xs font-black text-cyan-400">
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
            
            {TEMP_BYPASS_AI && (
              <div className="mt-3 p-2 bg-amber-500/20 rounded-lg border border-amber-500/30">
                <p className="text-[10px] text-amber-400 font-bold text-center">
                  ⚡ Note: AI verification is temporarily disabled
                </p>
                <p className="text-[8px] text-amber-300 text-center mt-1">
                  Your submission will be manually reviewed
                </p>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
          <p className="text-xs font-black text-white mb-2 flex items-center gap-2">
            <ICONS.Info className="w-4 h-4 text-cyan-400" />
            Verification Instructions
          </p>
          <ul className="text-[10px] text-slate-400 space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">✓</span>
              <span>Use correct audio mentioned in each mission</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">✓</span>
              <span>Include required keywords in your caption</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">✓</span>
              <span>Reel must be vertical (9:16 format)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400">✓</span>
              <span>URL must contain your exact username</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VerifyView;
