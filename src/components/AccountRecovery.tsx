import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';
import { sendPasswordResetEmail } from 'firebase/auth';

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

  // Step 1: Verify Email
  const handleVerifyEmail = async () => {
    if (!email.trim()) {
      showToast('Please enter your email', 'error');
      return;
    }

    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showToast('No account found with this email', 'error');
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const user = userDoc.data() as User;
      
      setUserData(user);
      setStep(2);
      showToast('Email verified! Please enter your security key.', 'success');
      
    } catch (error) {
      console.error('Error verifying email:', error);
      showToast('Failed to verify email. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Security Key
  const handleVerifySecurityKey = async () => {
    if (!securityKey.trim()) {
      showToast('Please enter your security key', 'error');
      return;
    }

    if (!userData) {
      showToast('User data not found. Please start over.', 'error');
      setStep(1);
      return;
    }

    if (userData.securityKey !== securityKey.trim()) {
      showToast('Invalid security key. Please try again.', 'error');
      return;
    }

    setStep(3);
    showToast('Security key verified! You can now reset your password.', 'success');
  };

  // Step 3: Reset Password
  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      showToast('Please enter new password', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Send password reset email
      await sendPasswordResetEmail(auth, email);
      
      showToast('Password reset email sent! Check your inbox.', 'success');
      setRequestSent(true);
      
      // Generate request ID
      const reqId = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      setRequestId(reqId);
      
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      let errorMessage = 'Failed to reset password. ';
      if (error.code === 'auth/user-not-found') {
        errorMessage += 'User not found.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage += 'Too many attempts. Try again later.';
      } else {
        errorMessage += 'Please try again.';
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Request Admin Help
  const handleRequestAdminHelp = async () => {
    if (!userData) {
      showToast('User data not found', 'error');
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
        updatedAt: Date.now(),
        requestId: `ADMIN-REQ-${Date.now().toString(36).toUpperCase()}`
      };

      await addDoc(requestsRef, requestData);
      
      showToast('Request sent to admin! They will contact you soon.', 'success');
      
      // Auto-generate admin notification
      const adminMsg = `🔐 ACCOUNT RECOVERY REQUEST\n\nUser: @${userData.username}\nEmail: ${userData.email}\nReason: Lost Security Key\n\nPlease contact user with recovery options.`;
      
      // Send to admin broadcasts
      const broadcastRef = collection(db, 'admin_notifications');
      await addDoc(broadcastRef, {
        type: 'recovery_request',
        title: 'Account Recovery Needed',
        message: adminMsg,
        userId: userData.id,
        username: userData.username,
        priority: 'high',
        timestamp: Date.now(),
        read: false
      });
      
    } catch (error) {
      console.error('Admin request error:', error);
      showToast('Failed to send request. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate new security key (admin only - for demonstration)
  const generateNewSecurityKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `REEL-${key.substring(0, 8)}-${key.substring(8, 16)}-${key.substring(16, 24)}-${key.substring(24, 32)}`;
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
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step === num 
                    ? 'bg-cyan-500 text-black' 
                    : step > num 
                    ? 'bg-green-500 text-black' 
                    : 'bg-slate-800 text-slate-500'
                }`}>
                  {step > num ? '✓' : num}
                </div>
                <span className="text-xs mt-2 text-slate-500">
                  {num === 1 ? 'Verify Email' : num === 2 ? 'Security Key' : 'Reset'}
                </span>
              </div>
            ))}
          </div>

          {/* Step 1: Email Verification */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">📧</span>
                </div>
                <h3 className="text-lg font-bold text-white">Enter Your Email</h3>
                <p className="text-sm text-slate-400">We'll check if your account exists</p>
              </div>

              <div>
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleVerifyEmail}
                disabled={loading || !email.trim()}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>

              <button
                onClick={() => setCurrentView('auth')}
                className="w-full text-slate-400 hover:text-white text-sm py-2"
              >
                ← Back to Login
              </button>
            </div>
          )}

          {/* Step 2: Security Key Verification */}
          {step === 2 && userData && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">🔑</span>
                </div>
                <h3 className="text-lg font-bold text-white">Enter Security Key</h3>
                <p className="text-sm text-slate-400">Check your saved security key</p>
                
                <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-sm text-slate-300">
                    Account: <span className="font-bold text-white">@{userData.username}</span>
                  </p>
                  <p className="text-xs text-slate-400 truncate">{userData.email}</p>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Enter your 32-character security key"
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Enter the security key you saved during signup
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleVerifySecurityKey}
                  disabled={loading || !securityKey.trim()}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify Security Key'}
                </button>

                {/* Lost Security Key Option */}
                <div className="p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
                  <p className="text-xs text-red-400 font-bold mb-2">⚠️ Lost Security Key?</p>
                  <p className="text-xs text-red-300 mb-2">
                    Without your security key, automatic recovery is not possible.
                  </p>
                  <button
                    onClick={handleRequestAdminHelp}
                    disabled={loading}
                    className="w-full bg-red-500/10 text-red-400 font-bold py-2 rounded-lg text-sm hover:bg-red-500/20"
                  >
                    Request Admin Help
                  </button>
                  <p className="text-xs text-red-300 mt-2">
                    Admin will contact you via email. This may take 24-48 hours.
                  </p>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="w-full text-slate-400 hover:text-white text-sm py-2"
                >
                  ← Back to Email
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Reset Password */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">🔄</span>
                </div>
                <h3 className="text-lg font-bold text-white">Reset Password</h3>
                <p className="text-sm text-slate-400">Create a new strong password</p>
                
                <div className="mt-4 p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
                  <p className="text-sm text-green-400 font-bold">✓ Security Key Verified</p>
                  <p className="text-xs text-green-300">
                    Your identity has been confirmed. You can now reset your password.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <input
                    type="password"
                    placeholder="New password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    disabled={loading}
                  />
                </div>

                <div>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    disabled={loading}
                  />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">Passwords don't match</p>
                  )}
                </div>

                <button
                  onClick={handleResetPassword}
                  disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Reset Password'}
                </button>

                <button
                  onClick={() => setStep(2)}
                  className="w-full text-slate-400 hover:text-white text-sm py-2"
                >
                  ← Back to Security Key
                </button>
              </div>
            </div>
          )}

          {/* Request Sent Success */}
          {requestSent && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-4xl">✅</span>
              </div>
              
              <h3 className="text-xl font-bold text-white">Request Submitted!</h3>
              
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-sm text-slate-300 mb-2">
                  Request ID: <span className="font-mono text-cyan-400">{requestId}</span>
                </p>
                <p className="text-sm text-slate-300">
                  We've sent password reset instructions to: 
                  <span className="font-bold text-white"> {email}</span>
                </p>
              </div>
              
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-400 font-bold mb-1">📋 What to do next:</p>
                <ul className="text-xs text-blue-300 text-left space-y-1">
                  <li>• Check your email inbox (and spam folder)</li>
                  <li>• Click the password reset link in the email</li>
                  <li>• Create a new strong password</li>
                  <li>• Login with your new password</li>
                </ul>
              </div>

              <button
                onClick={() => {
                  setCurrentView('auth');
                  showToast('Please check your email for reset instructions', 'info');
                }}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-3 rounded-xl hover:opacity-90"
              >
                Return to Login
              </button>
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
              <span><strong>Security Key</strong> is required for self-recovery</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Without security key, <strong>admin assistance</strong> is needed</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Admin may require <strong>additional verification</strong></span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Always save your security key in a <strong>secure place</strong></span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AccountRecovery;
