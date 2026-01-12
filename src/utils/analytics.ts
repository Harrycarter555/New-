// Analytics tracking
export const trackEvent = (eventName: string, data?: any) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, data);
  }
  console.log(`[Analytics] ${eventName}:`, data);
};

export const trackCampaignView = (campaignId: string) => {
  trackEvent('campaign_view', { campaignId });
};

export const trackVerification = (success: boolean, campaignId: string) => {
  trackEvent('verification_attempt', { success, campaignId });
};
