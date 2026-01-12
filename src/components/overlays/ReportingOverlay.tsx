import React, { useState } from 'react';
import { User } from '../../types';

interface ReportingOverlayProps {
  isOpen: boolean;
  currentUser: User | null;
  onClose: () => void;
  onSubmit: (message: string) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const ReportingOverlay: React.FC<ReportingOverlayProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSubmit,
  showToast,
}) => {
  const [message, setMessage] = useState('');

  if (!isOpen || !currentUser) return null;

  const handleSubmit = () => {
    if (!message.trim()) {
      showToast('Message cannot be empty', 'error');
      return;
    }

    onSubmit(message);
    setMessage('');
    onClose();
    showToast('Report submitted successfully', 'success');
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-8 animate-slide">
      <div className="glass-panel w-full max-w-sm p-10 rounded-[48px] border-t-8 border-red-600 space-y-8 relative">
        <h3 className="text-2xl font-black text-white text-center uppercase tracking-tighter">
          Report Issue
        </h3>
        <p className="text-[9px] text-center text-slate-500 uppercase tracking-widest italic">
          Describe the problem
        </p>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          className="w-full h-32 bg-white/5 border border-white/10 rounded-3xl p-6 text-white outline-none resize-none focus:border-red-500"
          placeholder="Your issue..."
        />

        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white/10 rounded-2xl text-slate-400 font-black uppercase"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-4 bg-red-600 rounded-2xl text-white font-black uppercase shadow-lg active:scale-95"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportingOverlay;
