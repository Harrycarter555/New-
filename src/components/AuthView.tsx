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
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('123456');
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
      console.log('🔐 Attempting Firebase login...');
      
      // Try Firebase login
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase auth successful:', userCredential.user.uid);
      
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        // Ensure readBroadcastIds exists
        const safeUserData = {
          ...userData,
          readBroadcastIds: userData.readBroadcastIds || [],
        };
        
        console.log('📄 User data found:', safeUserData.username);
        setCurrentUser(safeUserData);
        setCurrentView(safeUserData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
        showToast(`Welcome back, ${safeUserData.username}!`, 'success');
      } else {
        console.log('📝 User document not found, creating new...');
        // Create complete user object with all required fields
        const newUser: User = {
          id: userCredential.user.uid,
          username: email.split('@')[0] || 'user',
          email: email,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          walletBalance: 100,
          pendingBalance: 0,
          totalEarnings: 0,
          joinedAt: Date.now(),
          readBroadcastIds: [], // MUST be included
          securityKey: `KEY-${Date.now().toString(36).toUpperCase()}`,
          savedSocialUsername: '',
          payoutMethod: undefined,
          payoutDetails: undefined,
          password: undefined,
          failedAttempts: 0,
          lockoutUntil: undefined,
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
        console.log('💾 New user saved to Firestore');
        setCurrentUser(newUser);
        setCurrentView('campaigns');
        showToast('Account created automatically!', 'success');
      }
    } catch (error: any) {
      console.error('❌ Firebase login failed:', error);
      
      // Fallback to mock login if Firebase fails
      console.log('🔄 Falling back to mock login...');
      
      const mockUser: User = {
        id: 'mock-user-' + Date.now(),
        username: email.split('@')[0] || 'mockuser',
        email: email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 1000,
        pendingBalance: 500,
        totalEarnings: 1500,
        joinedAt: Date.now(),
        readBroadcastIds: [], // Empty array
        securityKey: 'MOCK-KEY-' + Date.now().toString(36),
        savedSocialUsername: '',
        payoutMethod: undefined,
        payoutDetails: undefined,
        password: undefined,
        failedAttempts: 0,
        lockoutUntil: undefined,
      };
      
      setCurrentUser(mockUser);
      setCurrentView('campaigns');
      showToast('Using development mode (Firebase unavailable)', 'success');
      
      // Optional: Show error message
      if (error.code) {
        console.log('Firebase error code:', error.code);
      }
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
      console.log('📝 Creating new account...');
      
      // Try Firebase signup
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase account created:', userCredential.user.uid);
      
      const securityKey = `RE-${Date.now().toString(36).toUpperCase()}`;
      
      const newUser: User = {
        id: userCredential.user.uid,
        username,
        email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [], // MUST be included
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
      showToast('Account created successfully!', 'success');
    } catch (error: any) {
      console.error('❌ Firebase signup failed:', error);
      
      // Fallback to mock signup
      const mockUser: User = {
        id: 'mock-user-' + Date.now(),
        username,
        email,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [], // Empty array
        securityKey: 'MOCK-KEY-' + Date.now().toString(36),
        savedSocialUsername: '',
        payoutMethod: undefined,
        payoutDetails: undefined,
        password: undefined,
        failedAttempts: 0,
        lockoutUntil: undefined,
      };
      
      setCurrentUser(mockUser);
      setCurrentView('campaigns');
      showToast('Account created (development mode)', 'success');
    } finally {
      setLoading(false);
    }
  };

  // Simple test login (direct mock)
  const testLogin = () => {
    setLoading(true);
    
    const mockUser: User = {
      id: 'test-user-' + Date.now(),
      username: 'testuser',
      email: 'test@example.com',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      walletBalance: 1000,
      pendingBalance: 500,
      totalEarnings: 1500,
      joinedAt: Date.now(),
      readBroadcastIds: [], // Empty array
      securityKey: 'TEST-KEY-123',
      savedSocialUsername: '',
      payoutMethod: undefined,
      payoutDetails: undefined,
      password: undefined,
      failedAttempts: 0,
      lockoutUntil: undefined,
    };
    
    setTimeout(() => {
      setCurrentUser(mockUser);
      setCurrentView('campaigns');
      showToast('Development login successful!', 'success');
      setLoading(false);
    }, 500);
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
                  maxLength={20}
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
              {loading ? '🔄 PROCESSING...' : (activeTab === 'login' ? '🔐 LOGIN' : '✨ CREATE ACCOUNT')}
            </button>
          </form>

          {/* Test login button */}
          <button
            onClick={testLogin}
            className="w-full mt-4 bg-green-500/20 text-green-400 border border-green-500/30 py-3 rounded-xl text-sm font-bold hover:bg-green-500/30 transition-all"
          >
            🚀 QUICK TEST LOGIN (Development Mode)
          </button>

          <div className="mt-6 text-center">
            <p className="text-slate-500 text-sm">
              {activeTab === 'login' ? "New here?" : "Already have an account?"}
              <button
                onClick={() => setActiveTab(activeTab === 'login' ? 'signup' : 'login')}
                className="text-cyan-400 ml-2 font-bold hover:text-cyan-300 transition-colors"
              >
                {activeTab === 'login' ? 'Create Account' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>

        {/* Development info */}
        <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
          <p className="text-cyan-400 text-xs font-bold uppercase mb-2">🛠️ Development Mode</p>
          <p className="text-slate-400 text-xs">
            • Using mock data for development
            <br />
            • Firebase will auto-enable when available
            <br />
            • Click "QUICK TEST LOGIN" to bypass Firebase
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
