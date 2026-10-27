import { Skeleton } from "@/shared/components/ui/skeleton";
import { InventoryPageSkeletonFrame } from "@/6-0-stock-management/layout/InventoryPageSkeletonFrame";

export function StockManagementDashboardSkeleton() {
  return (
    <InventoryPageSkeletonFrame>
      <div className="flex flex-nowrap items-center gap-2 border-b px-4 py-2">
        <Skeleton className="h-10 w-28 shrink-0" />
        <Skeleton className="h-10 w-[180px] shrink-0" />
        <Skeleton className="h-10 w-40 shrink-0" />
        <Skeleton className="h-10 w-[160px] shrink-0" />
        <Skeleton className="h-10 min-w-[140px] flex-1" />
        <Skeleton className="h-10 w-36 shrink-0" />
        <Skeleton className="h-10 w-24 shrink-0" />
      </div>
      <div className="min-h-0 flex-1 space-y-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </InventoryPageSkeletonFrame>
  );
}
