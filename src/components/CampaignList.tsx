// src/components/CampaignList.tsx
import React from 'react';
import { Campaign } from '../types';
import CampaignCard from './CampaignCard';
import CampaignCard from './components/AdminPanel/AdminCampaigns';
interface CampaignListProps {
  campaigns: Campaign[];
  onSelect: (campaign: Campaign) => void;
}

const CampaignList: React.FC<CampaignListProps> = ({ campaigns, onSelect }) => {
  return (
    <div className="space-y-10 pb-20">
      <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
        LIVE<br/><span className="text-cyan-400">MISSIONS</span>
      </h2>
      {campaigns.map(c => (
        <CampaignCard key={c.id} campaign={c} onClick={() => onSelect(c)} />
      ))}
    </div>
  );
};

export default CampaignList;
