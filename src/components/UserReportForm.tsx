import React, { useState } from 'react';
import { ICONS } from '../constants';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface UserReportFormProps {
  currentUser: any;
  showToast: (message: string, type: 'success' | 'error') => void;
  onClose: () => void;
}

const UserReportForm: React.FC<UserReportFormProps> = ({
  currentUser,
  showToast,
  onClose
}) => {
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'bug' | 'feature' | 'payment' | 'abuse' | 'other'>('bug');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      showToast('Please enter a message', 'error');
      return;
    }

    if (message.length < 10) {
      showToast('Message must be at least 10 characters', 'error');
      return;
    }

    setSubmitting(true);
    
    try {
      await addDoc(collection(db, 'reports'), {
        userId: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        message: message.trim(),
        category,
        status: 'open',
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      showToast('Report submitted successfully! Admin will review it.', 'success');
      setMessage('');
      onClose();
    } catch (error: any) {
      console.error('Error submitting report:', error);
      showToast('Failed to submit report. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { value: 'bug', label: 'Bug Report', icon: ICONS.AlertCircle, color: 'text-red-400' },
    { value: 'feature', label: 'Feature Request', icon: ICONS.Info, color: 'text-blue-400' },
    { value: 'payment', label: 'Payment Issue', icon: ICONS.Wallet, color: 'text-green-400' },
    { value: 'abuse', label: 'Abuse Report', icon: ICONS.Shield, color: 'text-orange-400' },
    { value: 'other', label: 'Other', icon: ICONS.Message, color: 'text-purple-400' }
  ];

  return (
    <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-lg rounded-3xl border border-slate-800 overflow-hidden animate-slide">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <ICONS.AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Report an Issue</h3>
                <p className="text-sm text-slate-400">Our team will review your report</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ICONS.X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Category Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-300">Category</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {categories.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value as any)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    category === value
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1 ${color}`} />
                  <span className="text-xs font-bold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-slate-300">Describe the Issue *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full h-40 bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              placeholder="Please provide detailed information about the issue you're facing..."
              maxLength={1000}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Minimum 10 characters</span>
              <span>{message.length}/1000</span>
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
                <ICONS.User className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">@{currentUser.username}</p>
                <p className="text-xs text-slate-400">Report will be linked to your account</p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 text-slate-400 rounded-xl font-bold hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !message.trim() || message.length < 10}
              className="flex-1 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <ICONS.Refresh className="w-4 h-4 animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Submit Report'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserReportForm;
