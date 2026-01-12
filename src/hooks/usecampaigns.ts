import { useState, useEffect, useCallback } from 'react';
import { Campaign } from '../types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { debounce } from '../utils/performance';

export const useCampaigns = (activeOnly: boolean = true) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      let q = collection(db, 'campaigns');
      if (activeOnly) {
        q = query(q, where('active', '==', true));
      }
      
      const snapshot = await getDocs(q);
      const campaignList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Campaign[];
      
      setCampaigns(campaignList);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  const debouncedFetch = debounce(fetchCampaigns, 300);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const refreshCampaigns = () => {
    debouncedFetch();
  };

  return { campaigns, loading, error, refreshCampaigns };
};
