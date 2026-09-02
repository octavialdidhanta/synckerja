import { Skeleton } from "@/shared/components/ui/skeleton";
import { InventoryPageSkeletonFrame } from "@/6-0-stock-management/layout/InventoryPageSkeletonFrame";

export function InventoryPurchaseOrdersSkeleton() {
  return (
    <InventoryPageSkeletonFrame>
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="min-h-0 flex-1 space-y-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </InventoryPageSkeletonFrame>
  );
}
