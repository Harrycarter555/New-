import React from 'react';
import { getPasswordStrength } from '../utils/helpers';

interface PasswordMeterProps {
  password: string;
}

const PasswordMeter: React.FC<PasswordMeterProps> = ({ password }) => {
  const { score, label, color } = getPasswordStrength(password);
  
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= score ? color : 'bg-slate-800'}`}
          />
        ))}
      </div>
      <p className="text-[10px] font-bold text-slate-500">{label} Password</p>
    </div>
  );
};

export default PasswordMeter;
