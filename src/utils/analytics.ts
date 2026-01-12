import { AppLog, User } from '../types';

export class AnalyticsTracker {
  static trackEvent(event: string, data?: Record<string, any>) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event, data);
    }
    
    // Local storage mein bhi save karo for offline
    const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
    events.push({
      event,
      data,
      timestamp: Date.now(),
    });
    localStorage.setItem('analytics_events', JSON.stringify(events.slice(-100))); // Last 100 events
  }

  static trackUserAction(user: User, action: string, details?: string) {
    const log: AppLog = {
      id: `log-${Date.now()}`,
      userId: user.id,
      username: user.username,
      type: 'system',
      message: `${user.username} performed: ${action} ${details ? `- ${details}` : ''}`,
      timestamp: Date.now(),
    };
    
    // Firestore mein save karne ka logic yahan aayega
    this.trackEvent('user_action', {
      user_id: user.id,
      action,
      details,
    });
    
    return log;
  }

  static trackCampaignView(campaignId: string, campaignTitle: string) {
    this.trackEvent('campaign_view', {
      campaign_id: campaignId,
      campaign_title: campaignTitle,
    });
  }

  static trackVerificationAttempt(campaignId: string, success: boolean) {
    this.trackEvent('verification_attempt', {
      campaign_id: campaignId,
      success,
      timestamp: Date.now(),
    });
  }
}

// Page view tracking
export const trackPageView = (pageName: string) => {
  AnalyticsTracker.trackEvent('page_view', { page: pageName });
};
