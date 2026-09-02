import { Skeleton } from "@/shared/components/ui/skeleton";
import { InventoryPageSkeletonFrame } from "@/6-0-stock-management/layout/InventoryPageSkeletonFrame";

export function InventoryAdjustmentSkeleton() {
  return (
    <InventoryPageSkeletonFrame>
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 flex-1" />
      </div>
      <div className="min-h-0 flex-1 space-y-4 p-4">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-2 h-8 w-16" />
          </div>
          <div className="col-span-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-2 h-8 w-16" />
          </div>
          <div className="col-span-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-2 h-8 w-24" />
          </div>
          <div className="col-span-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="mt-2 h-8 w-24" />
          </div>
        </div>
        <div className="h-10 w-full rounded-md border bg-muted/30" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </InventoryPageSkeletonFrame>
  );
}
