// Existing ICONS object ko intact rakho
export const ICONS = {
  User: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    </svg>
  ),
  // ... existing icons
};

// NEW: Add APP_CONFIG constants
export const APP_CONFIG = {
  MIN_WITHDRAWAL: 100,
  MAX_WITHDRAWAL: 50000,
  DAILY_LIMIT: 100000,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
};

// NEW: Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Check your connection.',
  FIREBASE_ERROR: 'Server error. Please try again.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_EXISTS: 'Email already registered.',
  WEAK_PASSWORD: 'Password should be at least 6 characters.',
};

// NEW: Success messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful!',
  SIGNUP_SUCCESS: 'Account created successfully!',
  VERIFICATION_SUCCESS: 'Verification submitted!',
  WITHDRAWAL_SUCCESS: 'Withdrawal request submitted!',
};
