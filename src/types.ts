// src/types.ts
export enum UserRole { ADMIN = 'admin', USER = 'user' }
export enum UserStatus { ACTIVE = 'active', SUSPENDED = 'suspended', BANNED = 'banned' }
export enum SubmissionStatus { PENDING = 'pending', APPROVED = 'approved', REJECTED = 'rejected', VIRAL_CLAIM = 'viral_claim' }
export enum PayoutStatus { PENDING = 'pending', APPROVED = 'approved', HOLD = 'hold', REJECTED = 'rejected' }
export enum Platform { INSTAGRAM = 'instagram', FACEBOOK = 'facebook' }

export interface User {
  id: string;
  username: string;
  password?: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  walletBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  joinedAt: number;
  readBroadcastIds: string[];
  securityKey: string;
  failedAttempts?: number;
  lockoutUntil?: number;
  savedSocialUsername?: string;
  payoutMethod?: 'UPI' | 'BANK' | 'USDT' | string;
  payoutDetails?: string;
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
  processedAt?: number;
  processedBy?: string;
}

export interface Broadcast {
  id: string;
  content: string;
  senderId: string;
  targetUserId?: string;
  timestamp: number;
}

export interface UserReport {
  id: string;
  userId: string;
  username: string;
  message: string;
  status: 'open' | 'resolved';
  timestamp: number;
  resolvedAt?: number;
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
