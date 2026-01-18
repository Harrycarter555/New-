import React, { useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';
import { sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

interface AccountRecoveryProps {
  setCurrentView: (view: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AccountRecovery: React.FC<AccountRecoveryProps> = ({ setCurrentView, showToast }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [securityKey, setSecurityKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState<string>('');

  // Clear errors
  const clearErrors = () => setError('');

  // Step 1: Verify Email
  const handleVerifyEmail = async () => {
    clearErrors();
    
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
      
      setUserData(user);
      setStep(2);
      showToast('Email verified! Please enter your security key.', 'success');
      
    } catch (error: any) {
      console.error('Error verifying email:', error);
      showToast('Failed to verify email. Please try again.', 'error');
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Security Key
  const handleVerifySecurityKey = async () => {
    clearErrors();
    
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

    setStep(3);
    showToast('Security key verified! You can now reset your password.', 'success');
  };

  // Step 3: Reset Password
  const handleResetPassword = async () => {
    clearErrors();
    
    if (!newPassword.trim()) {
      showToast('Please enter new password', 'error');
      setError('New password required');
      return;
    }

    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      setError('Password too short (min 6 chars)');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      
      if (!userData) {
        showToast('User data not found', 'error');
        return;
      }

      // Method 1: Send password reset email (recommended)
      await sendPasswordResetEmail(auth, userData.email);
      
      showToast('✅ Password reset email sent! Check your inbox and spam folder.', 'success');
      setRequestSent(true);
      
      // Generate request ID
      const reqId = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      setRequestId(reqId);
      
      // Log the recovery attempt
      try {
        const logsRef = collection(db, 'recovery_logs');
        await addDoc(logsRef, {
          userId: userData.id,
          username: userData.username,
          email: userData.email,
          requestId: reqId,
          timestamp: Date.now(),
          status: 'email_sent',
          step: 'password_reset'
        });
      } catch (logError) {
        console.error('Failed to log recovery:', logError);
      }
      
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      let errorMessage = 'Failed to reset password. ';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No Firebase account found with this email.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Try again in 15 minutes.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Check your internet connection.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else {
        errorMessage = 'Please try again or contact support.';
      }
      
      showToast(errorMessage, 'error');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Request Admin Help (when security key is lost)
  const handleRequestAdminHelp = async () => {
    clearErrors();
    
    if (!userData) {
      showToast('User data not found', 'error');
      setError('User data missing');
      return;
    }

    try {
      setLoading(true);
      
      // Create recovery request in database
      const requestsRef = collection(db, 'recovery_requests');
      const requestData = {
        userId: userData.id,
        username: userData.username,
        email: userData.email,
        status: 'pending',
        reason: 'security_key_lost',
        message: `User ${userData.username} (${userData.email}) lost security key and needs help with account recovery.`,
        createdAt: Date.now(),
        requestId: `ADMIN-REQ-${Date.now().toString(36).toUpperCase()}`,
        userEmail: userData.email, // Extra field for easy querying
        timestamp: Date.now()
      };

      await addDoc(requestsRef, requestData);
      
      showToast('✅ Request sent to admin! They will contact you via email.', 'success');
      setRequestSent(true);
      
      // Generate request ID
      const reqId = requestData.requestId;
      setRequestId(reqId);
      
    } catch (error: any) {
      console.error('Admin request error:', error);
      showToast('Failed to send request. Please try again.', 'error');
      setError('Request failed');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setEmail('');
    setSecurityKey('');
    setNewPassword('');
    setConfirmPassword('');
    setUserData(null);
    setRequestSent(false);
    setRequestId('');
    setError('');
    setStep(1);
  };

  // Import addDoc at the top
  import { addDoc } from 'firebase/firestore';

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
            {[1, 2, 3].map((num) => (
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
                  {num === 1 ? 'Email' : num === 2 ? 'Key' : 'Reset'}
                </span>
              </div>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl animate-pulse">
              <p className="text-red-400 text-sm font-bold flex items-center">
                <span className="mr-2">⚠</span> {error}
              </p>
            </div>
          )}

          {/* Step 1: Email Verification */}
          {step === 1 && !requestSent && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Enter Your Email</h3>
                <p className="text-sm text-slate-400">We'll check if your account exists</p>
              </div>

              <div>
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearErrors();
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
                      <span className="animate-spin mr-2">⟳</span> Verifying...
                    </span>
                  ) : 'Verify Email'}
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

          {/* Step 2: Security Key Verification */}
          {step === 2 && userData && !requestSent && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Enter Security Key</h3>
                <p className="text-sm text-slate-400">Check your saved security key</p>
                
                <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-slate-300">
                    Account: <span className="font-bold text-white">@{userData.username}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Joined: {new Date(userData.joinedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Enter your security key (case-sensitive)"
                  value={securityKey}
                  onChange={(e) => {
                    setSecurityKey(e.target.value);
                    clearErrors();
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
                  ) : 'Verify Security Key'}
                </button>

                {/* Lost Security Key Option */}
                <div className="p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
                  <p className="text-xs text-red-400 font-bold mb-2">⚠️ Lost Security Key?</p>
                  <p className="text-xs text-red-300 mb-3">
                    Don't worry! Admin can help you recover your account.
                  </p>
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
                    clearErrors();
                  }}
                  className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors"
                  disabled={loading}
                >
                  ← Back to Email
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Reset Password */}
          {step === 3 && userData && !requestSent && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Reset Password</h3>
                <p className="text-sm text-slate-400">Create a new strong password</p>
                
                <div className="mt-3 p-3 bg-slate-800/30 rounded-lg">
                  <p className="text-sm text-slate-300">
                    Account: <span className="font-bold text-white">@{userData.username}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <input
                    type="password"
                    placeholder="New password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      clearErrors();
                    }}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                    disabled={loading}
                  />
                  {newPassword && newPassword.length < 6 && (
                    <p className="text-red-400 text-xs mt-1 ml-1">Password must be at least 6 characters</p>
                  )}
                </div>

                <div>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      clearErrors();
                    }}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
                    disabled={loading}
                    onKeyPress={(e) => e.key === 'Enter' && handleResetPassword()}
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-red-400 text-xs mt-1 ml-1">Passwords do not match</p>
                  )}
                  {confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                    <p className="text-green-400 text-xs mt-1 ml-1">✓ Passwords match</p>
                  )}
                </div>

                <button
                  onClick={handleResetPassword}
                  disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
                  className={`w-full bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold py-3 rounded-xl transition-all ${loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6 ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]'}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="animate-spin mr-2">⟳</span> Processing...
                    </span>
                  ) : 'Reset Password'}
                </button>

                <button
                  onClick={() => {
                    setStep(2);
                    clearErrors();
                  }}
                  className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors"
                  disabled={loading}
                >
                  ← Back to Security Key
                </button>
              </div>
            </div>
          )}

          {/* Request Sent Success */}
          {requestSent && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                <span className="text-4xl">✅</span>
              </div>
              
              <h3 className="text-xl font-bold text-white">Request Submitted!</h3>
              
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <div className="mb-3">
                  <p className="text-sm text-slate-300">
                    <span className="font-bold text-white">Request ID:</span> {requestId}
                  </p>
                </div>
                <p className="text-sm text-slate-300">
                  {step === 3 
                    ? `Password reset email sent to: ${email}`
                    : `Admin request sent for: ${userData?.username || email}`
                  }
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {step === 3 
                    ? 'Check your inbox (and spam folder) for reset link'
                    : 'Admin will contact you via email within 24 hours'
                  }
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    resetForm();
                    setCurrentView('auth');
                    showToast('Please check your email for next steps', 'info');
                  }}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-3 rounded-xl hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Return to Login
                </button>
                
                <button
                  onClick={resetForm}
                  className="w-full text-slate-400 hover:text-white text-sm py-2 transition-colors"
                >
                  Start New Recovery
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recovery Info */}
        <div className="mt-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
          <p className="text-slate-400 text-xs font-bold mb-2 flex items-center">
            <span className="mr-2">ℹ️</span> RECOVERY INFORMATION
          </p>
          <ul className="text-slate-500 text-xs space-y-1.5">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Security key is required for self-recovery</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Without key, admin assistance is needed</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Always save your security key securely</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Check spam folder for reset emails</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AccountRecovery;
