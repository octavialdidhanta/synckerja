import React from 'react';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const AbsensiSkeleton = () => (
  <div className="space-y-1">
    <div className="bg-card border border-border rounded-lg p-6 text-center">
      <Skeleton className="h-12 w-48 mx-auto mb-2" />
      <Skeleton className="h-6 w-32 mx-auto" />
    </div>

    <div>
      <div className="bg-card border border-border rounded-lg p-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>

    <div>
      <div className="bg-card border border-border rounded-lg p-4">
        <Skeleton className="h-5 w-40 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>

    <div>
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>

    <div>
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="h-14 rounded-md" />
      </div>
    </div>
  </div>
);
