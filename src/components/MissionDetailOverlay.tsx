// src/components/MissionDetailOverlay.tsx
import React from 'react';
import { Campaign } from '../types';
import { ICONS } from '../constants';

interface MissionDetailOverlayProps {
  campaign: Campaign;
  onClose: () => void;
  onStartVerify: () => void;
}

const MissionDetailOverlay: React.FC<MissionDetailOverlayProps> = ({
  campaign,
  onClose,
  onStartVerify,
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-y-auto pb-40 animate-slide">
      <div className="px-6 py-5 sticky top-0 bg-black/80 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-50">
        <button
          onClick={onClose}
          className="p-4 bg-white/5 rounded-2xl transition-all active:scale-90 border border-white/10"
        >
          <ICONS.ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h2 className="font-black text-lg text-white italic uppercase tracking-tighter">
          Mission Plan
        </h2>
        <div className="w-10"></div>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        <div className="bg-slate-900 rounded-[48px] overflow-hidden border-2 border-white/5 shadow-2xl aspect-video relative group">
          <video
            src={campaign.videoUrl}
            className="w-full h-full object-cover"
            controls
            autoPlay
            loop
            muted
          />
        </div>

        <div className="space-y-6">
          {campaign.bioLink && (
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 italic">
                Official Link Page
              </p>
              <div
                className="flex justify-between items-center bg-cyan-500/10 p-5 rounded-2xl border border-cyan-500/20 active:scale-95 transition-all cursor-pointer"
                onClick={() => {
                  navigator.clipboard.writeText(campaign.bioLink!);
                  // showToast yahan App se pass kar sakte ho agar chaho
                }}
              >
                <p className="text-cyan-400 font-black text-xs italic truncate pr-4">
                  {campaign.bioLink}
                </p>
                <ICONS.Copy className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
          )}

          <div className="glass-panel border border-white/10 rounded-[32px] p-8 space-y-6 shadow-2xl">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 italic">
                Audio Audit Key
              </p>
              <p className="text-sm italic font-black text-cyan-400 uppercase tracking-widest">
                {campaign.audioName}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 shadow-inner">
                <p className="text-[8px] font-black text-slate-500 uppercase mb-1 italic">
                  Viral Views Threshold
                </p>
                <p className="text-xl font-black text-white italic">
                  {campaign.goalViews.toLocaleString()}+
                </p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5 shadow-inner">
                <p className="text-[8px] font-black text-slate-500 uppercase mb-1 italic">
                  Viral Likes Threshold
                </p>
                <p className="text-xl font-black text-white italic">
                  {campaign.goalLikes.toLocaleString()}+
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 italic">
                Mission Mandatory Directives
              </p>
              <p className="text-sm italic text-slate-300 leading-relaxed font-medium">
                "{campaign.caption}"
              </p>
              <button
                className="text-cyan-400 text-[9px] font-black uppercase mt-4 tracking-widest flex items-center gap-2 bg-cyan-500/10 px-6 py-3 rounded-xl border border-cyan-500/20 active:scale-95 shadow-lg shadow-cyan-500/5 transition-all"
                onClick={() => navigator.clipboard.writeText(campaign.caption)}
              >
                <ICONS.Copy className="w-3 h-3" /> Copy Directive Text
              </button>
            </div>
          </div>

          <button
            onClick={onStartVerify}
            className="w-full py-8 bg-cyan-500 text-black rounded-[40px] font-black uppercase tracking-[0.4em] text-lg shadow-2xl active:scale-95 transition-all"
          >
            Engage Verification
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissionDetailOverlay;
