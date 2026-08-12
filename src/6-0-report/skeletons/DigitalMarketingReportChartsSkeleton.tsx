import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

const CHART_TAB_SKELETON_WIDTHS = ["w-14", "w-12", "w-[4.5rem]", "w-[5.5rem]", "w-[7.5rem]", "w-[5.5rem]"] as const;

type Props = {
  variant?: "default" | "mobile";
};

/** Local chart-area skeleton while monthly spend APIs load (table already visible). */
export function DigitalMarketingReportChartsSkeleton({ variant = "default" }: Props) {
  const isMobile = variant === "mobile";

  return (
    <div
      className={cn(
        "overflow-hidden",
        isMobile
          ? "border-y border-border bg-card"
          : "rounded-lg border border-gray-200 bg-white p-4 shadow-sm",
      )}
      aria-busy
    >
      {isMobile ? (
        <>
          <div
            className={cn(
              "scrollbar-hide min-w-0 overflow-x-auto overflow-y-hidden",
              "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            )}
            aria-hidden
          >
            <div className="inline-flex items-center gap-2 pt-3">
              <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
              <div className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-gray-100 p-1">
                {CHART_TAB_SKELETON_WIDTHS.map((widthClass, i) => (
                  <Skeleton key={i} className={`h-7 rounded-sm ${widthClass}`} />
                ))}
              </div>
              <Skeleton className="h-9 w-[11.5rem] shrink-0" />
              <span className="inline-block w-4 shrink-0 grow-0 basis-4" aria-hidden />
            </div>
          </div>
          <Skeleton className="mx-3 mt-2 h-3 w-full max-w-sm" />
          <div className="px-4 pb-3 pt-2">
            <Skeleton className="h-[220px] w-full rounded-md" />
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div
                className="inline-flex h-9 flex-wrap items-center gap-1 rounded-md bg-gray-100 p-1"
                aria-hidden
              >
                {CHART_TAB_SKELETON_WIDTHS.map((widthClass, i) => (
                  <Skeleton key={i} className={`h-7 rounded-sm ${widthClass}`} />
                ))}
              </div>
              <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
            </div>
            <Skeleton className="h-9 w-[11.5rem] shrink-0" />
          </div>
          <Skeleton className="h-[300px] w-full rounded-md" />
        </>
      )}
    </div>
  );
}
