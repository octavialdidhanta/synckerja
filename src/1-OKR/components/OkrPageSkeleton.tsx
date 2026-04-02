import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Mirrors OKRPage (company / department / individual): same scroll shell, grid, 9+3 columns, Card, sidebar chrome.
 */
export function OkrPageSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-gray-100 font-sans dark:bg-muted/30"
      aria-busy
      aria-label="Loading OKR"
    >
      <div className="flex min-h-0 w-full min-w-0 flex-1">
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <div className="px-1 py-3">
                    <div className="mb-3">
                      <Skeleton className="mb-0.5 h-7 w-52 max-w-[90%]" />
                      <Skeleton className="h-3 w-72 max-w-full" />
                    </div>
                    <div className="-mb-3">
                      <div className="flex space-x-6" aria-hidden>
                        <Skeleton className="h-9 w-40" />
                        <Skeleton className="h-9 w-44" />
                        <Skeleton className="h-9 w-40" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-9 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch overflow-hidden">
                    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col rounded-lg border border-border bg-card text-card-foreground shadow-sm">
                      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col p-0 sm:p-6">
                        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-1">
                          <div className="shrink-0 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Skeleton className="h-6 w-56" />
                              <Skeleton className="h-8 w-40" />
                            </div>
                            <Skeleton className="h-24 w-full rounded-lg sm:h-28" />
                          </div>
                          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col basis-0 space-y-3 overflow-hidden">
                            <Skeleton className="h-14 w-full shrink-0 rounded-lg" />
                            <Skeleton className="min-h-[8rem] w-full flex-1 rounded-lg" />
                            <Skeleton className="h-28 w-full shrink-0 rounded-lg" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex h-full min-h-0 w-full min-w-0 flex-col self-stretch rounded-lg border border-border bg-card shadow-sm">
                    <div className="flex-shrink-0 border-b border-border px-4 py-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="mt-1 h-3 w-full max-w-[200px]" />
                    </div>
                    <div className="min-h-0 flex-1">
                      <div className="h-full min-h-0 space-y-4 p-4">
                        <Skeleton className="h-20 w-full rounded-md" />
                        <Skeleton className="h-24 w-full rounded-md" />
                        <Skeleton className="h-20 w-full rounded-md" />
                      </div>
                    </div>
                    <div className="flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
                      <Skeleton className="h-3 w-full max-w-[220px]" />
                    </div>
                  </div>
                </div>

                <div
                  className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
