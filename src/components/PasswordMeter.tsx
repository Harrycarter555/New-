// src/components/PasswordMeter.tsx
import React from 'react';
import { getPasswordStrength } from '../utils/helpers';

interface PasswordMeterProps {
  password: string;
}

const PasswordMeter: React.FC<PasswordMeterProps> = ({ password }) => {
  const { score, label, color } = getPasswordStrength(password);
  
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? color : 'bg-slate-800'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-black text-slate-600 uppercase">Password Strength</p>
        <p className={`text-[10px] font-black uppercase ${
          score === 0 ? 'text-red-500' :
          score === 1 ? 'text-red-400' :
          score === 2 ? 'text-orange-500' :
          score === 3 ? 'text-cyan-500' :
          'text-green-500'
        }`}>
          {label}
        </p>
      </div>
    </div>
  );
};

export default PasswordMeter;
