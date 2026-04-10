import React from 'react';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const InitiativePageSkeleton = () => (
  <div className="space-y-1">
    {/* Stats card skeleton */}
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-8" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-8" />
        </div>
      </div>
    </div>

    {/* Initiative cards skeleton */}
    <div className="space-y-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-14 rounded" />
          </div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-4/5 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  </div>
);
