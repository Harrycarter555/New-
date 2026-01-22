// UPDATED & FIXED VERSION (January 19, 2026)

import React from 'react';

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
  email: string;
  role: UserRole;
  status: UserStatus;
  walletBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  joinedAt: number;
  lastLoginAt?: number;
  readBroadcastIds: string[];
  securityKey: string;
  failedAttempts?: number;
  lockoutUntil?: number;
  savedSocialUsername?: string;
  payoutMethod?: 'UPI' | 'BANK' | 'USDT' | string;
  payoutDetails?: string;
  createdAt?: number;
  // ✅ ADDED: For constants.tsx compatibility
  description?: string;
  reward?: number;
  duration?: number;
  tags?: string[];
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
  description?: string;
  requirements?: string[];
  // ✅ ADDED: For constants.tsx compatibility
  reward?: number;
  duration?: number;
  tags?: string[];
  status?: string; // For reports status
  createdBy?: string; // For broadcasts
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
  requestedAt?: number;
  processedAt?: number;
  processedBy?: string;
}

export interface Broadcast {
  id: string;
  content: string;
  senderId: string;
  senderName?: string;
  targetUserId?: string;
  timestamp: number;
  readBy?: string[];
  title?: string;
  message?: string;
  createdAt?: number;
  createdBy?: string;
  // ✅ ADDED: For constants.tsx compatibility
  status?: string;
}

export interface UserReport {
  id: string;
  userId: string;
  username: string;
  message: string;
  status: 'open' | 'resolved';
  timestamp: number;
  resolvedAt?: number;
  reporterId?: string;
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

// ✅ UPDATED AppState to match constants.tsx
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

// View union type (for setCurrentView)
export type AppView = "admin" | "auth" | "verify" | "campaigns" | "recovery" | "wallet";

// Props Types
export interface AdminPanelProps {
  currentUser: User;
  showToast: (message: string, type?: 'success' | 'error') => void;
  appState?: AppState; // ✅ MADE OPTIONAL to fix App.tsx error
  setAppState?: React.Dispatch<React.SetStateAction<AppState>>; // ✅ MADE OPTIONAL
}

export interface AdminDashboardProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  data?: any; // ✅ ADDED for AdminPanel compatibility
  onRefresh?: () => void; // ✅ ADDED for AdminPanel compatibility
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
  cashflow: { dailyLimit: number; todaySpent: number; startDate?: string; endDate?: string };
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
  users?: User[];
}

// Auth & Recovery Props (type-safe setCurrentView)
export interface AccountRecoveryProps {
  setCurrentView: (view: AppView) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export interface AuthViewProps {
  setCurrentUser: (user: User | null) => void;
  setCurrentView: (view: AppView) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
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

// ✅ ADDITIONAL TYPES FOR COMPONENTS
export interface CampaignsPageProps {
  userCampaigns: Campaign[];
  userStats: {
    totalActive: number;
    totalRewardPool: number;
    pendingBalance: number;
    walletBalance: number;
  };
  onCampaignSelect: (campaign: Campaign) => void;
  onNavigateToVerify: () => void;
  onNavigateToWallet: () => void;
}

export interface VerifyViewProps {
  currentUser: User;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  genAI: any; // GoogleGenerativeAI type
  userCampaigns: Campaign[];
}

export interface WalletViewProps {
  currentUser: User;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  userCampaigns: Campaign[];
  userBroadcasts: any[];
  userSubmissions: any[];
  userPayouts: any[];
}

export interface MissionDetailOverlayProps {
  campaign: Campaign;
  onClose: () => void;
  onStartVerify: () => void;
}

export interface ProfileOverlayProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onLogout: () => void;
}

export interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onNotifyClick: () => void;
  onProfileClick: () => void;
  unreadCount: number;
}
