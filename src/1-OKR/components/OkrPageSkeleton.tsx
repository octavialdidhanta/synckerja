import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Layout mirror of OKRPage: header strip, main card (9 cols), sidebar (3 cols).
 */
export function OkrPageSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col bg-gray-100 font-sans dark:bg-muted/30"
      aria-busy
      aria-label="Loading OKR"
    >
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-4">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
          {/* Header + tabs */}
          <div className="mb-1 flex-shrink-0 px-1 py-3">
            <Skeleton className="mb-2 h-7 w-48 max-w-[80%]" />
            <Skeleton className="mb-4 h-3 w-72 max-w-full" />
            <div className="flex gap-6 border-b border-border pb-1">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-8 w-36" />
            </div>
          </div>

          <div className="grid h-full min-h-0 min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
            {/* Main card */}
            <div className="col-span-9 flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex h-full min-h-0 flex-1 flex-col p-4 sm:p-6">
                <div className="mb-4 shrink-0 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Skeleton className="h-6 w-56" />
                    <Skeleton className="h-8 w-40" />
                  </div>
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <Skeleton className="h-36 w-full rounded-lg" />
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-span-3 flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="flex-shrink-0 border-b border-border px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-full max-w-[200px]" />
              </div>
              <div className="min-h-0 flex-1 space-y-4 p-4">
                <Skeleton className="h-20 w-full rounded-md" />
                <Skeleton className="h-24 w-full rounded-md" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
              <div className="flex-shrink-0 border-t border-border px-4 py-3">
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
