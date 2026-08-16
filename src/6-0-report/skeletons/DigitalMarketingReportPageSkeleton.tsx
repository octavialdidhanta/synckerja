import { Skeleton } from "@/shared/components/ui/skeleton";
import { HeaderAndTab } from "@/6-0-traffic/container/HeaderAndTab";
import { cn } from "@/shared/lib/utils";

const REPORT_TABLE_COLUMN_COUNT = 11;
const SUMMARY_SLOT_COUNT = 5;
const CHART_TAB_SKELETON_WIDTHS = ["w-14", "w-12", "w-[4.5rem]", "w-[5.5rem]", "w-[7.5rem]", "w-[5.5rem]"] as const;

/** Mirrors `DigitalMarketingReportTable` column alignment for skeleton cells. */
function reportTableSkeletonClass(columnIndex: number): string {
  const isRight = columnIndex >= 2 && columnIndex !== 4 && columnIndex !== 5;
  return cn("h-4", isRight ? "ml-auto h-5 w-16" : "w-20");
}

function ReportTableRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: REPORT_TABLE_COLUMN_COUNT }, (_, i) => (
        <td key={i} className="px-3 py-3 align-middle">
          <Skeleton className={reportTableSkeletonClass(i)} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Layout-matched skeleton for `/digital-marketing/report`.
 * Mirrors live page: header/filters, 5 KPI slots, 11-column table, 6 chart tabs + channel filter.
 */
export function DigitalMarketingReportPageSkeleton() {
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-2">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>

              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                <div className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2">
                  {/* Report header card — same as DigitalMarketingReportPage */}
                  <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 shrink-0">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="mt-0.5 h-3 w-full max-w-xl" />
                        <Skeleton className="mt-1 h-3 w-full max-w-md" />
                      </div>
                      <div className="nested-scroll-touch-chain-xy min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                        <div className="flex w-max min-w-full items-center justify-end gap-2">
                          <Skeleton className="h-9 w-[14rem] shrink-0" />
                          <Skeleton className="h-9 min-w-[200px] w-52 shrink-0" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary bar — grid-cols-2 sm:grid-cols-3 lg:grid-cols-5, 5 slots */}
                  <div
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
                    aria-busy="true"
                    aria-hidden
                  >
                    {Array.from({ length: SUMMARY_SLOT_COUNT }, (_, i) => (
                      <div
                        key={i}
                        className="rounded-md border border-gray-200 bg-white px-3 py-2"
                      >
                        <Skeleton className="mb-1.5 h-3 w-16" />
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="mt-0.5 h-3 w-20" />
                        <Skeleton className="mt-2 h-1.5 w-full" />
                      </div>
                    ))}
                  </div>

                  {/* Service table — min-w-[1040px], 11 columns, 4 loading rows */}
        <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="nested-scroll-touch-chain-xy seamless-scroll min-w-0 w-full overflow-x-auto overflow-y-hidden">
            <table className="w-max min-w-[1040px] caption-bottom border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            {Array.from({ length: REPORT_TABLE_COLUMN_COUNT }, (_, i) => (
                              <th
                                key={i}
                                className={cn(
                                  "h-10 whitespace-nowrap bg-gray-50 px-3 text-left align-middle",
                                  i >= 2 && i !== 4 && i !== 5 && "text-right",
                                )}
                              >
                                <Skeleton
                                  className={cn(
                                    "h-4",
                                    i >= 2 && i !== 4 && i !== 5 ? "ml-auto w-14" : "w-16",
                                  )}
                                />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <ReportTableRowSkeleton />
                          <ReportTableRowSkeleton />
                          <ReportTableRowSkeleton />
                          <ReportTableRowSkeleton />
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Monthly charts — TabsList h-9, 6 tabs (All services default), channel filter 11.5rem */}
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 min-w-0">
                      <div className="nested-scroll-touch-chain-xy min-w-0 w-full overflow-x-auto overflow-y-hidden">
                        <div className="inline-flex w-max min-w-full items-center gap-2">
                          <div
                            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-gray-100 p-1"
                            aria-hidden
                          >
                            {CHART_TAB_SKELETON_WIDTHS.map((widthClass, i) => (
                              <Skeleton key={i} className={cn("h-7 rounded-sm", widthClass)} />
                            ))}
                          </div>
                          <Skeleton className="h-9 w-[11.5rem] shrink-0" />
                        </div>
                      </div>
                      <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
                      <Skeleton className="mt-1 h-3 w-full max-w-lg" />
                    </div>
                    <Skeleton className="h-[300px] w-full rounded-md" />
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
  );
}
