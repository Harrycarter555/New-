import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updatePassword
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';

interface AuthViewProps {
  setCurrentUser: (user: User | null) => void;
  setCurrentView: (view: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AuthView: React.FC<AuthViewProps> = ({ setCurrentUser, setCurrentView, showToast }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'recover'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authKey, setAuthKey] = useState('');
  const [generatedAuthKey, setGeneratedAuthKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Generate authentication key
  const generateAuthKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'RE-';
    
    for (let i = 0; i < 12; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    key += '-' + Date.now().toString(36).toUpperCase();
    return key;
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      showToast('Please enter email and password', 'error');
      return;
    }
    
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        setCurrentUser({ ...userData, lastLoginAt: Date.now() });
        setCurrentView(userData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
        showToast(`Welcome back, ${userData.username}!`, 'success');
      } else {
        showToast('Account data not found', 'error');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      showToast('Login failed: ' + (error.message || 'Invalid credentials'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !email || !password) {
      showToast('Please fill all fields', 'error');
      return;
    }
    
    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    
    try {
      setLoading(true);
      
      // 1. Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 2. Generate auth key
      const securityKey = generateAuthKey();
      
      // 3. Create user object
      const newUser = {
        id: userCredential.user.uid,
        username,
        email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [],
        securityKey,
        savedSocialUsername: '',
        payoutMethod: {},
        payoutDetails: {},
        failedAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: Date.now(),
        createdAt: new Date()
      };
      
      // 4. Save to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      
      // 5. Sign out
      await auth.signOut();
      
      // 6. Show auth key in modal
      setGeneratedAuthKey(securityKey);
      setShowKeyModal(true);
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = 'Signup failed';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already registered';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Recovery
  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !authKey || !newPassword) {
      showToast('Please fill all fields', 'error');
      return;
    }
    
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    
    try {
      setLoading(true);
      
      // First, find user by trying to sign in
      let userId = '';
      let userData: User | null = null;
      
      try {
        // Try to get user by email (we need to find the user first)
        // We'll use a dummy sign-in to get user ID
        const userCredential = await signInWithEmailAndPassword(auth, email, 'dummy_password');
        userId = userCredential.user.uid;
        
        // Get user document
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          userData = userDoc.data() as User;
        }
      } catch (err) {
        // Expected error - wrong password
      }
      
      if (!userData) {
        showToast('Account not found', 'error');
        return;
      }
      
      // Verify authentication key
      if (userData.securityKey !== authKey) {
        showToast('Invalid authentication key', 'error');
        return;
      }
      
      // Update password
      const currentUser = auth.currentUser;
      if (currentUser) {
        await updatePassword(currentUser, newPassword);
      } else {
        // If not logged in, we need to sign in first
        const userCredential = await signInWithEmailAndPassword(auth, email, 'dummy_password');
        await updatePassword(userCredential.user, newPassword);
      }
      
      showToast('Password reset successful! Please login with new password.', 'success');
      setActiveTab('login');
      setEmail('');
      setAuthKey('');
      setNewPassword('');
      setConfirmNewPassword('');
      
    } catch (error: any) {
      console.error('Recovery error:', error);
      showToast('Recovery failed: ' + (error.message || 'Invalid credentials'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submit based on active tab
  const handleSubmit = (e: React.FormEvent) => {
    if (activeTab === 'login') return handleLogin(e);
    if (activeTab === 'signup') return handleSignup(e);
    if (activeTab === 'recover') return handleRecover(e);
  };

  // Close key modal and continue to login
  const handleCloseKeyModal = () => {
    setShowKeyModal(false);
    setGeneratedAuthKey('');
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setActiveTab('login');
    showToast('Account created! Please login with your credentials.', 'success');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-white mb-2">
            REEL<span className="text-cyan-400">EARN</span>
          </h1>
          <p className="text-slate-500 text-sm">Earn by creating viral reels</p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel p-8 rounded-3xl">
          
          {/* Tabs */}
          <div className="flex mb-6 bg-slate-900/50 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3 rounded-xl font-bold ${activeTab === 'login' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}
            >
              LOGIN
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-3 rounded-xl font-bold ${activeTab === 'signup' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}
            >
              SIGN UP
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('recover')}
              className={`flex-1 py-3 rounded-xl font-bold ${activeTab === 'recover' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}
            >
              RECOVER
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Username for signup only */}
            {activeTab === 'signup' && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white"
                  required
                />
              </div>
            )}

            {/* Email for all tabs */}
            <div className="mb-4">
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white"
                required
              />
            </div>

            {/* Authentication Key for recover only */}
            {activeTab === 'recover' && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Enter authentication key"
                  value={authKey}
                  onChange={(e) => setAuthKey(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white"
                  required
                />
                <p className="text-slate-500 text-xs mt-2">
                  Enter the authentication key you received during signup
                </p>
              </div>
            )}

            {/* Current Password for login and signup */}
            {(activeTab === 'login' || activeTab === 'signup') && (
              <div className="mb-4">
                <input
                  type="password"
                  placeholder={activeTab === 'signup' ? "Create password (min 6 chars)" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white"
                  required
                />
              </div>
            )}

            {/* Confirm Password for signup only */}
            {activeTab === 'signup' && (
              <div className="mb-4">
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white"
                  required
                />
              </div>
            )}

            {/* New Password for recover only */}
            {activeTab === 'recover' && (
              <>
                <div className="mb-4">
                  <input
                    type="password"
                    placeholder="New password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white"
                    required
                  />
                </div>
                <div className="mb-6">
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white"
                    required
                  />
                </div>
              </>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2">⟳</span>
                  {activeTab === 'login' ? 'LOGGING IN...' : 
                   activeTab === 'signup' ? 'CREATING...' : 'RESETTING...'}
                </span>
              ) : (
                <>
                  {activeTab === 'login' && '🔐 LOGIN'}
                  {activeTab === 'signup' && '✨ CREATE ACCOUNT'}
                  {activeTab === 'recover' && '🔄 RESET PASSWORD'}
                </>
              )}
            </button>
          </form>

          {/* Quick Links */}
          <div className="mt-6 text-center">
            {activeTab === 'login' && (
              <p className="text-slate-500 text-sm">
                Forgot password?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('recover')}
                  className="text-cyan-400 font-bold hover:text-cyan-300"
                >
                  Recover Account
                </button>
              </p>
            )}
            {(activeTab === 'signup' || activeTab === 'recover') && (
              <p className="text-slate-500 text-sm">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
                  className="text-cyan-400 font-bold hover:text-cyan-300"
                >
                  Login Instead
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold">SYSTEM STATUS</span>
            <span className="text-green-400 text-xs font-bold flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              READY
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            • Email authentication
            <br />
            • Authentication key recovery
            <br />
            • Secure password reset
          </p>
        </div>
      </div>

      {/* Authentication Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔐</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Account Created Successfully!</h2>
              <p className="text-slate-400">Save your authentication key</p>
            </div>
            
            <div className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-xl">
              <div className="text-center mb-4">
                <span className="text-green-400 text-sm font-bold">YOUR AUTHENTICATION KEY</span>
              </div>
              
              <div className="bg-black/50 p-4 rounded-lg border border-green-500/20 mb-4">
                <code className="text-green-300 text-sm font-mono break-all">
                  {generatedAuthKey}
                </code>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedAuthKey);
                    showToast('Key copied to clipboard!', 'success');
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium"
                >
                  📋 Copy Key
                </button>
                <button
                  onClick={handleCloseKeyModal}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium"
                >
                  ✅ Continue
                </button>
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-yellow-500 text-xs p-3 bg-yellow-500/10 rounded-lg mb-4">
                ⚠️ Save this key securely! You'll need it for account recovery.
              </div>
              
              <div className="text-slate-500 text-xs">
                Click "Continue" to login with your new account
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthView;
