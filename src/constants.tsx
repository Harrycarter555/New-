// src/constants.tsx
import { AppState, UserRole, UserStatus } from './types.ts';

export const ICONS = {
  User: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    </svg>
  ),
  Bell: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  X: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Home: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Wallet: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 18h4v-4h-4v4z" />
    </svg>
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  ArrowLeft: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  Copy: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  ),
  // Agar Users icon chahiye bottom nav ke liye (admin ke liye)
  Users: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

export const INITIAL_DATA: AppState = {
  users: [
    {
      id: 'admin-1',
      username: 'admin',
      password: '123',
      email: 'admin@reelearn.pro',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      walletBalance: 0,
      pendingBalance: 0,
      totalEarnings: 0,
      joinedAt: Date.now(),
      readBroadcastIds: [],
      securityKey: 'ADMIN-MASTER'
    },
    // Agar aur users add karne hain toh yahan paste kar dena, warna empty rakh sakte ho
  ],
  campaigns: [
    // Agar campaigns add karne hain toh yahan paste kar dena, warna empty rakh sakte ho
  ],
  submissions: [],
  payoutRequests: [],
  broadcasts: [
    { id: 'm-1', content: 'Welcome to ReelEarn Pro! Check your missions and start earning.', senderId: 'admin-1', timestamp: Date.now() }
  ],
  reports: [],
  cashflow: { dailyLimit: 100000, todaySpent: 0, startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] },
  logs: [],
  config: { minWithdrawal: 100 }
};
