import { User, UserRole } from '../types';

export const requireAuth = (user: User | null) => {
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
};

export const requireAdmin = (user: User) => {
  if (user.role !== UserRole.ADMIN) {
    throw new Error('Admin access required');
  }
  return user;
};

export const validatePayoutRequest = (amount: number, minAmount: number, balance: number) => {
  if (amount < minAmount) {
    return `Minimum withdrawal is ₹${minAmount}`;
  }
  if (amount > balance) {
    return 'Insufficient balance';
  }
  return null;
};

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .substring(0, 500); // Limit length
};
