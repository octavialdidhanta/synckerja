
import React from 'react';

interface ProgressBarProps {
  current: number;
  target: number;
  /** When set, overrides current/target ratio (e.g. budget utilization for cost). */
  percentage?: number;
  className?: string;
  /** Brand fill + label; legacy colors kept for optional reuse */
  color?: 'primary' | 'purple' | 'blue' | 'green' | 'danger';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ 
  current, 
  target, 
  percentage: percentageOverride,
  className = "",
  color = 'primary' 
}) => {
  const rawPercentage =
    percentageOverride != null
      ? Math.round(percentageOverride)
      : target > 0
        ? Math.round((current / target) * 100)
        : 0;

  const displayPercentage = Math.max(0, rawPercentage);
  const barWidth = Math.min(displayPercentage, 100);
  const isOverTarget = displayPercentage > 100;
  const resolvedColor = isOverTarget ? 'danger' : color;
  
  const colorClasses = {
    primary: 'bg-primary',
    purple: 'bg-purple-600',
    blue: 'bg-blue-600', 
    green: 'bg-green-600',
    danger: 'bg-red-500',
  };

  const labelClass =
    resolvedColor === 'primary'
      ? 'text-primary'
      : resolvedColor === 'danger'
        ? 'text-red-600'
        : 'text-foreground';

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
          className={`${colorClasses[resolvedColor]} h-1.5 rounded-full transition-all duration-300`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <span className={`min-w-[2rem] text-xs font-medium text-right tabular-nums ${labelClass}`}>
        {displayPercentage}%
      </span>
    </div>
  );
};
