import React, { useState } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';
import { sendPasswordResetEmail } from 'firebase/auth';

interface AccountRecoveryProps {
  setCurrentView: (view: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AccountRecovery: React.FC<AccountRecoveryProps> = ({ setCurrentView, showToast }) => {
  const [step, setStep] = useState<1 | 2>(1); // Simplified to 2 steps
  const [email, setEmail] = useState('');
  const [securityKey, setSecurityKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState<string>('');

  // Step 1: Verify Email with Firebase Auth directly
  const handleVerifyEmail = async () => {
    setError('');
    
    if (!email.trim()) {
      showToast('Please enter your email', 'error');
      setError('Email is required');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('Please enter a valid email address', 'error');
      setError('Invalid email format');
      return;
    }

    try {
      setLoading(true);
      
      // Method 1: Try to send password reset email directly
      // This works even if Firestore rules block user query
      await sendPasswordResetEmail(auth, email);
      
      showToast('✅ Password reset email sent! Check your inbox and spam folder.', 'success');
      setRequestSent(true);
      
      // Generate request ID
      const reqId = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      setRequestId(reqId);
      
      // Try to log recovery attempt (optional)
      try {
        const logsRef = collection(db, 'recovery_logs');
        await addDoc(logsRef, {
          email: email.toLowerCase().trim(),
          requestId: reqId,
          timestamp: Date.now(),
          status: 'email_sent',
          method: 'direct_reset'
        });
      } catch (logError) {
        console.log('Recovery log failed (optional)', logError);
      }
      
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      let errorMessage = '';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
        showToast(errorMessage, 'error');
        setError(errorMessage);
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Try again in 15 minutes.';
        showToast(errorMessage, 'error');
        setError(errorMessage);
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Check your internet connection.';
        showToast(errorMessage, 'error');
        setError(errorMessage);
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
        showToast(errorMessage, 'error');
        setError(errorMessage);
      } else {
        // For other errors, try alternative method
        console.log('Trying alternative method...');
        tryAlternativeMethod();
      }
    } finally {
      setLoading(false);
    }
  };

  // Alternative method: Try to get user data from Firestore
  const tryAlternativeMethod = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showToast('No account found with this email', 'error');
        setError('Account not found');
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const user = { id: userDoc.id, ...userDoc.data() } as User;
      
      // Check if user is active
      if (user.status !== UserStatus.ACTIVE) {
        showToast(`Account is ${user.status}. Contact admin for help.`, 'error');
        setError(`Account ${user.status}`);
        return;
      }
      
      // Set user data and move to security key step
      setUserData(user);
      setStep(2);
      showToast('Email verified! Please enter your security key for account verification.', 'success');
      
    } catch (firestoreError: any) {
      console.error('Firestore error:', firestoreError);
      
      let errorMessage = 'Failed to verify account. ';
      if (firestoreError.code === 'permission-denied') {
        errorMessage = 'System error. Please contact admin directly at: admin@relearn.com';
      } else {
        errorMessage = 'Please try again or contact support.';
      }
      
      showToast(errorMessage, 'error');
      setError(errorMessage);
    }
  };

  // Step 2: Verify Security Key (optional step if user wants to verify identity)
  const handleVerifySecurityKey = async () => {
    setError('');
    
    if (!securityKey.trim()) {
      showToast('Please enter your security key', 'error');
      setError('Security key is required');
      return;
    }

    if (!userData) {
      showToast('User data not found. Please start over.', 'error');
      setError('User data missing');
      setStep(1);
      return;
    }

    // Check security key (case-insensitive)
    if (userData.securityKey.toLowerCase() !== securityKey.trim().toLowerCase()) {
      showToast('Invalid security key. Please try again.', 'error');
      setError('Invalid security key');
      return;
    }

    // Security key verified - now send reset email
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, userData.email);
      
      showToast('✅ Security key verified! Password reset email sent to your inbox.', 'success');
      setRequestSent(true);
      
