import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserRole, UserStatus } from '../types';

interface AdminPanelProps {
  currentUser: User;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ currentUser, showToast }) => {
  const [adminTab, setAdminTab] = useState<
    'dashboard' | 'members' | 'campaigns' | 'payouts' | 'messages' | 'reports'
  >('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  if (currentUser.role !== UserRole.ADMIN) return null;

  const loadUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, 'users'));
      const list: User[] = snap.docs.map(d => ({
        ...(d.data() as User),
        id: d.id,
        readBroadcastIds: (d.data() as User).readBroadcastIds || [],
      }));
      setUsers(list);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleUserStatus = async (u: User) => {
    try {
      const newStatus =
        u.status === UserStatus.ACTIVE
          ? UserStatus.SUSPENDED
          : UserStatus.ACTIVE;

      await updateDoc(doc(db, 'users', u.id), { status: newStatus });
      showToast('User status updated', 'success');
      loadUsers();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-slide">
      <h2 className="text-3xl font-black italic text-white uppercase">
        Admin Dashboard
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-6 rounded-[32px] border-t-4 border-cyan-500">
          <p className="text-[8px] font-black text-slate-500 uppercase">
            Total Users
          </p>
          <p className="text-3xl font-black text-white">
            {users.filter(u => u.role !== UserRole.ADMIN).length}
          </p>
        </div>
      </div>
    </div>
  );

  const renderMembers = () => (
    <div>
      <h3 className="text-2xl font-black text-white mb-6">
        Manage Members
      </h3>
      {users
        .filter(u => u.role !== UserRole.ADMIN)
        .map(u => (
          <div key={u.id} className="glass-panel p-6 rounded-3xl mb-4">
            <div className="flex justify-between">
              <div>
                <p className="font-black text-white">@{u.username}</p>
                <p className="text-sm text-slate-400">{u.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleUserStatus(u)}
                  className="px-4 py-2 bg-red-600/20 text-red-300 rounded-lg text-sm"
                >
                  {u.status === UserStatus.ACTIVE ? 'Suspend' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        ))}
    </div>
  );

  return (
    <div className="space-y-10 pb-40 animate-slide">
      <h2 className="text-4xl font-black italic px-2 text-white uppercase leading-none">
        ADMIN<br />
        <span className="text-cyan-400">PANEL</span>
      </h2>

      <div className="flex gap-2 bg-white/5 p-2 rounded-3xl border border-white/10 overflow-x-auto hide-scrollbar sticky top-0 z-10 backdrop-blur-md">
        {['dashboard','members','campaigns','payouts','messages','reports'].map(t => (
          <button
            key={t}
            onClick={() => setAdminTab(t as any)}
            className={`whitespace-nowrap flex-1 px-5 py-3 rounded-2xl text-[9px] font-black uppercase transition-all ${
              adminTab===t ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {adminTab==='dashboard' && renderDashboard()}
      {adminTab==='members' && renderMembers()}
      {adminTab==='campaigns' && <p className="text-white">Campaign Management - Coming soon</p>}
      {adminTab==='payouts' && <p className="text-white">Pending Payouts - List here</p>}
      {adminTab==='messages' && <p className="text-white">Broadcast Messages - Coming soon</p>}
      {adminTab==='reports' && <p className="text-white">Reports - Coming soon</p>}
    </div>
  );
};

export default AdminPanel;
