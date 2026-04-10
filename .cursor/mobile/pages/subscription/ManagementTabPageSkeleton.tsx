import React from 'react';
import { Card } from '@/mobile/components/ui/card';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const ManagementTabPageSkeleton = () => (
  <div className="space-y-1">
    <Card className="border border-border p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-6 w-16 rounded" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-3 w-[75%] mb-3" />
      <Skeleton className="h-2 w-full rounded-full" />
    </Card>

    <div className="grid grid-cols-2 gap-2">
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </div>

    <Card className="border border-border">
      <div className="p-3 border-b border-border">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="p-3 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={`management-skeleton-${i}`} className="h-12 w-full rounded" />
        ))}
      </div>
    </Card>
  </div>
);