      // Generate request ID
      const reqId = `REQ-SECURE-${Date.now().toString(36).toUpperCase()}`;
      setRequestId(reqId);
      
    } catch (error: any) {
      console.error('Reset password error:', error);
      showToast('Failed to send reset email. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Request Admin Help (when security key is lost)
  const handleRequestAdminHelp = async () => {
    setError('');
    
    if (!userData && !email.trim()) {
      showToast('Please enter your email first', 'error');
      return;
    }

    const userEmail = userData?.email || email;

    try {
      setLoading(true);
      
      // Create recovery request in database
      const requestsRef = collection(db, 'recovery_requests');
      const requestData = {
        email: userEmail.toLowerCase(),
        status: 'pending',
        reason: 'security_key_lost',
        message: `User needs help with account recovery. Email: ${userEmail}`,
        createdAt: Date.now(),
        requestId: `ADMIN-${Date.now().toString(36).toUpperCase()}`,
        timestamp: Date.now()
      };

      await addDoc(requestsRef, requestData);
      
      showToast('✅ Help request sent to admin! They will contact you via email.', 'success');
      setRequestSent(true);
      setRequestId(requestData.requestId);
      
    } catch (error: any) {
      console.error('Admin request error:', error);
      
      if (error.code === 'permission-denied') {
        showToast('System error. Please email admin directly at: admin@relearn.com', 'error');
        setError('Please email: admin@relearn.com');
      } else {
        showToast('Failed to send request. Please try again.', 'error');
        setError('Request failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // Direct Password Reset (Alternative flow)
  const handleDirectPasswordReset = async () => {
    setError('');
    
    if (!email.trim()) {
      showToast('Please enter your email first', 'error');
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      showToast('✅ Password reset email sent! Check your inbox.', 'success');
      setRequestSent(true);
    } catch (error: any) {
      console.error('Direct reset error:', error);
      
      if (error.code === 'auth/user-not-found') {
        showToast('No account found with this email', 'error');
        setError('Account not found');
      } else {
        showToast('Failed to send reset email', 'error');
        setError('Reset failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setEmail('');
    setSecurityKey('');
    setUserData(null);
    setRequestSent(false);
    setRequestId('');
    setError('');
    setStep(1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-2">
            🔐 ACCOUNT RECOVERY
          </h1>
          <p className="text-slate-500 text-sm">Recover your lost account</p>
        </div>

        {/* Recovery Card */}
        <div className="glass-panel p-8 rounded-3xl">
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-6">
            {[1, 2].map((num) => (
              <div key={num} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                  step === num 
                    ? 'bg-cyan-500 text-black scale-110' 
                    : step > num 
                    ? 'bg-green-500 text-black' 
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  {step > num ? '✓' : num}
                </div>
                <span className="text-xs mt-1 text-slate-500">
                  {num === 1 ? 'Email' : 'Verify'}
                </span>
              </div>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl">
              <p className="text-red-400 text-sm font-bold flex items-center">
                <span className="mr-2">⚠</span> {error}
              </p>
            </div>
          )}

          {/* Step 1: Email Verification */}
          {step === 1 && !requestSent && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Reset Your Password</h3>
                <p className="text-sm text-slate-400">Enter your email to receive reset link</p>
              </div>

              <div>
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                  disabled={loading}
                  onKeyPress={(e) => e.key === 'Enter' && handleVerifyEmail()}
                />
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleVerifyEmail}
                  disabled={loading || !email.trim()}
                  className={`w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-3 rounded-xl transition-all ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]'}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin mr-2">⟳</span> Sending Reset Link...
                    </span>
                  ) : 'Send Reset Link'}
                </button>

                <button
                  onClick={() => setCurrentView('auth')}
                  className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors"
                  disabled={loading}
                >
                  ← Back to Login
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Security Key Verification (Optional) */}
          {step === 2 && userData && !requestSent && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Verify Identity</h3>
                <p className="text-sm text-slate-400">Enter security key for additional verification</p>
                
                <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-slate-300">
                    Account: <span className="font-bold text-white">@{userData.username}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    This step is optional but recommended for security
                  </p>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Enter your security key (if available)"
                  value={securityKey}
                  onChange={(e) => {
                    setSecurityKey(e.target.value);
                    setError('');
                  }}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                  disabled={loading}
                  onKeyPress={(e) => e.key === 'Enter' && handleVerifySecurityKey()}
                />
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleVerifySecurityKey}
                  disabled={loading || !securityKey.trim()}
                  className={`w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-3 rounded-xl transition-all ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]'}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin mr-2">⟳</span> Verifying...
                    </span>
                  ) : 'Verify & Reset Password'}
                </button>

                {/* Skip security key option */}
                <button
                  onClick={handleDirectPasswordReset}
                  disabled={loading}
                  className="w-full bg-slate-800/50 border border-slate-700 text-white font-bold py-3 rounded-xl hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                >
                  Skip & Reset Password Directly
                </button>

                {/* Lost Security Key Option */}
                <div className="p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
                  <p className="text-xs text-red-400 font-bold mb-2">⚠️ Don't have security key?</p>
                  <button
                    onClick={handleRequestAdminHelp}
                    disabled={loading}
                    className={`w-full bg-red-500/10 text-red-400 font-bold py-2 rounded-lg text-sm transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500/20'}`}
                  >
                    {loading ? 'Sending Request...' : 'Request Admin Help'}
                  </button>
                </div>

                <button
                  onClick={() => {
                    setStep(1);
                    setError('');
                  }}
                  className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors"
                  disabled={loading}
                >
                  ← Back to Email
                </button>
              </div>
            </div>
          )}

          {/* Request Sent Success */}
          {requestSent && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-4xl">✅</span>
              </div>
              
              <h3 className="text-xl font-bold text-white">Reset Link Sent!</h3>
              
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                {requestId && (
                  <div className="mb-3">
                    <p className="text-sm text-slate-300">
                      <span className="font-bold text-white">Reference:</span> {requestId}
                    </p>
                  </div>
                )}
                <p className="text-sm text-slate-300">
                  Password reset email sent to: <span className="font-bold text-white">{email}</span>
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Check your inbox (and spam folder) for the reset link
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Link expires in 1 hour
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    resetForm();
                    setCurrentView('auth');
                    showToast('Please check your email for reset link', 'info');
                  }}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-3 rounded-xl hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Return to Login
                </button>
                
                <button
                  onClick={resetForm}
                  className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors"
                >
                  Reset Another Account
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recovery Info */}
        <div className="mt-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
          <p className="text-slate-400 text-xs font-bold mb-2 flex items-center">
            <span className="mr-2">ℹ️</span> IMPORTANT INFORMATION
          </p>
          <ul className="text-slate-500 text-xs space-y-1.5">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Reset link will be sent to your registered email</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Check spam folder if you don't see the email</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Reset link expires in 1 hour</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Need help? Email: admin@relearn.com</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AccountRecovery;
