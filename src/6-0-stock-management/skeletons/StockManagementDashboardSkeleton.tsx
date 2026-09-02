import { Skeleton } from "@/shared/components/ui/skeleton";
import { InventoryPageSkeletonFrame } from "@/6-0-stock-management/layout/InventoryPageSkeletonFrame";

export function StockManagementDashboardSkeleton() {
  return (
    <InventoryPageSkeletonFrame>
      <div className="border-b border-gray-100 px-4 py-3">
        <Skeleton className="h-5 w-64" />
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
