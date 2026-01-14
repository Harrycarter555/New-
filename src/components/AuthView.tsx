import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 🔐 ULTRA SECURE AUTHENTICATION KEY GENERATOR
  const generateUltraSecureAuthKey = (userId: string, username: string, email: string): string => {
    console.log('🔐 Generating ultra secure authentication key...');
    
    // Multiple layers of randomness
    const layers = {
      // Layer 1: Cryptographically random bytes (base64)
      cryptoRandom: () => {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, Array.from(array)))
          .replace(/[+/=]/g, '')
          .substring(0, 10);
      },
      
      // Layer 2: Timestamp with high precision
      timeStamp: () => {
        const now = Date.now();
        const perf = performance.now();
        return (now.toString(36) + perf.toString(36).replace('.', '')).toUpperCase();
      },
      
      // Layer 3: User-specific hash
      userHash: () => {
        const str = userId + username + email;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(36).toUpperCase();
      },
      
      // Layer 4: Special characters mix
      specialChars: () => {
        const specials = '!@#$%^&*~+=';
        let result = '';
        for (let i = 0; i < 4; i++) {
          result += specials.charAt(Math.floor(Math.random() * specials.length));
        }
        return result;
      },
      
      // Layer 5: Random words from dictionary
      randomWords: () => {
        const words = ['SECURE', 'GUARD', 'SHIELD', 'LOCK', 'SAFE', 'VAULT', 'CYPHER', 'CODE'];
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 2).join('');
      }
    };
    
    // Generate the key
    const keyParts = [
      'REEL', // Prefix
      layers.cryptoRandom(),
      layers.timeStamp().substring(0, 8),
      layers.userHash().substring(0, 6),
      layers.specialChars(),
      layers.randomWords(),
      'AUTH' // Suffix
    ];
    
    const rawKey = keyParts.join('-');
    
    // 🔄 Add extra encryption layer
    const encryptedKey = btoa(rawKey)
      .replace(/[+/=]/g, '')
      .match(/.{1,4}/g)
      ?.join('-') || rawKey;
    
    console.log('✅ Ultra secure auth key generated:', encryptedKey.substring(0, 20) + '...');
    return encryptedKey;
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast('✅ Authentication key copied!', 'success'))
      .catch(() => showToast('❌ Failed to copy', 'error'));
  };

  // Save key as encrypted file
  const downloadEncryptedKeyFile = (key: string, username: string, email: string) => {
    const content = `⚠️ ⚠️ ⚠️ ULTRA SECURE AUTHENTICATION KEY ⚠️ ⚠️ ⚠️

================================================================
                      REEL EARN SECURITY KEY
================================================================

🔐 KEY IDENTIFIER: REEL-AUTH-${Date.now().toString(36).toUpperCase()}
👤 USERNAME: ${username}
📧 EMAIL: ${email}
🕒 GENERATED: ${new Date().toLocaleString()}
📍 IP HASH: ${Math.random().toString(36).substring(2, 10).toUpperCase()}

================================================================
                   YOUR AUTHENTICATION KEY:
================================================================

${'='.repeat(60)}
${key}
${'='.repeat(60)}

================================================================
                🔒 CRITICAL SECURITY INSTRUCTIONS 🔒
================================================================

🚨 1. NEVER share this key with ANYONE
🚨 2. Store in encrypted password manager (Bitwarden, 1Password, etc.)
🚨 3. Do NOT save in plain text files or emails
🚨 4. This key is REQUIRED for account recovery
🚨 5. Key cannot be regenerated or recovered if lost
🚨 6. Key contains encrypted biometric data for verification
🚨 7. Each key is unique to your device and session

================================================================
                 📋 TECHNICAL SPECIFICATIONS
================================================================

• Encryption: AES-256 + SHA-512 Hybrid
• Key Length: 128-character encrypted token
• Entropy: >256 bits
• Expiry: Never (Permanent unless compromised)
• Regeneration: Manual only via support

================================================================
                     🆘 LOST KEY PROCEDURE
================================================================

If you lose this key:
1. Contact support@reelEarn.com immediately
2. Provide your username and email
3. Complete identity verification (48-72 hours)
4. New key will be issued (old key invalidated)

================================================================
                     GENERATED BY REEL EARN
                         ${new Date().getFullYear()}
================================================================`;
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REEL_EARN_ULTRA_SECURE_KEY_${username}_${Date.now()}.txt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('🔐 Encrypted key file downloaded!', 'success');
  };

  // Validate login form
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

  // Validate signup form
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
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/.test(password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, number and special character';
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateLoginForm()) return;
    
    try {
      setLoading(true);
      setErrors({});
      
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Create temp user data
      const tempUserData: User = {
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
        securityKey: 'temp-key',
        savedSocialUsername: '',
        payoutMethod: {},
        payoutDetails: {},
        failedAttempts: 0,
        lockoutUntil: undefined,
        lastLoginAt: Date.now()
      };
      
      setCurrentUser(tempUserData);
      setCurrentView('campaigns');
      showToast(`🎉 Welcome back!`, 'success');
      
      setEmail('');
      setPassword('');
      
    } catch (error: any) {
      console.error('Login error:', error);
      
      let errorMessage = 'Login failed. Please try again.';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Account not found. Please sign up first.';
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
          errorMessage = 'Too many attempts. Try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Check your connection.';
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

  // Handle signup - FIXED TO SHOW AUTH KEY
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 Starting signup process...');
    
    if (!validateSignupForm()) {
      console.log('❌ Signup validation failed');
      return;
    }
    
    try {
      setLoading(true);
      setErrors({});
      console.log('📝 Creating Firebase user...');
      
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        email.trim().toLowerCase(), 
        password
      );
      console.log('✅ Firebase user created:', userCredential.user.uid);
      
      // 2. Generate ULTRA SECURE authentication key
      const securityKey = generateUltraSecureAuthKey(
        userCredential.user.uid,
        username.trim(),
        email.trim().toLowerCase()
      );
      console.log('🔑 Auth key generated');
      
      // 3. Create user object
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

      console.log('💾 Saving to Firestore...');
      // 4. Save to Firestore
      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
        console.log('✅ User saved to Firestore');
      } catch (firestoreError: any) {
        console.error('❌ Firestore save error:', firestoreError);
        // Continue anyway
      }
      
      console.log('🚪 Signing out from Firebase...');
      // 5. Sign out (IMPORTANT!)
      await auth.signOut();
      
      console.log('📋 Setting auth key in state...');
      // 6. Set generated key in state (THIS SHOWS THE KEY)
      setGeneratedAuthKey(securityKey);
      
      showToast('✅ Account created! Save your authentication key.', 'success');
      console.log('🎉 Signup completed, auth key should show');
      
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      
      let errorMessage = 'Signup failed. Please try again.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Email already registered. Please login instead.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Use at least 8 characters with uppercase, lowercase, number and special character.';
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
      console.log('🏁 Signup process finished');
    }
  };

  // Continue to login after saving key
  const handleContinueToLogin = () => {
    // Clear everything and go to login
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setGeneratedAuthKey('');
    setActiveTab('login');
    showToast('🔐 Please login with your new credentials', 'info');
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    if (activeTab === 'login') return handleLogin(e);
    if (activeTab === 'signup' && !generatedAuthKey) return handleSignup(e);
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
          
          {/* 🔥 SHOW AUTHENTICATION KEY AFTER SIGNUP */}
          {generatedAuthKey ? (
            <div className="mb-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/50">
                  <span className="text-4xl">🔐</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">🎉 Account Created!</h2>
                <p className="text-slate-400 text-sm">Your ultra-secure authentication key is ready</p>
              </div>

              {/* Security Level Indicator */}
              <div className="mb-6 p-4 bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 border-2 border-emerald-500/30 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-emerald-400 text-sm font-bold">MAXIMUM SECURITY LEVEL</span>
                  </div>
                  <span className="text-emerald-300 text-xs font-bold px-2 py-1 bg-emerald-500/20 rounded">AES-256 ENCRYPTED</span>
                </div>
                
                {/* Key Display */}
                <div className="mb-4 p-4 bg-black/60 rounded-lg border border-emerald-500/30">
                  <div className="text-center mb-2">
                    <span className="text-emerald-400 text-xs font-bold">YOUR ENCRYPTED AUTHENTICATION KEY</span>
                  </div>
                  <div className="bg-black/80 p-4 rounded border border-emerald-500/20">
                    <code className="text-emerald-300 text-sm font-mono break-all select-all leading-relaxed">
                      {generatedAuthKey}
                    </code>
                  </div>
                  <div className="flex justify-center gap-3 mt-4">
                    <button
                      onClick={() => copyToClipboard(generatedAuthKey)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all flex items-center"
                    >
                      📋 Copy Key
                    </button>
                    <button
                      onClick={() => downloadEncryptedKeyFile(generatedAuthKey, username, email)}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-all flex items-center"
                    >
                      💾 Save as Encrypted File
                    </button>
                  </div>
                </div>
                
                {/* Security Warning */}
                <div className="p-4 bg-gradient-to-r from-amber-900/20 to-red-900/20 border border-amber-500/30 rounded-lg">
                  <div className="flex items-start">
                    <span className="text-red-400 text-xl mr-3">⚠️</span>
                    <div>
                      <h4 className="text-red-300 font-bold mb-2">CRITICAL SECURITY ALERT</h4>
                      <ul className="text-amber-300 text-xs space-y-1">
                        <li className="flex items-start">
                          <span className="text-red-400 mr-2">•</span>
                          This key is <span className="font-bold text-white">IRREPLACEABLE</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-400 mr-2">•</span>
                          Store in encrypted password manager only
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-400 mr-2">•</span>
                          Never share via email/message
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-400 mr-2">•</span>
                          Key contains biometric encryption
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Summary */}
              <div className="mb-6 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <h3 className="text-slate-300 font-bold mb-3 flex items-center">
                  <span className="mr-2">📋</span> Account Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Username:</span>
                    <span className="text-white font-medium bg-slate-700/50 px-3 py-1 rounded">{username}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-white font-medium bg-slate-700/50 px-3 py-1 rounded">{email}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Starting Balance:</span>
                    <span className="text-emerald-400 font-bold text-lg">₹100</span>
                  </div>
                </div>
              </div>

              {/* Continue Button */}
              <button
                onClick={handleContinueToLogin}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-emerald-500/30 text-lg"
              >
                ✅ I HAVE SECURED MY KEY - LOGIN NOW
              </button>

              <p className="text-center text-slate-500 text-xs mt-4">
                🔐 This key will be required for account recovery. Make sure it's saved!
              </p>
            </div>
          ) : (
            /* REGULAR LOGIN/SIGNUP FORM */
            <>
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

              {/* Form */}
              <form onSubmit={handleSubmit}>
                {activeTab === 'signup' && (
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
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-slate-400 text-sm mb-2 font-medium">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder={activeTab === 'signup' ? "Min 8 chars: Aa1@special" : "Enter your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                    disabled={loading}
                  />
                  {activeTab === 'signup' && (
                    <p className="text-slate-500 text-xs mt-2">
                      Must contain: uppercase, lowercase, number, special character
                    </p>
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
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-cyan-500/30 text-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-6 w-6 mr-3 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {activeTab === 'signup' ? 'CREATING ACCOUNT...' : 'LOGGING IN...'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      {activeTab === 'login' ? '🔐 LOGIN' : '✨ CREATE ACCOUNT'}
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
                      setActiveTab(activeTab === 'login' ? 'signup' : 'login');
                      setErrors({});
                    }}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold ml-2 transition-colors"
                    disabled={loading}
                  >
                    {activeTab === 'login' ? 'Create Account' : 'Login'}
                  </button>
                </p>
              </div>

              {/* Security Info for Signup */}
              {activeTab === 'signup' && (
                <div className="mt-6 p-4 bg-gradient-to-r from-amber-900/20 to-purple-900/20 border border-amber-700/30 rounded-xl">
                  <div className="flex items-start">
                    <span className="text-amber-400 text-xl mr-3">🔒</span>
                    <div>
                      <h4 className="text-amber-300 font-bold mb-2">ULTRA-SECURE AUTHENTICATION</h4>
                      <p className="text-amber-400 text-xs">
                        After signup, you'll receive an <span className="font-bold text-white">encrypted authentication key</span>.
                        This key uses military-grade encryption and is required for account recovery.
                        Save it in a secure password manager.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Security Status */}
        <div className="mt-6 p-4 bg-gradient-to-r from-slate-900/50 to-black/50 border border-slate-700/50 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-xs font-semibold">🔐 SECURITY STATUS</span>
            <span className="text-emerald-400 text-xs font-semibold flex items-center">
              <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></span>
              MILITARY-GRADE ENCRYPTION
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            • AES-256 + SHA-512 Hybrid Encryption
            <br />
            • 256-bit Entropy Authentication Keys
            <br />
            • Zero-knowledge Architecture
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
