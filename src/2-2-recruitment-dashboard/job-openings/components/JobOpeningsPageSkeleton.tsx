import { memo } from 'react';

const SkeletonShimmer = ({ className }: { className: string }) => (
  <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
);

export const JobOpeningsPageSkeleton = memo(() => {
  return (
    <div className="p-2 flex gap-2 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 min-h-full">
      {/* Main Content - Left Side */}
      <div style={{ flex: '1.8' }} className="space-y-2">
        {/* Filters Skeleton */}
        <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200/60 p-3 mb-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <SkeletonShimmer className="h-8 w-[200px]" />
            <SkeletonShimmer className="h-8 w-[130px]" />
            <SkeletonShimmer className="h-8 w-[130px]" />
            <SkeletonShimmer className="h-8 w-[130px]" />
            <SkeletonShimmer className="h-8 w-[130px]" />
            <div className="flex items-center gap-1 ml-auto">
              <SkeletonShimmer className="h-8 w-[140px]" />
              <SkeletonShimmer className="h-8 w-[80px]" />
            </div>
          </div>
        </div>
        
        {/* Metrics Cards Skeleton */}
        <div className="mb-2">
          <div className="grid grid-cols-4 gap-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-white/95 backdrop-blur-sm rounded-lg border border-slate-200/50 p-2 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-200 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/10 to-blue-50/10 pointer-events-none"></div>
                <div className="relative px-2">
                  <div className="flex items-center justify-between mb-1">
                    <SkeletonShimmer className="h-3 w-20" />
                    <div className="p-1.5 rounded-md bg-slate-100">
                      <SkeletonShimmer className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <SkeletonShimmer className="h-6 w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Main Table Skeleton */}
        <div className="bg-white/95 backdrop-blur-sm rounded-md border border-slate-200/60 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500/60 via-indigo-500/40 to-purple-500/30"></div>
          
          {/* Header */}
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <SkeletonShimmer className="h-5 w-32" />
                <SkeletonShimmer className="h-3 w-64" />
              </div>
              <SkeletonShimmer className="h-9 w-24" />
            </div>
          </div>

          {/* Table skeleton */}
          <div className="overflow-x-auto">
            {/* Table header */}
            <div className="bg-slate-50/50 border-b border-slate-200 px-4 py-3">
              <div className="grid grid-cols-12 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonShimmer key={i} className="h-3" />
                ))}
              </div>
            </div>

            {/* Table rows skeleton */}
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <div key={rowIndex} className="border-b border-slate-100 px-4 py-4 hover:bg-slate-50/30">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Job Title */}
                  <div className="col-span-2 space-y-1">
                    <SkeletonShimmer className="h-3" />
                    <SkeletonShimmer className="h-2 w-3/4" />
                  </div>
                  
                  {/* Department */}
                  <div className="flex items-center gap-2">
                    <SkeletonShimmer className="h-3 w-3" />
                    <SkeletonShimmer className="h-3 w-16" />
                  </div>
                  
                  {/* Position, Level, Location */}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonShimmer key={i} className="h-3" />
                  ))}
                  
                  {/* Salary Range */}
                  <div className="col-span-2">
                    <SkeletonShimmer className="h-3" />
                  </div>
                  
                  {/* Status */}
                  <SkeletonShimmer className="h-5 w-16 rounded-full" />
                  
                  {/* Created By */}
                  <div className="flex items-center gap-2">
                    <SkeletonShimmer className="h-6 w-6 rounded-full" />
                    <div className="space-y-1">
                      <SkeletonShimmer className="h-2 w-20" />
                      <SkeletonShimmer className="h-2 w-16" />
                    </div>
                  </div>
                  
                  {/* Clicks, Submissions */}
                  {Array.from({ length: 2 }).map((_, i) => (
                    <SkeletonShimmer key={i} className="h-3 w-8" />
                  ))}
                  
                  {/* Posted Date */}
                  <div className="flex items-center gap-1">
                    <SkeletonShimmer className="h-3 w-3" />
                    <SkeletonShimmer className="h-3 w-16" />
                  </div>
                  
                  {/* Actions */}
                  <SkeletonShimmer className="h-6 w-6" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar Skeleton - Right Side */}
      <div style={{ flex: 'none', width: '480px' }} className="bg-white/90 backdrop-blur-sm rounded-md border border-slate-200/60 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/40 via-indigo-400/30 to-purple-400/20"></div>
        
        {/* Header */}
        <div className="p-3 border-b border-slate-100/80 bg-gradient-to-r from-blue-50/30 to-white">
          <SkeletonShimmer className="h-4 w-48 mb-1" />
          <SkeletonShimmer className="h-3 w-64" />
        </div>

        <div className="p-2 space-y-3">
          {/* Performance Overview */}
          <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-lg p-3 border border-blue-100/60">
            <div className="flex items-center gap-2 mb-2">
              <SkeletonShimmer className="h-4 w-4" />
              <SkeletonShimmer className="h-3 w-32" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/70 rounded-md p-2">
                <SkeletonShimmer className="h-3 w-20 mb-1" />
                <SkeletonShimmer className="h-5 w-12" />
              </div>
              <div className="bg-white/70 rounded-md p-2">
                <SkeletonShimmer className="h-3 w-20 mb-1" />
                <SkeletonShimmer className="h-5 w-12" />
              </div>
            </div>
          </div>

          {/* Repeat similar pattern for other sections */}
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="bg-gradient-to-br from-slate-50/50 to-gray-50/30 rounded-lg p-3 border border-slate-100/60">
              <div className="flex items-center gap-2 mb-2">
                <SkeletonShimmer className="h-4 w-4" />
                <SkeletonShimmer className="h-3 w-24" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white/70 rounded-md p-2">
                    <SkeletonShimmer className="h-3 w-full mb-1" />
                    <SkeletonShimmer className="h-2 w-2/3" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

JobOpeningsPageSkeleton.displayName = 'JobOpeningsPageSkeleton';
