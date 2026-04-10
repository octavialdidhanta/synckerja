import React from 'react';
import { Skeleton } from '@/mobile/components/ui/skeleton';

/**
 * Fullscreen loading skeleton for mobile route/guard (auth, subscription check).
 * Used when ProtectedRoute, HomeAccessGuard, etc. are loading so we show skeleton instead of LoadingDots.
 */
export const RouteLoadingSkeleton = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <div className="flex-shrink-0 h-14 border-b border-border bg-card safe-area-top flex items-center px-3">
      <Skeleton className="h-8 w-8 rounded" />
      <Skeleton className="h-5 w-32 ml-3" />
    </div>
    <div className="flex-1 p-4 space-y-3 content-padding-above-nav">
      <Skeleton className="h-6 w-[75%]" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[83%]" />
      <div className="pt-4 space-y-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  </div>
);
