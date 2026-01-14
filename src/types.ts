// src/types.ts
// ────────────────────────────────────────────────
// Enums (consistent naming)
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

export enum SubmissionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  VIRAL_CLAIM = 'viral_claim',
}

export enum PayoutStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  HOLD = 'hold',
  REJECTED = 'rejected',
}

export enum Platform {
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
}

// ────────────────────────────────────────────────
// User Interface
export interface User {
  id: string;
  username: string;
  password?: string;              // Optional - security reasons
  email?: string;
  role: UserRole;
  status: UserStatus;
  walletBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  joinedAt: number;
  readBroadcastIds: string[];
  securityKey: string;            // Required recovery key
  failedAttempts?: number;        // Login attempts tracking
  lockoutUntil?: number;          // Timestamp for lockout end
  savedSocialUsername?: string;   // e.g., "instagram.com/@username"
  payoutMethod?: 'UPI' | 'BANK' | 'USDT' | string;
  payoutDetails?: string;         // UPI ID, Bank Account, Wallet Address
}

// ────────────────────────────────────────────────
// Campaign Interface
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
  createdAt?: number;             // Added from second block
}

// ────────────────────────────────────────────────
// Submission Interface
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
  approvedAt?: number;            // Added from second block
  rejectedAt?: number;            // Added from second block
}

// ────────────────────────────────────────────────
// Payout Request
export interface PayoutRequest {
  id: string;
  userId: string;
  username: string;
  amount: number;
  method: string;
  status: PayoutStatus;
  timestamp: number;
  processedAt?: number;           // Added from second block
  processedBy?: string;           // Added from second block
}

// ────────────────────────────────────────────────
// Broadcast Message (Renamed from BroadcastMessage to match second block)
export interface Broadcast {
  id: string;
  content: string;
  senderId: string;
  targetUserId?: string;
  timestamp: number;
}

// ────────────────────────────────────────────────
// User Report
export interface UserReport {
  id: string;
  userId: string;
  username: string;
  message: string;
  status: 'open' | 'resolved';
  timestamp: number;
  resolvedAt?: number;            // Added from second block
}

// ────────────────────────────────────────────────
// App Log
export interface AppLog {
  id: string;
  userId?: string;
  username?: string;
  type: 'auth' | 'verify' | 'payout' | 'viral' | 'system' | 'admin' | 'transaction';
  message: string;
  timestamp: number;
}

// ────────────────────────────────────────────────
// Cashflow Config
export interface Cashflow {
  dailyLimit: number;
  todaySpent: number;
  startDate: string;
  endDate: string;
}

// ────────────────────────────────────────────────
// App Config
export interface AppConfig {
  minWithdrawal: number;
}

// ────────────────────────────────────────────────
// Main App State
export interface AppState {
  users: User[];
  campaigns: Campaign[];
  submissions: Submission[];
  payoutRequests: PayoutRequest[];
  broadcasts: Broadcast[];        // Updated type name
  reports: UserReport[];
  cashflow: Cashflow;
  logs: AppLog[];
  config: AppConfig;              // Updated to use AppConfig interface
}
