import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { ToolsHeaderAndTab } from "@/shared/layouts/tools";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { DailyTaskReportPageSkeleton } from "../skeletons/DailyTaskReportPageSkeleton";
import { DAILY_TASK_REPORT_MAIN_SCROLL } from "../layout/dailyTaskReportLayout";

type DailyTaskReportModuleShellProps = {
  children: ReactNode;
  showContent: boolean;
};

const MAIN_SCROLL = DAILY_TASK_REPORT_MAIN_SCROLL;

/**
 * Shell `/tools/daily-task-report` — header ikut scroll; grid 9+3 di dalam children (bukan di gate flex-col).
 */
export function DailyTaskReportModuleShell({
  children,
  showContent,
}: DailyTaskReportModuleShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          "flex min-h-0 w-full min-w-0 flex-1 flex-col",
          !showContent && "pointer-events-none invisible select-none",
        )}
        aria-hidden={!showContent}
      >
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
            <div className={cn(MAIN_SCROLL, "min-w-0")}>
              <div className="flex min-h-full min-w-0 flex-col bg-muted/40">
                <div className="mb-1 min-w-0 shrink-0">
                  <ToolsHeaderAndTab activeTab="daily-task-report" onTabChange={() => {}} />
                </div>

                <ModuleShellContentGate pagePath="/tools/daily-task-report">
                  {children}
                </ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!showContent ? (
        <div
          className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
          aria-busy
        >
          <DailyTaskReportPageSkeleton />
        </div>
      ) : null}
    </div>
  );
}
