import { Skeleton } from "@/shared/components/ui/skeleton";

export function XenditSettingsPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-gray-100">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
        <div className="scrollbar-hide flex-1 min-h-0 max-h-[calc(100vh-120px)] overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-2xl space-y-4 py-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
