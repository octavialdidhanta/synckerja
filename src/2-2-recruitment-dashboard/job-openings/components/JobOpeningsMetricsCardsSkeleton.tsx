
import { memo } from 'react';

export const JobOpeningsMetricsCardsSkeleton = memo(() => {
  return (
    <div className="mb-2">
      <div className="grid grid-cols-4 gap-1">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200/50 p-2 shadow-sm relative overflow-hidden">
            {/* Accent line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-200 animate-pulse"></div>
            
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/10 to-blue-50/10 pointer-events-none"></div>
            
            {/* Content */}
            <div className="relative px-2">
              <div className="flex items-center justify-between mb-1">
                <div className="h-3 w-20 bg-slate-200 rounded animate-pulse"></div>
                <div className="p-1.5 rounded-md bg-slate-100">
                  <div className="h-3.5 w-3.5 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="h-6 w-12 bg-slate-200 rounded animate-pulse"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

JobOpeningsMetricsCardsSkeleton.displayName = 'JobOpeningsMetricsCardsSkeleton';
