import { DailyTaskReportPageSkeleton } from "@/8-2-DailyTaskReport/skeletons/DailyTaskReportPageSkeleton";
import { MobileToolsDailyTaskReportPageSkeletonOverlay } from "@/mobile/5-daily-task-report/pages/MobileToolsDailyTaskReportPageSkeletonOverlay";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";

/**
 * `PageAccessGuard` untuk `/tools/daily-task-report`: viewport tools-mobile memakai overlay
 * yang meniru shell mobile; desktop tetap `DailyTaskReportPageSkeleton` (layout modul web).
 */
export function DailyTaskReportRouteLoadingShell() {
  const useMobileShell = useToolsModuleMobileViewport();
  if (useMobileShell) {
    return <MobileToolsDailyTaskReportPageSkeletonOverlay />;
  }
  return <DailyTaskReportPageSkeleton />;
}
