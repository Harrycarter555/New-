import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  color = 'cyan-500' 
}) => {
  const sizeClass = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  }[size];

  return (
    <div className="flex justify-center items-center p-8">
      <div className={`${sizeClass} border-4 border-${color}/20 border-t-${color} rounded-full animate-spin`} />
    </div>
  );
};

export default LoadingSpinner;
