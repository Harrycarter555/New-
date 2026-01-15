import { User, Campaign, Submission, PayoutRequest, Broadcast, UserReport } from '../../utils/types';

// Admin Tab Types
export type AdminTab = 
  | 'dashboard' 
  | 'members' 
  | 'campaigns' 
  | 'cashflow' 
  | 'payouts' 
  | 'reports' 
  | 'broadcasts';


export enum UserRole { ADMIN = 'admin', USER = 'user' }
export enum UserStatus { ACTIVE = 'active', SUSPENDED = 'suspended', BANNED = 'banned' }



export type PayoutSubTab = 'payouts' | 'verifications';

// Props Types
export interface AdminPanelProps {
  currentUser: User;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export interface AdminDashboardProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

export interface AdminMembersProps {
  users: User[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

export interface AdminCampaignsProps {
  campaigns: Campaign[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: User;
}

export interface AdminCashflowProps {
  cashflow: { dailyLimit: number; todaySpent: number };
  showToast: (message: string, type: 'success' | 'error') => void;
}

export interface AdminPayoutsProps {
  payouts: PayoutRequest[];
  submissions: Submission[];
  showToast: (message: string, type: 'success' | 'error') => void;
  payoutSubTab: PayoutSubTab;
  setPayoutSubTab: (tab: PayoutSubTab) => void;
}

export interface AdminReportsProps {
  reports: UserReport[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

export interface AdminBroadcastsProps {
  broadcasts: Broadcast[];
  showToast: (message: string, type: 'success' | 'error') => void;
  currentUser: User;
}

// Form Data Types
export interface NewCampaignData {
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  hashtags: string;
  audioName: string;
  goalViews: number;
  goalLikes: number;
  basicPay: number;
  viralPay: number;
  bioLink: string;
}

export interface BroadcastData {
  content: string;
  targetUserId?: string;
}

export interface BalanceEditData {
  amount: string;
  type: 'add' | 'deduct';
}

// Statistics Types
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalBalance: number;
  totalPending: number;
  totalEarnings: number;
  pendingPayouts: number;
  pendingPayoutsAmount: number;
  openReports: number;
  activeCampaigns: number;
  pendingSubmissions: number;
  pendingSubmissionsAmount: number;
  cashflowRemaining: number;
  pendingCashflow: number;
  dailyLimit: number;
  todaySpent: number;
}

// Real-time Update Types
export interface RealTimeUpdate {
  type: 'users' | 'campaigns' | 'payouts' | 'submissions' | 'reports' | 'broadcasts' | 'cashflow';
  data: any;
  timestamp: number;
}

// Admin Action Types
export type AdminAction = 
  | 'user_status_update'
  | 'user_balance_update'
  | 'campaign_create'
  | 'campaign_update'
  | 'campaign_delete'
  | 'payout_approve'
  | 'payout_reject'
  | 'submission_approve'
  | 'submission_reject'
  | 'report_resolve'
  | 'report_delete'
  | 'broadcast_send'
  | 'cashflow_update';

// Admin Log Entry
export interface AdminLog {
  id: string;
  adminId: string;
  adminUsername: string;
  action: AdminAction;
  targetId?: string;
  targetUsername?: string;
  details: string;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}
