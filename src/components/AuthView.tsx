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
  const [email, setEmail] = useState('test@example.com'); // Default for testing
  const [password, setPassword] = useState('123456'); // Default for testing
  const [username, setUsername] = useState('testuser');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) {
      showToast('Please enter email and password', 'error');
      return;
    }

    try {
      setLoading(true);
      console.log('Attempting login with:', email);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase auth successful:', userCredential.user.uid);
      
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        console.log('User data found:', userData.username);
        
        setCurrentUser(userData);
        setCurrentView(userData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
        showToast(`Welcome back, ${userData.username}!`, 'success');
      } else {
        console.log('User document not found, creating new...');
        // Create user document if doesn't exist
        const newUser: User = {
          id: userCredential.user.uid,
          username: email.split('@')[0],
          email: email,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          walletBalance: 0,
          pendingBalance: 0,
          totalEarnings: 0,
          joinedAt: Date.now(),
          readBroadcastIds: [],
          securityKey: `KEY-${Date.now().toString(36).toUpperCase()}`,
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
        setCurrentUser(newUser);
        setCurrentView('campaigns');
        showToast('Account created automatically!', 'success');
      }
    } catch (error: any) {
      console.error('Login error details:', error);
      let message = 'Login failed';
      
      if (error.code === 'auth/user-not-found') {
        message = 'Account not found. Please sign up first.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Try again later.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email format';
      } else if (error.code === 'auth/user-disabled') {
        message = 'Account disabled';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Check connection.';
      }
      
      showToast(message, 'error');
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

    try {
      setLoading(true);
      console.log('Creating account for:', email);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('User created with ID:', userCredential.user.uid);
      
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
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      console.log('User document saved to Firestore');
      
      setCurrentUser(newUser);
      setCurrentView('campaigns');
      showToast('Account created successfully!', 'success');
    } catch (error: any) {
      console.error('Signup error details:', error);
      let message = 'Signup failed';
      
      if (error.code === 'auth/email-already-in-use') {
        message = 'Email already in use. Please login.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email format';
      } else if (error.code === 'auth/operation-not-allowed') {
        message = 'Email/password signup is disabled';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Network error. Check connection.';
      }
      
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Simple test login
  const testLogin = async () => {
    setEmail('test@example.com');
    setPassword('123456');
    await handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-white mb-2">
            REEL<span className="text-cyan-400">EARN</span>
          </h1>
          <p className="text-slate-500 text-sm">Earn by creating viral reels</p>
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
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white mb-3"
                  required
                />
              </div>
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white mb-3"
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white mb-6"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'PROCESSING...' : (activeTab === 'login' ? 'LOGIN' : 'CREATE ACCOUNT')}
            </button>

            {/* Test button for quick login */}
            <button
              type="button"
              onClick={testLogin}
              className="w-full mt-4 bg-green-500/20 text-green-400 border border-green-500/30 py-3 rounded-xl text-sm"
            >
              🚀 TEST LOGIN (test@example.com / 123456)
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600 text-sm">
              {activeTab === 'login' ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={() => setActiveTab(activeTab === 'login' ? 'signup' : 'login')}
                className="text-cyan-400 ml-2"
              >
                {activeTab === 'login' ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>

        {/* Debug info */}
        <div className="mt-6 p-4 bg-slate-900/30 rounded-xl text-xs text-slate-500">
          <p>🔍 Debug Info:</p>
          <p>• Firebase Project: reelearn-505d9</p>
          <p>• Ensure Email/Password auth is enabled in Firebase Console</p>
          <p>• Test credentials: test@example.com / 123456</p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
