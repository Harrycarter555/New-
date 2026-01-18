import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';
import { validatePasswordStrength, getPasswordStrengthColor } from '../utils/passwordValidator';

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
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [passwordStrength, setPasswordStrength] = useState<{
    strength: string;
    score: number;
    color: string;
    message: string;
  } | null>(null);
  const [showSecurityKey, setShowSecurityKey] = useState(false);
  const [generatedSecurityKey, setGeneratedSecurityKey] = useState('');

  // Generate security key
  const generateSecurityKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `REEL-${key.substring(0, 8)}-${key.substring(8, 16)}-${key.substring(16, 24)}-${key.substring(24, 32)}`;
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Security key copied to clipboard!', 'success');
  };

  // Real-time password strength check
  useEffect(() => {
    if (activeTab === 'signup' && password && password.length > 0) {
      const validation = validatePasswordStrength(password);
      setPasswordStrength({
        strength: validation.strength,
        score: validation.score,
        color: getPasswordStrengthColor(validation.strength),
        message: validation.message
      });
    } else {
      setPasswordStrength(null);
    }
  }, [password, activeTab]);

  // Validate username and email are not same
  const validateInputs = () => {
    const newErrors: {[key: string]: string} = {};

    if (activeTab === 'signup') {
      // Check if username and email are same
      if (username && email && username.toLowerCase() === email.toLowerCase()) {
        newErrors.username = 'Username and email cannot be the same';
      }

      // Check if username is valid
      if (username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (username.length > 20) {
        newErrors.username = 'Username cannot exceed 20 characters';
      } else if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
        newErrors.username = 'Username can only contain letters, numbers, dots, hyphens and underscores';
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        newErrors.password = passwordValidation.message;
        // Show all issues
        if (passwordValidation.issues.length > 0) {
          newErrors.passwordDetails = passwordValidation.issues.join(', ');
        }
      }

      // Check if passwords match
      if (password && confirmPassword && password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // For login, just check if fields are filled
    if (activeTab === 'login') {
      if (!email.trim()) newErrors.email = 'Email is required';
      if (!password.trim()) newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Check if username already exists in database
  const checkUsernameExists = async (username: string): Promise<boolean> => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.toLowerCase()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking username:', error);
      return false;
    }
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateInputs()) {
      if (!errors.email && !errors.password) {
        showToast('Please check the form for errors', 'error');
      }
      return;
    }
    
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        setCurrentUser({ 
          ...userData, 
          lastLoginAt: Date.now() 
        });
        setCurrentView(userData.role === UserRole.ADMIN ? 'admin' : 'campaigns');
        showToast(`Welcome back, ${userData.username}!`, 'success');
      } else {
        // If user doc doesn't exist, create basic one
        const securityKey = generateSecurityKey();
        const basicUser: User = {
          id: userCredential.user.uid,
          username: email.split('@')[0],
          email: email.trim(),
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          walletBalance: 100,
          pendingBalance: 0,
          totalEarnings: 0,
          joinedAt: Date.now(),
          readBroadcastIds: [],
          securityKey: securityKey,
          savedSocialUsername: '',
          payoutMethod: '',
          payoutDetails: '',
          failedAttempts: 0,
          lastLoginAt: Date.now()
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), basicUser);
        setCurrentUser(basicUser);
        setCurrentView('campaigns');
        showToast(`Welcome, ${basicUser.username}! ₹100 bonus added to your wallet!`, 'success');
      }
      
      // Clear form
      setEmail('');
      setPassword('');
      setErrors({});
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email. Please sign up.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Contact support.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      showToast(errorMessage, 'error');
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Handle Signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Trim all inputs
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();
    
    // Basic validation
    if (!trimmedUsername || !trimmedEmail || !trimmedPassword) {
      showToast('Please fill all required fields', 'error');
      return;
    }
    
    // Validate inputs
    if (!validateInputs()) {
      if (errors.username || errors.email || errors.password) {
        showToast('Please fix the errors in the form', 'error');
      }
      return;
    }
    
    // Check if username and email are same
    if (trimmedUsername.toLowerCase() === trimmedEmail.toLowerCase()) {
      showToast('Username and email cannot be the same', 'error');
      setErrors({ ...errors, username: 'Username and email cannot be the same' });
      return;
    }
    
    // Check if username already exists
    try {
      const usernameExists = await checkUsernameExists(trimmedUsername);
      if (usernameExists) {
        showToast('Username already taken. Please choose another.', 'error');
        setErrors({ ...errors, username: 'Username already taken' });
        return;
      }
    } catch (error) {
      showToast('Error checking username availability. Please try again.', 'error');
      return;
    }
    
    try {
      setLoading(true);
      
      // Generate security key
      const securityKey = generateSecurityKey();
      setGeneratedSecurityKey(securityKey);
      
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      
      // Create user object for Firestore
      const newUser: User = {
        id: userCredential.user.uid,
        username: trimmedUsername.toLowerCase(),
        email: trimmedEmail.toLowerCase(),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [],
        securityKey: securityKey,
        savedSocialUsername: '',
        payoutMethod: '',
        payoutDetails: '',
        failedAttempts: 0,
        lastLoginAt: Date.now()
      };
      
      // Save to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      
      // Show security key modal
      setShowSecurityKey(true);
      
      // Clear form
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setErrors({});
      setPasswordStrength(null);
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please login instead.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please use a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password signup is currently disabled.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      showToast(errorMessage, 'error');
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    const newErrors = { ...errors };
    delete newErrors.general;
    setErrors(newErrors);
    
    if (activeTab === 'login') return handleLogin(e);
    if (activeTab === 'signup') return handleSignup(e);
  };

  // Input change handlers with validation
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    // Validate in real-time for signup
    if (activeTab === 'signup') {
      if (email && value.toLowerCase() === email.toLowerCase()) {
        setErrors({ ...errors, username: 'Username and email cannot be the same' });
      } else if (value.length > 0 && value.length < 3) {
        setErrors({ ...errors, username: 'Username must be at least 3 characters' });
      } else if (!/^[a-zA-Z0-9_.-]*$/.test(value)) {
        setErrors({ ...errors, username: 'Only letters, numbers, dots, hyphens and underscores allowed' });
      } else {
        const newErrors = { ...errors };
        delete newErrors.username;
        setErrors(newErrors);
      }
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    // Validate in real-time
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      setErrors({ ...errors, email: 'Please enter a valid email address' });
    } else if (activeTab === 'signup' && username && value.toLowerCase() === username.toLowerCase()) {
      setErrors({ ...errors, email: 'Email and username cannot be the same' });
    } else {
      const newErrors = { ...errors };
      delete newErrors.email;
      setErrors(newErrors);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    // For signup, validate in real-time
    if (activeTab === 'signup') {
      if (value && confirmPassword && value !== confirmPassword) {
        setErrors({ ...errors, confirmPassword: 'Passwords do not match' });
      } else {
        const newErrors = { ...errors };
        delete newErrors.password;
        delete newErrors.confirmPassword;
        delete newErrors.passwordDetails;
        setErrors(newErrors);
      }
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (password && value && password !== value) {
      setErrors({ ...errors, confirmPassword: 'Passwords do not match' });
    } else {
      const newErrors = { ...errors };
      delete newErrors.confirmPassword;
      setErrors(newErrors);
    }
  };

  // Security Key Modal Component
  const SecurityKeyModal = () => (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-slate-800 w-full max-w-md rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-black/50">
          <h3 className="text-xl font-bold text-white">⚠️ IMPORTANT: Save Your Security Key!</h3>
          <p className="text-sm text-slate-400 mt-1">
            This key is required for account recovery. Save it securely!
          </p>
        </div>

        <div className="p-6">
          {/* Security Key Display */}
          <div className="mb-4">
            <div className="bg-black/50 border-2 border-amber-500/30 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-amber-400">SECURITY KEY</span>
                <button
                  onClick={() => copyToClipboard(generatedSecurityKey)}
                  className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-lg hover:bg-amber-500/30"
                >
                  📋 Copy
                </button>
              </div>
              <p className="text-lg font-mono text-white text-center tracking-wider break-all">
                {generatedSecurityKey}
              </p>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Copy and save this key in a secure place (password manager, notes, etc.)
            </p>
          </div>

          {/* Warning Message */}
          <div className="mb-6 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
            <p className="text-xs text-red-300 font-bold mb-1">⚠️ WARNING:</p>
            <ul className="text-xs text-red-400 list-disc list-inside space-y-1">
              <li>This key cannot be recovered if lost</li>
              <li>Without this key, you cannot recover your account</li>
              <li>Do not share this key with anyone</li>
              <li>Admin cannot recover your account without this key</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                setShowSecurityKey(false);
                setCurrentView('campaigns');
                showToast('Account created successfully! Welcome to ReelEarn!', 'success');
              }}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-black font-bold py-3 rounded-lg hover:opacity-90"
            >
              ✅ I have saved my security key
            </button>

            <button
              onClick={() => copyToClipboard(generatedSecurityKey)}
              className="w-full bg-amber-500/10 text-amber-400 font-bold py-3 rounded-lg border border-amber-500/20 hover:bg-amber-500/20"
            >
              📋 Copy Key Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      {showSecurityKey && <SecurityKeyModal />}
      
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
              onClick={() => {
                setActiveTab('login');
                setErrors({});
                setPasswordStrength(null);
              }}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'login' ? 'bg-cyan-500 text-black' : 'text-slate-500 hover:text-slate-300'}`}
            >
              LOGIN
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrors({});
              }}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'signup' ? 'bg-cyan-500 text-black' : 'text-slate-500 hover:text-slate-300'}`}
            >
              SIGN UP
            </button>
          </div>

          {/* Error message display */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-xl animate-pulse">
              <p className="text-red-400 text-sm font-medium">{errors.general}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Username for signup only */}
            {activeTab === 'signup' && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Choose a username (3-20 characters)"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={`w-full bg-slate-900/50 border ${errors.username ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                  required
                  minLength={3}
                  maxLength={20}
                  disabled={loading}
                />
                {errors.username && (
                  <p className="text-red-400 text-xs mt-1 ml-1 flex items-center">
                    <span className="mr-1">⚠</span> {errors.username}
                  </p>
                )}
                {!errors.username && username.length > 0 && username.length >= 3 && (
                  <p className="text-green-400 text-xs mt-1 ml-1 flex items-center">
                    <span className="mr-1">✓</span> Username available
                  </p>
                )}
              </div>
            )}

            {/* Email */}
            <div className="mb-4">
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={`w-full bg-slate-900/50 border ${errors.email ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                required
                disabled={loading}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1 ml-1 flex items-center">
                  <span className="mr-1">⚠</span> {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="mb-4">
              <input
                type="password"
                placeholder={activeTab === 'signup' ? "Create a strong password" : "Enter your password"}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className={`w-full bg-slate-900/50 border ${errors.password ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                required
                minLength={6}
                disabled={loading}
              />
              
              {/* Password strength meter for signup */}
              {activeTab === 'signup' && passwordStrength && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400">Password strength:</span>
                    <span className="text-xs font-medium" style={{ color: passwordStrength.color }}>
                      {passwordStrength.strength.toUpperCase()}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${passwordStrength.score}%`,
                        backgroundColor: passwordStrength.color
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: passwordStrength.color }}>
                    {passwordStrength.message}
                  </p>
                </div>
              )}
              
              {errors.password && (
                <p className="text-red-400 text-xs mt-1 ml-1 flex items-center">
                  <span className="mr-1">⚠</span> {errors.password}
                </p>
              )}
              {errors.passwordDetails && (
                <div className="mt-2 p-2 bg-red-900/20 border border-red-800/50 rounded-lg">
                  <p className="text-red-300 text-xs font-bold mb-1">Issues to fix:</p>
                  <ul className="text-red-400 text-xs list-disc list-inside space-y-1">
                    {errors.passwordDetails.split(', ').map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm Password for signup only */}
            {activeTab === 'signup' && (
              <div className="mb-6">
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  className={`w-full bg-slate-900/50 border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors`}
                  required
                  disabled={loading}
                />
                {errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1 ml-1 flex items-center">
                    <span className="mr-1">⚠</span> {errors.confirmPassword}
                  </p>
                )}
                {!errors.confirmPassword && confirmPassword && password === confirmPassword && (
                  <p className="text-green-400 text-xs mt-1 ml-1 flex items-center">
                    <span className="mr-1">✓</span> Passwords match
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (activeTab === 'signup' && Object.keys(errors).length > 0)}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin mr-2">⟳</span>
                  {activeTab === 'login' ? 'LOGGING IN...' : 'CREATING ACCOUNT...'}
                </span>
              ) : activeTab === 'login' ? (
                <span className="flex items-center justify-center">
                  <span className="mr-2">🔐</span> LOGIN
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <span className="mr-2">✨</span> CREATE ACCOUNT
                </span>
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
                  const newTab = activeTab === 'login' ? 'signup' : 'login';
                  setActiveTab(newTab);
                  setEmail('');
                  setPassword('');
                  setUsername('');
                  setConfirmPassword('');
                  setErrors({});
                  setPasswordStrength(null);
                }}
                className="text-cyan-400 ml-2 font-bold hover:text-cyan-300 transition-colors"
                disabled={loading}
              >
                {activeTab === 'login' ? 'Create Account' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>

        {/* Security Key Info */}
        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-amber-400 text-xs font-bold mb-2 flex items-center">
            <span className="mr-2">🔑</span> NEW SECURITY KEY FEATURE
          </p>
          <ul className="text-amber-300 text-xs space-y-1.5">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Every account gets a <strong>unique security key</strong></span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Required for <strong>account recovery</strong></span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Save it securely - <strong>cannot be recovered</strong></span>
            </li>
          </ul>
        </div>

        {/* Password Requirements Info (for signup) */}
        {activeTab === 'signup' && (
          <div className="mt-4 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
            <p className="text-slate-400 text-xs font-bold mb-2 flex items-center">
              <span className="mr-2">🔒</span> PASSWORD REQUIREMENTS
            </p>
            <ul className="text-slate-500 text-xs space-y-1.5">
              <li className="flex items-center">
                <span className={`mr-2 ${password && password.length >= 6 ? 'text-green-400' : 'text-slate-600'}`}>
                  {password && password.length >= 6 ? '✓' : '○'}
                </span>
                Minimum 6 characters (8+ recommended)
              </li>
              <li className="flex items-center">
                <span className={`mr-2 ${password && /[A-Z]/.test(password) ? 'text-green-400' : 'text-slate-600'}`}>
                  {password && /[A-Z]/.test(password) ? '✓' : '○'}
                </span>
                At least one uppercase letter (A-Z)
              </li>
              <li className="flex items-center">
                <span className={`mr-2 ${password && /[a-z]/.test(password) ? 'text-green-400' : 'text-slate-600'}`}>
                  {password && /[a-z]/.test(password) ? '✓' : '○'}
                </span>
                At least one lowercase letter (a-z)
              </li>
              <li className="flex items-center">
                <span className={`mr-2 ${password && /\d/.test(password) ? 'text-green-400' : 'text-slate-600'}`}>
                  {password && /\d/.test(password) ? '✓' : '○'}
                </span>
                At least one number (0-9)
              </li>
              <li className="flex items-center">
                <span className={`mr-2 ${password && /[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-green-400' : 'text-slate-600'}`}>
                  {password && /[!@#$%^&*(),.?":{}|<>]/.test(password) ? '✓' : '○'}
                </span>
                At least one special character (!@#$%^&*)
              </li>
            </ul>
          </div>
        )}

        {/* Status */}
        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold flex items-center">
              <span className="mr-2">🛡️</span> SYSTEM STATUS
            </span>
            <span className="text-green-400 text-xs font-bold flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              SECURE & READY
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            • End-to-end encrypted authentication
            <br />
            • Security key protection
            <br />
            • Real-time username validation
            <br />
            • Secure Firestore database
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
