
import { memo } from 'react';

export const JobOpeningsTableSkeleton = memo(() => {
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-md border border-slate-200/60 shadow-sm overflow-hidden relative">
      {/* Accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/60 via-indigo-500/40 to-purple-500/30"></div>
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-32 bg-slate-200 rounded animate-pulse"></div>
            <div className="h-3 w-64 bg-slate-100 rounded animate-pulse"></div>
          </div>
          <div className="h-9 w-24 bg-slate-200 rounded animate-pulse"></div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="overflow-x-auto">
        {/* Table header */}
        <div className="bg-slate-50/50 border-b border-slate-200 px-4 py-3">
          <div className="grid grid-cols-12 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-3 bg-slate-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>

        {/* Table rows skeleton */}
        {Array.from({ length: 8 }).map((_, rowIndex) => (
          <div key={rowIndex} className="border-b border-slate-100 px-4 py-4 hover:bg-slate-50/30">
            <div className="grid grid-cols-12 gap-4 items-center">
              {/* Job Title */}
              <div className="col-span-2 space-y-1">
                <div className="h-3 bg-slate-200 rounded animate-pulse"></div>
                <div className="h-2 w-3/4 bg-slate-100 rounded animate-pulse"></div>
              </div>
              
              {/* Department */}
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-slate-200 rounded animate-pulse"></div>
                <div className="h-3 w-16 bg-slate-200 rounded animate-pulse"></div>
              </div>
              
              {/* Position, Level, Location */}
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-3 bg-slate-200 rounded animate-pulse"></div>
              ))}
              
              {/* Salary Range */}
              <div className="col-span-2">
                <div className="h-3 bg-slate-200 rounded animate-pulse"></div>
              </div>
              
              {/* Status */}
              <div className="h-5 w-16 bg-slate-200 rounded-full animate-pulse"></div>
              
              {/* Created By */}
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 bg-slate-200 rounded-full animate-pulse"></div>
                <div className="space-y-1">
                  <div className="h-2 w-20 bg-slate-200 rounded animate-pulse"></div>
                  <div className="h-2 w-16 bg-slate-100 rounded animate-pulse"></div>
                </div>
              </div>
              
              {/* Clicks, Submissions */}
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-3 w-8 bg-slate-200 rounded animate-pulse"></div>
              ))}
              
              {/* Posted Date */}
              <div className="flex items-center gap-1">
                <div className="h-3 w-3 bg-slate-200 rounded animate-pulse"></div>
                <div className="h-3 w-16 bg-slate-200 rounded animate-pulse"></div>
              </div>
              
              {/* Actions */}
              <div className="h-6 w-6 bg-slate-200 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

JobOpeningsTableSkeleton.displayName = 'JobOpeningsTableSkeleton';
