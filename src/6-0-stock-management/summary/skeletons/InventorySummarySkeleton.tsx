import { Skeleton } from "@/shared/components/ui/skeleton";
import { StockManagementHeaderAndTab } from "@/6-0-stock-management/container/StockManagementHeaderAndTab";

export function InventorySummarySkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
        <div className="scrollbar-hide flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full flex-col">
            <div className="mb-1 flex-shrink-0">
              <StockManagementHeaderAndTab />
            </div>
            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2">
              <div className="col-span-12 flex min-h-[560px] flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap gap-2 border-b px-4 py-3">
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 flex-1" />
                </div>
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            </div>
            <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
