import React, { useEffect, useState } from 'react';
import { ICONS } from '../../constants';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: 'bg-gradient-to-r from-green-500 to-emerald-600',
    error: 'bg-gradient-to-r from-red-500 to-rose-600',
    info: 'bg-gradient-to-r from-blue-500 to-cyan-600',
    warning: 'bg-gradient-to-r from-yellow-500 to-orange-600'
  }[type];

  const icon = {
    success: <ICONS.Check className="w-5 h-5" />,
    error: <ICONS.X className="w-5 h-5" />,
    info: <div className="w-5 h-5 text-center font-black">i</div>,
    warning: <div className="w-5 h-5 text-center font-black">!</div>
  }[type];

  return (
    <div
      className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] ${bgColor} text-white px-6 py-4 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 min-w-[300px] max-w-[90vw] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="flex-shrink-0">{icon}</div>
      <p className="font-bold text-sm flex-1">{message}</p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="text-white/80 hover:text-white active:scale-90 transition-all"
      >
        <ICONS.X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default Toast;
