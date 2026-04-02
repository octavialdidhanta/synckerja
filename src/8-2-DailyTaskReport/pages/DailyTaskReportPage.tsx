import React from "react";
import { DailyTaskReportModuleShell } from "../layout/DailyTaskReportModuleShell";
import { DailyTaskReportProvider, useDailyTaskReport } from "../context/ReportContext";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { OverviewCards } from "../components/OverviewCards";
import { Filters } from "../components/Filters";
import { PerformanceTable } from "../components/PerformanceTable";
import { BlockersAndUpdatesPanel } from "../components/BlockersAndUpdatesPanel";

const DailyTaskReportContent = () => {
  const { initialLoading, refreshError, retryRefresh } = useDailyTaskReport();
  const showContent = useDebouncedReady(!initialLoading, 250);

  return (
    <DailyTaskReportModuleShell showContent={showContent}>
      <div className="col-span-9 flex flex-col min-h-0 max-h-[calc(100vh-120px)]">
        {refreshError && (
          <div className="mb-1 flex flex-shrink-0 items-center justify-between gap-2 rounded-md border border-brand-blue/25 bg-brand-blue/[0.08] px-3 py-1.5 text-sm text-brand-blue">
            <span>Data mungkin tidak terbarui.</span>
            <button type="button" onClick={retryRefresh} className="rounded border border-brand-blue/30 bg-white px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10">
              Coba lagi
            </button>
          </div>
        )}
        <div className="flex-shrink-0 mb-0.5">
          <OverviewCards />
        </div>
        <div className="flex-shrink-0 px-0 pb-0.5">
          <Filters />
        </div>
        <div className="flex-1 min-h-0">
          <PerformanceTable />
        </div>
      </div>

      <div className="col-span-3 flex flex-col gap-2 min-h-0 max-h-[calc(100vh-120px)]">
        <BlockersAndUpdatesPanel />
      </div>
    </DailyTaskReportModuleShell>
  );
};

export default function DailyTaskReportPage() {
  return (
    <DailyTaskReportProvider>
      <DailyTaskReportContent />
    </DailyTaskReportProvider>
  );
}
