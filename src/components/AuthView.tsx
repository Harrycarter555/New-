import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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

  // Simple authentication key generator
  const generateAuthKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'RE-';
    
    for (let i = 0; i < 12; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    key += '-' + Date.now().toString(36).toUpperCase();
    
    console.log('Generated key:', key);
    return key;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login button clicked');
    
    if (!email || !password) {
      showToast('Please enter email and password', 'error');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Attempting login...');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', userCredential.user.uid);
      
      // Create user object
      const userData: User = {
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
        securityKey: 'temp-key',
        savedSocialUsername: '',
        payoutMethod: {},
        payoutDetails: {},
        failedAttempts: 0,
        lockoutUntil: undefined,
        lastLoginAt: Date.now()
      };
      
      setCurrentUser(userData);
      setCurrentView('campaigns');
      showToast('Login successful!', 'success');
      
    } catch (error: any) {
      console.error('Login error:', error);
      showToast('Login failed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Signup button clicked');
    
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
      console.log('Creating account...');
      
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Firebase user created:', userCredential.user.uid);
      
      // 2. Generate authentication key
      const authKey = generateAuthKey();
      console.log('Auth key generated:', authKey);
      
      // 3. Create user object for Firestore
      const newUser = {
        id: userCredential.user.uid,
        username: username,
        email: email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [],
        securityKey: authKey,
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
      console.log('User saved to Firestore');
      
      // 5. SIGN OUT - VERY IMPORTANT!
      await auth.signOut();
      console.log('Signed out from Firebase');
      
      // 6. Show authentication key to user
      setGeneratedAuthKey(authKey);
      showToast('Account created! Save your authentication key.', 'success');
      
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

  const handleContinueToLogin = () => {
    // Clear form and go to login
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setGeneratedAuthKey('');
    setActiveTab('login');
    showToast('Please login with your new account', 'info');
  };

  const handleSubmit = (e: React.FormEvent) => {
    console.log('Form submitted, activeTab:', activeTab);
    
    if (activeTab === 'login') {
      handleLogin(e);
    } else if (activeTab === 'signup' && !generatedAuthKey) {
      handleSignup(e);
    }
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
          
          {/* Show Authentication Key if generated */}
          {generatedAuthKey ? (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔐</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
                <p className="text-slate-400">Save your authentication key</p>
              </div>
              
              <div className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-xl">
                <div className="text-center mb-4">
                  <span className="text-green-400 text-sm font-bold">AUTHENTICATION KEY</span>
                </div>
                
                <div className="bg-black/50 p-4 rounded-lg border border-green-500/20 mb-4">
                  <code className="text-green-300 text-sm font-mono break-all">
                    {generatedAuthKey}
                  </code>
                </div>
                
                <div className="text-center mb-4">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedAuthKey);
                      showToast('Key copied!', 'success');
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                  >
                    Copy Key
                  </button>
                </div>
                
                <div className="text-yellow-500 text-xs p-3 bg-yellow-500/10 rounded-lg">
                  ⚠️ Save this key securely! You'll need it for account recovery.
                </div>
              </div>
              
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl">
                <h3 className="text-white font-bold mb-3">Account Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Username:</span>
                    <span className="text-white">{username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-white">{email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Starting Balance:</span>
                    <span className="text-green-400 font-bold">₹100</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleContinueToLogin}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-4 rounded-xl hover:opacity-90"
              >
                Continue to Login
              </button>
            </div>
          ) : (
            /* Regular Login/Signup Form */
            <>
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
                {activeTab === 'signup' && (
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white mb-3"
                      required
                    />
                  </div>
                )}

                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white mb-3"
                  required
                />

                <input
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white mb-3"
                  required
                />

                {activeTab === 'signup' && (
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white mb-6"
                    required
                  />
                )}

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

              {/* Switch tabs */}
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
            </>
          )}
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
            • Email-based authentication
            <br />
            • Secure authentication keys
            <br />
            • Real-time database
          </p>
        </div>

        {/* Debug Info */}
        <div className="mt-4 text-center">
          <p className="text-slate-600 text-xs">
            Open console (F12) to see debug logs
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
