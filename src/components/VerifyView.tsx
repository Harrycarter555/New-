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
  const TEMP_BYPASS_AI = false;

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

  const cleanUrl = (url: string) => {
    if (!url) return '';
    return url.toLowerCase()
      .replace('https://', '')
      .replace('http://', '')
      .replace('www.', '')
      .trim();
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
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const successfulSubmissions = [];
      const cleanHandle = cleanUsername(handleInput);

      for (const cid of selectedVerifyCampaigns) {
        const campaign = activeCampaigns.find(c => c.id === cid);
        if (!campaign) continue;

        setAnalysisStep(`VERIFYING: ${campaign.title.toUpperCase()}...`);

        // Prepare platform-specific URL check
        let platformUrlCheck = '';
        if (platform === Platform.INSTAGRAM) {
          platformUrlCheck = `instagram.com/${cleanHandle}`;
        } else {
          platformUrlCheck = `facebook.com/${cleanHandle}`;
        }

        // Create verification prompt
        const prompt = `
You are a social media reel verification assistant. Verify this submission:

REEL URL: ${links[cid]}
EXPECTED CREATOR: @${cleanHandle}
PLATFORM: ${platform}
REQUIRED AUDIO: "${campaign.audioName}"
REQUIRED KEYWORDS IN CAPTION: "${campaign.caption}"

VERIFICATION STEPS:
1. Check if the URL is a valid ${platform} reel URL
2. Check if the URL contains "${platformUrlCheck}" (username should match)
3. Check if caption/description contains keywords: "${campaign.caption}"
4. Verify audio track "${campaign.audioName}" is used
5. Confirm video is vertical format (9:16 aspect ratio)

IMPORTANT INSTRUCTIONS:
- If ALL 5 conditions are met, respond with exactly: "SUCCESS"
- If ANY condition fails, respond with ONE short error message in Hinglish
- Keep error messages under 15 words
- Do not add any explanations or extra text

Examples of valid errors:
"Audio galat hai, correct audio use karo"
"Caption mein required keywords nahi hai"
"URL mein username match nahi ho raha"
"Video vertical format nahi hai"
`;

        if (DEBUG_MODE) {
          console.log("=== DEBUG AI VERIFICATION ===");
          console.log("Campaign:", campaign.title);
          console.log("Prompt sent to AI:", prompt);
          console.log("URL to check:", links[cid]);
          console.log("Expected username:", cleanHandle);
          console.log("Platform URL check:", platformUrlCheck);
        }

        let response = "";
        
        if (TEMP_BYPASS_AI) {
          // Temporary bypass for testing
          console.log("TEMPORARY: Bypassing AI verification for", campaign.title);
          response = "SUCCESS";
        } else {
          const result = await model.generateContent(prompt);
          response = (await result.response).text().trim();
          
          if (DEBUG_MODE) {
            console.log("AI Raw Response:", response);
            console.log("Response includes 'SUCCESS':", response.toUpperCase().includes("SUCCESS"));
            console.log("=== END DEBUG ===");
          }
        }

        // Check for success (more flexible checking)
        const isSuccess = response.toUpperCase().includes("SUCCESS") || 
                         response.toLowerCase().includes("success") ||
                         response.includes("✅") ||
                         response.includes("✔");

        if (isSuccess) {
          // ✅ Save to Firestore
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
            aiVerificationResponse: response,
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

          if (DEBUG_MODE) {
            console.log(`✅ Successfully verified: ${campaign.title}`);
          }
        } else {
          // Show AI's error message
          const errorMsg = response || "Verification failed - unknown error";
          showToast(`${campaign.title}: ${errorMsg}`, 'error');
          setIsAnalyzing(false);
          return;
        }
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
      console.error("AI Verification Error:", {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
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
            Scanning Metadata & AI OCR...
          </p>
          {DEBUG_MODE && (
            <p className="text-[8px] text-amber-500 mt-2 font-mono">
              Debug Mode Active - Check Console
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
        {DEBUG_MODE && (
          <p className="text-[8px] text-amber-500 mt-1 font-bold">
            ⚠️ DEBUG MODE ENABLED
          </p>
        )}
        {TEMP_BYPASS_AI && (
          <p className="text-[8px] text-red-500 mt-1 font-bold">
            ⚠️ AI BYPASS ENABLED - FOR TESTING ONLY
          </p>
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
                  {selectedVerifyCampaigns.includes(campaign.id) && (
                    <div className="w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                      <ICONS.Check className="w-3 h-3 text-black" />
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
              className={`py-4 rounded-[22px] font-black text-[10px] uppercase ${
                platform === Platform.INSTAGRAM ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
              }`}
            >
              Instagram
            </button>
            <button
              onClick={() => setPlatform(Platform.FACEBOOK)}
              className={`py-4 rounded-[22px] font-black text-[10px] uppercase ${
                platform === Platform.FACEBOOK ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
              }`}
            >
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
              @{handleInput || 'username'}
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
                <div key={cid} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <img 
                      src={campaign?.thumbnailUrl} 
                      alt={campaign?.title}
                      className="w-10 h-10 rounded-lg object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://placehold.co/100x100/0ea5e9/000?text=Campaign';
                      }}
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{campaign?.title}</p>
                      <p className="text-[10px] text-cyan-400">₹{campaign?.basicPay}</p>
                    </div>
                  </div>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-cyan-500 shadow-md placeholder:text-slate-600"
                    placeholder={`Paste ${platform} Reel URL for ${campaign?.title}...`}
                    value={links[cid] || ''}
                    onChange={e => setLinks({ ...links, [cid]: e.target.value })}
                  />
                  <p className="text-[9px] text-slate-500 px-2">
                    Make sure URL contains your username: @{handleInput || 'yourusername'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleVerifySubmit}
          disabled={isAnalyzing || selectedVerifyCampaigns.length === 0}
          className={`w-full py-7 rounded-[40px] font-black uppercase tracking-[0.4em] text-lg shadow-2xl active:scale-95 transition-all ${
            selectedVerifyCampaigns.length === 0 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-cyan-500 text-black hover:bg-cyan-400'
          }`}
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              VERIFYING...
            </span>
          ) : TEMP_BYPASS_AI ? (
            'TEST VERIFICATION (AI BYPASSED)'
          ) : (
            'START VERIFICATION'
          )}
        </button>

        {/* Selected campaigns summary */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs font-black text-cyan-400">
                Selected: {selectedVerifyCampaigns.length} mission(s)
              </p>
              <p className="text-xs text-slate-400">
                {platform === Platform.INSTAGRAM ? 'Instagram' : 'Facebook'} Reels
              </p>
            </div>
            <p className="text-lg font-bold text-white">
              Total Payout: ₹{selectedVerifyCampaigns.reduce((sum, cid) => {
                const campaign = activeCampaigns.find(c => c.id === cid);
                return sum + (campaign?.basicPay || 0);
              }, 0)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Amount will be added to pending balance after verification
            </p>
          </div>
        )}

        {/* Debug Info (only in debug mode) */}
        {DEBUG_MODE && selectedVerifyCampaigns.length > 0 && (
          <div className="p-3 bg-black/30 border border-amber-500/30 rounded-xl">
            <p className="text-[10px] text-amber-400 font-bold mb-1">DEBUG INFO</p>
            <p className="text-[8px] text-slate-400 font-mono">
              Username: @{handleInput}<br/>
              Platform: {platform}<br/>
              Selected: {selectedVerifyCampaigns.length} campaigns<br/>
              Links: {Object.keys(links).length} provided
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyView;
