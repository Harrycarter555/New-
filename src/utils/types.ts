// src/types.ts
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
  requirements?: string[];         // ← ADDED: To fix constants.tsx error
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
  createdBy?: string;             // ← ADDED: To fix constants.tsx error
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
  appState: AppState;                                    // ← MADE REQUIRED to match App.tsx logic
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;  // ← MADE REQUIRED
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
