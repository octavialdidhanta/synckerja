import React from 'react';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const DailyTaskReportPageSkeleton = () => (
  <div className="space-y-1">
    {/* Filters skeleton */}
    <div className="bg-card border border-border rounded-lg shadow-sm p-2">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 flex-1 min-w-[120px] rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>

    {/* Overview cards skeleton */}
    <div className="bg-card border border-border rounded-lg shadow-sm p-2">
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>

    {/* Performance table skeleton */}
    <div className="bg-card border border-border rounded-lg shadow-sm p-2 space-y-2">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-8 w-20 rounded" />
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="border border-border rounded-lg p-3 space-y-2">
          <div className="flex justify-between gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>

    {/* Blockers/Updates panel skeleton */}
    <div className="bg-card border border-border rounded-lg shadow-sm">
      <div className="p-2 border-b border-border flex gap-2">
        <Skeleton className="h-9 w-24 rounded" />
        <Skeleton className="h-9 w-24 rounded" />
      </div>
      <div className="p-2 space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-md" />
        ))}
      </div>
    </div>
  </div>
);
