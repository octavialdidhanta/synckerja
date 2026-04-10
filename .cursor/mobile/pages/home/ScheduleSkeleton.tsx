import { Card } from '@/mobile/components/ui/card';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const ScheduleSkeleton = () => (
  <div className="space-y-1">
    <div className="grid grid-cols-2 gap-2">
      <Card className="p-3 bg-gradient-card border border-border">
        <Skeleton className="h-8 w-12 mb-1" />
        <Skeleton className="h-3 w-28" />
      </Card>
      <Card className="p-3 bg-gradient-card border border-border">
        <Skeleton className="h-8 w-12 mb-1" />
        <Skeleton className="h-3 w-32" />
      </Card>
    </div>

    <Card className="p-4 bg-gradient-card border border-border">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </Card>

    <Card className="p-4 bg-gradient-card border border-border">
      <Skeleton className="h-5 w-36 mb-3" />
      <Skeleton className="h-20 w-full rounded" />
    </Card>

    <Card className="p-4 bg-gradient-card border border-border">
      <Skeleton className="h-5 w-32 mb-3" />
      <Skeleton className="h-16 w-full rounded" />
    </Card>
  </div>
);
