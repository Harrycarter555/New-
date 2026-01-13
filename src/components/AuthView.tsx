import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
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
  const [email, setEmail] = useState(''); // EMPTY - no test email
  const [password, setPassword] = useState(''); // EMPTY - no test password
  const [username, setUsername] = useState(''); // EMPTY
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) {
      showToast('Please enter email and password', 'error');
      return;
    }

    try {
      setLoading(true);
      console.log('🔐 Attempting Firebase login...');
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase auth successful:', userCredential.user.uid);
      
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        const safeUserData = {
          ...userData,
          readBroadcastIds: userData.readBroadcastIds || [],
        };
        
        console.log('📄 User data found:', safeUserData.username);
        setCurrentUser(safeUserData);
        setCurrentView(safeUserData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
        showToast(`Welcome back, ${safeUserData.username}!`, 'success');
      } else {
        console.log('❌ User document not found in Firestore');
        showToast('Account not found. Please sign up first.', 'error');
      }
    } catch (error: any) {
      console.error('❌ Firebase login failed:', error);
      
      // SPECIFIC ERROR MESSAGES
      let errorMessage = 'Login failed';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Account not found. Please sign up.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Check your connection.';
          break;
        default:
          errorMessage = `Login failed: ${error.message}`;
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!username || !email || !password) {
      showToast('Please fill all fields', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    // Username validation
    if (username.length < 3) {
      showToast('Username must be at least 3 characters', 'error');
      return;
    }

    try {
      setLoading(true);
      console.log('📝 Creating new account...');
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase account created:', userCredential.user.uid);
      
      const securityKey = `RE-${Date.now().toString(36).toUpperCase()}`;
      
      const newUser: User = {
        id: userCredential.user.uid,
        username,
        email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100, // Starting bonus
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [],
        securityKey,
        savedSocialUsername: '',
        payoutMethod: undefined,
        payoutDetails: undefined,
        password: undefined,
        failedAttempts: 0,
        lockoutUntil: undefined,
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      console.log('💾 User document saved to Firestore');
      
      setCurrentUser(newUser);
      setCurrentView('campaigns');
      showToast('Account created successfully! Welcome!', 'success');
    } catch (error: any) {
      console.error('❌ Firebase signup failed:', error);
      
      let errorMessage = 'Signup failed';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Email already registered. Please login.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Check your connection.';
          break;
        default:
          errorMessage = `Signup failed: ${error.message}`;
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-white mb-2">
            REEL<span className="text-cyan-400">EARN</span>
          </h1>
          <p className="text-slate-500 text-sm">Earn by creating viral reels</p>
          <p className="text-cyan-500 text-xs mt-2 font-bold">🔥 PRODUCTION MODE - REAL FIREBASE</p>
        </div>

        <div className="glass-panel p-8 rounded-3xl">
          <div className="flex mb-6 bg-slate-900/50 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-3 rounded-xl font-bold ${activeTab === 'login' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}
            >
              LOGIN
            </button>
            <button
              onClick={() => setActiveTab('signup')}
              className={`flex-1 py-3 rounded-xl font-bold ${activeTab === 'signup' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}
            >
              SIGN UP
            </button>
          </div>

          <form onSubmit={activeTab === 'login' ? handleLogin : handleSignup}>
            {activeTab === 'signup' && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white mb-3"
                  required
                  minLength={3}
                  maxLength={20}
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
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white mb-6"
              required
              minLength={6}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2">⟳</span>
                  PROCESSING...
                </span>
              ) : activeTab === 'login' ? (
                '🔐 LOGIN TO YOUR ACCOUNT'
              ) : (
                '✨ CREATE NEW ACCOUNT'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              {activeTab === 'login' ? "New to ReelEarn?" : "Already have an account?"}
              <button
                onClick={() => {
                  setActiveTab(activeTab === 'login' ? 'signup' : 'login');
                  setEmail('');
                  setPassword('');
                  setUsername('');
                }}
                className="text-cyan-400 ml-2 font-bold hover:text-cyan-300 transition-colors"
              >
                {activeTab === 'login' ? 'Create Account' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>

        {/* Firebase Status Indicator */}
        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold">FIREBASE STATUS</span>
            <span className="text-green-400 text-xs font-bold flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              PRODUCTION READY
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            • Real Firebase Authentication
            <br />
            • Real Firestore Database
            <br />
            • No test/mock data
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
