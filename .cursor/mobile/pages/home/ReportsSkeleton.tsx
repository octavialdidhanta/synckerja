import { Skeleton } from '@/mobile/components/ui/skeleton';

export const ReportsSkeleton = () => (
  <div className="space-y-1">
    <div className="grid grid-cols-2 gap-2">
      <div className="p-3 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-8" />
      </div>
      <div className="p-3 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-12" />
      </div>
    </div>

    <div className="bg-card border border-border rounded-lg">
      <div className="p-3 border-b border-border">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="p-3 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>

    <div className="bg-card border border-border rounded-lg">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <div className="p-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>

    <div className="bg-card border border-border rounded-lg">
      <div className="p-3 border-b border-border">
        <Skeleton className="h-5 w-28" />
      </div>
      <div className="p-3">
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-2 items-center">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="bg-card border border-border rounded-lg">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <div className="p-2">
        <Skeleton className="w-full h-48" />
      </div>
    </div>
  </div>
);
