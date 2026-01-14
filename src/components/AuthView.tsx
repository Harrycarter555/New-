import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
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
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [recoverUsername, setRecoverUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Add debug log
  const addDebugLog = (message: string) => {
    console.log(`🔍 DEBUG: ${message}`);
    setDebugLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Generate secure authentication key
  const generateSecureAuthKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const specialSuffix = 'RE-';
    let key = specialSuffix;
    
    for (let i = 0; i < 12; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    key += '-' + Date.now().toString(36).toUpperCase();
    
    addDebugLog(`Generated auth key: ${key.substring(0, 10)}...`);
    return key;
  };

  // Clear errors when switching tabs
  useEffect(() => {
    addDebugLog(`Tab changed to: ${activeTab}`);
    setErrors({});
    if (activeTab !== 'signup') {
      setGeneratedAuthKey('');
    }
  }, [activeTab]);

  // Find user by username in Firestore
  const findUserByUsername = async (username: string): Promise<User | null> => {
    try {
      addDebugLog(`Searching user by username: ${username}`);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.trim()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        addDebugLog(`User found by username: ${username}`);
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      addDebugLog(`No user found with username: ${username}`);
      return null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      addDebugLog(`Error finding user by username: ${error}`);
      return null;
    }
  };

  // Find user by email in Firestore
  const findUserByEmail = async (email: string): Promise<User | null> => {
    try {
      addDebugLog(`Searching user by email: ${email}`);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        addDebugLog(`User found by email: ${email}`);
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      addDebugLog(`No user found with email: ${email}`);
      return null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      addDebugLog(`Error finding user by email: ${error}`);
      return null;
    }
  };

  const validateLoginForm = (): boolean => {
    addDebugLog(`Validating login form: identifier=${loginIdentifier}, password=${password ? '***' : 'empty'}`);
    const newErrors: Record<string, string> = {};
    
    if (!loginIdentifier.trim()) {
      newErrors.loginIdentifier = 'Username or email is required';
      addDebugLog('Login validation failed: identifier empty');
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
      addDebugLog('Login validation failed: password empty');
    }
    
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    addDebugLog(`Login validation ${isValid ? 'passed' : 'failed'}`);
    return isValid;
  };

  const validateSignupForm = (): boolean => {
    addDebugLog(`Validating signup form: username=${username}, email=${email}, password=${password ? '***' : 'empty'}`);
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
    const isValid = Object.keys(newErrors).length === 0;
    addDebugLog(`Signup validation ${isValid ? 'passed' : 'failed'}`);
    return isValid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    addDebugLog('🔐 Login button clicked');
    
    if (!validateLoginForm()) {
      addDebugLog('Login validation failed, returning');
      return;
    }
    
    try {
      setLoading(true);
      addDebugLog('Starting login process...');
      setErrors({});
      
      let userData: User | null = null;
      let userEmail = '';
      
      // Check if loginIdentifier is email or username
      if (loginIdentifier.includes('@')) {
        addDebugLog(`Login identifier looks like email: ${loginIdentifier}`);
        userData = await findUserByEmail(loginIdentifier);
        userEmail = loginIdentifier.trim().toLowerCase();
      } else {
        addDebugLog(`Login identifier looks like username: ${loginIdentifier}`);
        userData = await findUserByUsername(loginIdentifier);
        if (userData) {
          userEmail = userData.email;
          addDebugLog(`Found user email: ${userEmail}`);
        }
      }
      
      if (!userData || !userEmail) {
        addDebugLog('User not found in database');
        showToast('Account not found. Please check your username/email.', 'error');
        return;
      }
      
      addDebugLog(`User found: ${userData.username}, email: ${userEmail}`);
      
      // Check if user is active
      if (userData.status === UserStatus.SUSPENDED) {
        addDebugLog('Account is suspended');
        showToast('Account suspended. Please contact support.', 'error');
        return;
      }
      
      // Check if account is locked
      if (userData.lockoutUntil && userData.lockoutUntil > Date.now()) {
        const minutesLeft = Math.ceil((userData.lockoutUntil - Date.now()) / (1000 * 60));
        addDebugLog(`Account locked for ${minutesLeft} minutes`);
        showToast(`Account locked. Try again in ${minutesLeft} minute(s).`, 'error');
        return;
      }
      
      addDebugLog('Attempting Firebase authentication...');
      // Now login with email and password
      const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
      addDebugLog(`Firebase auth successful: ${userCredential.user.uid}`);
      
      const safeUserData = {
        ...userData,
        readBroadcastIds: userData.readBroadcastIds || [],
        lastLoginAt: Date.now()
      };
      
      // Update last login timestamp
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        lastLoginAt: serverTimestamp(),
        failedAttempts: 0,
        lockoutUntil: null
      }, { merge: true });
      
      addDebugLog(`Setting current user: ${safeUserData.username}, role: ${safeUserData.role}`);
      
      setCurrentUser(safeUserData);
      setCurrentView(safeUserData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
      showToast(`Welcome back, ${safeUserData.username}!`, 'success');
      
      // Clear login form
      setLoginIdentifier('');
      setPassword('');
      
      addDebugLog('Login completed successfully');
      
    } catch (error: any) {
      console.error('Login error:', error);
      addDebugLog(`Login error: ${error.code} - ${error.message}`);
      
      let errorMessage = 'Login failed. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Account not found.';
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
      addDebugLog('Login process finished, loading=false');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    addDebugLog('✨ Signup button clicked');
    
    if (!validateSignupForm()) {
      addDebugLog('Signup validation failed');
      return;
    }
    
    try {
      setLoading(true);
      addDebugLog('Starting signup process...');
      setErrors({});
      
      // Check if username already exists
      addDebugLog(`Checking if username exists: ${username}`);
      const existingUserByUsername = await findUserByUsername(username);
      if (existingUserByUsername) {
        addDebugLog(`Username already taken: ${username}`);
        showToast('Username already taken. Please choose another.', 'error');
        return;
      }
      
      // Check if email already exists
      addDebugLog(`Checking if email exists: ${email}`);
      const existingUserByEmail = await findUserByEmail(email);
      if (existingUserByEmail) {
        addDebugLog(`Email already registered: ${email}`);
        showToast('Email already registered. Please login instead.', 'error');
        return;
      }
      
      addDebugLog('Creating Firebase auth user...');
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        email.trim().toLowerCase(), 
        password
      );
      addDebugLog(`Firebase user created: ${userCredential.user.uid}`);
      
      // Generate secure authentication key
      const securityKey = generateSecureAuthKey();
      
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

      addDebugLog('Saving user to Firestore...');
      // Save user document to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      addDebugLog('User saved to Firestore');
      
      // Sign out from Firebase Auth (IMPORTANT: Don't auto login)
      addDebugLog('Signing out from Firebase...');
      await auth.signOut();
      
      // Set generated key
      addDebugLog(`Setting generated auth key: ${securityKey.substring(0, 15)}...`);
      setGeneratedAuthKey(securityKey);
      
      showToast('Account created successfully! Save your authentication key.', 'success');
      addDebugLog('Signup completed, showing auth key');
      
    } catch (error: any) {
      console.error('Signup error:', error);
      addDebugLog(`Signup error: ${error.code} - ${error.message}`);
      
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
      addDebugLog('Signup process finished, loading=false');
    }
  };

  const handleContinueToLogin = () => {
    addDebugLog('Continuing to login after saving auth key');
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

  const handleRecoverWithAuthKey = async (e: React.FormEvent) => {
    e.preventDefault();
    addDebugLog('🔑 Recover account button clicked');
    
    if (!authKey.trim()) {
      showToast('Please enter your authentication key', 'error');
      return;
    }
    
    if (!recoverUsername.trim()) {
      showToast('Please enter your username', 'error');
      return;
    }
    
    try {
      setLoading(true);
      addDebugLog(`Recovering account for username: ${recoverUsername}`);
      
      // Find user by username
      const userData = await findUserByUsername(recoverUsername);
      
      if (!userData) {
        addDebugLog(`Username not found: ${recoverUsername}`);
        showToast('Username not found. Please check and try again.', 'error');
        return;
      }
      
      addDebugLog(`User found, checking auth key...`);
      // Verify authentication key
      if (userData.securityKey !== authKey.trim()) {
        addDebugLog('Authentication key mismatch');
        showToast('Invalid authentication key. Please check and try again.', 'error');
        return;
      }
      
      addDebugLog('Authentication key verified successfully');
      // Key matches! Show account details
      const accountDetails = `
Account Recovery Successful!

Username: ${userData.username}
Email: ${userData.email}
Wallet Balance: ₹${userData.walletBalance}
Status: ${userData.status}

Please login with your username and password.
`;
      
      alert(accountDetails);
      
      // Clear recovery form and go to login
      setRecoverUsername('');
      setAuthKey('');
      setActiveTab('login');
      showToast('Please login with your credentials', 'success');
      
    } catch (error: any) {
      console.error('Recovery error:', error);
      addDebugLog(`Recovery error: ${error}`);
      showToast('Recovery failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    addDebugLog(`Form submitted for tab: ${activeTab}`);
    if (activeTab === 'login') return handleLogin(e);
    if (activeTab === 'signup' && !generatedAuthKey) return handleSignup(e);
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

        {/* DEBUG PANEL - Remove in production */}
        <div className="mb-4 p-3 bg-gray-900/80 border border-gray-700 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-yellow-400 text-xs font-bold">🔧 DEBUG MODE</span>
            <button 
              onClick={() => setDebugLogs([])}
              className="text-gray-400 text-xs hover:text-white"
            >
              Clear Logs
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {debugLogs.map((log, index) => (
              <div key={index} className="text-gray-400 text-xs font-mono mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-2xl">
          
          {/* ONLY SHOW TABS WHEN NOT SHOWING AUTH KEY */}
          {!generatedAuthKey ? (
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
          ) : (
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white">🔐 Account Created</h2>
              <p className="text-slate-400 text-sm">Save your authentication key</p>
            </div>
          )}

          {/* SHOW AUTHENTICATION KEY AFTER SIGNUP */}
          {generatedAuthKey ? (
            <div className="mb-6">
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
            /* REGULAR LOGIN/SIGNUP/RECOVER FORM */
            <>
              {/* Error Message */}
              {errors.general && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{errors.general}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit}>
                {activeTab === 'login' && (
                  <div className="mb-4">
                    <label className="block text-slate-400 text-sm mb-2 font-medium">
                      Username or Email
                    </label>
                    <input
                      type="text"
                      placeholder="Enter username or email"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                      required
                      disabled={loading}
                    />
                    {errors.loginIdentifier && (
                      <p className="text-red-400 text-xs mt-1">{errors.loginIdentifier}</p>
                    )}
                  </div>
                )}

                {activeTab === 'signup' && (
                  <>
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
                  </>
                )}

                {activeTab === 'recover' && (
                  <>
                    <div className="mb-4">
                      <label className="block text-slate-400 text-sm mb-2 font-medium">
                        Username
                      </label>
                      <input
                        type="text"
                        placeholder="Enter your username"
                        value={recoverUsername}
                        onChange={(e) => setRecoverUsername(e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="mb-4">
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
                  </>
                )}

                {/* Password Fields for Login and Signup */}
                {(activeTab === 'login' || activeTab === 'signup') && (
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
                  </>
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
                      🔐 Lost Account? Use Authentication Key
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
                      setRecoverUsername('');
                      setAuthKey('');
                    }}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold ml-1 transition-colors"
                    disabled={loading}
                  >
                    {activeTab === 'login' && 'Sign Up'}
                    {activeTab === 'signup' && 'Login'}
                    {activeTab === 'recover' && 'Back to Login'}
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
              DEBUG MODE ACTIVE
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            • Check console for debug logs (F12)
            <br />
            • Login with Username or Email
            <br />
            • Authentication Key Recovery System
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
