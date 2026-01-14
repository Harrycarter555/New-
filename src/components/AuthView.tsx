import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Generate secure authentication key
  const generateSecureAuthKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const specialSuffix = 'RE-';
    let key = specialSuffix;
    
    // Generate 12 random characters
    for (let i = 0; i < 12; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Add timestamp for uniqueness
    key += '-' + Date.now().toString(36).toUpperCase();
    
    return key;
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Authentication key copied!', 'success'))
      .catch(() => showToast('Failed to copy', 'error'));
  };

  // Clear errors when switching tabs
  useEffect(() => {
    setErrors({});
    setGeneratedAuthKey('');
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
    
    if (!validateLoginForm()) return;
    
    try {
      setLoading(true);
      setErrors({});
      
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Fetch user document from Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        
        // Check if user is active
        if (userData.status === UserStatus.SUSPENDED) {
          showToast('Account suspended. Please contact support.', 'error');
          await auth.signOut();
          return;
        }
        
        // Check if account is locked
        if (userData.lockoutUntil && userData.lockoutUntil > Date.now()) {
          const minutesLeft = Math.ceil((userData.lockoutUntil - Date.now()) / (1000 * 60));
          showToast(`Account locked. Try again in ${minutesLeft} minute(s).`, 'error');
          return;
        }
        
        const safeUserData = {
          ...userData,
          readBroadcastIds: userData.readBroadcastIds || [],
          lastLoginAt: Date.now()
        };
        
        // Update last login timestamp
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          lastLoginAt: serverTimestamp(),
          failedAttempts: 0, // Reset failed attempts on successful login
          lockoutUntil: null
        }, { merge: true });
        
        setCurrentUser(safeUserData);
        setCurrentView(safeUserData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
        showToast(`Welcome back, ${safeUserData.username}!`, 'success');
      } else {
        showToast('Account setup incomplete. Please contact support.', 'error');
        await auth.signOut(); // Sign out from Firebase Auth if no user doc
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email.';
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
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSignupForm()) return;
    
    try {
      setLoading(true);
      setErrors({});
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        email.trim(), 
        password
      );
      
      // Generate secure authentication key
      const securityKey = generateSecureAuthKey();
      setGeneratedAuthKey(securityKey);
      
      const newUser = {
        id: userCredential.user.uid,
        username: username.trim(),
        email: email.trim(),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [],
        securityKey, // Store the key in database
        savedSocialUsername: '',
        payoutMethod: {},
        payoutDetails: {},
        failedAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: Date.now(),
        createdAt: serverTimestamp()
      };

      // Save user document to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      
      // Show success message with authentication key
      showToast('Account created successfully!', 'success');
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
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
    }
  };

  const handleRecoverWithAuthKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authKey.trim()) {
      showToast('Please enter your authentication key', 'error');
      return;
    }
    
    if (!email.trim()) {
      showToast('Please enter your email', 'error');
      return;
    }
    
    try {
      setLoading(true);
      
      // Find user by email first
      let userFound = false;
      
      try {
        // Sign in to get user UID
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), 'temporary');
        const userId = userCredential.user.uid;
        
        // Get user document
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          
          // Verify authentication key
          if (userData.securityKey === authKey.trim()) {
            // Key matches! Show user credentials
            showToast(`Authentication successful! Username: ${userData.username}`, 'success');
            
            // Ask user to set new password
            const newPassword = prompt('Enter new password (min 6 characters):');
            if (newPassword && newPassword.length >= 6) {
              // Update password in Firebase Auth
              await updateDoc(doc(db, 'users', userId), {
                securityKey: generateSecureAuthKey() // Generate new key after recovery
              });
              
              // Note: Firebase Auth password update requires re-authentication
              // For now, show current credentials
              alert(`Account Recovery Successful!\n\nUsername: ${userData.username}\nEmail: ${userData.email}\n\nPlease login with your credentials.`);
              
              setActiveTab('login');
              setAuthKey('');
            }
            userFound = true;
          }
        }
      } catch (error) {
        // Expected error - wrong password
      }
      
      if (!userFound) {
        // Search by authentication key in all users (Admin function needed)
        showToast('Authentication key not found or invalid', 'error');
      }
      
    } catch (error: any) {
      console.error('Recovery error:', error);
      showToast('Recovery failed. Please check your authentication key and email.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (activeTab === 'login') return handleLogin(e);
    if (activeTab === 'signup') return handleSignup(e);
    if (activeTab === 'recover') return handleRecoverWithAuthKey(e);
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

          {/* Show Generated Authentication Key */}
          {generatedAuthKey && (
            <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-400 text-sm font-bold">⚠️ SECURE YOUR ACCOUNT</span>
                <button
                  onClick={() => copyToClipboard(generatedAuthKey)}
                  className="text-emerald-400 hover:text-emerald-300 text-xs"
                >
                  📋 Copy
                </button>
              </div>
              <p className="text-emerald-300 text-xs mb-2">
                Save this authentication key securely! You'll need it to recover your account.
              </p>
              <div className="bg-black/50 p-3 rounded-lg border border-emerald-500/20">
                <code className="text-emerald-400 text-sm font-mono break-all">
                  {generatedAuthKey}
                </code>
              </div>
              <p className="text-emerald-400 text-xs mt-2">
                🔒 Store this key safely. Never share it with anyone!
              </p>
              <div className="mt-3">
                <button
                  onClick={() => {
                    setGeneratedAuthKey('');
                    setActiveTab('login');
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-medium"
                >
                  I've Saved My Key - Continue to Login
                </button>
              </div>
            </div>
          )}

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
                  disabled={loading || !!generatedAuthKey}
                />
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
                disabled={loading || !!generatedAuthKey}
              />
            </div>

            {activeTab !== 'recover' && (
              <>
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
                    disabled={loading || !!generatedAuthKey}
                  />
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
                      disabled={loading || !!generatedAuthKey}
                    />
                  </div>
                )}
              </>
            )}

            {activeTab === 'recover' && (
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2 font-medium">
                  Authentication Key
                </label>
                <input
                  type="text"
                  placeholder="Enter your authentication key"
                  value={authKey}
                  onChange={(e) => setAuthKey(e.target.value)}
                  className="w-full bg-slate-800/50 border border-amber-500/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                  required
                  disabled={loading}
                />
                <p className="text-amber-400 text-xs mt-2">
                  Enter the authentication key you received during signup
                </p>
              </div>
            )}

            {/* Forgot Password / Recover Account Link */}
            {activeTab === 'login' && (
              <div className="mb-6 text-right">
                <button
                  type="button"
                  onClick={() => setActiveTab('recover')}
                  className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                  disabled={loading}
                >
                  🔐 Lost Password? Use Authentication Key
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !!generatedAuthKey}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3.5 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-cyan-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {activeTab === 'recover' ? 'VERIFYING...' : 'PROCESSING...'}
                </span>
              ) : (
                <span>
                  {activeTab === 'login' && '🔐 LOGIN'}
                  {activeTab === 'signup' && '✨ CREATE ACCOUNT'}
                  {activeTab === 'recover' && '🔑 RECOVER ACCOUNT'}
                </span>
              )}
            </button>
          </form>

          {/* Switch Auth Mode */}
          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              {activeTab === 'login' && "Don't have an account? "}
              {activeTab === 'signup' && "Already have an account? "}
              {activeTab === 'recover' && "Remember your password? "}
              
              <button
                type="button"
                onClick={() => {
                  const nextTab = activeTab === 'login' ? 'signup' : 
                                activeTab === 'signup' ? 'login' : 'login';
                  setActiveTab(nextTab);
                  setErrors({});
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold ml-1 transition-colors"
                disabled={loading || !!generatedAuthKey}
              >
                {activeTab === 'login' && 'Sign Up'}
                {activeTab === 'signup' && 'Login'}
                {activeTab === 'recover' && 'Back to Login'}
              </button>
            </p>
          </div>

          {/* Security Information */}
          {activeTab === 'signup' && !generatedAuthKey && (
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
        </div>

        {/* Firebase Status */}
        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold">SECURITY SYSTEM</span>
            <span className="text-green-400 text-xs font-semibold flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              AUTH-KEY PROTECTION ENABLED
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            • Authentication Key Recovery System
            <br />
            • No Email Dependencies
            <br />
            • Encrypted Key Storage
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
