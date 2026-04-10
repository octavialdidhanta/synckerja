import React from 'react';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const LeadsManagementPageSkeleton = () => (
  <div className="space-y-1">
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="h-3 w-[50%]" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      </div>
    ))}
  </div>
);
