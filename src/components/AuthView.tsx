// src/components/AuthView.tsx
import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, getDoc, query, where, collection, getDocs } from 'firebase/firestore';

import { auth, db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';
import { getPasswordStrength, validateEmail } from '../utils/helpers';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, ICONS } from '../utils/constants';
import PasswordMeter from './PasswordMeter';

interface AuthViewProps {
  setCurrentUser: (u: User | null) => void;
  setCurrentView: (v: 'auth' | 'campaigns' | 'admin') => void;
  showToast: (m: string, t?: 'success' | 'error' | 'info' | 'warning') => void;
}

const AuthView: React.FC<AuthViewProps> = ({
  setCurrentUser,
  setCurrentView,
  showToast,
}) => {
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [securityKey, setSecurityKey] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Auto-fill remember me
  useEffect(() => {
    const savedEmail = localStorage.getItem('reelearn_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  /* ---------------- SIGN IN ---------------- */
  const signIn = async () => {
    // Validation
    if (!email || !password) {
      showToast('Please fill all fields', 'error');
      return;
    }

    if (!validateEmail(email)) {
      showToast('Please enter a valid email', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Firebase authentication
      const cred = await signInWithEmailAndPassword(auth, email, password);
      
      // Fetch user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));

      if (!userDoc.exists()) {
        showToast('Account not found. Please sign up first.', 'error');
        return;
      }

      const userData = userDoc.data() as User;
      
      // Check if user is suspended
      if (userData.status === UserStatus.SUSPENDED) {
        showToast('Account suspended. Contact admin.', 'error');
        return;
      }

      // Update readBroadcastIds if missing
      if (!userData.readBroadcastIds) {
        userData.readBroadcastIds = [];
      }

      // Remember email if checked
      if (rememberMe) {
        localStorage.setItem('reelearn_email', email);
      } else {
        localStorage.removeItem('reelearn_email');
      }

      // Set user and navigate
      setCurrentUser(userData);
      setCurrentView(userData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
      showToast(SUCCESS_MESSAGES.LOGIN_SUCCESS, 'success');

    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle specific Firebase errors
      let message = ERROR_MESSAGES.FIREBASE_ERROR;
      if (error.code === 'auth/user-not-found') {
        message = ERROR_MESSAGES.INVALID_CREDENTIALS;
      } else if (error.code === 'auth/wrong-password') {
        message = ERROR_MESSAGES.INVALID_CREDENTIALS;
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Try again later.';
      } else if (error.code === 'auth/user-disabled') {
        message = 'Account disabled. Contact support.';
      }
      
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- SIGN UP ---------------- */
  const signUp = async () => {
    // Validation
    if (!username || !email || !password) {
      showToast('Please fill all fields', 'error');
      return;
    }

    if (username.length < 3) {
      showToast('Username must be at least 3 characters', 'error');
      return;
    }

    if (!validateEmail(email)) {
      showToast('Please enter a valid email', 'error');
      return;
    }

    const passwordErrors = getPasswordStrength(password);
    if (passwordErrors.score < 2) {
      showToast('Please choose a stronger password', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Check if username already exists
      const usernameQuery = query(collection(db, 'users'), where('username', '==', username));
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!usernameSnapshot.empty) {
        showToast('Username already taken', 'error');
        return;
      }

      // Create Firebase auth user
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Generate security key
      const key = `RE-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

      // Create user object
      const user: User = {
        id: cred.user.uid,
        username,
        email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        securityKey: key,
        walletBalance: 0,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [],
        savedSocialUsername: '',
        payoutMethod: 'UPI',
        payoutDetails: '',
      };

      // Save to Firestore
      await setDoc(doc(db, 'users', cred.user.uid), user);

      // Show security key
      setGeneratedKey(key);

      // Set user and show success
      setCurrentUser(user);
      showToast(SUCCESS_MESSAGES.SIGNUP_SUCCESS, 'success');

      // Auto-navigate after 3 seconds
      setTimeout(() => {
        setCurrentView('campaigns');
      }, 3000);

    } catch (error: any) {
      console.error('Signup error:', error);
      
      let message = ERROR_MESSAGES.FIREBASE_ERROR;
      if (error.code === 'auth/email-already-in-use') {
        message = ERROR_MESSAGES.EMAIL_EXISTS;
      } else if (error.code === 'auth/weak-password') {
        message = ERROR_MESSAGES.WEAK_PASSWORD;
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address';
      }
      
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- FORGOT PASSWORD ---------------- */
  const recover = async () => {
    if (!securityKey.trim() && !email.trim()) {
      showToast('Please enter either security key or email', 'error');
      return;
    }

    try {
      setLoading(true);
      
      let recoveryEmail = email;

      // If security key is provided, find email
      if (securityKey.trim()) {
        const keyQuery = query(collection(db, 'users'), where('securityKey', '==', securityKey));
        const keySnapshot = await getDocs(keyQuery);

        if (keySnapshot.empty) {
          showToast('Invalid security key', 'error');
          return;
        }

        recoveryEmail = keySnapshot.docs[0].data().email!;
      }

      // Send password reset email
      await sendPasswordResetEmail(auth, recoveryEmail);
      
      showToast('Password reset email sent. Check your inbox.', 'success');
      setTab('signin');
      setSecurityKey('');
      
    } catch (error: any) {
      console.error('Recovery error:', error);
      showToast(error.message || 'Failed to send reset email', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- GENERATED KEY VIEW ---------------- */
  if (generatedKey) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-panel w-full max-w-md p-8 rounded-[48px] border-t-8 border-cyan-500 text-center space-y-8">
          <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto">
            <ICONS.Check className="w-10 h-10 text-cyan-500" />
          </div>
          
          <h2 className="text-2xl font-black text-white">ACCOUNT CREATED</h2>
          
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Save your security key:</p>
            <div className="bg-black/50 p-6 rounded-3xl border-2 border-cyan-500/30">
              <p className="text-2xl font-black text-cyan-400 tracking-widest">{generatedKey}</p>
            </div>
            <p className="text-[10px] text-slate-600">
              This key is required for password recovery. Save it securely!
            </p>
          </div>
          
          <button
            onClick={() => {
              setGeneratedKey(null);
              setCurrentView('campaigns');
            }}
            className="w-full py-4 bg-cyan-500 text-black rounded-2xl font-black uppercase tracking-widest"
          >
            CONTINUE TO APP
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- MAIN AUTH UI ---------------- */
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-black italic text-white tracking-tighter">
            REEL<span className="text-cyan-400">EARN</span>
          </h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic">
            EARN BY CREATING VIRAL REELS
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 bg-white/5 p-2 rounded-3xl border border-white/10">
          <button
            onClick={() => setTab('signin')}
            className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all ${
              tab === 'signin' ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
            }`}
          >
            SIGN IN
          </button>
          <button
            onClick={() => setTab('signup')}
            className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all ${
              tab === 'signup' ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
            }`}
          >
            SIGN UP
          </button>
          <button
            onClick={() => setTab('forgot')}
            className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase transition-all ${
              tab === 'forgot' ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
            }`}
          >
            RECOVER
          </button>
        </div>

        {/* Form Container */}
        <div className="glass-panel p-8 rounded-[48px] border border-white/10 space-y-6">
          {/* SIGN IN FORM */}
          {tab === 'signin' && (
            <>
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 bg-white/5 border border-white/10 rounded"
                  />
                  <span className="text-[10px] font-black text-slate-500 uppercase">Remember me</span>
                </label>
                <button
                  onClick={() => setTab('forgot')}
                  className="text-[10px] font-black text-cyan-500 uppercase"
                >
                  Forgot Password?
                </button>
              </div>
              
              <button
                onClick={signIn}
                disabled={loading}
                className="w-full py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-lg rounded-full shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
              >
                {loading ? 'SIGNING IN...' : 'SIGN IN'}
              </button>
            </>
          )}

          {/* SIGN UP FORM */}
          {tab === 'signup' && (
            <>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
                  maxLength={20}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
                />
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
                  />
                  <PasswordMeter password={password} />
                </div>
              </div>
              
              <div className="text-[10px] text-slate-600 space-y-2">
                <p className="font-black uppercase">By signing up, you agree to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Follow all campaign guidelines</li>
                  <li>Not use bots or automation</li>
                  <li>Submit only authentic content</li>
                  <li>Keep your security key safe</li>
                </ul>
              </div>
              
              <button
                onClick={signUp}
                disabled={loading}
                className="w-full py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-lg rounded-full shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
              >
                {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
              </button>
            </>
          )}

          {/* FORGOT PASSWORD FORM */}
          {tab === 'forgot' && (
            <>
              <div className="space-y-6">
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Security Key (if you have it)"
                    value={securityKey}
                    onChange={(e) => setSecurityKey(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
                  />
                  <div className="relative">
                    <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10 -translate-y-1/2"></div>
                    <div className="relative flex justify-center">
                      <span className="bg-black px-4 text-[10px] font-black text-slate-600 uppercase">OR</span>
                    </div>
                  </div>
                  <input
                    type="email"
                    placeholder="Registered Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
                  />
                </div>
                
                <p className="text-[10px] text-slate-600 text-center">
                  Enter either your security key or registered email to recover your account
                </p>
                
                <button
                  onClick={recover}
                  disabled={loading}
                  className="w-full py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-lg rounded-full shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
                >
                  {loading ? 'SENDING...' : 'RECOVER ACCOUNT'}
                </button>
                
                <button
                  onClick={() => setTab('signin')}
                  className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-slate-500 font-black uppercase"
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="text-center space-y-4">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
            {tab === 'signin' ? "Don't have an account?" : "Already have an account?"}
            <button
              onClick={() => setTab(tab === 'signin' ? 'signup' : 'signin')}
              className="text-cyan-500 ml-2"
            >
              {tab === 'signin' ? 'SIGN UP' : 'SIGN IN'}
            </button>
          </p>
          <p className="text-[8px] text-slate-800 font-black uppercase tracking-widest">
            © 2024 REEL EARN PRO • EARN BY CREATING VIRAL CONTENT
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
