import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { SocialMediaInsightReportChartsSkeleton } from "@/6-0-social-media-report/skeletons/SocialMediaInsightReportChartsSkeleton";

const TABLE_COLUMN_COUNT = 12;
const SUMMARY_SLOT_COUNT = 6;
const CHART_TAB_WIDTHS = ["w-12", "w-14", "w-[4.75rem]", "w-[7.25rem]"] as const;

/** Columns 2–9 (Audience → Plan matched) are right-aligned like the live table. */
function isNumericColumn(columnIndex: number): boolean {
  return columnIndex >= 2 && columnIndex <= 9;
}

function AccountTableRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: TABLE_COLUMN_COUNT }, (_, i) => (
        <td key={i} className="px-3 py-3 align-middle">
          <Skeleton className={cn("h-4", isNumericColumn(i) ? "ml-auto h-5 w-14" : "w-20")} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Mirrors live report body: filter card, 6 KPI cards, 12-column account table, monthly charts.
 * Used as the in-page overlay (shell already has HeaderAndTab).
 */
export function SocialMediaInsightReportTablePhaseSkeleton() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 gap-2 items-stretch [grid-template-rows:minmax(0,1fr)]">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="mt-1.5 h-3 w-full max-w-xl" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Skeleton className="h-9 w-[11rem]" />
              <Skeleton className="h-9 w-52" />
              <Skeleton className="h-9 w-[8.5rem]" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </div>

        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6"
          aria-busy
          aria-hidden
        >
          {Array.from({ length: SUMMARY_SLOT_COUNT }, (_, i) => (
            <div
              key={i}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 shadow-sm"
            >
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-1 h-6 w-20" />
              <Skeleton className="mt-0.5 h-3 w-20" />
              <div className="mt-2 min-h-[1.125rem]">
                <Skeleton className="h-1.5 w-full" />
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] caption-bottom border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {Array.from({ length: TABLE_COLUMN_COUNT }, (_, i) => (
                    <th
                      key={i}
                      className={cn(
                        "h-10 whitespace-nowrap bg-gray-50 px-3 text-left align-middle",
                        isNumericColumn(i) && "text-right",
                      )}
                    >
                      <Skeleton
                        className={cn("h-4", isNumericColumn(i) ? "ml-auto w-14" : "w-16")}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AccountTableRowSkeleton />
                <AccountTableRowSkeleton />
                <AccountTableRowSkeleton />
                <AccountTableRowSkeleton />
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-4 w-28" />
            <div
              className="inline-flex h-9 flex-wrap items-center gap-1 rounded-md bg-gray-100 p-1"
              aria-hidden
            >
              {CHART_TAB_WIDTHS.map((widthClass, i) => (
                <Skeleton key={i} className={cn("h-7 rounded-sm", widthClass)} />
              ))}
            </div>
          </div>
          <SocialMediaInsightReportChartsSkeleton />
        </div>
      </div>
    </div>
  );
}
