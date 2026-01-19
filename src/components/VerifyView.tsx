import React, { useState, useEffect } from 'react';
import { AppState, User, Platform, SubmissionStatus } from '../types';
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
}

const VerifyView: React.FC<VerifyViewProps> = ({
  currentUser,
  appState,
  setAppState,
  showToast,
  genAI,
}) => {
  const [platform, setPlatform] = useState<Platform>(Platform.INSTAGRAM);
  const [handleInput, setHandleInput] = useState(
    currentUser.savedSocialUsername?.split('/@')[1] || ''
  );
  const [links, setLinks] = useState<Record<string, string>>({});
  const [selectedVerifyCampaigns, setSelectedVerifyCampaigns] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');

  // Filter only active campaigns
  const activeCampaigns = appState.campaigns.filter(c => c.active);

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

      {/* Selection Section */}
      <div className="space-y-4 px-2">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2 italic">
          1. Selection
        </p>
        <div className="flex gap-4 overflow-x-auto hide-scrollbar py-2 px-2">
          {activeCampaigns.map(c => (
            <div
              key={c.id}
              onClick={() => toggleCampaign(c.id)}
              className={`flex-shrink-0 w-28 aspect-[9/16] rounded-3xl overflow-hidden relative border-4 transition-all ${
                selectedVerifyCampaigns.includes(c.id)
                  ? 'border-cyan-500 scale-105 shadow-[0_0_20px_rgba(0,210,255,0.4)]'
                  : 'border-transparent opacity-40'
              }`}
            >
              <img src={c.thumbnailUrl} className="w-full h-full object-cover" alt={c.title} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-2">
                <p className="text-[7px] font-black text-white italic truncate">
                  {c.title.toUpperCase()}
                </p>
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

        {/* Links */}
        {selectedVerifyCampaigns.length > 0 && (
          <div className="space-y-4 animate-slide">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2 italic">
              3. URL Link Verification
            </p>
            {selectedVerifyCampaigns.map(cid => {
              const camp = activeCampaigns.find(c => c.id === cid);
              return (
                <div key={cid} className="space-y-2">
                  <p className="text-[8px] font-black text-cyan-500 uppercase px-4 italic">
                    {camp?.title}
                  </p>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-[24px] px-6 py-4 text-sm font-bold text-white outline-none focus:border-cyan-500 shadow-md"
                    placeholder="Paste Full URL..."
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
          disabled={isAnalyzing}
          className="w-full py-7 bg-cyan-500 text-black rounded-[40px] font-black uppercase tracking-[0.4em] text-lg shadow-2xl active:scale-95 transition-all disabled:opacity-50"
        >
          {isAnalyzing ? 'VERIFYING...' : 'START VERIFICATION'}
        </button>
      </div>
    </div>
  );
};

export default VerifyView;
