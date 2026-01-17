import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
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
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
        setCurrentUser({ ...userData });
        setCurrentView(userData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
        showToast(`Welcome back, ${userData.username}!`, 'success');
      } else {
        // If user doc doesn't exist, create basic one
        const basicUser: User = {
          id: userCredential.user.uid,
          username: email.split('@')[0],
          email: email,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          walletBalance: 100,
          pendingBalance: 0,
          totalEarnings: 0,
          joinedAt: Date.now(),
          readBroadcastIds: [],
          securityKey: '',
          savedSocialUsername: '',
          payoutMethod: '', // ✅ FIXED: Empty string
          payoutDetails: '', // ✅ FIXED: Empty string
          failedAttempts: 0,
          lockoutUntil: undefined,
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), basicUser);
        setCurrentUser(basicUser);
        setCurrentView('campaigns');
        showToast(`Welcome, ${basicUser.username}!`, 'success');
      }
      
      // Clear form
      setEmail('');
      setPassword('');
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Account not found. Please sign up.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Try again later.';
      }
      
      showToast(errorMessage, 'error');
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
      
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Generate security key
      const generateSecurityKey = () => {
        return Math.random().toString(36).substring(2, 10) + 
               Math.random().toString(36).substring(2, 10);
      };
      
      // Create user object for Firestore
      const newUser: User = {
        id: userCredential.user.uid,
        username: username,
        email: email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [], // ✅ FIXED: Empty array
        securityKey: generateSecurityKey(),
        savedSocialUsername: '',
        payoutMethod: '', // ✅ FIXED: Empty string
        payoutDetails: '', // ✅ FIXED: Empty string
        failedAttempts: 0,
        lockoutUntil: undefined,
      };
      
      // Save to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      
      // Set current user and redirect
      setCurrentUser(newUser); // ✅ No need for type assertion now
      setCurrentView('campaigns');
      showToast(`Welcome to ReelEarn, ${username}!`, 'success');
      
      // Clear form
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = 'Signup failed';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already registered. Please login.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    if (activeTab === 'login') return handleLogin(e);
    if (activeTab === 'signup') return handleSignup(e);
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

            {/* Email */}
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

            {/* Password */}
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

            {/* Confirm Password for signup only */}
            {activeTab === 'signup' && (
              <div className="mb-6">
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2">⟳</span>
                  {activeTab === 'login' ? 'LOGGING IN...' : 'CREATING ACCOUNT...'}
                </span>
              ) : activeTab === 'login' ? (
                '🔐 LOGIN'
              ) : (
                '✨ CREATE ACCOUNT'
              )}
            </button>
          </form>

          {/* Switch Tabs */}
          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              {activeTab === 'login' ? "New to ReelEarn?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => {
                  setActiveTab(activeTab === 'login' ? 'signup' : 'login');
                  setEmail('');
                  setPassword('');
                  setUsername('');
                  setConfirmPassword('');
                }}
                className="text-cyan-400 ml-2 font-bold hover:text-cyan-300"
              >
                {activeTab === 'login' ? 'Create Account' : 'Sign In'}
              </button>
            </p>
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
            • Simple email/password authentication
            <br />
            • Real-time database
            <br />
            • Secure and fast
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
