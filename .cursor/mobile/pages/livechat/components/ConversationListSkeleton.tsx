import React from 'react';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const ConversationListSkeleton = () => (
  <div className="p-2 space-y-0">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="flex items-center gap-3 p-3 border-b border-border">
        <Skeleton className="h-10 w-10 flex-shrink-0 rounded-full" />
        <div className="flex-1 min-w-0 space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    ))}
  </div>
);
