// UPDATED & FIXED VERSION (January 27, 2026)

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
  updatedAt?: number;
  description?: string;
  reward?: number;
  duration?: number;
  tags?: string[];
  totalBalance?: number;
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
  updatedAt?: number;
  description?: string;
  requirements?: string[];
  reward?: number;
  duration?: number;
  tags?: string[];
  status?: string;
  createdBy?: string;
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

// ✅ UPDATED AppState
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

// ========== VIEW TYPE ==========
export type ViewType = 'auth' | 'dashboard' | 'campaigns' | 'verify' | 'wallet' | 'admin' | 'recovery';

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
  showToast: (message: string, type?: 'success' | 'error') => void;
  appState?: AppState;
  setAppState?: React.Dispatch<React.SetStateAction<AppState>>;
}

export interface AdminDashboardProps {
  showToast: (message: string, type: 'success' | 'error') => void;
  data?: any;
  onRefresh?: () => void;
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

// Auth & Recovery Props
export interface AccountRecoveryProps {
  setCurrentView: (view: ViewType) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export interface AuthViewProps {
  setCurrentUser: (user: User | null) => void;
  setCurrentView: (view: ViewType) => void;
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

// ✅ ADDITIONAL TYPES
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
  genAI: any;
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
  onReportClick: () => void;
}

// ✅ ADDED MISSING TYPES
export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color: string;
}

export interface ActivityLog {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  user?: string;
}

// Firebase Service
export interface FirebaseService {
  checkFirebaseConnection: () => Promise<boolean>;
  adminService: {
    getAdminDashboardData: () => Promise<any>;
    onAdminDataUpdate: (callbacks: any) => () => void;
    updateUserStatus: (userId: string, status: UserStatus) => Promise<boolean>;
    approvePayout: (payoutId: string, adminId: string) => Promise<boolean>;
    approveSubmission: (submissionId: string, adminId: string) => Promise<boolean>;
    rejectPayout: (payoutId: string, adminId: string) => Promise<boolean>;
    rejectSubmission: (submissionId: string, adminId: string) => Promise<boolean>;
    resolveReport: (reportId: string, resolverId: string) => Promise<boolean>;
    deleteReport: (reportId: string) => Promise<boolean>;
    updateCampaign: (campaignId: string, updates: Partial<Campaign>) => Promise<boolean>;
    toggleCampaignStatus: (campaignId: string, currentStatus: boolean) => Promise<void>;
    deleteCampaign: (campaignId: string) => Promise<void>;
    createCampaign: (campaignData: Omit<Campaign, 'id' | 'createdAt'>, creatorId: string) => Promise<string>;
  };
  cashflowService: {
    getCashflowData: () => Promise<Cashflow>;
    updateDailyLimit: (dailyLimit: number) => Promise<boolean>;
    resetTodaySpent: () => Promise<boolean>;
  };
  broadcastService: {
    sendBroadcast: (content: string, senderId: string, senderName: string, targetUserId?: string) => Promise<string>;
    markAsRead: (broadcastId: string, userId: string) => Promise<boolean>;
    getUsers: () => Promise<User[]>;
  };
}

export interface FormatOptions {
  currency?: boolean;
  date?: boolean;
  compact?: boolean;
}

export type {
  User as IUser,
  Campaign as ICampaign,
  Submission as ISubmission,
  PayoutRequest as IPayoutRequest,
  Broadcast as IBroadcast,
  UserReport as IUserReport,
  AppLog as IAppLog,
  AppState as IAppState
};
