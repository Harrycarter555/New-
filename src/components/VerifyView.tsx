//src/components/VerifyView.tsx
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
  userCampaigns: Campaign[]; // ✅ Campaigns passed from App.tsx
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

  // Use userCampaigns instead of appState.campaigns
  const activeCampaigns = userCampaigns.filter(c => c.active);

  const toggleCampaign = (id: string) => {
    setSelectedVerifyCampaigns(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // ✅ UPDATED: Now uses Firestore for real-time sync
  const handleVerifySubmit = async () => {
    if (!handleInput) return showToast('Username required', 'error');
    if (selectedVerifyCampaigns.length === 0) return showToast('Select at least one mission', 'error');

    const missing = selectedVerifyCampaigns.find(id => !links[id]?.trim());
    if (missing) return showToast('All selected missions need a link', 'error');

    setIsAnalyzing(true);
    setAnalysisStep("AI INITIALIZING...");

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const successfulSubmissions = [];

      for (const cid of selectedVerifyCampaigns) {
        const campaign = activeCampaigns.find(c => c.id === cid);
        if (!campaign) continue;

        setAnalysisStep(`VERIFYING: ${campaign.title.toUpperCase()}...`);

        const prompt = `
Verification Task:
Reel Link: ${links[cid]}
Target Username: @${handleInput}
Platform: ${platform}
Required Audio: ${campaign.audioName}
Caption Keywords: ${campaign.caption}

Check:
1. Valid reel URL?
2. Correct username in URL?
3. Caption & text overlay match?
4. Audio track detected?
5. Vertical 9:16 format?

Respond ONLY with "SUCCESS" if valid, or ONE sentence mistake in Hinglish if invalid.
`;

        const result = await model.generateContent(prompt);
        const response = (await result.response).text().trim().toUpperCase();

        if (response.includes("SUCCESS")) {
          // ✅ Save to Firestore (REAL-TIME)
          const submissionRef = await addDoc(collection(db, 'submissions'), {
            userId: currentUser.id,
            username: currentUser.username,
            socialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${handleInput}`,
            campaignId: cid,
            campaignTitle: campaign.title,
            platform,
            status: SubmissionStatus.PENDING,
            timestamp: Date.now(),
            rewardAmount: campaign.basicPay,
            externalLink: links[cid],
            isViralBonus: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // ✅ Update user's pending balance in Firestore
          await updateDoc(doc(db, 'users', currentUser.id), {
            pendingBalance: increment(campaign.basicPay),
            savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${handleInput}`,
            updatedAt: serverTimestamp()
          });

          successfulSubmissions.push({
            id: submissionRef.id,
            campaignTitle: campaign.title,
            amount: campaign.basicPay
          });
        } else {
          showToast(`${campaign.title}: ${response}`, 'error');
          setIsAnalyzing(false);
          return;
        }
      }

      if (successfulSubmissions.length > 0) {
        setAnalysisStep("LOGGING PAYOUT DATA...");
        
        // Update local state for immediate UI feedback
        setAppState(prev => ({
          ...prev,
          users: prev.users.map(u =>
            u.id === currentUser.id
              ? {
                  ...u,
                  pendingBalance: u.pendingBalance + successfulSubmissions.reduce((acc, s) => acc + s.amount, 0),
                  savedSocialUsername: `${platform === Platform.INSTAGRAM ? 'instagram.com/@' : 'facebook.com/'}${handleInput}`,
                }
              : u
          ),
        }));

        showToast(`✅ ${successfulSubmissions.length} submission(s) verified and queued for payout`, 'success');
        
        // Reset form
        setSelectedVerifyCampaigns([]);
        setLinks({});
        setHandleInput(currentUser.savedSocialUsername?.split('/@')[1] || '');
      }
    } catch (err: any) {
      console.error(err);
      showToast("AI verification failed. Try again.", 'error');
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
        </div>
      )}

      <div className="text-center">
        <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase italic">
          MISSION <span className="text-cyan-400">VERIFY</span>
        </h2>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 italic">
          Audit Submission
        </p>
      </div>

      {/* Campaign Selection with Thumbnails */}
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
          <input
            className="w-full bg-white/5 border border-white/10 rounded-[28px] px-8 py-5 text-xl font-black italic text-white outline-none focus:border-cyan-500 placeholder:text-slate-800"
            placeholder="Username (no @)"
            value={handleInput}
            onChange={e => setHandleInput(e.target.value)}
          />
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
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{campaign?.title}</p>
                      <p className="text-[10px] text-cyan-400">₹{campaign?.basicPay}</p>
                    </div>
                  </div>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-cyan-500 shadow-md"
                    placeholder="Paste Full Reel URL..."
                    value={links[cid] || ''}
                    onChange={e => setLinks({ ...links, [cid]: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleVerifySubmit}
          disabled={isAnalyzing || selectedVerifyCampaigns.length === 0}
          className={`w-full py-7 rounded-[40px] font-black uppercase tracking-[0.4em] text-lg shadow-2xl active:scale-95 transition-all ${
            selectedVerifyCampaigns.length === 0 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-cyan-500 text-black'
          }`}
        >
          {isAnalyzing ? 'VERIFYING...' : 'START VERIFICATION'}
        </button>

        {/* Selected campaigns summary */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
            <p className="text-xs font-black text-cyan-400 mb-2">
              Selected: {selectedVerifyCampaigns.length} mission(s)
            </p>
            <p className="text-sm font-bold text-white">
              Total Payout: ₹{selectedVerifyCampaigns.reduce((sum, cid) => {
                const campaign = activeCampaigns.find(c => c.id === cid);
                return sum + (campaign?.basicPay || 0);
              }, 0)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyView;
