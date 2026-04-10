import React from 'react';
import { Card } from '@/mobile/components/ui/card';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const OverviewTabPageSkeleton = () => (
  <div className="space-y-1">
    <Card className="border border-border p-4">
      <div className="flex justify-between items-start mb-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-6 w-14 rounded" />
      </div>
      <Skeleton className="h-4 w-full" />
    </Card>

    <Card className="border border-border p-4">
      <Skeleton className="h-5 w-28 mb-3" />
      <Skeleton className="h-40 w-full rounded" />
    </Card>

    <div className="grid grid-cols-2 gap-2">
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
    </div>
  </div>
);
