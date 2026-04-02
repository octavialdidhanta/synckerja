import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Layout mirror of ModernHomePage for full-page loading overlay.
 */
export function ModernHomePageSkeleton() {
  return (
    <div
      className="flex min-h-full min-h-0 flex-col bg-background font-sans text-foreground"
      aria-busy
      aria-label="Loading home"
    >
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="flex min-h-full min-h-0 flex-col">
            {/* Motivation strip */}
            <div className="mb-2 mt-2 flex-shrink-0">
              <div className="min-h-[70px] rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-[55%] max-w-md" />
                    <Skeleton className="h-3 w-[40%] max-w-sm" />
                  </div>
                  <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
                </div>
              </div>
            </div>

            <div className="grid min-h-[calc(100dvh-210px)] flex-1 grid-cols-12 gap-2 [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
              {/* Profile column */}
              <div className="col-span-3 flex h-full min-h-0 flex-col">
                <div className="flex h-full min-h-0 flex-1 flex-col">
                  <div className="space-y-2">
                    <div className="rounded-lg border border-border p-4">
                      <div className="mb-4 flex items-center gap-3">
                        <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 rounded-lg border border-border p-3">
                      <Skeleton className="mb-3 h-5 w-48" />
                      <Skeleton className="mb-2 h-24 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* OKR column */}
              <div className="col-span-6 flex h-full min-h-0 flex-col">
                <div className="flex h-full min-h-0 flex-1 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <Skeleton className="h-6 w-64" />
                      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
                      <div className="flex shrink-0 gap-1 p-2">
                        <Skeleton className="h-9 flex-1 rounded-md" />
                        <Skeleton className="h-9 flex-1 rounded-md" />
                        <Skeleton className="h-9 flex-1 rounded-md" />
                      </div>
                      <div className="min-h-0 flex-1 space-y-3 p-3">
                        <Skeleton className="h-24 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-28 w-full rounded-lg" />
                        <Skeleton className="h-36 w-full rounded-lg" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity column */}
              <div className="col-span-3 flex h-full min-h-0 flex-col">
                <div className="flex h-full min-h-0 flex-1 flex-col">
                  <div className="rounded-lg border border-border p-3">
                    <Skeleton className="mb-3 h-5 w-40" />
                    <Skeleton className="mb-2 h-10 w-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full rounded-md" />
                      <Skeleton className="h-16 w-full rounded-md" />
                      <Skeleton className="h-16 w-full rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Status row */}
            <div className="mt-2 flex-shrink-0">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="h-14 w-full rounded-md" />
              </div>
            </div>
            <div className="h-4 flex-shrink-0" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
