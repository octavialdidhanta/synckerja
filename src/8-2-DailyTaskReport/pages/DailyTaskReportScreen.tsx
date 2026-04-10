import { DailyTaskReportProvider, useDailyTaskReport } from "../context/ReportContext";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { OverviewCards } from "../components/OverviewCards";
import { Filters } from "../components/Filters";
import { PerformanceTable } from "../components/PerformanceTable";
import { BlockersAndUpdatesPanel } from "../components/BlockersAndUpdatesPanel";
import { DailyTaskReportPageSkeleton } from "../skeletons/DailyTaskReportPageSkeleton";
import { cn } from "@/shared/lib/utils";

const scroll =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function DailyTaskReportMobileBody() {
  const { initialLoading, refreshError, retryRefresh } = useDailyTaskReport();
  const showContent = useDebouncedReady(!initialLoading, 250);

  if (!showContent) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-100" aria-busy>
        <DailyTaskReportPageSkeleton />
      </div>
    );
  }

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col bg-gray-100", scroll)}>
      <div className="flex min-h-full flex-col gap-2 bg-muted/40 px-3 pb-4 pt-2">
        {refreshError && (
          <div className="mb-1 flex flex-shrink-0 items-center justify-between gap-2 rounded-md border border-brand-blue/25 bg-brand-blue/[0.08] px-3 py-1.5 text-sm text-brand-blue">
            <span>Data mungkin tidak terbarui.</span>
            <button
              type="button"
              onClick={retryRefresh}
              className="rounded border border-brand-blue/30 bg-white px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10"
            >
              Coba lagi
            </button>
          </div>
        )}
        <div className="flex-shrink-0">
          <OverviewCards />
        </div>
        <div className="flex-shrink-0">
          <Filters />
        </div>
        <div className="min-h-0 flex-1">
          <PerformanceTable />
        </div>
        <div className="min-h-0 flex-1">
          <BlockersAndUpdatesPanel />
        </div>
      </div>
    </div>
  );
}

/** Mobile / native shell: provider + konten bertumpuk tanpa `DailyTaskReportModuleShell` desktop. */
export function DailyTaskReportScreen() {
  return (
    <DailyTaskReportProvider>
      <DailyTaskReportMobileBody />
    </DailyTaskReportProvider>
  );
}
