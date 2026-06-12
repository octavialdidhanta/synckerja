import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

export type KolManagementKolManagementPageSkeletonProps = {
  /**
   * `full` — guard + Suspense (shell + HeaderAndTab + grid 9+3).
   * `embedded` — overlay area konten saja; mirror `KOLManagementPage`.
   */
  variant?: "full" | "embedded";
  className?: string;
};

/** Mirror `KOLManagementPage`: filter bar, 4 metrik, tabel utama, sidebar overview. */
function KolManagementKolManagementSkeletonMain() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-9">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex-shrink-0">
            <div className="rounded-md border border-gray-200 bg-white p-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <Skeleton className="h-9 min-w-[120px] flex-1 rounded-md" />
                <Skeleton className="h-9 w-full rounded-md sm:w-36 lg:w-40" />
                <Skeleton className="h-9 w-full rounded-md sm:w-36 lg:w-40" />
                <Skeleton className="h-9 w-full rounded-md sm:w-36 lg:w-40" />
                <Skeleton className="h-9 w-full rounded-md sm:w-36 lg:w-40" />
                <Skeleton className="h-9 w-28 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            </div>
          </div>

          <div className="mb-2 flex-shrink-0">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "border-blue-200 bg-blue-50/80",
                "border-green-200 bg-green-50/80",
                "border-purple-200 bg-purple-50/80",
                "border-orange-200 bg-orange-50/80",
              ].map((cardClass, i) => (
                <div key={i} className={`rounded-md border p-4 ${cardClass}`}>
                  <Skeleton className="mb-3 h-4 w-24 rounded-md bg-gray-200/90" />
                  <Skeleton className="mb-1 h-8 w-16 rounded-md bg-gray-200/90" />
                  <Skeleton className="h-3 w-20 rounded-md bg-gray-200/90" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50 px-3 py-2">
                <div className="flex gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-3 w-16 rounded md:w-20" />
                  ))}
                </div>
              </div>
              <div className="flex-1 space-y-3 p-3">
                {Array.from({ length: 8 }).map((_, r) => (
                  <div key={r} className="flex gap-3 border-b border-gray-50 pb-3 last:border-0">
                    <Skeleton className="h-10 w-40 shrink-0 rounded-md" />
                    <Skeleton className="h-10 flex-1 rounded-md" />
                    <Skeleton className="h-10 w-24 shrink-0 rounded-md" />
                    <Skeleton className="hidden h-10 w-20 shrink-0 rounded-md lg:block" />
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                <Skeleton className="h-4 w-48 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-12 flex min-h-[400px] min-w-0 flex-col xl:col-span-3">
        <div className="flex h-full min-h-[400px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex-shrink-0 border-b border-gray-100 bg-gray-50/80 px-4 py-1.5">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="mt-1 h-3 w-40 rounded-md" />
          </div>
          <div className="flex-1 space-y-3 overflow-hidden p-4">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
          <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50 px-4 py-3">
            <Skeleton className="h-4 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function KolManagementKolManagementPageSkeleton({
  variant = "full",
  className,
}: KolManagementKolManagementPageSkeletonProps) {
  if (variant === "embedded") {
    return (
      <div
        className={cn("min-h-0 w-full min-w-0", className)}
        aria-busy
        aria-label="Loading KOL management"
      >
        <span className="sr-only">Loading KOL management</span>
        <KolManagementKolManagementSkeletonMain />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans",
        className,
      )}
      aria-busy
      aria-label="Loading KOL management"
    >
      <span className="sr-only">Loading KOL management</span>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full flex-col px-4 pb-2">
            <div className="flex min-h-full flex-1 flex-col">
              <div className="mb-1 flex-shrink-0 px-1 py-3">
                <div className="mb-3">
                  <Skeleton className="h-7 w-[min(280px,55vw)] max-w-sm rounded-md" />
                  <Skeleton className="mt-2 h-3 w-[min(360px,85vw)] max-w-md rounded-md" />
                </div>
                <div className="-mb-3">
                  <nav className="flex flex-wrap gap-x-4 gap-y-2 sm:space-x-6 sm:gap-x-0" aria-hidden>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-[100px] rounded-none sm:w-[112px]" />
                    ))}
                  </nav>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
                <KolManagementKolManagementSkeletonMain />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
