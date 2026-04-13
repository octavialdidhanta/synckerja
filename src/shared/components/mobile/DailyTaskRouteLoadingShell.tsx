import { DailyTaskPageSkeleton } from "@/8-2-DailyTask/skeletons/DailyTaskPageSkeleton";
import { MobileToolsDailyTaskPageSkeletonOverlay } from "@/mobile/5-daily-task/pages/MobileToolsDailyTaskPageSkeletonOverlay";
import { MobileToolsDailyTaskJobDescPageSkeletonOverlay } from "@/mobile/5-job-desc/pages/MobileToolsDailyTaskJobDescPageSkeletonOverlay";
import { MobileToolsDailyTaskInitiativePageSkeletonOverlay } from "@/mobile/5-initiative/pages/MobileToolsDailyTaskInitiativePageSkeletonOverlay";
import { useToolsModuleMobileViewport } from "@/shared/hooks/useToolsModuleMobileViewport";
import { useLocation } from "react-router-dom";

/**
 * `PageAccessGuard` untuk `/tools/daily-task`: mobile `?view=jobdesc` memakai satu file skeleton
 * `MobileToolsDailyTaskJobDescPageSkeletonOverlay`; tampilan lain (desktop / mobile task list, dll.) tetap `DailyTaskPageSkeleton`.
 */
export function DailyTaskRouteLoadingShell() {
  const useMobileShell = useToolsModuleMobileViewport();
  const { search } = useLocation();
  const view = new URLSearchParams(search).get("view");
  const isJobDescView = view === "jobdesc";
  const isInitiativeView = view === "initiative";

  if (!useMobileShell) {
    return <DailyTaskPageSkeleton />;
  }
  if (isJobDescView) {
    return <MobileToolsDailyTaskJobDescPageSkeletonOverlay />;
  }
  if (isInitiativeView) {
    return <MobileToolsDailyTaskInitiativePageSkeletonOverlay />;
  }
  return <MobileToolsDailyTaskPageSkeletonOverlay />;
}
