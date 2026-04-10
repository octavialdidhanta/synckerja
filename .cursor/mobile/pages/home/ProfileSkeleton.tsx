import { Card } from '@/mobile/components/ui/card';
import { Skeleton } from '@/mobile/components/ui/skeleton';

export const ProfileSkeleton = () => (
  <div className="space-y-1">
    <Card className="bg-gradient-card border border-border">
      <div className="p-4 text-center">
        <Skeleton className="w-20 h-20 rounded-full mx-auto mb-3" />
        <Skeleton className="h-6 w-32 mx-auto mb-1" />
        <Skeleton className="h-4 w-24 mx-auto" />
      </div>
    </Card>

    <Card className="bg-gradient-card border border-border">
      <div className="p-3 border-b border-border">
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="p-3 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1">
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    </Card>

    <Card className="bg-gradient-card border border-border">
      <div className="p-3 border-b border-border">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="p-2 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </Card>

    <div className="space-y-1">
      <Skeleton className="w-full h-12 rounded-lg" />
      <Skeleton className="w-full h-12 rounded-lg" />
    </div>
  </div>
);
