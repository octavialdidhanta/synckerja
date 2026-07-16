import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

const REPORT_TABLE_COLUMN_COUNT = 11;
const SUMMARY_SLOT_COUNT = 5;

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

/** Table + KPI phase only — untuk overlay in-page (shell sudah punya HeaderAndTab). */
export function DigitalMarketingReportTablePhaseSkeleton() {
  return (
    <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col gap-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="mt-0.5 h-3 w-full max-w-xl" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Skeleton className="h-9 w-[14rem] shrink-0" />
              <Skeleton className="h-9 min-w-[200px] w-52 max-w-[min(300px,50vw)] shrink-0" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-hidden>
          {Array.from({ length: SUMMARY_SLOT_COUNT }, (_, i) => (
            <div key={i} className="rounded-md border border-gray-200 bg-white px-3 py-2">
              <Skeleton className="mb-1.5 h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] caption-bottom border-collapse text-sm">
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
      </div>
    </div>
  );
}
