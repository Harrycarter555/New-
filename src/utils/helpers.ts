// src/utils/helpers.ts
import { AppLog } from '../types';

export const getPasswordStrength = (pass: string) => {
  if (!pass) return { score: 0, label: 'NONE', color: 'bg-slate-800' };
  let score = 0;
  if (pass.length > 5) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  if (pass.length > 9) score++;

  if (score === 1) return { score, label: 'WEAK', color: 'bg-red-500' };
  if (score === 2) return { score, label: 'FAIR', color: 'bg-orange-500' };
  if (score === 3) return { score, label: 'GOOD', color: 'bg-cyan-500' };
  if (score === 4) return { score, label: 'STRONG', color: 'bg-green-500' };
  return { score: 0, label: 'VERY WEAK', color: 'bg-red-600' };
};

export const createLog = (
  type: AppLog['type'],
  message: string,
  userId?: string,
  username?: string
): AppLog => ({
  id: `log-\( {Date.now()}- \){Math.random().toString(36).slice(2, 8)}`,
  type,
  message,
  userId,
  username,
  timestamp: Date.now(),
});
