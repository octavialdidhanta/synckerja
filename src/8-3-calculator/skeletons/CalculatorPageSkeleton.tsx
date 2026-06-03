import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Layout-matched shell for Calculator routes (guard, Suspense, hard refresh).
 */
export function CalculatorPageSkeleton() {
  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans"
      aria-busy
      aria-label="Loading calculator"
    >
      <span className="sr-only">Loading calculator</span>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
          <div className="scrollbar-hide flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
              <div className="mb-1 min-w-0 shrink-0 space-y-3 px-1 py-3">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-72 max-w-full" />
                <div className="flex gap-6">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2 xl:col-span-9">
                  <Skeleton className="min-h-[320px] w-full flex-1 rounded-lg" />
                  <Skeleton className="min-h-[280px] w-full flex-1 rounded-lg" />
                  <Skeleton className="min-h-[280px] w-full flex-1 rounded-lg" />
                </div>
                <div className="col-span-12 flex min-h-0 min-w-0 xl:col-span-3">
                  <Skeleton className="h-full min-h-[400px] w-full rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
