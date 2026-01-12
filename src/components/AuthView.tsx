// src/components/AuthView.tsx
import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  query,
  where,
  collection,
  getDocs,
} from 'firebase/firestore';

import { auth, db } from '../firebase';
import { User, UserRole, UserStatus, AppState } from '../types';

interface AuthViewProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  setCurrentUser: (u: User | null) => void;
  setCurrentView: (v: 'auth' | 'campaigns' | 'admin') => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}

const AuthView: React.FC<AuthViewProps> = ({
  appState,
  setAppState,
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

  /* ---------------- SIGN IN ---------------- */
  const signIn = async () => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));

      if (!snap.exists()) {
        showToast('Profile not found', 'error');
        return;
      }

      const user = snap.data() as User;
      if (!user.readBroadcastIds) user.readBroadcastIds = [];

      setCurrentUser(user);
      setCurrentView(user.role === UserRole.ADMIN ? 'admin' : 'campaigns');
      showToast('Login successful', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  /* ---------------- SIGN UP ---------------- */
  const signUp = async () => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      const key = `RE-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

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
      };

      await setDoc(doc(db, 'users', cred.user.uid), user);
      setGeneratedKey(key);

      // Add to appState.users (for instant state update without reload)
      setAppState(prev => ({
        ...prev,
        users: [user, ...prev.users],
      }));

      showToast('Account created', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  /* ---------------- FORGOT ---------------- */
  const recover = async () => {
    try {
      const q = query(collection(db, 'users'), where('securityKey', '==', securityKey));
      const snap = await getDocs(q);

      if (snap.empty) {
        showToast('Invalid security key', 'error');
        return;
      }

      const email = snap.docs[0].data().email!;
      await sendPasswordResetEmail(auth, email);
      showToast('Reset email sent', 'success');
      setTab('signin');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  /* ---------------- UI ---------------- */
  if (generatedKey) {
    return (
      <div>
        <h2>RECOVERY KEY</h2>
        <p>{generatedKey}</p>
        <button onClick={() => setGeneratedKey(null)}>Continue</button>
      </div>
    );
  }

  return (
    <div>
      <div>
        <button onClick={() => setTab('signin')}>SIGN IN</button>
        <button onClick={() => setTab('signup')}>SIGN UP</button>
        <button onClick={() => setTab('forgot')}>FORGOT</button>
      </div>

      {tab === 'signin' && (
        <>
          <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
          <button onClick={signIn}>LOGIN</button>
        </>
      )}

      {tab === 'signup' && (
        <>
          <input placeholder="Username" onChange={e => setUsername(e.target.value)} />
          <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
          <button onClick={signUp}>REGISTER</button>
        </>
      )}

      {tab === 'forgot' && (
        <>
          <input placeholder="Security Key" onChange={e => setSecurityKey(e.target.value)} />
          <button onClick={recover}>RECOVER</button>
        </>
      )}
    </div>
  );
};

export default AuthView;
