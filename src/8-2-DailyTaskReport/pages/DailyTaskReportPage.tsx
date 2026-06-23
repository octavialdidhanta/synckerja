import React from "react";
import { DailyTaskReportModuleShell } from "../layout/DailyTaskReportModuleShell";
import { DailyTaskReportProvider, useDailyTaskReport } from "../context/ReportContext";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { OverviewCards } from "../components/OverviewCards";
import { Filters } from "../components/Filters";
import { PerformanceTable } from "../components/PerformanceTable";
import { BlockersAndUpdatesPanel } from "../components/BlockersAndUpdatesPanel";
import {
  DAILY_TASK_REPORT_MAIN_GRID,
  DAILY_TASK_REPORT_TABLE_CARD,
} from "../layout/dailyTaskReportLayout";

const DailyTaskReportContent = () => {
  const { initialLoading, refreshError, retryRefresh } = useDailyTaskReport();
  const showContent = useDebouncedReady(!initialLoading, 250);

  return (
    <DailyTaskReportModuleShell showContent={showContent}>
      <div className={DAILY_TASK_REPORT_MAIN_GRID}>
        <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-9">
          <div className="flex h-full min-w-0 flex-1 flex-col gap-2">
            {refreshError && (
              <div className="flex shrink-0 items-center justify-between gap-2 rounded-md border border-brand-blue/25 bg-brand-blue/[0.08] px-3 py-1.5 text-sm text-brand-blue">
                <span>Data mungkin tidak terbaru.</span>
                <button
                  type="button"
                  onClick={retryRefresh}
                  className="rounded border border-brand-blue/30 bg-white px-2 py-1 text-xs font-medium text-brand-blue hover:bg-brand-blue/10"
                >
                  Coba lagi
                </button>
              </div>
            )}

            <div className="shrink-0">
              <OverviewCards />
            </div>

            <div className="shrink-0">
              <Filters />
            </div>

            <div className={DAILY_TASK_REPORT_TABLE_CARD}>
              <PerformanceTable />
            </div>
          </div>
        </div>

        <div className="col-span-12 flex h-full min-w-0 flex-col xl:col-span-3">
          <BlockersAndUpdatesPanel />
        </div>
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
