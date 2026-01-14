import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  AuthError 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';

interface AuthViewProps {
  setCurrentUser: (user: User | null) => void;
  setCurrentView: (view: string) => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

const AuthView: React.FC<AuthViewProps> = ({ setCurrentUser, setCurrentView, showToast }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Clear errors when switching tabs
  useEffect(() => {
    setErrors({});
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
      
      // Specific error handling
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email. Please sign up.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          // Increment failed attempts
          try {
            const user = await auth.fetchSignInMethodsForEmail(email);
            if (user.length > 0) {
              // User exists, increment failed attempts in Firestore
              const userQuery = await getDoc(doc(db, 'users', user[0]));
              if (userQuery.exists()) {
                const currentFailures = (userQuery.data().failedAttempts || 0) + 1;
                if (currentFailures >= 5) {
                  // Lock account for 30 minutes
                  await setDoc(doc(db, 'users', user[0]), {
                    failedAttempts: currentFailures,
                    lockoutUntil: Date.now() + (30 * 60 * 1000)
                  }, { merge: true });
                  errorMessage = 'Too many failed attempts. Account locked for 30 minutes.';
                } else {
                  await setDoc(doc(db, 'users', user[0]), {
                    failedAttempts: currentFailures
                  }, { merge: true });
                }
              }
            }
          } catch (err) {
            console.error('Failed to update failed attempts:', err);
          }
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
      
      // Check if username already exists
      // Note: You'll need a separate query/index for this in production
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        email.trim(), 
        password
      );
      
      const securityKey = `RE-${Date.now().toString(36).toUpperCase()}`;
      
      const newUser: User = {
        id: userCredential.user.uid,
        username: username.trim(),
        email: email.trim(),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100, // Starting bonus
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [],
        securityKey,
        savedSocialUsername: '',
        payoutMethod: [],
        payoutDetails: [],
        failedAttempts: 0,
        lockoutUntil: [],
        lastLoginAt: Date.now(),
        createdAt: serverTimestamp()
      };

      // Save user document to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      
      setCurrentUser(newUser);
      setCurrentView('campaigns');
      showToast('Account created successfully! Welcome to ReelEarn!', 'success');
      
      // Clear form
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setErrors({ email: 'Email is required to reset password' });
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }
    
    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      showToast('Password reset email sent! Check your inbox.', 'success');
      setActiveTab('login');
      setErrors({});
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      let errorMessage = 'Failed to send reset email.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      
      showToast(errorMessage, 'error');
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (activeTab === 'login') return handleLogin(e);
    if (activeTab === 'signup') return handleSignup(e);
    if (activeTab === 'forgot') return handleForgotPassword(e);
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

          {/* Error Message */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Forgot Password Notice */}
          {activeTab === 'forgot' && (
            <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <p className="text-cyan-400 text-sm">
                Enter your email address and we'll send you a password reset link.
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {activeTab === 'signup' && (
              <div className="mb-4">
                <label className="block text-slate-400 text-sm mb-2 font-medium">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errors.username) setErrors({...errors, username: ''});
                  }}
                  className={`w-full bg-slate-800/50 border ${
                    errors.username ? 'border-red-500' : 'border-slate-700'
                  } rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors`}
                  required
                  minLength={3}
                  maxLength={20}
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({...errors, email: ''});
                }}
                className={`w-full bg-slate-800/50 border ${
                  errors.email ? 'border-red-500' : 'border-slate-700'
                } rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors`}
                required
                disabled={loading}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email}</p>
              )}
            </div>

            {activeTab !== 'forgot' && (
              <>
                <div className="mb-4">
                  <label className="block text-slate-400 text-sm mb-2 font-medium">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder={activeTab === 'signup' ? "Create a password (min 6 chars)" : "Enter your password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({...errors, password: ''});
                    }}
                    className={`w-full bg-slate-800/50 border ${
                      errors.password ? 'border-red-500' : 'border-slate-700'
                    } rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors`}
                    required
                    minLength={6}
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
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) setErrors({...errors, confirmPassword: ''});
                      }}
                      className={`w-full bg-slate-800/50 border ${
                        errors.confirmPassword ? 'border-red-500' : 'border-slate-700'
                      } rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors`}
                      required
                      disabled={loading}
                    />
                    {errors.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Forgot Password Link */}
            {activeTab === 'login' && (
              <div className="mb-6 text-right">
                <button
                  type="button"
                  onClick={() => setActiveTab('forgot')}
                  className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
                  disabled={loading}
                >
                  Forgot Password?
                </button>
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
                  {activeTab === 'forgot' ? 'SENDING...' : 'PROCESSING...'}
                </span>
              ) : (
                <span>
                  {activeTab === 'login' && '🔐 LOGIN'}
                  {activeTab === 'signup' && '✨ CREATE ACCOUNT'}
                  {activeTab === 'forgot' && '📧 SEND RESET LINK'}
                </span>
              )}
            </button>
          </form>

          {/* Switch Auth Mode */}
          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              {activeTab === 'login' && "Don't have an account? "}
              {activeTab === 'signup' && "Already have an account? "}
              {activeTab === 'forgot' && "Remember your password? "}
              
              <button
                type="button"
                onClick={() => {
                  const nextTab = activeTab === 'login' ? 'signup' : 
                                activeTab === 'signup' ? 'login' : 'login';
                  setActiveTab(nextTab);
                  setErrors({});
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold ml-1 transition-colors"
                disabled={loading}
              >
                {activeTab === 'login' && 'Sign Up'}
                {activeTab === 'signup' && 'Login'}
                {activeTab === 'forgot' && 'Back to Login'}
              </button>
            </p>
          </div>
        </div>

        {/* Firebase Status */}
        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700/50 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-semibold">FIREBASE STATUS</span>
            <span className="text-green-400 text-xs font-semibold flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              PRODUCTION CONNECTED
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            • Secure Authentication
            <br />
            • Real-time Firestore Database
            <br />
            • Enterprise-grade Security
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
