// src/components/AuthView.tsx
import React, { useState } from 'react';
import { AppState, User, UserRole, UserStatus } from '../types';
import { ICONS } from '../constants';

interface AuthViewProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  setCurrentView: React.Dispatch<React.SetStateAction<'auth' | 'campaigns' | 'verify' | 'wallet' | 'admin'>>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const AuthView: React.FC<AuthViewProps> = ({
  appState,
  setAppState,
  setCurrentUser,
  setCurrentView,
  showToast,
}) => {
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [e, setE] = useState('');
  const [k, setK] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [recoveryUser, setRecoveryUser] = useState<User | null>(null);
  const [resetData, setResetData] = useState({ username: '', password: '' });

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'NONE', color: 'bg-slate-800' };
    let score = 0;
    if (pass.length > 5) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (pass.length > 9) score++;
    if (score === 1) return { score, label: 'WEAK', color: 'bg-red-500' };
    if (score === 2) return { score, label: 'FAIR', color: 'bg-orange-500' };
    if (score === 3) return { score, label: 'GOOD', color: 'bg-cyan-500' };
    if (score === 4) return { score, label: 'STRONG', color: 'bg-green-500' };
    return { score: 0, label: 'VERY WEAK', color: 'bg-red-600' };
  };

  const PasswordMeter = ({ pass }: { pass: string }) => {
    const strength = getPasswordStrength(pass);
    if (!pass) return null;
    return (
      <div className="w-full px-2 mt-2 space-y-1 animate-slide">
        <div className="flex justify-between items-center px-1">
          <span className="text-[7px] font-black uppercase text-slate-500">Security Level</span>
          <span className={`text-[7px] font-black uppercase ${strength.label === 'STRONG' ? 'text-green-400' : 'text-slate-400'}`}>
            {strength.label}
          </span>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5">
          {[1, 2, 3, 4].map(step => (
            <div
              key={step}
              className={`h-full flex-1 transition-all duration-500 ${step <= strength.score ? strength.color : 'bg-transparent'}`}
            />
          ))}
        </div>
      </div>
    );
  };

  const handleSignIn = () => {
    const user = appState.users.find(x => x.username === u);
    if (!user) return showToast('Node Username Not Found', 'error');

    // Lockout check, failed attempts, etc. – yahan tumhara original logic paste kar dena
    // Example simplified:
    if (user.password === p) {
      setCurrentUser(user);
      setCurrentView(user.role === UserRole.ADMIN ? 'admin' : 'campaigns');
      showToast('Terminal Initialized', 'success');
    } else {
      showToast('Wrong Authentication Key', 'error');
    }
  };

  const handleSignUp = () => {
    if (!u || !p || !e) return showToast('All fields required', 'error');
    if (appState.users.find(x => x.username === u)) return showToast('Username already taken', 'error');

    const newKey = `RE-\( {Math.random().toString(36).substring(2, 8).toUpperCase()}- \){Date.now().toString().slice(-4)}`;
    const newUser: User = {
      id: `u-${Date.now()}`,
      username: u,
      password: p,
      email: e,
      securityKey: newKey,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      walletBalance: 0,
      pendingBalance: 0,
      totalEarnings: 0,
      joinedAt: Date.now(),
      readBroadcastIds: [],
      failedAttempts: 0,
      lockoutUntil: 0,
    };
    setAppState(prev => ({ ...prev, users: [...prev.users, newUser] }));
    setGeneratedKey(newKey);
    showToast('Terminal Initialized – Note your recovery key!', 'success');
  };

  const handleForgot = () => {
    const user = appState.users.find(u => u.securityKey === k);
    if (user) {
      setRecoveryUser(user);
      setResetData({ username: user.username, password: user.password || '' });
      showToast('Key Verified: Node Access Granted', 'success');
    } else {
      showToast('Invalid Security Key', 'error');
    }
  };

  if (generatedKey) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-10 overflow-hidden">
        <div className="glass-panel w-full max-w-sm p-12 rounded-[56px] space-y-8 text-center border-t-8 border-cyan-500 shadow-2xl">
          <h2 className="text-2xl font-black text-cyan-400 italic uppercase">RECOVERY SECURITY KEY</h2>
          <p className="text-sm text-slate-300 italic">Note this key safely – required for password recovery.</p>
          <div
            className="p-7 bg-black/40 rounded-3xl border-2 border-dashed border-cyan-500/30 cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(generatedKey);
              showToast('Security Key Copied', 'success');
            }}
          >
            <p className="text-2xl font-black tracking-widest text-white select-all">{generatedKey}</p>
          </div>
          <button
            onClick={() => {
              setGeneratedKey(null);
              setAuthTab('signin');
            }}
            className="w-full py-7 bg-cyan-500 text-black rounded-[32px] font-black uppercase shadow-2xl active:scale-95"
          >
            I HAVE SAVED THE KEY – CONTINUE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-10">
      <div className="glass-panel w-full max-w-sm p-12 rounded-[64px] space-y-10 border-t-8 border-cyan-500 shadow-2xl">
        <div className="text-center">
          <h1 className="text-5xl font-black italic text-white">
            REEL<span className="text-cyan-400">EARN</span>
          </h1>
          <div className="flex gap-4 justify-center mt-4">
            {['signin', 'signup', 'forgot'].map(t => (
              <button
                key={t}
                onClick={() => setAuthTab(t as any)}
                className={`text-[10px] font-black uppercase ${authTab === t ? 'text-cyan-400 scale-110' : 'text-slate-500'}`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {authTab === 'signin' && (
          <>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-[28px] px-8 py-5 text-center text-lg font-black text-white placeholder-slate-700 outline-none"
              placeholder="TERMINAL ID"
              value={u}
              onChange={e => setU(e.target.value)}
            />
            <input
              type="password"
              className="w-full bg-white/5 border border-white/10 rounded-[28px] px-8 py-5 text-center text-lg font-black text-white placeholder-slate-700 outline-none"
              placeholder="AUTH KEY"
              value={p}
              onChange={e => setP(e.target.value)}
            />
            <PasswordMeter pass={p} />
            <button
              onClick={handleSignIn}
              className="w-full py-7 bg-cyan-500 text-black rounded-[32px] font-black uppercase shadow-2xl active:scale-95"
            >
              INITIALIZE NODE
            </button>
          </>
        )}

        {authTab === 'signup' && (
          <>
            <input placeholder="USERNAME" value={u} onChange={e => setU(e.target.value)} className="..." />
            <input placeholder="EMAIL" value={e} onChange={e => setE(e.target.value)} className="..." />
            <input type="password" placeholder="PASSWORD" value={p} onChange={e => setP(e.target.value)} className="..." />
            <PasswordMeter pass={p} />
            <button onClick={handleSignUp} className="...">
              CREATE TERMINAL
            </button>
          </>
        )}

        {authTab === 'forgot' && (
          <>
            {recoveryUser ? (
              <>
                <input placeholder="NEW USERNAME" value={resetData.username} onChange={e => setResetData({...resetData, username: e.target.value})} />
                <input type="password" placeholder="NEW PASSWORD" value={resetData.password} onChange={e => setResetData({...resetData, password: e.target.value})} />
                <PasswordMeter pass={resetData.password} />
                <button
                  onClick={() => {
                    // Update user logic here
                    showToast('Credentials Updated', 'success');
                    setRecoveryUser(null);
                    setAuthTab('signin');
                  }}
                  className="..."
                >
                  RESET & LOGIN
                </button>
              </>
            ) : (
              <>
                <input placeholder="SECURITY KEY" value={k} onChange={e => setK(e.target.value)} />
                <button onClick={handleForgot} className="...">
                  RECOVER ACCESS
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuthView;
