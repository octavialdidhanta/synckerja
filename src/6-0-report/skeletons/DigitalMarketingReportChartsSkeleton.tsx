import { Skeleton } from "@/shared/components/ui/skeleton";

const CHART_TAB_SKELETON_WIDTHS = ["w-14", "w-12", "w-[4.5rem]", "w-[5.5rem]", "w-[7.5rem]", "w-[5.5rem]"] as const;

/** Local chart-area skeleton while monthly spend APIs load (table already visible). */
export function DigitalMarketingReportChartsSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm" aria-busy>
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
    </div>
  );
}
