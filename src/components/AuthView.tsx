import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';
import { validatePasswordStrength } from '../utils/passwordValidator'; // पासवर्ड वैलिडेशन के लिए

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

  // Validate username and email are not same
  const validateInputs = () => {
    const newErrors: {[key: string]: string} = {};

    if (activeTab === 'signup') {
      // Check if username and email are same
      if (username && email && username.toLowerCase() === email.toLowerCase()) {
        newErrors.username = 'Username and email cannot be the same';
      }

      // Check if username already exists
      if (username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        newErrors.password = passwordValidation.message;
      }

      // Check if passwords match
      if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address';
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
      showToast('Please fix the errors before logging in', 'error');
      return;
    }
    
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
        setCurrentUser({ ...userData, lastLoginAt: Date.now() });
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
          payoutMethod: {},
          payoutDetails: {},
          failedAttempts: 0,
          lockoutUntil: undefined,
          lastLoginAt: Date.now()
        };
        
        await setDoc(doc(db, 'users', userCredential.user.uid), basicUser);
        setCurrentUser(basicUser);
        setCurrentView('campaigns');
        showToast(`Welcome, ${basicUser.username}!`, 'success');
      }
      
      // Clear form
      setEmail('');
      setPassword('');
      setErrors({});
      
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
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'Your account has been disabled.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
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
    
    // Validate inputs
    if (!validateInputs()) {
      const errorMessages = Object.values(errors).join(', ');
      showToast(`Please fix errors: ${errorMessages}`, 'error');
      return;
    }
    
    if (!username || !email || !password) {
      showToast('Please fill all fields', 'error');
      return;
    }
    
    // Check if username already exists
    const usernameExists = await checkUsernameExists(username);
    if (usernameExists) {
      showToast('Username already taken. Please choose another.', 'error');
      setErrors({ ...errors, username: 'Username already taken' });
      return;
    }
    
    // Validate username and email are not same
    if (username.toLowerCase() === email.toLowerCase()) {
      showToast('Username and email cannot be the same', 'error');
      setErrors({ ...errors, username: 'Username and email cannot be the same' });
      return;
    }
    
    try {
      setLoading(true);
      
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user object for Firestore
      const newUser = {
        id: userCredential.user.uid,
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        walletBalance: 100,
        pendingBalance: 0,
        totalEarnings: 0,
        joinedAt: Date.now(),
        readBroadcastIds: [],
        securityKey: '',
        savedSocialUsername: '',
        payoutMethod: '',
        payoutDetails: '',
        failedAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: Date.now(),
        createdAt: new Date()
      };
      
      // Save to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      
      // Set current user and redirect
      setCurrentUser(newUser);
      setCurrentView('campaigns');
      showToast(`Welcome to ReelEarn, ${username}! ₹100 bonus added to your wallet!`, 'success');
      
      // Clear form
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setErrors({});
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = 'Signup failed';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already registered. Please login.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Use at least 6 characters with uppercase, lowercase, number and special character.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Email/password accounts are not enabled.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
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
    setErrors({});
    
    if (activeTab === 'login') return handleLogin(e);
    if (activeTab === 'signup') return handleSignup(e);
  };

  // Input change handlers with validation
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    // Validate in real-time for signup
    if (activeTab === 'signup' && email && value.toLowerCase() === email.toLowerCase()) {
      setErrors({ ...errors, username: 'Username and email cannot be the same' });
    } else {
      const newErrors = { ...errors };
      delete newErrors.username;
      setErrors(newErrors);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    // Validate in real-time for signup
    if (activeTab === 'signup' && username && value.toLowerCase() === username.toLowerCase()) {
      setErrors({ ...errors, email: 'Email and username cannot be the same' });
    } else {
      const newErrors = { ...errors };
      delete newErrors.email;
      setErrors(newErrors);
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
          
          {/* Tabs */}
          <div className="flex mb-6 bg-slate-900/50 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrors({});
              }}
              className={`flex-1 py-3 rounded-xl font-bold ${activeTab === 'login' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}
            >
              LOGIN
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrors({});
              }}
              className={`flex-1 py-3 rounded-xl font-bold ${activeTab === 'signup' ? 'bg-cyan-500 text-black' : 'text-slate-500'}`}
            >
              SIGN UP
            </button>
          </div>

          {/* Error message display */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-xl">
              <p className="text-red-400 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            {/* Username for signup only */}
            {activeTab === 'signup' && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Choose a username (min 3 chars)"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={`w-full bg-slate-900/50 border ${errors.username ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white`}
                  required
                  minLength={3}
                  maxLength={20}
                />
                {errors.username && (
                  <p className="text-red-400 text-xs mt-1 ml-1">{errors.username}</p>
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
                className={`w-full bg-slate-900/50 border ${errors.email ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white`}
                required
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="mb-4">
              <input
                type="password"
                placeholder={activeTab === 'signup' ? "Create strong password" : "Enter your password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  const newErrors = { ...errors };
                  delete newErrors.password;
                  setErrors(newErrors);
                }}
                className={`w-full bg-slate-900/50 border ${errors.password ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white`}
                required
                minLength={6}
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password for signup only */}
            {activeTab === 'signup' && (
              <div className="mb-6">
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    const newErrors = { ...errors };
                    delete newErrors.confirmPassword;
                    setErrors(newErrors);
                  }}
                  className={`w-full bg-slate-900/50 border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-white`}
                  required
                />
                {errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1 ml-1">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || Object.keys(errors).length > 0}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  setErrors({});
                }}
                className="text-cyan-400 ml-2 font-bold hover:text-cyan-300"
              >
                {activeTab === 'login' ? 'Create Account' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>

        {/* Password Requirements Info (for signup) */}
        {activeTab === 'signup' && (
          <div className="mt-4 p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
            <p className="text-slate-400 text-xs font-bold mb-1">PASSWORD REQUIREMENTS:</p>
            <ul className="text-slate-500 text-xs space-y-1">
              <li>• Minimum 6 characters</li>
              <li>• At least one uppercase letter</li>
              <li>• At least one lowercase letter</li>
              <li>• At least one number</li>
              <li>• At least one special character (!@#$%^&*)</li>
            </ul>
          </div>
        )}

        {/* Status */}
        <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold">SYSTEM STATUS</span>
            <span className="text-green-400 text-xs font-bold flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              SECURE & READY
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            • Email/password authentication
            <br />
            • Username validation
            <br />
            • Real-time database
            <br />
            • Secure and encrypted
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
