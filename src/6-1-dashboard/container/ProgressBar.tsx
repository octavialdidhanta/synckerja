
import React from 'react';

interface ProgressBarProps {
  current: number;
  target: number;
  className?: string;
  color?: 'purple' | 'blue' | 'green';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  current, 
  target, 
  className = "",
  color = 'purple' 
}) => {
  const percentage = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  
  const colorClasses = {
    purple: 'bg-purple-600',
    blue: 'bg-blue-600', 
    green: 'bg-green-600'
  };

  if (target === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <span className="text-xs text-gray-400">-</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div 
          className={`${colorClasses[color]} h-1.5 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right">{percentage}%</span>
    </div>
  );
};
