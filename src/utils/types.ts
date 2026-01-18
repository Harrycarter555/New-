// src/types.ts - UPDATED & UNIFIED VERSION

// ========== ENUMS ==========
export enum UserRole { 
  ADMIN = 'admin', 
  USER = 'user' 
}

export enum UserStatus { 
  ACTIVE = 'active', 
  SUSPENDED = 'suspended', 
  BANNED = 'banned' 
}

export enum SubmissionStatus { 
  PENDING = 'pending', 
  APPROVED = 'approved', 
  REJECTED = 'rejected', 
  VIRAL_CLAIM = 'viral_claim' 
}

export enum PayoutStatus { 
  PENDING = 'pending', 
  APPROVED = 'approved', 
  HOLD = 'hold', 
  REJECTED = 'rejected' 
}

export enum Platform { 
  INSTAGRAM = 'instagram', 
  FACEBOOK = 'facebook' 
}

// ========== CORE INTERFACES ==========
export interface User {
  id: string;
  username: string;
  password?: string;
  email: string; // REQUIRED - utils/types.ts se liya
  role: UserRole;
  status: UserStatus;
  walletBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  joinedAt: number;
  lastLoginAt?: number; // OPTIONAL - dono ko combine kiya
  readBroadcastIds: string[];
  securityKey: string;
  failedAttempts?: number;
  lockoutUntil?: number;
  savedSocialUsername?: string;
  payoutMethod?: 'UPI' | 'BANK' | 'USDT' | string; // src/types.ts wala version rakha
  payoutDetails?: string; // src/types.ts wala version rakha
  createdAt?: number; // utils/types.ts se liya
}

export interface Campaign {
  id: string;
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
  active: boolean;
  bioLink: string;
  createdAt?: number;
}

export interface Submission {
  id: string;
  userId: string;
  username: string;
  socialUsername: string;
  campaignId: string;
  campaignTitle: string;
  platform: Platform;
  status: SubmissionStatus;
  timestamp: number;
  rewardAmount: number;
  isViralBonus?: boolean;
  rejectionReason?: string;
  externalLink: string;
  approvedAt?: number;
  rejectedAt?: number;
}

export interface PayoutRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  method: string;
  status: PayoutStatus;
  timestamp: number;
  requestedAt?: number; // VdminPanel.tsx ke liye add kiya
  processedAt?: number;
  processedBy?: string;
}

export interface Broadcast {
  id: string;
  content: string;
  senderId: string;
  senderName?: string; // utils/types.ts se liya
  targetUserId?: string;
  timestamp: number; // REQUIRED - AdminBroadcasts.tsx ke liye
  readBy?: string[]; // utils/types.ts se liya
  title?: string; // VdminPanel.tsx ke liye add kiya
  message?: string; // VdminPanel.tsx ke liye add kiya
}

export interface UserReport {
  id: string;
  userId: string;
  username: string;
  message: string;
  status: 'open' | 'resolved';
  timestamp: number;
  resolvedAt?: number;
  reporterId?: string; // VdminPanel.tsx ke liye add kiya
}

export interface AppLog {
  id: string;
  userId?: string;
  username?: string;
  type: 'auth' | 'verify' | 'payout' | 'viral' | 'system' | 'admin' | 'transaction';
  message: string;
  timestamp: number;
}

export interface Cashflow {
  dailyLimit: number;
  todaySpent: number;
  startDate: string;
  endDate: string;
}

export interface AppConfig {
  minWithdrawal: number;
}

export interface AppState {
  users: User[];
  campaigns: Campaign[];
  submissions: Submission[];
  payoutRequests: PayoutRequest[];
  broadcasts: Broadcast[];
  reports: UserReport[];
  cashflow: Cashflow;
  logs: AppLog[];
  config: AppConfig;
}

// ========== ADMIN PANEL TYPES ==========
export type AdminTab = 
  | 'dashboard' 
  | 'members' 
  | 'campaigns' 
  | 'cashflow' 
  | 'payouts' 
  | 'reports' 
  | 'broadcasts';

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
  users?: User[]; // utils/types.ts se liya
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
  description?: string; // VdminPanel.tsx ke liye add kiya
}

export interface BroadcastData {
  content: string;
  targetUserId?: string;
  title?: string; // VdminPanel.tsx ke liye add kiya
  message?: string; // VdminPanel.tsx ke liye add kiya
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
