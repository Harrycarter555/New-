import React, { useState } from 'react';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ViewType } from '../types';

interface AccountRecoveryProps {
  setCurrentView: (view: ViewType) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AccountRecovery: React.FC<AccountRecoveryProps> = ({ setCurrentView, showToast }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string>('');

  // Simple password reset function
  const handleSendResetLink = async () => {
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
      
      // Send password reset email
      await sendPasswordResetEmail(auth, email);
      
      showToast('✅ Password reset link sent! Check your email.', 'success');
      setResetSent(true);
      
    } catch (error: any) {
      console.error('Reset password error:', error);
      
      let errorMessage = '';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Try again in 15 minutes.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Check your internet connection.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      } else {
        errorMessage = 'Failed to send reset link. Please try again.';
      }
      
      showToast(errorMessage, 'error');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setEmail('');
    setResetSent(false);
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white mb-2">
            🔐 PASSWORD RESET
          </h1>
          <p className="text-slate-500 text-sm">Reset your account password</p>
        </div>

        {/* Reset Card */}
        <div className="glass-panel p-8 rounded-3xl">
          
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl">
              <p className="text-red-400 text-sm font-bold flex items-center">
                <span className="mr-2">⚠</span> {error}
              </p>
            </div>
          )}

          {/* Reset Form */}
          {!resetSent ? (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Enter Your Email</h3>
                <p className="text-sm text-slate-400">We'll send a password reset link to your email</p>
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
                  onKeyPress={(e) => e.key === 'Enter' && handleSendResetLink()}
                />
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleSendResetLink}
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
          ) : (
            /* Success Message */
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-4xl">✅</span>
              </div>
              
              <h3 className="text-xl font-bold text-white">Check Your Email!</h3>
              
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-sm text-slate-300">
                  Password reset link sent to: <br />
                  <span className="font-bold text-white">{email}</span>
                </p>
                <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-400 font-bold mb-1">📧 Important:</p>
                  <ul className="text-xs text-amber-300 space-y-1">
                    <li>• Check your inbox AND spam folder</li>
                    <li>• Click the link in the email</li>
                    <li>• Create a new password</li>
                    <li>• Link expires in 1 hour</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    resetForm();
                    setCurrentView('auth');
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

        {/* Info Box */}
        <div className="mt-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
          <p className="text-slate-400 text-xs font-bold mb-2 flex items-center">
            <span className="mr-2">ℹ️</span> HOW IT WORKS
          </p>
          <ul className="text-slate-500 text-xs space-y-1.5">
            <li className="flex items-start">
              <span className="mr-2">1.</span>
              <span>Enter your email above</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">2.</span>
              <span>Check email for reset link from Firebase</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">3.</span>
              <span>Click link and create new password</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">4.</span>
              <span>Login with new password</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AccountRecovery;
