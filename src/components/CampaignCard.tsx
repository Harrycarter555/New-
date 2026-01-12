// src/components/CampaignCard.tsx
import React from 'react';
import { Campaign } from '../types';

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="glass-panel rounded-[56px] overflow-hidden relative group aspect-[9/16] shadow-[0_40px_100px_rgba(0,0,0,0.6)] cursor-pointer border border-white/5"
    >
      <img
        src={campaign.thumbnailUrl}
        alt={campaign.title}
        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-10 space-y-2">
        <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter drop-shadow-lg">
          {campaign.title}
        </h3>
        <div className="flex gap-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
            {campaign.goalViews.toLocaleString()} Views Goal
          </p>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
            {campaign.goalLikes.toLocaleString()} Likes Goal
          </p>
        </div>
      </div>
      {/* Add reward badges etc. from your original code */}
    </div>
  );
};

export default CampaignCard;
