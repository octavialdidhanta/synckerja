import React from 'react';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const DailyTaskPageSkeleton = () => (
  <div className="space-y-1">
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 shadow-sm"
      >
        <div className="flex items-start gap-2">
          <Skeleton className="mt-1 h-4 w-4 flex-shrink-0 rounded" />
          <div className="flex-1 min-w-0 space-y-1">
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-3 w-[60%]" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-14" />
        </div>
      </div>
    ))}
  </div>
);
