import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

export type KolManagementPaymentTermsPageSkeletonProps = {
  /**
   * `full` — guard + Suspense (shell + HeaderAndTab + kartu payment terms).
   * `embedded` — overlay area konten; mirror `PaymentTermsPage`.
   */
  variant?: "full" | "embedded";
  className?: string;
};

/** Mirror `PaymentTermsPage` + header tab: baris TabsList + CTA, lalu kartu daftar payment terms. */
function KolManagementPaymentTermsSkeletonMain() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm sm:px-5 sm:py-5">
          <div className="flex shrink-0 min-w-0 flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-[220px] max-w-full rounded-md" />
            <Skeleton className="h-7 w-[160px] shrink-0 rounded-md" />
          </div>

          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden sm:mt-3 sm:gap-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                <div className="space-y-2 border-b border-gray-100 p-3 sm:p-5">
                  <div className="flex flex-wrap items-start gap-2">
                    <Skeleton className="h-5 w-[min(280px,85vw)] rounded-md sm:h-6" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-[min(400px,90vw)] rounded-md sm:h-4" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-7 w-24 rounded-md sm:h-8" />
                    <Skeleton className="h-7 w-28 rounded-md sm:h-8" />
                  </div>
                </div>
                <div className="space-y-2 p-3 sm:space-y-3 sm:p-5">
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Skeleton className="h-14 w-full rounded-md sm:h-16" />
                    <Skeleton className="h-14 w-full rounded-md sm:h-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function KolManagementPaymentTermsPageSkeleton({
  variant = "full",
  className,
}: KolManagementPaymentTermsPageSkeletonProps) {
  if (variant === "embedded") {
    return (
      <div
        className={cn("min-h-0 w-full min-w-0", className)}
        aria-busy
        aria-label="Loading payment terms"
      >
        <span className="sr-only">Loading payment terms</span>
        <KolManagementPaymentTermsSkeletonMain />
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
      aria-label="Loading payment terms"
    >
      <span className="sr-only">Loading payment terms</span>
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
                <KolManagementPaymentTermsSkeletonMain />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
