// Security Key Utility Functions

/**
 * Generate a new security key
 * Format: REEL-XXXX-XXXX-XXXX-XXXX (32 characters)
 */
export const generateSecurityKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REEL-${key.substring(0, 8)}-${key.substring(8, 16)}-${key.substring(16, 24)}-${key.substring(24, 32)}`;
};

/**
 * Validate security key format
 */
export const validateSecurityKey = (key: string): boolean => {
  if (!key) return false;
  
  // Check format: REEL-XXXX-XXXX-XXXX-XXXX
  const regex = /^REEL-[A-Za-z0-9!@#$%^&*]{8}-[A-Za-z0-9!@#$%^&*]{8}-[A-Za-z0-9!@#$%^&*]{8}-[A-Za-z0-9!@#$%^&*]{8}$/;
  return regex.test(key);
};

/**
 * Mask security key for display
 */
export const maskSecurityKey = (key: string): string => {
  if (!key) return 'Not set';
  if (key.length < 20) return key;
  
  const firstPart = key.substring(0, 8);
  const lastPart = key.substring(key.length - 4);
  return `${firstPart}...${lastPart}`;
};

/**
 * Get security key strength
 */
export const getKeyStrength = (key: string): {
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number;
} => {
  let score = 0;
  
  if (!key) return { strength: 'weak', score: 0 };
  
  // Length check
  if (key.length >= 32) score += 25;
  else if (key.length >= 24) score += 15;
  else if (key.length >= 16) score += 10;
  
  // Character variety
  const hasUpperCase = /[A-Z]/.test(key);
  const hasLowerCase = /[a-z]/.test(key);
  const hasNumbers = /\d/.test(key);
  const hasSpecial = /[!@#$%^&*]/.test(key);
  
  if (hasUpperCase) score += 20;
  if (hasLowerCase) score += 20;
  if (hasNumbers) score += 20;
  if (hasSpecial) score += 15;
  
  // Determine strength
  if (score >= 90) return { strength: 'very-strong', score };
  if (score >= 70) return { strength: 'strong', score };
  if (score >= 40) return { strength: 'medium', score };
  return { strength: 'weak', score };
};

/**
 * Encrypt security key (basic obfuscation)
 */
export const encryptKey = (key: string): string => {
  if (!key) return '';
  return btoa(key.split('').reverse().join(''));
};

/**
 * Decrypt security key
 */
export const decryptKey = (encrypted: string): string => {
  if (!encrypted) return '';
  return atob(encrypted).split('').reverse().join('');
};

/**
 * Generate key expiry date (6 months from now)
 */
export const getKeyExpiryDate = (): number => {
  const now = new Date();
  now.setMonth(now.getMonth() + 6);
  return now.getTime();
};

/**
 * Check if key is expired
 */
export const isKeyExpired = (createdAt: number): boolean => {
  const sixMonthsInMs = 6 * 30 * 24 * 60 * 60 * 1000;
  return Date.now() - createdAt > sixMonthsInMs;
};

/**
 * Generate QR code data for security key
 */
export const generateKeyQRData = (key: string, username: string): string => {
  return JSON.stringify({
    type: 'security_key',
    platform: 'ReelEarn',
    username: username,
    key: key,
    generatedAt: Date.now(),
    note: 'Save this QR code for account recovery'
  });
};

/**
 * Create security key backup object
 */
export const createKeyBackup = (key: string, userData: any) => {
  return {
    version: '1.0',
    platform: 'ReelEarn',
    userId: userData.id,
    username: userData.username,
    email: userData.email,
    securityKey: key,
    backupDate: Date.now(),
    instructions: [
      'This is your account recovery key.',
      'Save this file in a secure location.',
      'Do not share with anyone.',
      'Required for password reset.'
    ]
  };
};
