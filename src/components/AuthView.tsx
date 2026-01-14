import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';

interface AuthViewProps {
  setCurrentUser: (user: User | null) => void;
  setCurrentView: (view: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AuthView: React.FC<AuthViewProps> = ({ setCurrentUser, setCurrentView, showToast }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generatedAuthKey, setGeneratedAuthKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Generate secure authentication key
  const generateSecureAuthKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const specialSuffix = 'RE-';
    let key = specialSuffix;
    
    for (let i = 0; i < 12; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    key += '-' + Date.now().toString(36).toUpperCase();
    
    console.log('🔐 Generated auth key:', key);
    return key;
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Authentication key copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy', 'error'));
  };

  // Save key as text file
  const downloadKeyAsFile = (key: string, username: string, email: string) => {
    const content = `=== REEL EARN AUTHENTICATION KEY ===

Username: ${username}
Email: ${email}
Authentication Key: ${key}

=== IMPORTANT SECURITY NOTES ===

1. NEVER share this key with anyone
2. Store this key in a secure place
3. You will need this key to recover your account
4. This key cannot be recovered if lost

Generated on: ${new Date().toLocaleString()}

=== END OF KEY ===`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reelEarn_auth_key_${username}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear errors when switching tabs
  useEffect(() => {
    setErrors({});
    if (activeTab !== 'signup') {
      setGeneratedAuthKey('');
    }
  }, [activeTab]);

  const validateLoginForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignupForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      newErrors.username = 'Only letters, numbers, and underscores allowed';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      newErrors.password = 'Password must contain at least one letter and one number';
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔐 Login button clicked');
    
    if (!validateLoginForm()) {
      console.log('❌ Login validation failed');
      return;
    }
    
    try {
      setLoading(true);
      setErrors({});
      console.log('🚀 Starting login process...');
      
      // Direct Firebase authentication with email
      console.log(`📧 Attempting login with email: ${email}`);
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log('✅ Firebase auth successful:', userCredential.user.uid);
      
      // Get user data directly using the UID from auth
      // Note: Firestore rules must allow read for authenticated users
      // We'll access user data in parent component or after setting current user
      
      // Create minimal user data for now
      const tempUserData: User = {
        id: userCredential.user.uid,
        username: email.split('@')[0], // Temporary username from email
        email: email.trim(),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [],
        securityKey: 'temp-key',
        savedSocialUsername: '',
        payoutMethod: {},
        payoutDetails: {},
        failedAttempts: 0,
        lockoutUntil: undefined,
        lastLoginAt: Date.now()
      };
      
      console.log('👤 Setting current user:', tempUserData.username);
      setCurrentUser(tempUserData);
      setCurrentView('campaigns');
      showToast(`Welcome back!`, 'success');
      
      // Clear login form
      setEmail('');
      setPassword('');
      
      console.log('✅ Login completed successfully');
      
    } catch (error: any) {
      console.error('❌ Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Account not found. Please sign up first.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email format.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'Account disabled. Please contact support.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many login attempts. Please try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Login failed: ${error.message}`;
      }
      
      showToast(errorMessage, 'error');
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
      console.log('🏁 Login process finished');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('✨ Signup button clicked');
    
    if (!validateSignupForm()) {
      console.log('❌ Signup validation failed');
      return;
    }
    
    try {
      setLoading(true);
      setErrors({});
      console.log('🚀 Starting signup process...');
      
      // Create Firebase Auth user
      console.log(`📝 Creating Firebase user: ${email}`);
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        email.trim().toLowerCase(), 
        password
      );
      console.log('✅ Firebase user created:', userCredential.user.uid);
      
      // Generate secure authentication key
      const securityKey = generateSecureAuthKey();
      console.log('🔑 Generated auth key:', securityKey);
      
      const newUser = {
        id: userCredential.user.uid,
        username: username.trim(),
        email: email.trim().toLowerCase(),
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
        createdAt: serverTimestamp()
      };

      console.log('💾 Saving user to Firestore...');
      // Save user document to Firestore
      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
        console.log('✅ User saved to Firestore');
      } catch (firestoreError: any) {
        console.error('❌ Firestore save error:', firestoreError);
        // Continue even if Firestore fails, but warn user
      }
      
      // Sign out from Firebase Auth (IMPORTANT: Don't auto login)
      console.log('🚪 Signing out from Firebase...');
      await auth.signOut();
      
      // Set generated key
      console.log('📋 Setting generated auth key in state');
      setGeneratedAuthKey(securityKey);
      
      showToast('Account created successfully! Save your authentication key.', 'success');
      console.log('✅ Signup completed, showing auth key');
      
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      
      let errorMessage = 'Signup failed. Please try again.';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Email already registered. Please login instead.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Use at least 6 characters with letters and numbers.';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'Email/password accounts are not enabled. Contact support.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Signup failed: ${error.message}`;
      }
      
      showToast(errorMessage, 'error');
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
      console.log('🏁 Signup process finished');
    }
  };

  const handleContinueToLogin = () => {
    console.log('➡️ Continuing to login after saving auth key');
    // Clear signup form
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setGeneratedAuthKey('');
    
    // Switch to login tab
    setActiveTab('login');
    showToast('Please login with your new credentials', 'info');
  };

  const handleSubmit = (e: React.FormEvent) => {
    console.log(`📝 Form submitted for tab: ${activeTab}`);
    if (activeTab === 'login') return handleLogin(e);
    if (activeTab === 'signup' && !generatedAuthKey) return handleSignup(e);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">
            REEL<span className="text-cyan-400">EARN</span>
          </h1>
          <p className="text-slate-400 text-sm">Earn by creating viral content</p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-2xl">
          
          {/* SHOW AUTHENTICATION KEY AFTER SIGNUP */}
          {generatedAuthKey ? (
            <div className="mb-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔐</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Account Created Successfully!</h2>
                <p className="text-slate-400">Save your authentication key securely</p>
              </div>

              <div className="mb-6 p-4 bg-emerald-900/20 border-2 border-emerald-500/40 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-emerald-400 text-sm font-bold">YOUR AUTHENTICATION KEY</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(generatedAuthKey)}
                      className="text-emerald-400 hover:text-emerald-300 text-xs px-3 py-1 bg-emerald-500/10 rounded-lg"
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => downloadKeyAsFile(generatedAuthKey, username, email)}
                      className="text-emerald-400 hover:text-emerald-300 text-xs px-3 py-1 bg-emerald-500/10 rounded-lg"
                    >
                      💾 Save as File
                    </button>
                  </div>
                </div>
                
                <div className="bg-black/60 p-4 rounded-lg border border-emerald-500/30 mb-3">
                  <code className="text-emerald-300 text-sm font-mono break-all select-all">
                    {generatedAuthKey}
                  </code>
                </div>
                
                <div className="flex items-start p-3 bg-amber-900/20 rounded-lg">
                  <span className="text-amber-400 mr-2">⚠️</span>
                  <div>
                    <p className="text-amber-300 text-xs font-bold mb-1">IMPORTANT SECURITY WARNING</p>
                    <p className="text-amber-400 text-xs">
                      • Save this key in a secure location
                      <br />
                      • Never share this key with anyone
                      <br />
                      • You will need this key to recover your account
                      <br />
                      • This key cannot be recovered if lost
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl">
                <h3 className="text-slate-300 font-bold mb-3">Your Account Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Username:</span>
                    <span className="text-white font-medium">{username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-white font-medium">{email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Starting Balance:</span>
                    <span className="text-emerald-400 font-bold">₹100</span>
                  </div>
                </div>
              </div>

              {/* Continue Button */}
              <button
                onClick={handleContinueToLogin}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-3.5 rounded-lg hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-emerald-500/20"
              >
                ✅ I'VE SAVED MY KEY - CONTINUE TO LOGIN
              </button>

              <p className="text-center text-slate-500 text-xs mt-4">
                Once you save the key, click above to login with your new account
              </p>
            </div>
          ) : (
            /* REGULAR LOGIN/SIGNUP FORM */
            <>
              {/* Tabs */}
              <div className="flex mb-6 bg-slate-800/50 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'login' 
                      ? 'bg-cyan-500 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  LOGIN
                </button>
                <button
                  onClick={() => setActiveTab('signup')}
                  className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === 'signup' 
                      ? 'bg-cyan-500 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  SIGN UP
                </button>
              </div>

              {/* Error Message */}
              {errors.general && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{errors.general}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit}>
                {activeTab === 'signup' && (
                  <div className="mb-4">
                    <label className="block text-slate-400 text-sm mb-2 font-medium">
                      Username
                    </label>
                    <input
                      type="text"
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      required
                      disabled={loading}
                    />
                    {errors.username && (
                      <p className="text-red-400 text-xs mt-1">{errors.username}</p>
                    )}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-slate-400 text-sm mb-2 font-medium">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                    disabled={loading}
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-slate-400 text-sm mb-2 font-medium">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder={activeTab === 'signup' ? "Create a password (min 6 chars)" : "Enter your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                    disabled={loading}
                  />
                  {errors.password && (
                    <p className="text-red-400 text-xs mt-1">{errors.password}</p>
                  )}
                </div>

                {activeTab === 'signup' && (
                  <div className="mb-6">
                    <label className="block text-slate-400 text-sm mb-2 font-medium">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      required
                      disabled={loading}
                    />
                    {errors.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-cyan-500/20"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      PROCESSING...
                    </span>
                  ) : (
                    <span>
                      {activeTab === 'login' && '🔐 LOGIN'}
                      {activeTab === 'signup' && '✨ CREATE ACCOUNT'}
                    </span>
                  )}
                </button>
              </form>

              {/* Switch Auth Mode */}
              <div className="mt-6 text-center">
                <p className="text-slate-500 text-sm">
                  {activeTab === 'login' && "Don't have an account? "}
                  {activeTab === 'signup' && "Already have an account? "}
                  
                  <button
                    type="button"
                    onClick={() => {
                      const nextTab = activeTab === 'login' ? 'signup' : 'login';
                      setActiveTab(nextTab);
                      setErrors({});
                    }}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold ml-1 transition-colors"
                    disabled={loading}
                  >
                    {activeTab === 'login' && 'Sign Up'}
                    {activeTab === 'signup' && 'Login'}
                  </button>
                </p>
              </div>

              {/* Security Information for Signup */}
              {activeTab === 'signup' && (
                <div className="mt-6 p-4 bg-amber-900/20 border border-amber-700/30 rounded-xl">
                  <div className="flex items-start mb-2">
                    <span className="text-amber-400 mr-2">🔒</span>
                    <span className="text-amber-400 text-sm font-bold">IMPORTANT SECURITY NOTE</span>
                  </div>
                  <p className="text-amber-300 text-xs">
                    After signup, you'll receive a unique authentication key. 
                    <span className="font-bold"> Save it securely!</span> You'll need this key 
                    to recover your account if you forget your password.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Firebase Status */}
        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold">SYSTEM STATUS</span>
            <span className="text-green-400 text-xs font-semibold flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              SIMPLE AUTH MODE
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            • Email-based authentication
            <br />
            • Authentication Key System
            <br />
            • No Firestore queries needed
          </p>
        </div>

        {/* Console Instructions */}
        <div className="mt-4 p-3 bg-gray-900/50 border border-gray-700/50 rounded-xl">
          <p className="text-gray-400 text-xs">
            <span className="text-yellow-400 font-bold">⚠️ IMPORTANT:</span> Open Browser Console (F12) to see debug logs
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
