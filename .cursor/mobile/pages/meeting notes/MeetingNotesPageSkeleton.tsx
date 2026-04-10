import React from 'react';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const MeetingNotesPageSkeleton = () => (
  <div className="mx-auto w-full max-w-md px-2 pt-2 space-y-3 content-padding-above-nav-meeting-notes">
    {/* Filters + Input card */}
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-border flex gap-2 flex-wrap">
        <Skeleton className="h-9 flex-1 min-w-[100px] rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="px-2.5 py-1.5 border-b border-border">
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <div className="px-2 py-2 space-y-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
      <div className="border-t border-border px-2 py-2">
        <Skeleton className="h-6 w-32" />
      </div>
    </div>

    {/* Summary cards */}
    <div className="bg-card border border-border rounded-lg shadow-sm">
      <div className="px-2.5 py-2.5 grid grid-cols-2 gap-2">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </div>
  </div>
);
